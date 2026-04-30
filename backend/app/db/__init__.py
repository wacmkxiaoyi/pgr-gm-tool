from __future__ import annotations

from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from backend.app.config import Settings


def create_mongo_client(settings: Settings, **kwargs: Any) -> AsyncIOMotorClient:
    return AsyncIOMotorClient(settings.build_mongo_uri(), **kwargs)


def get_database(settings: Settings, client: AsyncIOMotorClient | None = None) -> AsyncIOMotorDatabase:
    active_client = client or create_mongo_client(settings)
    return active_client[settings.mongo_db]
