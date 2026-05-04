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
from backend.app.db.models import AccountListResponse, AccountRecord, PlayerProfileRecord, UpdatePlayerProfilePayload


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
ACCOUNT_PAGE_SIZE = 25
PLAYER_COLLECTION_NAME = "players"
PLAYER_HEAD_FRAME_ID_FIELD = "CurrHeadFrameId"
PLAYER_BACKGROUND_ID_FIELD = "use_background_id"
PLAYER_EDITABLE_FIELDS = {
    "name": "Name",
    "gender": "Gender",
    "level": "Level",
    "likes": "Likes",
}


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
