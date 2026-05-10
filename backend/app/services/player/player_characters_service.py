from __future__ import annotations

import contextlib
import math
from typing import Any, Literal

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import CharacterManagementItemRecord, CharacterManagementListResponse
from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.characters import get_character_exhibitions_map, get_character_grade_name_map
from backend.app.services.player.player_profile import get_character_log_name_map


CHARACTERS_COLLECTION_NAME = "characters"
PLAYER_COLLECTION_NAME = "players"
ITEM_PAGE_SIZE = 10
CHARACTER_LIST_SCHEMA_PATH = "characters"
CharacterSortField = Literal["sequence", "name", "quality", "level", "grade", "awaken_level"]
CharacterSortOrder = Literal["asc", "desc"]


def _parse_optional_int(value: Any) -> int | None:
    if isinstance(value, dict):
        if "$numberLong" in value:
            value = value.get("$numberLong")
        elif "$numberInt" in value:
            value = value.get("$numberInt")
        elif "$numberDouble" in value:
            value = value.get("$numberDouble")

    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _matching_uid_query(uid: int) -> dict[str, Any]:
    return {
        "$or": [
            {"_id": {"$in": [uid, Int64(uid), str(uid)]}},
            {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
        ],
    }


def _matching_player_uid_query(uid: int) -> dict[str, Any]:
    return {
        "player_data._id": {"$in": [uid, Int64(uid), str(uid)]},
    }


def _normalize_search_keyword(keyword: str | None) -> str:
    return str(keyword or "").strip().lower()


def _get_search_priority(keyword: str, name: str, grade_name: str) -> int | None:
    if not keyword:
        return 0

    normalized_name = str(name or "").strip().lower()
    if keyword in normalized_name:
        return 0

    normalized_grade_name = str(grade_name or "").strip().lower()
    if keyword in normalized_grade_name:
        return 1

    return None


def _descending_text_key(value: str) -> tuple[int, ...]:
    return tuple(-ord(character) for character in value)


def _ordered_text_key(value: Any, sort_order: CharacterSortOrder) -> str | tuple[int, ...]:
    normalized = str(value or "").strip().lower()
    if sort_order == "desc":
        return _descending_text_key(normalized)
    return normalized


def _ordered_number_key(value: int, sort_order: CharacterSortOrder) -> int:
    return -value if sort_order == "desc" else value


def _resolve_grade_name(character_id: int, grade: int, character_grade_name_map: dict[int, list[str]]) -> str:
    if grade <= 0:
        return ""

    grade_names = character_grade_name_map.get(character_id)
    if not isinstance(grade_names, list):
        return ""

    index = grade - 1
    if index < 0 or index >= len(grade_names):
        return ""

    grade_name = grade_names[index]
    return str(grade_name).strip()


def _resolve_awaken_level(character_id: int, gather_rewards: set[int], character_exhibitions_map: dict[int, list[int]]) -> int:
    awaken_path = character_exhibitions_map.get(character_id)
    if not isinstance(awaken_path, list) or not awaken_path:
        return 0

    awaken_level = 0
    for exhibition_id in awaken_path:
        normalized_exhibition_id = _parse_optional_int(exhibition_id)
        if normalized_exhibition_id is None or normalized_exhibition_id not in gather_rewards:
            break
        awaken_level += 1

    return awaken_level


def _character_sort_key(
    item: CharacterManagementItemRecord,
    sort_by: CharacterSortField,
    sort_order: CharacterSortOrder,
    search_priority: int,
    character_name_map: dict[int, str],
) -> tuple[Any, ...]:
    character_name = character_name_map.get(item.CharacterId, "")

    if sort_by == "name":
        return (
            search_priority,
            _ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "quality":
        return (
            search_priority,
            _ordered_number_key(int(item.Quality or 0), sort_order),
            _ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "level":
        return (
            search_priority,
            _ordered_number_key(int(item.Level or 0), sort_order),
            _ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "grade":
        return (
            search_priority,
            _ordered_number_key(int(item.Grade or 0), sort_order),
            _ordered_text_key(item.GradeName or "", sort_order),
            _ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "awaken_level":
        return (
            search_priority,
            _ordered_number_key(int(item.AwakenLevel or 0), sort_order),
            _ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    return (
        search_priority,
        _ordered_number_key(item.Sequence, sort_order),
        item.record_id,
    )


class PlayerCharactersService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime
        self._characters_schema = schema_runtime.get_collection_schema(CHARACTERS_COLLECTION_NAME)
        self._players_schema = schema_runtime.get_collection_schema(PLAYER_COLLECTION_NAME)

    def _get_characters_schema(self) -> CompiledCollectionSchema:
        if self._characters_schema is None:
            raise RuntimeError(f"Missing schema for collection: {CHARACTERS_COLLECTION_NAME}")
        return self._characters_schema

    def _get_players_schema(self) -> CompiledCollectionSchema:
        if self._players_schema is None:
            raise RuntimeError(f"Missing schema for collection: {PLAYER_COLLECTION_NAME}")
        return self._players_schema

    def _sanitize_characters_document(self, document: Any) -> dict[str, Any]:
        sanitized = self._get_characters_schema().sanitize_document(document)
        return sanitized if isinstance(sanitized, dict) else {}

    def _sanitize_character_list(self, raw_characters: Any) -> list[dict[str, Any]]:
        sanitized = self._get_characters_schema().sanitize_read(raw_characters, CHARACTER_LIST_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def _sanitize_players_document(self, document: Any) -> dict[str, Any]:
        sanitized = self._get_players_schema().sanitize_document(document)
        return sanitized if isinstance(sanitized, dict) else {}

    def _sanitize_gather_rewards(self, raw_gather_rewards: Any) -> set[int]:
        sanitized = self._get_players_schema().sanitize_read(raw_gather_rewards, "gather_rewards")
        if not isinstance(sanitized, list):
            return set()

        return {
            reward_id
            for raw_reward_id in sanitized
            for reward_id in [_parse_optional_int(raw_reward_id)]
            if reward_id is not None
        }

    async def set_character_support(self, uid: int, record_id: int) -> bool:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(_matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if _parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                return False

            if target_index == 0:
                return True

            target_character = characters.pop(target_index)
            characters.insert(0, target_character)
            result = await characters_collection.update_one(
                _matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            return result.matched_count > 0
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def list_characters(
        self,
        uid: int,
        page: int = 1,
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: CharacterSortField = "sequence",
        sort_order: CharacterSortOrder = "asc",
    ) -> CharacterManagementListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ITEM_PAGE_SIZE if page_size <= 0 else min(int(page_size), ITEM_PAGE_SIZE)
        normalized_keyword = _normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(_matching_uid_query(uid), {"characters": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_characters_document = self._sanitize_characters_document(characters_document)
        normalized_players_document = self._sanitize_players_document(players_document)
        raw_characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
        gather_rewards = self._sanitize_gather_rewards(normalized_players_document.get("gather_rewards"))
        character_name_map = get_character_log_name_map()
        character_grade_name_map = get_character_grade_name_map()
        character_exhibitions_map = get_character_exhibitions_map()
        normalized_items: list[CharacterManagementItemRecord] = []

        for index, raw_character in enumerate(raw_characters):
            character_id = _parse_optional_int(raw_character.get("_id"))
            if character_id is None:
                continue

            grade = max(0, int(_parse_optional_int(raw_character.get("Grade")) or 0))
            grade_name = _resolve_grade_name(character_id, grade, character_grade_name_map)
            character_name = character_name_map.get(character_id, "")
            search_priority = _get_search_priority(normalized_keyword, character_name, grade_name)
            if search_priority is None:
                continue

            record_id = _parse_optional_int(raw_character.get("_id")) or character_id
            normalized_item = CharacterManagementItemRecord(
                record_id=record_id,
                CharacterId=character_id,
                Sequence=index + 1,
                Level=_parse_optional_int(raw_character.get("Level")),
                Quality=_parse_optional_int(raw_character.get("Quality")),
                Grade=grade,
                GradeName=grade_name or None,
                AwakenLevel=_resolve_awaken_level(character_id, gather_rewards, character_exhibitions_map),
            )
            normalized_items.append(normalized_item)

        normalized_items.sort(
            key=lambda item: _character_sort_key(
                item,
                sort_by,
                sort_order,
                _get_search_priority(
                    normalized_keyword,
                    character_name_map.get(item.CharacterId, ""),
                    item.GradeName or "",
                ) or 0,
                character_name_map,
            ),
        )

        total = len(normalized_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return CharacterManagementListResponse(
            items=normalized_items[start:end],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )
