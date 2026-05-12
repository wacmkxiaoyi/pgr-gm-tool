from __future__ import annotations

import contextlib
import math
import time
from typing import Literal
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import InventoryItemRecord, InventoryListResponse
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
from backend.app.services.player.player_items import get_item_name_map
from backend.app.services.player.utils import normalize_search_keyword, parse_optional_int


INVENTORY_COLLECTION_NAME = "inventory"
ITEM_PAGE_SIZE = 10
EXCLUDED_ITEM_ID_MIN = 1
EXCLUDED_ITEM_ID_MAX = 18
InventorySortField = Literal["item_id", "name", "quantity"]
InventorySortOrder = Literal["asc", "desc"]
INVENTORY_ITEMS_SCHEMA_PATH = "items"
INVENTORY_ITEM_SCHEMA_PATH = "items.0"


def _is_item_id_protected(item_id: int) -> bool:
    return EXCLUDED_ITEM_ID_MIN <= item_id <= EXCLUDED_ITEM_ID_MAX


def _inventory_sort_key(item: InventoryItemRecord, item_name_map: dict[int, str], sort_by: InventorySortField) -> tuple[Any, int]:
    if sort_by == "quantity":
        return item.quantity, item.item_id

    if sort_by == "name":
        return str(item_name_map.get(item.item_id, "")).strip().lower(), item.item_id

    return item.item_id, item.item_id


class PlayerItemsService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime
        self._collection_schema = schema_runtime.get_collection_schema(INVENTORY_COLLECTION_NAME)

    def _get_inventory_schema(self) -> CompiledCollectionSchema:
        if self._collection_schema is None:
            raise RuntimeError(f"Missing schema for collection: {INVENTORY_COLLECTION_NAME}")
        return self._collection_schema

    def _sanitize_raw_items(self, raw_items: Any) -> list[dict[str, Any]]:
        sanitized = self._get_inventory_schema().sanitize_read(raw_items, INVENTORY_ITEMS_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def sanitize_inventory_items(self, raw_items: Any) -> list[dict[str, Any]]:
        return self._sanitize_raw_items(raw_items)

    def _normalize_inventory_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        return self._get_inventory_schema().normalize_update_fields(update_fields)

    def _sanitize_inventory_document(self, document: Any) -> dict[str, Any]:
        sanitized = self._get_inventory_schema().sanitize_document(document)
        return sanitized if isinstance(sanitized, dict) else {}

    def inventory_item_template(self, item_id: int, quantity: int) -> dict[str, Any]:
        now = int(time.time())
        item_document = self._get_inventory_schema().materialize_write({
            "_id": item_id,
            "Count": Int64(quantity),
            "BuyTimes": 0,
            "TotalBuyTimes": 0,
            "LastBuyTime": Int64(0),
            "RefreshTime": Int64(0),
            "CreateTime": Int64(now),
        }, INVENTORY_ITEM_SCHEMA_PATH)

        if not isinstance(item_document, dict):
            raise RuntimeError("Failed to materialize inventory item schema")

        if "Count" in item_document:
            item_document["Count"] = Int64(quantity)
        for time_field in ("LastBuyTime", "RefreshTime", "CreateTime"):
            if time_field not in item_document:
                continue
            item_document[time_field] = Int64(now if time_field == "CreateTime" else 0)

        return item_document

    async def list_inventory_items(
        self,
        uid: int,
        page: int = 1,
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: InventorySortField = "item_id",
        sort_order: InventorySortOrder = "asc",
    ) -> InventoryListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ITEM_PAGE_SIZE if page_size <= 0 else min(int(page_size), ITEM_PAGE_SIZE)
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        raw_items = self._sanitize_raw_items(document.get("items") if isinstance(document, dict) else [])
        item_name_map = get_item_name_map()
        normalized_items: list[InventoryItemRecord] = []
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                continue

            item_id = parse_optional_int(raw_item.get("_id"))
            quantity = parse_optional_int(raw_item.get("Count"))
            if item_id is None or quantity is None:
                continue

            if _is_item_id_protected(item_id):
                continue

            if normalized_keyword:
                item_name = str(item_name_map.get(item_id, "")).strip().lower()
                if normalized_keyword not in item_name:
                    continue

            normalized_items.append(InventoryItemRecord(item_id=item_id, quantity=quantity))

        normalized_items.sort(
            key=lambda item: _inventory_sort_key(item, item_name_map, sort_by),
            reverse=sort_order == "desc",
        )

        total = len(normalized_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return InventoryListResponse(
            items=normalized_items[start:end],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )

    async def delete_inventory_item(self, uid: int, item_id: int) -> bool:
        if _is_item_id_protected(item_id):
            return False

        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            result = await collection.update_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}, "items._id": item_id},
                {"$pull": {"items": {"_id": item_id}}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.modified_count > 0

    async def clear_inventory_items_by_keyword(self, uid: int, keyword: str) -> int:
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )

            raw_items = self._sanitize_raw_items(document.get("items") if isinstance(document, dict) else [])
            item_name_map = get_item_name_map()
            deletable_item_ids: list[int] = []
            for raw_item in raw_items:
                if not isinstance(raw_item, dict):
                    continue

                item_id = parse_optional_int(raw_item.get("_id"))
                if item_id is None or _is_item_id_protected(item_id):
                    continue

                item_name = str(item_name_map.get(item_id, "")).strip().lower()
                if not normalized_keyword or normalized_keyword in item_name:
                    deletable_item_ids.append(item_id)

            if not deletable_item_ids:
                return 0

            result = await collection.update_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"$pull": {"items": {"_id": {"$in": deletable_item_ids}}}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            return 0

        return len(deletable_item_ids)

    async def update_inventory_item_quantity(self, uid: int, item_id: int, quantity: int) -> bool:
        if _is_item_id_protected(item_id):
            return False

        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )

            raw_items = self._sanitize_raw_items(document.get("items") if isinstance(document, dict) else [])
            updated = False
            for raw_item in raw_items:
                if not isinstance(raw_item, dict):
                    continue
                current_item_id = parse_optional_int(raw_item.get("_id"))
                if current_item_id != item_id:
                    continue
                raw_item["Count"] = Int64(quantity)
                updated = True
                break

            if not updated or not isinstance(document, dict):
                return False

            normalized_update = self._normalize_inventory_update_fields({"items": raw_items})
            if "items" not in normalized_update:
                return False

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"items": normalized_update["items"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.modified_count > 0

    async def add_inventory_items(self, uid: int, items: list[dict[str, int]]) -> dict[str, int]:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )

            raw_items = self._sanitize_raw_items(document.get("items") if isinstance(document, dict) else [])
            existing_item_by_id: dict[int, dict[str, Any]] = {}
            for raw_item in raw_items:
                if not isinstance(raw_item, dict):
                    continue
                item_id = parse_optional_int(raw_item.get("_id"))
                if item_id is None:
                    continue
                existing_item_by_id[item_id] = raw_item

            created_count = 0
            updated_count = 0
            for item in items:
                item_id = int(item["item_id"])
                quantity = int(item["quantity"])

                if item_id in existing_item_by_id:
                    current_quantity = parse_optional_int(existing_item_by_id[item_id].get("Count")) or 0
                    existing_item_by_id[item_id]["Count"] = Int64(current_quantity + quantity)
                    updated_count += 1
                    continue

                inventory_item = self.inventory_item_template(item_id, quantity)
                raw_items.append(inventory_item)
                existing_item_by_id[item_id] = inventory_item
                created_count += 1

            if isinstance(document, dict):
                normalized_document = self._sanitize_inventory_document(document)
                result = await collection.update_one(
                    {"_id": document.get("_id")},
                    {"$set": {"items": self._normalize_inventory_update_fields({"items": raw_items}).get("items", normalized_document.get("items", []))}},
                )
            else:
                inventory_document = self._sanitize_inventory_document({"uid": Int64(uid), "items": raw_items})
                result = await collection.insert_one(inventory_document)
                if not result.inserted_id:
                    raise RuntimeError("Failed to create inventory document")
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return {
            "added_count": len(items),
            "created_count": created_count,
            "updated_count": updated_count,
        }

    async def get_inventory_quantities(self, uid: int) -> dict[int, int]:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        raw_items = self._sanitize_raw_items(document.get("items") if isinstance(document, dict) else [])
        quantities: dict[int, int] = {}
        for raw_item in raw_items:
            if not isinstance(raw_item, dict):
                continue

            item_id = parse_optional_int(raw_item.get("_id"))
            quantity = parse_optional_int(raw_item.get("Count"))
            if item_id is None or quantity is None:
                continue

            quantities[item_id] = quantity

        return quantities
