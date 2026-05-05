from __future__ import annotations

import contextlib
import math

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AccountListResponse, AccountRecord


ACCOUNT_COLLECTION_NAME = "accounts"
ACCOUNT_PAGE_SIZE = 10


def _parse_account_uid(value: object) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


class DatabaseAccountsService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def account_exists(self, uid: int) -> bool:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            document = await collection.find_one({"uid": uid}, {"_id": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return document is not None

    async def update_account_password(self, uid: int, password: str) -> bool:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            result = await collection.update_one({"uid": uid}, {"$set": {"password": password}})
        finally:
            with contextlib.suppress(Exception):
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
            with contextlib.suppress(Exception):
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
