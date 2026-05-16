from __future__ import annotations

import contextlib
from dataclasses import dataclass

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime


@dataclass(frozen=True)
class DatabaseRepairSummary:
    collections: int
    documents_scanned: int
    documents_updated: int


class DatabaseRepairService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime

    async def repair_all_collections(self) -> DatabaseRepairSummary:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            collection_names = self._schema_runtime.get_collection_names()
            collections = 0
            documents_scanned = 0
            documents_updated = 0

            for collection_name in collection_names:
                collection_schema = self._schema_runtime.get_collection_schema(collection_name)
                if collection_schema is None:
                    continue

                collections += 1
                collection = database[collection_name]
                cursor = collection.find({})

                async for document in cursor:
                    documents_scanned += 1
                    materialized = collection_schema.materialize_document(document, fill_missing_scalars_with_null=True)
                    if not isinstance(materialized, dict):
                        continue

                    document_id = document.get('_id')
                    if document_id is None:
                        continue

                    if materialized != document:
                        await collection.replace_one({'_id': document_id}, materialized)
                        documents_updated += 1

            return DatabaseRepairSummary(
                collections=collections,
                documents_scanned=documents_scanned,
                documents_updated=documents_updated,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()
