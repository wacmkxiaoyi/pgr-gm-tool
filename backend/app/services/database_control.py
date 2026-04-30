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

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AccountListResponse, AccountRecord


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


async def database_health_check_loop(settings: Settings) -> None:
    await run_database_health_check_once(settings)
    while True:
        await asyncio.sleep(settings.healthy_check_interval)
        await run_database_health_check_once(settings)
