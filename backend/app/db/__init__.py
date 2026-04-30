from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from backend.app.config import Settings


def create_mongo_client(settings: Settings) -> AsyncIOMotorClient:
    return AsyncIOMotorClient(settings.build_mongo_uri())


def get_database(settings: Settings, client: AsyncIOMotorClient | None = None) -> AsyncIOMotorDatabase:
    active_client = client or create_mongo_client(settings)
    return active_client[settings.mongo_db]