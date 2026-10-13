from __future__ import annotations

import contextlib
import math
from collections import Counter
from typing import Any, Literal

from bson.int64 import Int64
from pymongo import ReturnDocument

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models.player_dorm import (
    AddFurnitureRequest, AddFurnitureResponse, FurnitureListResponse, FurnitureRecord, FurnitureSortField,
)
from backend.app.services.constants import DEFAULT_LIST_PAGE_SIZE
from backend.app.services.api_errors import raise_http_error
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player.player_dorm import (
    get_base_furniture_list,
    get_dorm_template_entries_map,
    get_furniture_additional_attr_entries_map,
    get_furniture_create_max_attr_map,
    get_furniture_entries_map,
    get_furniture_suit_name_map,
    get_furniture_template_count_map,
    get_furniture_type_entires_map,
)
from backend.app.services.player.utils import normalize_search_keyword, parse_optional_int
from backend.app.utils.resource_language import resource_language


class PlayerDormService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._collection_schema = schema_runtime.get_collection_schema("players")

    async def add_furniture(self, uid: int, payload: AddFurnitureRequest) -> AddFurnitureResponse:
        entries = get_furniture_entries_map()
        types = get_furniture_type_entires_map()
        max_attrs = get_furniture_create_max_attr_map()
        counts: dict[int, int] = {}
        if payload.unlock_all:
            config_ids = sorted(entries)
            counts = get_furniture_template_count_map()
        elif payload.template_ids:
            templates = get_dorm_template_entries_map()
            if any(template_id not in templates for template_id in payload.template_ids):
                raise_http_error(422, "furniture.config_invalid")
            counts = dict(Counter(config_id for template_id in sorted(set(payload.template_ids))
                                  for config_id in templates[template_id]["FurnitureId"]))
            config_ids = sorted(counts)
        elif payload.suit_ids:
            if any(suit_id not in get_furniture_suit_name_map() for suit_id in payload.suit_ids):
                raise_http_error(422, "furniture.config_invalid")
            selected_suits = set(payload.suit_ids)
            config_ids = sorted(config_id for config_id, entry in entries.items() if entry["SuitId"] in selected_suits)
        else:
            config_ids = sorted(set(payload.config_ids))
        additions = list(dict.fromkeys(payload.addition_ids))
        if not config_ids or any(config_id not in entries for config_id in config_ids):
            raise_http_error(422, "furniture.config_invalid")
        if any(addition not in get_furniture_additional_attr_entries_map() for addition in additions):
            raise_http_error(422, "furniture.addition_invalid")
        if payload.attr_mode == "auto" and any(entries[config_id]["TypeId"] not in max_attrs for config_id in config_ids):
            raise_http_error(422, "furniture.config_invalid")
        if self._collection_schema is None:
            raise RuntimeError("Missing schema for collection: players")

        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db]["players"]
            document = await collection.find_one({"player_data._id": Int64(uid)}, {"dorm": 1})
            if not isinstance(document, dict):
                raise_http_error(404, "player.not_found", {"uid": uid})
            dorm = document.get("dorm") if isinstance(document.get("dorm"), dict) else {}
            existing = dorm.get("furniture") if isinstance(dorm.get("furniture"), list) else []
            next_id = max(1, parse_optional_int(dorm.get("next_furniture_id")) or 1,
                          max((parse_optional_int(item.get("_id")) or 0 for item in existing if isinstance(item, dict)), default=0) + 1)
            new_items: list[dict[str, Any]] = []

            def build(config_id: int) -> dict[str, Any]:
                nonlocal next_id
                if payload.attr_mode == "custom":
                    attrs = list(payload.attr_list or [])
                else:
                    total = max_attrs[entries[config_id]["TypeId"]]
                    share, remainder = divmod(total, 3)
                    attrs = [share + int(index < remainder) for index in range(3)]
                item = {"_id": next_id, "config_id": config_id, "dormitory_id": -1,
                        "attr_list": attrs, "addition": additions[len(new_items) % len(additions)] if additions else 0}
                next_id += 1
                new_items.append(item)
                return item

            for config_id in config_ids:
                for _ in range(counts.get(config_id, 1)):
                    build(config_id)

            if payload.unlock_all:
                rooms = dorm.get("rooms") if isinstance(dorm.get("rooms"), list) else []
                room_ids = sorted({room_id for room in rooms if isinstance(room, dict)
                                   if (room_id := parse_optional_int(room.get("_id"))) is not None})
                by_type: dict[int, list[dict[str, Any]]] = {}
                defaults: dict[int, int] = {}
                for config_id in get_base_furniture_list():
                    resource = entries.get(config_id, {})
                    type_id = resource.get("TypeId")
                    if types.get(type_id, {}).get("MajorType") == 1:
                        defaults.setdefault(type_id, config_id)
                for item in new_items:
                    config_id = item["config_id"]
                    resource = entries[config_id]
                    type_id = resource["TypeId"]
                    if types.get(type_id, {}).get("MajorType") != 1:
                        continue
                    by_type.setdefault(type_id, []).append(item)
                # Every room has exactly one instance of each basic furniture type.
                for type_id, type_entry in sorted(types.items()):
                    if type_entry.get("MajorType") != 1:
                        continue
                    candidates = by_type.get(type_id, [])
                    for index, room_id in enumerate(room_ids):
                        if index >= len(candidates):
                            if type_id not in defaults:
                                raise_http_error(422, "furniture.basic_config_missing")
                            candidates.append(build(defaults[type_id]))
                        candidates[index]["dormitory_id"] = room_id

            materialized = self._collection_schema.materialize_write(new_items, "dorm.furniture")
            counter = self._collection_schema.materialize_write(next_id, "dorm.next_furniture_id")
            unlocks = self._collection_schema.materialize_write(config_ids, "dorm.furniture_unlocks")
            query: dict[str, Any] = {"player_data._id": Int64(uid)}
            # Compare only affected fields, preserving concurrent unrelated player edits.
            paths = ["furniture", "furniture_unlocks", "next_furniture_id"]
            if payload.unlock_all:
                paths.append("rooms")
            for key in paths:
                query[f"dorm.{key}"] = dorm[key] if key in dorm else {"$exists": False}
            if payload.unlock_all:
                update = {"$set": {"dorm.furniture": materialized, "dorm.furniture_unlocks": unlocks,
                                   "dorm.next_furniture_id": counter}}
            else:
                update = {"$push": {"dorm.furniture": {"$each": materialized}},
                          "$addToSet": {"dorm.furniture_unlocks": {"$each": unlocks}},
                          "$set": {"dorm.next_furniture_id": counter}}
            result = await collection.update_one(query, update)
            if result.modified_count == 0:
                raise_http_error(409, "furniture.conflict")
            return AddFurnitureResponse(added_count=len(new_items), unlock_all=payload.unlock_all)
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def list_furniture(
        self,
        uid: int,
        page: int = 1,
        page_size: int = DEFAULT_LIST_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: FurnitureSortField = "record_id",
        sort_order: Literal["asc", "desc"] = "asc",
    ) -> FurnitureListResponse:
        client = create_mongo_client(self._settings)
        try:
            document = await client[self._settings.mongo_db]["players"].find_one(
                {"player_data._id": Int64(uid)}, {"dorm.furniture": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        dorm = document.get("dorm") if isinstance(document, dict) else None
        raw_items = dorm.get("furniture") if isinstance(dorm, dict) else []
        if self._collection_schema is None:
            raise RuntimeError("Missing schema for collection: players")
        raw_items = self._collection_schema.sanitize_subpath("dorm.furniture", raw_items, fill_defaults=False)
        entries = get_furniture_entries_map()
        types = get_furniture_type_entires_map()
        suits = get_furniture_suit_name_map()
        additions = get_furniture_additional_attr_entries_map()
        normalized_keyword = normalize_search_keyword(keyword)
        rows: list[tuple[FurnitureRecord, dict[str, Any]]] = []
        for raw in raw_items if isinstance(raw_items, list) else []:
            if not isinstance(raw, dict):
                continue
            record_id = parse_optional_int(raw.get("_id"))
            config_id = parse_optional_int(raw.get("config_id"))
            if record_id is None or config_id is None:
                continue
            attrs = raw.get("attr_list")
            attrs = attrs if isinstance(attrs, list) else []
            item = FurnitureRecord(
                record_id=record_id,
                config_id=config_id,
                dormitory_id=parse_optional_int(raw.get("dormitory_id")),
                addition=parse_optional_int(raw.get("addition")) or 0,
                **{field: parse_optional_int(attrs[index]) if index < len(attrs) else None
                   for index, field in enumerate(("beauty", "comfort", "utility"))},
            )
            entry = entries.get(config_id, {})
            display = {
                "name": str(entry.get("Name") or "--"),
                "type": str(types.get(entry.get("TypeId"), {}).get("CategoryName") or "--"),
                "description": str(entry.get("Desc") or "--"),
                "suit": str(suits.get(entry.get("SuitId")) or "--"),
                "beauty": item.beauty,
                "comfort": item.comfort,
                "utility": item.utility,
                "addition": ("无" if resource_language.get() == "CN" else "None") if item.addition == 0
                else str(additions.get(item.addition, {}).get("Introduce") or "--"),
            }
            if normalized_keyword and not any(
                normalized_keyword in str(value).lower() for value in display.values() if value is not None
            ):
                continue
            rows.append((item, display))

        def sort_key(row: tuple[FurnitureRecord, dict[str, Any]]) -> tuple[Any, int]:
            item, display = row
            if sort_by == "record_id":
                return item.record_id, item.record_id
            value = display[sort_by]
            if sort_by in ("beauty", "comfort", "utility"):
                return value if value is not None else -1, item.record_id
            return str(value).strip().lower(), item.record_id

        rows.sort(key=sort_key, reverse=sort_order == "desc")
        size = min(max(1, page_size), DEFAULT_LIST_PAGE_SIZE)
        total = len(rows)
        total_pages = math.ceil(total / size) if total else 0
        current_page = min(max(1, page), max(1, total_pages))
        start = (current_page - 1) * size
        return FurnitureListResponse(
            items=[row[0] for row in rows[start:start + size]],
            page=current_page, page_size=size, total=total, total_pages=total_pages,
        )

    async def delete_furniture(self, uid: int, record_id: int) -> bool:
        types = get_furniture_type_entires_map()
        protected_config_ids = [
            config_id for config_id, entry in get_furniture_entries_map().items()
            if types.get(entry.get("TypeId"), {}).get("MajorType") == 1
        ]
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db]["players"]

            async def check_target() -> bool:
                document = await collection.find_one(
                    {"player_data._id": Int64(uid), "dorm.furniture._id": record_id},
                    {"dorm.furniture": 1},
                )
                dorm = document.get("dorm") if isinstance(document, dict) else None
                items = dorm.get("furniture") if isinstance(dorm, dict) else []
                for item in items if isinstance(items, list) else []:
                    if not isinstance(item, dict) or parse_optional_int(item.get("_id")) != record_id:
                        continue
                    if parse_optional_int(item.get("config_id")) in protected_config_ids and parse_optional_int(item.get("dormitory_id")) != -1:
                        raise_http_error(409, "furniture.in_use_delete_protected", {"record_id": record_id})
                    return True
                return False

            if not await check_target():
                return False
            # Recheck eligibility atomically in both the query and the removal,
            # so a floor/wall/ceiling placed after the read cannot be removed.
            deletable = {"_id": record_id, "$or": [
                {"config_id": {"$nin": protected_config_ids}}, {"dormitory_id": -1},
            ]}
            result = await collection.update_one(
                {"player_data._id": Int64(uid), "dorm.furniture": {"$elemMatch": deletable}},
                {"$pull": {"dorm.furniture": deletable}},
            )
            if result.modified_count == 0:
                await check_target()
            return result.modified_count > 0
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def clear_unused_furniture(self, uid: int) -> int:
        client = create_mongo_client(self._settings)
        try:
            # Count the records removed by this atomic update from its pre-image.
            document = await client[self._settings.mongo_db]["players"].find_one_and_update(
                {"player_data._id": Int64(uid), "dorm.furniture.dormitory_id": -1},
                {"$pull": {"dorm.furniture": {"dormitory_id": -1}}},
                projection={"dorm.furniture": 1}, return_document=ReturnDocument.BEFORE,
            )
            dorm = document.get("dorm") if isinstance(document, dict) else None
            items = dorm.get("furniture") if isinstance(dorm, dict) else []
            return sum(1 for item in items if isinstance(item, dict) and item.get("dormitory_id") == -1)
        finally:
            with contextlib.suppress(Exception):
                client.close()
