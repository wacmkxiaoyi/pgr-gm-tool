from __future__ import annotations

import asyncio
import contextlib
import math
import time
from collections import deque
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime, timezone
from typing import Any, Literal

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import (
    AccountListResponse,
    AccountRecord,
    InventoryItemRecord,
    InventoryListResponse,
    PlayerProfileRecord,
    UpdatePlayerProfilePayload,
)
from backend.app.services.player_portrait import get_item_name_map


HealthState = Literal["healthy", "unhealthy", "unknown"]


@dataclass(frozen=True)
class DatabaseHealthCheckRecord:
    checked_at: str
    state: HealthState
    message: str
    latency_ms: int | None = None
    status_code: int | None = None


@dataclass
class DatabaseHealthTarget:
    key: str
    title: str
    target_type: str
    url: str
    host: str
    port: int
    history: deque[DatabaseHealthCheckRecord] = field(default_factory=lambda: deque(maxlen=20))
    latest: DatabaseHealthCheckRecord | None = None


DATABASE_HEALTH_TARGETS: dict[str, DatabaseHealthTarget] = {}

DATABASE_HEALTH_SNAPSHOT: dict[str, Any] = {
    "checked_at": None,
    "interval_seconds": None,
    "sections": [],
}

ACCOUNT_COLLECTION_NAME = "accounts"
ACCOUNT_PAGE_SIZE = 10
PLAYER_COLLECTION_NAME = "players"
INVENTORY_COLLECTION_NAME = "inventory"
PLAYER_HEAD_FRAME_ID_FIELD = "CurrHeadFrameId"
PLAYER_BACKGROUND_ID_FIELD = "use_background_id"
PLAYER_EDITABLE_FIELDS = {
    "name": "Name",
    "gender": "Gender",
    "level": "Level",
    "likes": "Likes",
}
ITEM_PAGE_SIZE = 10
ITEM_LOOKUP_PAGE_SIZE = 99999
EXCLUDED_ITEM_ID_MIN = 1
EXCLUDED_ITEM_ID_MAX = 18
ITEM_QUANTITY_MIN = 1
ITEM_QUANTITY_MAX = 99999


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_target_url(settings: Settings) -> str:
    return f"mongodb://{settings.mongo_host}:{settings.mongo_port}/{settings.mongo_db}"


async def _check_mongodb_target(settings: Settings, target: DatabaseHealthTarget) -> DatabaseHealthCheckRecord:
    del target
    start = time.perf_counter()
    client = None

    try:
        client = create_mongo_client(
            settings,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
            socketTimeoutMS=5000,
        )
        database = client[settings.mongo_db]
        await database.list_collection_names()
        state: HealthState = "healthy"
        message = f"MongoDB 连接成功，数据库 {settings.mongo_db} 可访问"
    except Exception as error:  # noqa: BLE001
        state = "unhealthy"
        message = f"MongoDB 数据库访问失败: {error}"
    finally:
        if client is not None:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

    latency_ms = int((time.perf_counter() - start) * 1000)
    return DatabaseHealthCheckRecord(
        checked_at=_now_iso(),
        state=state,
        message=message,
        latency_ms=latency_ms,
    )


def init_database_health_targets(settings: Settings) -> None:
    DATABASE_HEALTH_TARGETS.clear()
    DATABASE_HEALTH_TARGETS.update({
        "mongodb": DatabaseHealthTarget(
            key="mongodb",
            title="MongoDB 数据库服务器",
            target_type="mongodb",
            url=_build_target_url(settings),
            host=settings.mongo_host,
            port=settings.mongo_port,
        ),
    })
    DATABASE_HEALTH_SNAPSHOT["checked_at"] = None
    DATABASE_HEALTH_SNAPSHOT["interval_seconds"] = settings.healthy_check_interval
    DATABASE_HEALTH_SNAPSHOT["sections"] = _build_sections()


def reload_database_health_targets(settings: Settings) -> None:
    init_database_health_targets(settings)


async def run_database_health_check_once(settings: Settings) -> None:
    if not DATABASE_HEALTH_TARGETS:
        init_database_health_targets(settings)

    record = await _check_mongodb_target(settings, DATABASE_HEALTH_TARGETS["mongodb"])
    target = DATABASE_HEALTH_TARGETS["mongodb"]
    target.latest = record
    target.history.appendleft(record)

    DATABASE_HEALTH_SNAPSHOT["checked_at"] = _now_iso()
    DATABASE_HEALTH_SNAPSHOT["interval_seconds"] = settings.healthy_check_interval
    DATABASE_HEALTH_SNAPSHOT["sections"] = _build_sections()


def _build_sections() -> list[dict[str, Any]]:
    return [
        {
            "key": "database",
            "title": "数据库服务状态",
            "services": [_serialize_target(DATABASE_HEALTH_TARGETS["mongodb"])],
        },
    ]


def _serialize_target(target: DatabaseHealthTarget) -> dict[str, Any]:
    latest = target.latest
    return {
        "key": target.key,
        "title": target.title,
        "target_type": target.target_type,
        "url": target.url,
        "host": target.host,
        "port": target.port,
        "latest": None if latest is None else {
            "checked_at": latest.checked_at,
            "state": latest.state,
            "message": latest.message,
            "latency_ms": latest.latency_ms,
            "status_code": latest.status_code,
        },
        "history": [
            {
                "checked_at": item.checked_at,
                "state": item.state,
                "message": item.message,
                "latency_ms": item.latency_ms,
                "status_code": item.status_code,
            }
            for item in list(target.history)
        ],
    }


def _build_empty_sections(settings: Settings) -> list[dict[str, Any]]:
    return [
        {
            "key": "database",
            "title": "数据库服务状态",
            "services": [
                {
                    "key": "mongodb",
                    "title": "MongoDB 数据库服务器",
                    "target_type": "mongodb",
                    "url": _build_target_url(settings),
                    "host": settings.mongo_host,
                    "port": settings.mongo_port,
                    "latest": None,
                    "history": [],
                },
            ],
        },
    ]


def get_database_health_snapshot(settings: Settings) -> dict[str, Any]:
    if not DATABASE_HEALTH_TARGETS:
        init_database_health_targets(settings)

    sections = DATABASE_HEALTH_SNAPSHOT["sections"] or _build_empty_sections(settings)
    return {
        "checked_at": DATABASE_HEALTH_SNAPSHOT["checked_at"],
        "interval_seconds": DATABASE_HEALTH_SNAPSHOT["interval_seconds"] or settings.healthy_check_interval,
        "sections": sections,
    }


def is_database_snapshot_healthy(snapshot: dict[str, Any] | None) -> bool:
    sections = snapshot.get("sections", []) if isinstance(snapshot, dict) else []
    services = [
        service
        for section in sections
        if isinstance(section, dict)
        for service in section.get("services", [])
        if isinstance(service, dict)
    ]

    if not services:
        return False

    return all(service.get("latest", {}).get("state") == "healthy" for service in services)


def _parse_account_uid(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


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


def _parse_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = _unwrap_bson_numeric(value)
    text = str(normalized)
    return text if text else None


def _normalize_item_search_keyword(keyword: str | None) -> str:
    return str(keyword or "").strip().lower()


def _is_item_id_protected(item_id: int) -> bool:
    return EXCLUDED_ITEM_ID_MIN <= item_id <= EXCLUDED_ITEM_ID_MAX


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


class DatabaseController:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def account_exists(self, uid: int) -> bool:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            document = await collection.find_one({"uid": uid}, {"_id": 1})
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

        return document is not None

    async def update_account_password(self, uid: int, password: str) -> bool:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            result = await collection.update_one({"uid": uid}, {"$set": {"password": password}})
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

        return result.matched_count > 0

    async def update_player_profile(self, uid: int, payload: UpdatePlayerProfilePayload) -> PlayerProfileRecord | None:
        update_fields: dict[str, Any] = {}
        if payload.name is not None:
            update_fields[f"player_data.{PLAYER_EDITABLE_FIELDS['name']}"] = payload.name
        if payload.gender is not None:
            update_fields[f"player_data.{PLAYER_EDITABLE_FIELDS['gender']}"] = payload.gender
        if payload.level is not None:
            update_fields[f"player_data.{PLAYER_EDITABLE_FIELDS['level']}"] = payload.level
        if payload.likes is not None:
            update_fields[f"player_data.{PLAYER_EDITABLE_FIELDS['likes']}"] = payload.likes
        if payload.head_portrait_id is not None:
            update_fields["player_data.CurrHeadPortraitId"] = payload.head_portrait_id
        if payload.head_frame_id is not None:
            update_fields[f"player_data.{PLAYER_HEAD_FRAME_ID_FIELD}"] = payload.head_frame_id
        if payload.use_background_id is not None:
            update_fields[PLAYER_BACKGROUND_ID_FIELD] = payload.use_background_id

        if not update_fields:
            return await self.get_player_profile(uid)

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            result = await collection.update_one(
                {"player_data._id": {"$in": [uid, Int64(uid), str(uid)]}},
                {"$set": update_fields},
            )
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

        if result.matched_count <= 0:
            return None

        return await self.get_player_profile(uid)

    async def list_accounts(self, page: int = 1, page_size: int = ACCOUNT_PAGE_SIZE) -> AccountListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ACCOUNT_PAGE_SIZE if page_size <= 0 else min(int(page_size), ACCOUNT_PAGE_SIZE)
        skip = (current_page - 1) * normalized_page_size
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            total = await collection.count_documents({})
            cursor = collection.find({}, {"uid": 1, "username": 1}).sort("uid", 1).skip(skip).limit(normalized_page_size)
            documents = await cursor.to_list(length=normalized_page_size)
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

        items = [
            AccountRecord(
                id=str(document.get("_id", "")),
                uid=_parse_account_uid(document.get("uid")),
                username=str(document.get("username", "")),
            )
            for document in documents
        ]
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0

        return AccountListResponse(
            items=items,
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )

    async def list_inventory_items(
        self,
        uid: int,
        page: int = 1,
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
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
            with contextlib.suppress(Exception):  # noqa: BLE001
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

            if EXCLUDED_ITEM_ID_MIN <= item_id <= EXCLUDED_ITEM_ID_MAX:
                continue

            if normalized_keyword:
                item_name = str(item_name_map.get(item_id, "")).strip().lower()
                if normalized_keyword not in item_name:
                    continue

            normalized_items.append(InventoryItemRecord(item_id=item_id, quantity=quantity))

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
            with contextlib.suppress(Exception):  # noqa: BLE001
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
            with contextlib.suppress(Exception):  # noqa: BLE001
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
            with contextlib.suppress(Exception):  # noqa: BLE001
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
                result = await collection.insert_one({
                    "uid": Int64(uid),
                    "items": raw_items,
                })
                if not result.inserted_id:
                    raise RuntimeError("Failed to create inventory document")
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
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
            with contextlib.suppress(Exception):  # noqa: BLE001
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

    async def get_player_profile(self, uid: int) -> PlayerProfileRecord | None:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            document = await collection.find_one(
                {"player_data._id": {"$in": [uid, Int64(uid), str(uid)]}},
                {
                    "player_data._id": 1,
                    "player_data.Name": 1,
                    "player_data.Gender": 1,
                    "player_data.Level": 1,
                    "player_data.Likes": 1,
                    "player_data.CurrHeadPortraitId": 1,
                    f"player_data.{PLAYER_HEAD_FRAME_ID_FIELD}": 1,
                    PLAYER_BACKGROUND_ID_FIELD: 1,
                },
            )
        finally:
            with contextlib.suppress(Exception):  # noqa: BLE001
                client.close()

        if not document:
            return None

        player_data = document.get("player_data") if isinstance(document, dict) else None
        if not isinstance(player_data, dict):
            return None

        normalized_uid = _parse_optional_int(player_data.get("_id"))
        if normalized_uid is None:
            return None

        head_portrait_id = _parse_optional_int(player_data.get("CurrHeadPortraitId"))
        head_frame_id = _parse_optional_int(player_data.get(PLAYER_HEAD_FRAME_ID_FIELD))
        use_background_id = _parse_optional_int(document.get(PLAYER_BACKGROUND_ID_FIELD))

        return PlayerProfileRecord(
            uid=normalized_uid,
            name=_parse_optional_string(player_data.get("Name")),
            gender=_parse_optional_int(player_data.get("Gender")),
            level=_parse_optional_int(player_data.get("Level")),
            likes=_parse_optional_int(player_data.get("Likes")),
            head_portrait_id=head_portrait_id,
            head_frame_id=head_frame_id,
            use_background_id=use_background_id,
        )


async def database_health_check_loop(settings: Settings) -> None:
    await run_database_health_check_once(settings)
    while True:
        await asyncio.sleep(settings.healthy_check_interval)
        await run_database_health_check_once(settings)
