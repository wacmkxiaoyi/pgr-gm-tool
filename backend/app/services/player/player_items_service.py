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
from backend.app.services.player.player_items import get_item_name_map


INVENTORY_COLLECTION_NAME = "inventory"
ITEM_PAGE_SIZE = 10
EXCLUDED_ITEM_ID_MIN = 1
EXCLUDED_ITEM_ID_MAX = 18
InventorySortField = Literal["item_id", "name", "quantity"]
InventorySortOrder = Literal["asc", "desc"]


def _unwrap_bson_numeric(value: Any) -> Any:
    if isinstance(value, dict):
        if "$numberLong" in value:
            return _parse_optional_int(value.get("$numberLong"))
        if "$numberInt" in value:
            return _parse_optional_int(value.get("$numberInt"))
        if "$numberDouble" in value:
            raw = value.get("$numberDouble")
            try:
                return float(raw)
            except (TypeError, ValueError):
                return raw
    return value


def _parse_optional_int(value: Any) -> int | None:
    normalized = _unwrap_bson_numeric(value)
    try:
        return int(normalized)
    except (TypeError, ValueError):
        return None


def _normalize_item_search_keyword(keyword: str | None) -> str:
    return str(keyword or "").strip().lower()


def _is_item_id_protected(item_id: int) -> bool:
    return EXCLUDED_ITEM_ID_MIN <= item_id <= EXCLUDED_ITEM_ID_MAX


def _inventory_sort_key(item: InventoryItemRecord, item_name_map: dict[int, str], sort_by: InventorySortField) -> tuple[Any, int]:
    if sort_by == "quantity":
        return item.quantity, item.item_id

    if sort_by == "name":
        return str(item_name_map.get(item.item_id, "")).strip().lower(), item.item_id

    return item.item_id, item.item_id


def _inventory_item_template(item_id: int, quantity: int) -> dict[str, Any]:
    now = int(time.time())
    return {
        "_id": item_id,
        "Count": Int64(quantity),
        "BuyTimes": 0,
        "TotalBuyTimes": 0,
        "LastBuyTime": Int64(0),
        "RefreshTime": Int64(0),
        "CreateTime": Int64(now),
    }


class PlayerItemsService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    @staticmethod
    def inventory_item_template(item_id: int, quantity: int) -> dict[str, Any]:
        return _inventory_item_template(item_id, quantity)

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
        normalized_keyword = _normalize_item_search_keyword(keyword)
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

        raw_items = document.get("items") if isinstance(document, dict) else []
        item_name_map = get_item_name_map()
        normalized_items: list[InventoryItemRecord] = []
        for raw_item in raw_items if isinstance(raw_items, list) else []:
            if not isinstance(raw_item, dict):
                continue

            item_id = _parse_optional_int(raw_item.get("_id"))
            quantity = _parse_optional_int(raw_item.get("Count"))
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
        normalized_keyword = _normalize_item_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )

            raw_items = document.get("items") if isinstance(document, dict) else []
            item_name_map = get_item_name_map()
            deletable_item_ids: list[int] = []
            for raw_item in raw_items if isinstance(raw_items, list) else []:
                if not isinstance(raw_item, dict):
                    continue

                item_id = _parse_optional_int(raw_item.get("_id"))
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
            result = await collection.update_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}, "items._id": item_id},
                {"$set": {"items.$.Count": Int64(quantity)}},
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

            raw_items = list(document.get("items") or []) if isinstance(document, dict) else []
            existing_item_by_id: dict[int, dict[str, Any]] = {}
            for raw_item in raw_items:
                if not isinstance(raw_item, dict):
                    continue
                item_id = _parse_optional_int(raw_item.get("_id"))
                if item_id is None:
                    continue
                existing_item_by_id[item_id] = raw_item

            created_count = 0
            updated_count = 0
            for item in items:
                item_id = int(item["item_id"])
                quantity = int(item["quantity"])

                if item_id in existing_item_by_id:
                    current_quantity = _parse_optional_int(existing_item_by_id[item_id].get("Count")) or 0
                    existing_item_by_id[item_id]["Count"] = Int64(current_quantity + quantity)
                    updated_count += 1
                    continue

                inventory_item = _inventory_item_template(item_id, quantity)
                raw_items.append(inventory_item)
                existing_item_by_id[item_id] = inventory_item
                created_count += 1

            if isinstance(document, dict):
                result = await collection.update_one(
                    {"_id": document.get("_id")},
                    {"$set": {"items": raw_items}},
                )
            else:
                result = await collection.insert_one({"uid": Int64(uid), "items": raw_items})
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

        raw_items = document.get("items") if isinstance(document, dict) else []
        quantities: dict[int, int] = {}
        for raw_item in raw_items if isinstance(raw_items, list) else []:
            if not isinstance(raw_item, dict):
                continue

            item_id = _parse_optional_int(raw_item.get("_id"))
            quantity = _parse_optional_int(raw_item.get("Count"))
            if item_id is None or quantity is None:
                continue

            quantities[item_id] = quantity

        return quantities
