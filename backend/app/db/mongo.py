from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


def create_mongo_client() -> AsyncIOMotorClient:
    return AsyncIOMotorClient(settings.build_mongo_uri())


def get_database(client: AsyncIOMotorClient | None = None) -> AsyncIOMotorDatabase:
    active_client = client or create_mongo_client()
    return active_client[settings.mongo_db]
