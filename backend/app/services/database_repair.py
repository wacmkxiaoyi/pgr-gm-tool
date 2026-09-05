from __future__ import annotations

import contextlib
import copy
from dataclasses import dataclass
from typing import Any

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime


@dataclass(frozen=True)
class DatabaseRepairSummary:
    collections: int
    documents_scanned: int
    documents_updated: int


def _repair_weapon_overrun_active_suits(document: dict[str, Any]) -> dict[str, Any]:
    repaired_document = copy.deepcopy(document)
    equips = repaired_document.get("equips")
    if not isinstance(equips, list):
        return repaired_document

    for equip in equips:
        if not isinstance(equip, dict):
            continue

        overrun_data = equip.get("WeaponOverrunData")
        if not isinstance(overrun_data, dict):
            continue

        active_suits = overrun_data.get("ActiveSuits")
        if not isinstance(active_suits, list):
            continue

        repaired_suits: list[int] = []
        valid = True
        for suit in active_suits:
            if isinstance(suit, int) and not isinstance(suit, bool):
                repaired_suits.append(suit)
                continue
            if (
                isinstance(suit, dict)
                and set(suit) == {"_id"}
                and isinstance(suit["_id"], int)
                and not isinstance(suit["_id"], bool)
            ):
                repaired_suits.append(suit["_id"])
                continue
            valid = False
            break

        if valid:
            chose_suit = overrun_data.get("ChoseSuit")
            if (
                repaired_suits == [0]
                and isinstance(chose_suit, int)
                and not isinstance(chose_suit, bool)
                and chose_suit > 0
            ):
                repaired_suits = [chose_suit]
            overrun_data["ActiveSuits"] = repaired_suits

    return repaired_document


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
                    repair_source = _repair_weapon_overrun_active_suits(document)
                    materialized = collection_schema.materialize_document(repair_source, fill_missing_scalars_with_null=True)
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
