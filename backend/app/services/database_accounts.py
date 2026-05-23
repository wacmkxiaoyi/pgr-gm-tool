from __future__ import annotations

import contextlib
import math

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AccountListResponse, AccountRecord
from backend.app.db.models.accounts import ACCOUNT_COLLECTION_NAME
from backend.app.db.models.player_characters import CHARACTERS_COLLECTION_NAME
from backend.app.db.models.player_items import INVENTORY_COLLECTION_NAME
from backend.app.db.models.player_profile import PLAYER_COLLECTION_NAME
from backend.app.db.models.player_stages import STAGES_COLLECTION_NAME
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
from backend.app.services.constants import DEFAULT_LIST_PAGE_SIZE


def _parse_account_uid(value: object) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


class DatabaseAccountsService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime
        self._collection_schema = schema_runtime.get_collection_schema(ACCOUNT_COLLECTION_NAME)

    def _get_account_schema(self) -> CompiledCollectionSchema:
        if self._collection_schema is None:
            raise RuntimeError(f"Missing schema for collection: {ACCOUNT_COLLECTION_NAME}")
        return self._collection_schema

    def _sanitize_account_document(self, document: object, *, fill_defaults: bool = True) -> dict[str, object]:
        sanitized = self._get_account_schema().sanitize_document(document, fill_defaults=fill_defaults)
        return sanitized if isinstance(sanitized, dict) else {}

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
        if not self._get_account_schema().allows_field("password"):
            return False

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            result = await collection.update_one({"uid": uid}, {"$set": {"password": password}})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.matched_count > 0

    async def delete_account(self, uid: int) -> bool:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            accounts_collection = database[ACCOUNT_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            inventory_collection = database[INVENTORY_COLLECTION_NAME]
            stages_collection = database[STAGES_COLLECTION_NAME]

            accounts_result = await accounts_collection.delete_many({"uid": uid})
            if accounts_result.deleted_count <= 0:
                return False

            await players_collection.delete_many({"player_data._id": uid})
            await characters_collection.delete_many({"uid": uid})
            await inventory_collection.delete_many({"uid": uid})
            await stages_collection.delete_many({"uid": uid})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return True

    async def list_accounts(self, page: int = 1, page_size: int = DEFAULT_LIST_PAGE_SIZE, sort_by: str = "uid", sort_order: str = "asc", keyword: str = "") -> AccountListResponse:
        current_page = max(1, int(page))
        normalized_page_size = DEFAULT_LIST_PAGE_SIZE if page_size <= 0 else min(int(page_size), DEFAULT_LIST_PAGE_SIZE)
        skip = (current_page - 1) * normalized_page_size

        mongo_filter = {}
        if keyword:
            try:
                uid_keyword = int(keyword)
                mongo_filter["$or"] = [
                    {"uid": uid_keyword},
                    {"username": {"$regex": keyword, "$options": "i"}},
                ]
            except ValueError:
                mongo_filter["username"] = {"$regex": keyword, "$options": "i"}

        sort_field = "uid" if sort_by not in ("uid", "username") else sort_by
        sort_direction = -1 if sort_order == "desc" else 1

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][ACCOUNT_COLLECTION_NAME]
            total = await collection.count_documents(mongo_filter)
            cursor = collection.find(mongo_filter, {"uid": 1, "username": 1}).sort(sort_field, sort_direction).skip(skip).limit(normalized_page_size)
            documents = await cursor.to_list(length=normalized_page_size)
        finally:
            with contextlib.suppress(Exception):
                client.close()

        items = [
            AccountRecord(
                id=str(normalized_document.get("_id", "")),
                uid=_parse_account_uid(normalized_document.get("uid")),
                username=str(normalized_document.get("username", "")),
            )
            for document in documents
            for normalized_document in [self._sanitize_account_document(document, fill_defaults=False)]
        ]
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0

        return AccountListResponse(
            items=items,
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )
