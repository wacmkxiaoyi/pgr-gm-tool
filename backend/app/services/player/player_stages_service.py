from __future__ import annotations

import contextlib
import math
from typing import Any, Literal

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AddStagesResponse, ClearStagesResponse, DeleteStageResponse, StageListResponse, StageRecord
from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.player_stages import get_stage_entries_map
from backend.app.services.player.utils import matching_uid_query, normalize_search_keyword, normalize_sort_text, parse_optional_int


STAGES_COLLECTION_NAME = 'stages'
STAGES_PAGE_SIZE = 10
STAGES_SCHEMA_PATH = 'stages'
StagesSortField = Literal['stage_id', 'name']
StagesSortOrder = Literal['asc', 'desc']


def _normalize_stage_id(raw_stage: dict[str, Any]) -> int | None:
    stage_id = parse_optional_int(raw_stage.get('k'))
    if stage_id is not None:
        return stage_id

    payload = raw_stage.get('v')
    if isinstance(payload, dict):
        return parse_optional_int(payload.get('StageId'))

    return None


def _build_match_priority(stage_id: int, name: str, description: str, keyword: str) -> int | None:
    if not keyword:
        return 0

    if keyword in normalize_sort_text(name):
        return 0
    if keyword in str(stage_id):
        return 1
    if keyword in normalize_sort_text(description):
        return 2
    return None


class PlayerStagesService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime
        self._collection_schema = schema_runtime.get_collection_schema(STAGES_COLLECTION_NAME)

    def _get_stages_schema(self) -> CompiledCollectionSchema:
        if self._collection_schema is None:
            raise RuntimeError(f'Missing schema for collection: {STAGES_COLLECTION_NAME}')
        return self._collection_schema

    def _sanitize_raw_stages(self, raw_stages: Any) -> list[dict[str, Any]]:
        sanitized = self._get_stages_schema().sanitize_read(raw_stages, STAGES_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def _materialize_stage_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        return self._get_stages_schema().materialize_update_fields(update_fields)

    async def _load_stage_document(self, uid: int) -> dict[str, Any] | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][STAGES_COLLECTION_NAME]
            return await collection.find_one(matching_uid_query(uid), {'stages': 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def list_stages(
        self,
        uid: int,
        page: int = 1,
        page_size: int = STAGES_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: StagesSortField = 'stage_id',
        sort_order: StagesSortOrder = 'asc',
    ) -> StageListResponse:
        current_page = max(1, int(page))
        normalized_page_size = STAGES_PAGE_SIZE if page_size <= 0 else min(int(page_size), STAGES_PAGE_SIZE)
        normalized_keyword = normalize_search_keyword(keyword)
        document = await self._load_stage_document(uid)
        raw_stages = self._sanitize_raw_stages(document.get('stages') if isinstance(document, dict) else [])
        stage_entries_map = get_stage_entries_map()

        matched_items: list[tuple[int, str, StageRecord]] = []
        for raw_stage in raw_stages:
            stage_id = _normalize_stage_id(raw_stage)
            if stage_id is None:
                continue

            entry = stage_entries_map.get(stage_id, {})
            name = str(entry.get('Name', '')).strip()
            description = str(entry.get('Description', '')).strip()
            priority = _build_match_priority(stage_id, name, description, normalized_keyword)
            if priority is None:
                continue

            payload = raw_stage.get('v')
            matched_items.append((
                priority,
                normalize_sort_text(name),
                StageRecord(
                    stage_id=stage_id,
                    k=parse_optional_int(raw_stage.get('k')),
                    v=payload if isinstance(payload, dict) else {},
                ),
            ))

        def _sort_key(item: tuple[int, str, StageRecord]) -> tuple[object, ...]:
            priority, normalized_name, record = item
            if sort_by == 'name':
                sort_value: object = tuple(-ord(character) for character in normalized_name) if sort_order == 'desc' else normalized_name
                stage_id_value: object = -record.stage_id if sort_order == 'desc' else record.stage_id
                return (priority, sort_value, stage_id_value)
            stage_id_value = -record.stage_id if sort_order == 'desc' else record.stage_id
            name_value: object = tuple(-ord(character) for character in normalized_name) if sort_order == 'desc' else normalized_name
            return (priority, stage_id_value, name_value)

        matched_items.sort(key=_sort_key)

        total = len(matched_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return StageListResponse(
            items=[item[2] for item in matched_items[start:end]],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )

    async def get_cleared_stage_ids(self, uid: int) -> list[int]:
        document = await self._load_stage_document(uid)
        raw_stages = self._sanitize_raw_stages(document.get('stages') if isinstance(document, dict) else [])
        cleared_stage_ids = {
            stage_id
            for raw_stage in raw_stages
            if (stage_id := _normalize_stage_id(raw_stage)) is not None
        }
        return sorted(cleared_stage_ids)

    async def add_stages(self, uid: int, stage_ids: list[int]) -> AddStagesResponse:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][STAGES_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {'stages': 1})
            raw_stages = self._sanitize_raw_stages(document.get('stages') if isinstance(document, dict) else [])
            if not isinstance(document, dict):
                return AddStagesResponse(added_count=0)

            existing_stage_ids = {
                stage_id
                for raw_stage in raw_stages
                if (stage_id := _normalize_stage_id(raw_stage)) is not None
            }
            valid_stage_ids = get_stage_entries_map()
            normalized_stage_ids = []
            for stage_id in stage_ids:
                normalized_stage_id = int(stage_id)
                if normalized_stage_id in existing_stage_ids or normalized_stage_id not in valid_stage_ids:
                    continue
                existing_stage_ids.add(normalized_stage_id)
                normalized_stage_ids.append(normalized_stage_id)

            if not normalized_stage_ids:
                return AddStagesResponse(added_count=0)

            updated_stages = raw_stages + [
                {
                    'k': stage_id,
                    'v': {
                        'StageId': stage_id,
                    },
                }
                for stage_id in normalized_stage_ids
            ]
            materialized_update = self._materialize_stage_update_fields({'stages': updated_stages})
            if 'stages' not in materialized_update:
                return AddStagesResponse(added_count=0)

            result = await collection.update_one(
                {'_id': document.get('_id')},
                {'$set': {'stages': materialized_update['stages']}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            return AddStagesResponse(added_count=0)
        return AddStagesResponse(added_count=len(normalized_stage_ids))

    async def delete_stage(self, uid: int, stage_id: int) -> DeleteStageResponse:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][STAGES_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {'stages': 1})
            raw_stages = self._sanitize_raw_stages(document.get('stages') if isinstance(document, dict) else [])
            filtered_stages = [stage for stage in raw_stages if _normalize_stage_id(stage) != stage_id]
            if len(filtered_stages) == len(raw_stages) or not isinstance(document, dict):
                return DeleteStageResponse(stage_id=stage_id, deleted=False)

            materialized_update = self._materialize_stage_update_fields({'stages': filtered_stages})
            if 'stages' not in materialized_update:
                return DeleteStageResponse(stage_id=stage_id, deleted=False)

            result = await collection.update_one(
                {'_id': document.get('_id')},
                {'$set': {'stages': materialized_update['stages']}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return DeleteStageResponse(stage_id=stage_id, deleted=result.modified_count > 0)

    async def clear_stages(self, uid: int) -> ClearStagesResponse:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][STAGES_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {'stages': 1})
            raw_stages = self._sanitize_raw_stages(document.get('stages') if isinstance(document, dict) else [])
            deleted_count = len([stage for stage in raw_stages if _normalize_stage_id(stage) is not None])
            if not isinstance(document, dict):
                return ClearStagesResponse(deleted_count=0)

            materialized_update = self._materialize_stage_update_fields({'stages': []})
            result = await collection.update_one(
                {'_id': document.get('_id')},
                {'$set': {'stages': materialized_update.get('stages', [])}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count < 0:
            return ClearStagesResponse(deleted_count=0)
        return ClearStagesResponse(deleted_count=deleted_count)
