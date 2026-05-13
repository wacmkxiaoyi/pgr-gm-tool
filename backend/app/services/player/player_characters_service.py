from __future__ import annotations

import contextlib
import math
from typing import Any, Literal

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import CharacterDetailMemoryRecord, CharacterDetailWeaponRecord, CharacterEquipRecord, CharacterEquipResonanceRecord, CharacterExtraInfoRecord, CharacterFashionRecord, CharacterManagementItemRecord, CharacterManagementListResponse, CharacterSkillInfoRecord, CharacterWeaponOverrunRecord, UpdateCharacterAwakenResponse, UpdateCharacterFashionResponse, UpdateCharacterGradeResponse, UpdateCharacterLevelupResponse, UpdateCharacterResponse, UpdateCharacterSkillResponse, UpdateCharacterTrustResponse
from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.equips import get_equip_descriptions_map, get_equip_site_map
from backend.app.services.player.equips.weapon import get_weapon_overrun_max_level_map
from backend.app.services.player.levelup_template import get_level_exp_map
from backend.app.services.player.utils import matching_uid_query, normalize_search_keyword, ordered_number_key, ordered_text_key, parse_optional_int
from backend.app.services.player.player_characters import (
    get_character_Intro_map,
    get_character_enhance_skill_entries_map,
    get_character_enhance_skill_ids_map,
    get_character_exhibitions_map,
    get_character_fashions_map,
    get_character_grade_name_map,
    get_character_levelup_template_map,
    get_character_log_name_map,
    get_character_max_liberate_level_map,
    get_character_quality_bound_map,
    get_character_skill_entries_map,
    get_character_skill_ids_map,
    get_character_trust_exp_map,
)


CHARACTERS_COLLECTION_NAME = "characters"
PLAYER_COLLECTION_NAME = "players"
ITEM_PAGE_SIZE = 10
CHARACTER_LIST_SCHEMA_PATH = "characters"
FASHIONS_SCHEMA_PATH = "fashions"
EQUIPS_SCHEMA_PATH = "equips"
CharacterSortField = Literal["sequence", "name", "quality", "level", "grade", "awaken_level"]
CharacterSortOrder = Literal["asc", "desc"]


def _normalize_weapon_resonance_list(value: Any) -> list[CharacterEquipResonanceRecord]:
    normalized_list: list[CharacterEquipResonanceRecord] = []
    for entry in value if isinstance(value, list) else []:
        if not isinstance(entry, dict):
            continue

        slot = parse_optional_int(entry.get("Slot"))
        if slot is None:
            continue

        normalized_list.append(CharacterEquipResonanceRecord(
            slot=slot,
            type=parse_optional_int(entry.get("Type")),
            template_id=parse_optional_int(entry.get("TemplateId")),
            character_id=parse_optional_int(entry.get("CharacterId")),
        ))

    return normalized_list


def _normalize_weapon_overrun_data(value: Any) -> CharacterWeaponOverrunRecord | None:
    if not isinstance(value, dict):
        return None

    return CharacterWeaponOverrunRecord(
        level=parse_optional_int(value.get("Level")),
        chose_suit=parse_optional_int(value.get("ChoseSuit")),
    )


def _matching_player_uid_query(uid: int) -> dict[str, Any]:
    return {
        "player_data._id": {"$in": [uid, Int64(uid), str(uid)]},
    }


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
        normalized_exhibition_id = parse_optional_int(exhibition_id)
        if normalized_exhibition_id is None or normalized_exhibition_id not in gather_rewards:
            break
        awaken_level += 1

    return awaken_level


def _get_character_record_id(raw_character: dict[str, Any]) -> int | None:
    record_id = parse_optional_int(raw_character.get("_id"))
    if record_id is not None:
        return record_id
    return parse_optional_int(raw_character.get("CharacterId"))


def _get_character_id(raw_character: dict[str, Any]) -> int | None:
    character_id = parse_optional_int(raw_character.get("CharacterId"))
    if character_id is not None:
        return character_id
    return parse_optional_int(raw_character.get("_id"))


def _find_character_index(characters: list[dict[str, Any]], record_id: int) -> int | None:
    return next(
        (
            index
            for index, character in enumerate(characters)
            if _get_character_record_id(character) == record_id
        ),
        None,
    )


def _normalize_character_skill_level_map(value: Any) -> dict[int, int]:
    normalized_map: dict[int, int] = {}
    for entry in value if isinstance(value, list) else []:
        if not isinstance(entry, dict):
            continue

        skill_id = parse_optional_int(entry.get("_id"))
        if skill_id is None:
            continue

        normalized_map[skill_id] = parse_optional_int(entry.get("Level")) or 0

    return normalized_map


def _build_character_skill_info_list(
    character_id: int | None,
    value: Any,
    skill_ids_map: dict[int, list[int]],
    skill_entries_map: dict[int, dict[str, int | str]],
) -> list[CharacterSkillInfoRecord]:
    if character_id is None:
        return []

    level_map = _normalize_character_skill_level_map(value)
    normalized_list: list[CharacterSkillInfoRecord] = []
    for skill_id in skill_ids_map.get(character_id, []):
        entry = skill_entries_map.get(skill_id, {})
        name = str(entry.get("Name") or "").strip()
        max_level = parse_optional_int(entry.get("MaxLevel")) or 0
        normalized_list.append(CharacterSkillInfoRecord(
            SkillId=skill_id,
            Name=name,
            Level=level_map.get(skill_id, 0),
            MaxLevel=max_level,
        ))

    return normalized_list


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
            ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "quality":
        return (
            search_priority,
            ordered_number_key(int(item.Quality or 0), sort_order),
            ordered_number_key(int(item.Star or 0), sort_order),
            ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "level":
        return (
            search_priority,
            ordered_number_key(int(item.Level or 0), sort_order),
            ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "grade":
        return (
            search_priority,
            ordered_number_key(int(item.Grade or 0), sort_order),
            ordered_text_key(item.GradeName or "", sort_order),
            ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    if sort_by == "awaken_level":
        return (
            search_priority,
            ordered_number_key(int(item.AwakenLevel or 0), sort_order),
            ordered_text_key(character_name, sort_order),
            item.Sequence,
            item.record_id,
        )

    return (
        search_priority,
        ordered_number_key(item.Sequence, sort_order),
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

    def _sanitize_fashions(self, raw_fashions: Any) -> list[dict[str, Any]]:
        sanitized = self._get_characters_schema().sanitize_read(raw_fashions, FASHIONS_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def _sanitize_equips(self, raw_equips: Any) -> list[dict[str, Any]]:
        sanitized = self._get_characters_schema().sanitize_read(raw_equips, EQUIPS_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def _supports_weapon_overrun_data(self) -> bool:
        return self._get_characters_schema().allows_field("equips.0.WeaponOverrunData")

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
            for reward_id in [parse_optional_int(raw_reward_id)]
            if reward_id is not None
        }

    async def update_character_awaken(self, uid: int, record_id: int, awaken_level: int) -> UpdateCharacterAwakenResponse:
        if awaken_level < 1:
            raise ValueError("character.update_invalid_awaken")

        character_exhibitions_map = get_character_exhibitions_map()
        character_max_liberate_level_map = get_character_max_liberate_level_map()
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            normalized_players_document = self._sanitize_players_document(players_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            max_liberate_level = character_max_liberate_level_map.get(character_id)
            if max_liberate_level is None or awaken_level > max_liberate_level:
                raise ValueError("character.update_invalid_awaken")

            awaken_path = [
                exhibition_id
                for raw_exhibition_id in character_exhibitions_map.get(character_id, [])
                for exhibition_id in [parse_optional_int(raw_exhibition_id)]
                if exhibition_id is not None
            ]
            if not awaken_path or awaken_level > len(awaken_path):
                raise ValueError("character.update_invalid_awaken")

            gather_rewards = self._sanitize_gather_rewards(normalized_players_document.get("gather_rewards"))
            cleaned_gather_rewards = set(gather_rewards)
            cleaned_gather_rewards.difference_update(awaken_path)
            cleaned_gather_rewards.update(awaken_path[:awaken_level])

            target_character["LiberateLv"] = awaken_level

            characters_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            players_result = await players_collection.update_one(
                _matching_player_uid_query(uid),
                {"$set": {"gather_rewards": sorted(cleaned_gather_rewards)}},
            )
            if characters_result.matched_count <= 0 or players_result.matched_count <= 0:
                raise ValueError("character.update_awaken_failed")

            return UpdateCharacterAwakenResponse(
                record_id=record_id,
                CharacterId=character_id,
                AwakenLevel=awaken_level,
                LiberateLv=awaken_level,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_grade(self, uid: int, record_id: int, grade: int) -> UpdateCharacterGradeResponse:
        if grade < 1:
            raise ValueError("character.update_invalid_grade")

        character_grade_name_map = get_character_grade_name_map()
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            grade_names = character_grade_name_map.get(character_id)
            if not isinstance(grade_names, list) or grade > len(grade_names):
                raise ValueError("character.update_invalid_grade")

            target_character["Grade"] = grade

            update_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            if update_result.matched_count <= 0:
                raise ValueError("character.update_grade_failed")

            return UpdateCharacterGradeResponse(
                record_id=record_id,
                CharacterId=character_id,
                Grade=grade,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_quality_star(self, uid: int, record_id: int, quality: int, star: int) -> UpdateCharacterResponse:
        if quality < 1 or quality > 6:
            raise ValueError("character.update_invalid_quality_star")
        if star < 0 or star > 9:
            raise ValueError("character.update_invalid_quality_star")
        if quality == 6 and star != 0:
            raise ValueError("character.update_invalid_quality_star")

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            quality_bound_map = get_character_quality_bound_map()
            quality_bound = quality_bound_map.get(character_id, [])
            if len(quality_bound) != 2:
                raise ValueError("character.update_invalid_quality_star")

            min_quality, max_quality = quality_bound
            if quality < min_quality or quality > max_quality:
                raise ValueError("character.update_invalid_quality_star")

            target_character["Quality"] = quality
            target_character["Star"] = 0 if quality == 6 else star
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_failed")

            return UpdateCharacterResponse(
                record_id=record_id,
                CharacterId=character_id,
                Quality=target_character["Quality"],
                Star=target_character["Star"],
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_level_exp(self, uid: int, record_id: int, level: int, exp: int) -> UpdateCharacterLevelupResponse:
        if exp < 0:
            raise ValueError("character.update_invalid_level_exp")

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            levelup_template_id = get_character_levelup_template_map().get(character_id)
            if levelup_template_id is None:
                raise ValueError("character.update_invalid_level_exp")

            level_exp_map = get_level_exp_map(levelup_template_id)
            if not level_exp_map:
                raise ValueError("character.update_invalid_level_exp")

            min_level = min(level_exp_map)
            max_level = max(level_exp_map)
            if level < min_level or level > max_level:
                raise ValueError("character.update_invalid_level_exp")

            if level not in level_exp_map:
                raise ValueError("character.level_not_defined")

            current_level_exp_limit = level_exp_map[level]
            allowed_max_exp = current_level_exp_limit if level == max_level else max(current_level_exp_limit - 1, 0)
            if exp > allowed_max_exp:
                raise ValueError("character.update_invalid_level_exp")

            target_character["Level"] = level
            target_character["Exp"] = exp
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_levelup_failed")

            return UpdateCharacterLevelupResponse(
                record_id=record_id,
                CharacterId=character_id,
                Level=target_character["Level"],
                Exp=target_character["Exp"],
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_trust(self, uid: int, record_id: int, trust_lv: int, trust_exp: int) -> UpdateCharacterTrustResponse:
        if trust_exp < 0:
            raise ValueError("character.update_invalid_trust")

        trust_exp_map = get_character_trust_exp_map()
        if not trust_exp_map:
            raise ValueError("character.update_invalid_trust")

        trust_levels = sorted(level for level in trust_exp_map if isinstance(level, int) and level > 0 and level <= 8)
        if not trust_levels:
            raise ValueError("character.update_invalid_trust")

        min_trust_lv = trust_levels[0]
        max_trust_lv = min(trust_levels[-1], 8)
        if trust_lv < min_trust_lv or trust_lv > max_trust_lv or trust_lv not in trust_exp_map:
            raise ValueError("character.update_invalid_trust")

        raw_limit = trust_exp_map[trust_lv]
        allowed_max_exp = raw_limit if trust_lv == max_trust_lv else max(raw_limit - 1, 0)
        if trust_exp > allowed_max_exp:
            raise ValueError("character.update_invalid_trust")

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            target_character["TrustLv"] = trust_lv
            target_character["TrustExp"] = trust_exp
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_trust_failed")

            return UpdateCharacterTrustResponse(
                record_id=record_id,
                CharacterId=character_id,
                TrustLv=target_character["TrustLv"],
                TrustExp=target_character["TrustExp"],
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_fashion(self, uid: int, record_id: int, fashion_id: int) -> UpdateCharacterFashionResponse:
        if fashion_id <= 0:
            raise ValueError("character.update_invalid_fashion")

        character_fashions_map = get_character_fashions_map()
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            allowed_fashion_ids = {
                normalized_id
                for fashion in character_fashions_map.get(character_id, [])
                if isinstance(fashion, dict)
                for normalized_id in [parse_optional_int(fashion.get("Id"))]
                if normalized_id is not None
            }
            if fashion_id not in allowed_fashion_ids:
                raise ValueError("character.update_invalid_fashion")

            fashion_index = next(
                (
                    index
                    for index, fashion in enumerate(fashions)
                    if parse_optional_int(fashion.get("_id")) == fashion_id
                ),
                None,
            )
            if fashion_index is None:
                raise ValueError("character.update_invalid_fashion")

            target_fashion = fashions[fashion_index]
            target_fashion["IsLock"] = False
            target_character["FashionId"] = fashion_id

            character_head_info = target_character.get("CharacterHeadInfo")
            normalized_head_info = character_head_info if isinstance(character_head_info, dict) else {}
            normalized_head_info["HeadFashionId"] = fashion_id
            current_head_fashion_type = parse_optional_int(normalized_head_info.get("HeadFashionType"))
            normalized_head_info["HeadFashionType"] = current_head_fashion_type if current_head_fashion_type is not None else 0
            target_character["CharacterHeadInfo"] = normalized_head_info

            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters, "fashions": fashions}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_fashion_failed")

            return UpdateCharacterFashionResponse(
                record_id=record_id,
                CharacterId=character_id,
                CurrentFahionId=fashion_id,
                HeadFashionId=fashion_id,
                HeadFashionType=parse_optional_int(normalized_head_info.get("HeadFashionType")),
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def _update_character_skill_level(
        self,
        uid: int,
        record_id: int,
        skill_id: int,
        level: int,
        *,
        list_field_name: str,
        skill_ids_map: dict[int, list[int]],
        skill_entries_map: dict[int, dict[str, int | str]],
        invalid_error: str,
        failed_error: str,
    ) -> UpdateCharacterSkillResponse:
        if skill_id <= 0 or level < 0:
            raise ValueError(invalid_error)

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = _get_character_id(target_character)
            if character_id is None:
                raise ValueError("character.not_found")

            allowed_skill_ids = skill_ids_map.get(character_id, [])
            if skill_id not in allowed_skill_ids:
                raise ValueError(invalid_error)

            entry = skill_entries_map.get(skill_id, {})
            max_level = parse_optional_int(entry.get("MaxLevel")) or 0
            if max_level <= 0 or level > max_level:
                raise ValueError(invalid_error)

            raw_skill_list = target_character.get(list_field_name)
            normalized_skill_list = [item for item in raw_skill_list if isinstance(item, dict)] if isinstance(raw_skill_list, list) else []
            updated = False
            for skill_entry in normalized_skill_list:
                if parse_optional_int(skill_entry.get("_id")) != skill_id:
                    continue

                skill_entry["Level"] = level
                updated = True
                break

            if not updated:
                normalized_skill_list.append({
                    "_id": skill_id,
                    "Level": level,
                })

            target_character[list_field_name] = normalized_skill_list
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters}},
            )
            if result.matched_count <= 0:
                raise ValueError(failed_error)

            return UpdateCharacterSkillResponse(
                record_id=record_id,
                CharacterId=character_id,
                SkillId=skill_id,
                Level=level,
                MaxLevel=max_level,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_skill_level(self, uid: int, record_id: int, skill_id: int, level: int) -> UpdateCharacterSkillResponse:
        return await self._update_character_skill_level(
            uid,
            record_id,
            skill_id,
            level,
            list_field_name="SkillList",
            skill_ids_map=get_character_skill_ids_map(),
            skill_entries_map=get_character_skill_entries_map(),
            invalid_error="character.update_invalid_skill_level",
            failed_error="character.update_skill_failed",
        )

    async def update_character_enhance_skill_level(self, uid: int, record_id: int, skill_id: int, level: int) -> UpdateCharacterSkillResponse:
        return await self._update_character_skill_level(
            uid,
            record_id,
            skill_id,
            level,
            list_field_name="EnhanceSkillList",
            skill_ids_map=get_character_enhance_skill_ids_map(),
            skill_entries_map=get_character_enhance_skill_entries_map(),
            invalid_error="character.update_invalid_enhance_skill_level",
            failed_error="character.update_enhance_skill_failed",
        )

    async def set_character_support(self, uid: int, record_id: int) -> bool:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = _find_character_index(characters, record_id)
            if target_index is None:
                return False

            if target_index == 0:
                return True

            target_character = characters.pop(target_index)
            characters.insert(0, target_character)
            result = await characters_collection.update_one(
                matching_uid_query(uid),
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
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
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
            character_id = parse_optional_int(raw_character.get("_id"))
            if character_id is None:
                continue

            grade = max(0, int(parse_optional_int(raw_character.get("Grade")) or 0))
            grade_name = _resolve_grade_name(character_id, grade, character_grade_name_map)
            character_name = character_name_map.get(character_id, "")
            search_priority = _get_search_priority(normalized_keyword, character_name, grade_name)
            if search_priority is None:
                continue

            record_id = _get_character_record_id(raw_character) or character_id
            normalized_item = CharacterManagementItemRecord(
                record_id=record_id,
                CharacterId=character_id,
                Sequence=index + 1,
                Level=parse_optional_int(raw_character.get("Level")),
                Quality=parse_optional_int(raw_character.get("Quality")),
                Star=parse_optional_int(raw_character.get("Star")),
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

    async def get_character_extra_info(self, uid: int, record_id: int) -> CharacterExtraInfoRecord:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1, "equips": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_characters_document = self._sanitize_characters_document(characters_document)
        characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
        account_fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))
        account_equips = self._sanitize_equips(normalized_characters_document.get("equips"))
        target_character = next(
            (
                character
                for character in characters
                if _get_character_record_id(character) == record_id
            ),
            None,
        )
        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("CharacterId"))
        if character_id is None:
            character_id = parse_optional_int(target_character.get("_id"))
        character_intro_map = get_character_Intro_map()
        character_fashions_map = get_character_fashions_map()
        character_levelup_template_map = get_character_levelup_template_map()
        character_max_liberate_level_map = get_character_max_liberate_level_map()
        character_quality_bound_map = get_character_quality_bound_map()
        equip_descriptions_map = get_equip_descriptions_map()
        equip_site_map = get_equip_site_map()
        character_skill_ids_map = get_character_skill_ids_map()
        character_skill_entries_map = get_character_skill_entries_map()
        character_enhance_skill_ids_map = get_character_enhance_skill_ids_map()
        character_enhance_skill_entries_map = get_character_enhance_skill_entries_map()
        level_exp_map: dict[int, int] = {}
        if character_id is not None:
            levelup_template_id = character_levelup_template_map.get(character_id)
            if levelup_template_id is not None:
                level_exp_map = get_level_exp_map(levelup_template_id)

        fashion_lock_map: dict[int, bool] = {}
        for fashion in account_fashions:
            fashion_id = parse_optional_int(fashion.get("_id"))
            if fashion_id is None:
                continue
            fashion_lock_map[fashion_id] = bool(fashion.get("IsLock", True))

        fashions: list[CharacterFashionRecord] = []
        for fashion in character_fashions_map.get(character_id, []) if character_id is not None else []:
            if not isinstance(fashion, dict):
                continue

            fashion_id = parse_optional_int(fashion.get("Id"))
            quality = parse_optional_int(fashion.get("Quality"))
            big_icon = str(fashion.get("BigIcon") or "").strip()
            big_head_icon_fashion = str(fashion.get("BigHeadIconFashion") or "").strip()
            name = str(fashion.get("Name") or "").strip()
            description = str(fashion.get("Description") or "").strip()
            if fashion_id is None or quality is None or not big_icon or not big_head_icon_fashion:
                continue

            fashions.append(
                CharacterFashionRecord(
                    Id=fashion_id,
                    Quality=quality,
                    IsLock=fashion_lock_map.get(fashion_id, True),
                    BigIcon=big_icon,
                    BigHeadIconFashion=big_head_icon_fashion,
                    Name=name,
                    Description=description
                )
            )

        def build_character_equip(raw_equip: dict[str, Any]) -> CharacterEquipRecord | None:
            equip_record_id = parse_optional_int(raw_equip.get("_id"))
            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if equip_record_id is None or template_id is None:
                return None

            return CharacterEquipRecord(
                record_id=equip_record_id,
                TemplateId=template_id,
                Breakthrough=parse_optional_int(raw_equip.get("Breakthrough")),
                Level=parse_optional_int(raw_equip.get("Level")),
            )

        def build_character_weapon(raw_equip: dict[str, Any]) -> CharacterDetailWeaponRecord | None:
            normalized_equip = build_character_equip(raw_equip)
            if normalized_equip is None:
                return None

            template_id = normalized_equip.TemplateId
            resonance_info = [entry for entry in _normalize_weapon_resonance_list(raw_equip.get("ResonanceInfo")) if entry.slot in {1, 2, 3}]
            weapon_overrun_data = None
            max_overrun_level = get_weapon_overrun_max_level_map().get(template_id)
            if self._supports_weapon_overrun_data() and max_overrun_level is not None:
                normalized_overrun = _normalize_weapon_overrun_data(raw_equip.get("WeaponOverrunData"))
                if normalized_overrun is None:
                    weapon_overrun_data = CharacterWeaponOverrunRecord(max_level=max_overrun_level)
                else:
                    weapon_overrun_data = CharacterWeaponOverrunRecord(
                        level=normalized_overrun.level,
                        max_level=max_overrun_level,
                        chose_suit=normalized_overrun.chose_suit,
                    )

            return CharacterDetailWeaponRecord(
                record_id=normalized_equip.record_id,
                TemplateId=normalized_equip.TemplateId,
                Breakthrough=normalized_equip.Breakthrough,
                Level=normalized_equip.Level,
                Description=equip_descriptions_map.get(template_id),
                resonance_info=resonance_info,
                weapon_overrun_data=weapon_overrun_data,
            )

        def build_character_memory(raw_equip: dict[str, Any]) -> CharacterDetailMemoryRecord | None:
            normalized_equip = build_character_equip(raw_equip)
            if normalized_equip is None:
                return None

            resonance_info = [entry for entry in _normalize_weapon_resonance_list(raw_equip.get("ResonanceInfo")) if entry.slot in {1, 2}]
            return CharacterDetailMemoryRecord(
                record_id=normalized_equip.record_id,
                TemplateId=normalized_equip.TemplateId,
                Breakthrough=normalized_equip.Breakthrough,
                Level=normalized_equip.Level,
                Description=equip_descriptions_map.get(normalized_equip.TemplateId),
                resonance_info=resonance_info,
            )

        character_weapon: CharacterDetailWeaponRecord | None = None
        character_memories: list[CharacterDetailMemoryRecord] = []
        character_skills = _build_character_skill_info_list(
            character_id,
            target_character.get("SkillList"),
            character_skill_ids_map,
            character_skill_entries_map,
        )
        character_enhance_skills = _build_character_skill_info_list(
            character_id,
            target_character.get("EnhanceSkillList"),
            character_enhance_skill_ids_map,
            character_enhance_skill_entries_map,
        )
        for raw_equip in account_equips:
            equipped_character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
            if character_id is None or equipped_character_id != character_id:
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if template_id is None:
                continue

            site_value = str(equip_site_map.get(template_id, "")).strip()
            if not site_value or site_value == "0":
                if character_weapon is None:
                    character_weapon = build_character_weapon(raw_equip)
                continue

            normalized_memory = build_character_memory(raw_equip)
            if normalized_memory is not None:
                character_memories.append(normalized_memory)

        return CharacterExtraInfoRecord(
            TrustLv=parse_optional_int(target_character.get("TrustLv")),
            TrustExp=parse_optional_int(target_character.get("TrustExp")),
            Exp=parse_optional_int(target_character.get("Exp")),
            MaxLiberateLevel=character_max_liberate_level_map.get(character_id) if character_id is not None else None,
            LevelExpMap=level_exp_map,
            QualityBound=character_quality_bound_map.get(character_id, []) if character_id is not None else [],
            Intro=character_intro_map.get(character_id) if character_id is not None else None,
            CurrentFahionId=parse_optional_int(target_character.get("FashionId")),
            Fashions=fashions,
            Weapon=character_weapon,
            Memories=character_memories,
            SkillsList=character_skills,
            EnhanceSkillList=character_enhance_skills,
        )
