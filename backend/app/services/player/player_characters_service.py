from __future__ import annotations

import copy
import contextlib
import math
import time
from typing import Any, Literal

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AddCharacterResponse, CharacterAvailableListResponse, CharacterDetailMemoryRecord, CharacterDetailWeaponRecord, CharacterEquipRecord, CharacterEquipResonanceRecord, CharacterExtraInfoRecord, CharacterFashionRecord, CharacterManagementItemRecord, CharacterManagementListResponse, CharacterSkillInfoRecord, CharacterWeaponOverrunRecord, MaxAllCharactersResponse, MaxCharacterResponse, SetCharacterSupportResponse, UpdateCharacterAwakenResponse, UpdateCharacterFashionResponse, UpdateCharacterHeadFashionResponse, UpdateCharacterWeaponFashionResponse, UpdateCharacterGradeResponse, UpdateCharacterLevelupResponse, UpdateCharacterResponse, UpdateCharacterSkillResponse, UpdateCharacterTrustResponse, WeaponFashionRecord
from backend.app.db.models.player_characters import CHARACTER_LIST_SCHEMA_PATH, CHARACTERS_COLLECTION_NAME, EQUIPS_SCHEMA_PATH, FASHION_ITEM_SCHEMA_PATH, FASHIONS_SCHEMA_PATH, WEAPON_FASHION_ITEM_SCHEMA_PATH, WEAPON_FASHIONS_SCHEMA_PATH
from backend.app.db.models.player_profile import PLAYER_COLLECTION_NAME
from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.equips import get_equip_descriptions_map, get_equip_site_map, get_equip_type_weapon_fashion_ids_map, get_weapon_fashion_id_entries_map
from backend.app.services.player.equips.weapon import get_weapon_overrun_max_level_map
from backend.app.services.constants import DEFAULT_LIST_PAGE_SIZE
from backend.app.services.player.levelup_template import get_level_exp_map
from backend.app.services.player.utils import matching_uid_query, normalize_search_keyword, ordered_number_key, ordered_text_key, parse_optional_int
from backend.app.services.player.player_characters import (
    build_character_max_skills,
    get_character_add_config_map,
    get_character_Intro_map,
    get_character_default_fashion_id_map,
    get_character_enhance_skill_entries_map,
    get_character_enhance_skill_ids_map,
    get_character_exhibitions_map,
    get_exhibition_fashion_id_map,
    get_character_fashions_map,
    get_character_grade_name_map,
    get_character_levelup_template_map,
    get_character_log_name_map,
    get_character_max_template_map,
    get_character_max_liberate_level_map,
    get_character_quality_bound_map,
    get_character_skill_entries_map,
    get_character_skill_ids_map,
    get_character_skill_groups_map,
    get_character_trust_exp_map,
    get_character_default_weapon_map,
    get_character_equip_type_map,
)
from backend.app.services.player.nameplates import get_nameplate_entires_map
from backend.app.services.player.chat_emojis import get_emoji_entires_map
from backend.app.services.player.score_titles import get_score_title_entires_map
CharacterSortField = Literal["sequence", "name", "quality", "level", "grade", "awaken_level"]
CharacterSortOrder = Literal["asc", "desc"]


def _is_memory_template_id(template_id: int | None) -> bool:
    if template_id is None:
        return False

    site_value = str(get_equip_site_map().get(template_id, "")).strip()
    return bool(site_value) and site_value != "0"


def _is_weapon_template_id(template_id: int | None) -> bool:
    if template_id is None:
        return False

    site_value = str(get_equip_site_map().get(template_id, "")).strip()
    return not site_value or site_value == "0"


def _get_best_weapon_fashion_id(equip_type: int | None) -> int | None:
    fashion_entries_map = get_weapon_fashion_id_entries_map()
    return max(
        (
            fashion_id
            for fashion_id in get_equip_type_weapon_fashion_ids_map().get(equip_type, [])
            if fashion_id in fashion_entries_map
        ),
        key=lambda fashion_id: (int(fashion_entries_map[fashion_id]["Quality"]), fashion_id),
        default=None,
    )


def _get_next_equip_record_id(raw_equips: list[Any]) -> int:
    existing_ids = sorted({
        current_id
        for raw_equip in raw_equips
        if isinstance(raw_equip, dict)
        for current_id in [parse_optional_int(raw_equip.get("_id"))]
        if current_id is not None and current_id > 0
    })
    next_id = 1
    for current_id in existing_ids:
        if current_id != next_id:
            return next_id
        next_id += 1
    return next_id


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
    return {"player_data._id": Int64(uid)}


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

    def _sanitize_weapon_fashions(self, raw_fashions: Any) -> list[dict[str, Any]]:
        sanitized = self._get_characters_schema().sanitize_read(
            raw_fashions,
            WEAPON_FASHIONS_SCHEMA_PATH,
        )
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    async def get_nameplate_state(self, uid: int) -> tuple[int | None, list[int]]:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"nameplates": 1, "current_wear_nameplate": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not document:
            return None, []

        normalized_document = self._sanitize_characters_document(document)
        now_unix_seconds = int(time.time())
        nameplate_entries_map = get_nameplate_entires_map()
        raw_nameplates = normalized_document.get("nameplates")
        valid_nameplates = raw_nameplates if isinstance(raw_nameplates, list) else []
        unlock_nameplates = sorted({
            nameplate_id
            for owned in valid_nameplates if isinstance(owned, dict)
            if (nameplate_id := parse_optional_int(owned.get("_id"))) in nameplate_entries_map
            and ((end_time := parse_optional_int(owned.get("EndTime"))) is None or end_time == 0 or end_time > now_unix_seconds)
        })
        current_wear_nameplate = parse_optional_int(normalized_document.get("current_wear_nameplate"))
        return (current_wear_nameplate if current_wear_nameplate in unlock_nameplates else None), unlock_nameplates

    async def select_nameplate(self, uid: int, nameplate_id: int) -> bool:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"nameplates": 1})
            if not document:
                return False

            normalized_document = self._sanitize_characters_document(document)
            raw_nameplates = normalized_document.get("nameplates")
            nameplates = raw_nameplates if isinstance(raw_nameplates, list) else []
            now_unix_seconds = int(time.time())
            if nameplate_id > 0:
                existing_index = next((
                    index for index, owned in enumerate(nameplates)
                    if isinstance(owned, dict) and parse_optional_int(owned.get("_id")) == nameplate_id
                ), None)
                existing_end_time = parse_optional_int(nameplates[existing_index].get("EndTime")) if existing_index is not None else None
                if existing_index is None or (existing_end_time not in {None, 0} and existing_end_time <= now_unix_seconds):
                    owned = {"_id": nameplate_id, "Exp": 0, "EndTime": Int64(0), "GetTime": Int64(now_unix_seconds)}
                    if existing_index is None:
                        nameplates.append(owned)
                    else:
                        nameplates[existing_index] = owned

            update_fields = self._get_characters_schema().materialize_update_fields({
                "nameplates": nameplates,
                "current_wear_nameplate": nameplate_id,
            })
            result = await collection.update_one(matching_uid_query(uid), {"$set": update_fields})
            return result.matched_count > 0
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def get_locked_chat_emojis(self, uid: int) -> dict[int, dict[str, str | None]] | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"chat_emojis": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not document:
            return None

        normalized_document = self._sanitize_characters_document(document)
        now_unix_seconds = int(time.time())
        raw_emojis = normalized_document.get("chat_emojis")
        emojis = raw_emojis if isinstance(raw_emojis, list) else []
        active_ids = {
            emoji_id
            for owned in emojis
            if isinstance(owned, dict)
            if (emoji_id := parse_optional_int(owned.get("_id"))) is not None
            and ((end_time := parse_optional_int(owned.get("EndTime"))) is None or end_time == 0 or end_time > now_unix_seconds)
        }
        return {
            emoji_id: entry
            for emoji_id, entry in get_emoji_entires_map().items()
            if emoji_id not in active_ids
        }

    async def unlock_chat_emojis(self, uid: int, emoji_ids: list[int]) -> list[int] | None:
        valid_ids = set(emoji_ids) & set(get_emoji_entires_map())
        if not valid_ids:
            return []

        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"chat_emojis": 1})
            if not document:
                return None

            normalized_document = self._sanitize_characters_document(document)
            raw_emojis = normalized_document.get("chat_emojis")
            emojis = [entry for entry in raw_emojis if isinstance(entry, dict)] if isinstance(raw_emojis, list) else []
            now_unix_seconds = int(time.time())
            unlocked_ids: list[int] = []
            for emoji_id in sorted(valid_ids):
                existing_index = next((
                    index for index, owned in enumerate(emojis)
                    if parse_optional_int(owned.get("_id")) == emoji_id
                ), None)
                existing_end_time = parse_optional_int(emojis[existing_index].get("EndTime")) if existing_index is not None else None
                if existing_index is not None and (existing_end_time is None or existing_end_time == 0 or existing_end_time > now_unix_seconds):
                    continue

                emoji = {"_id": emoji_id, "EndTime": 0}
                if existing_index is None:
                    emojis.append(emoji)
                else:
                    emojis[existing_index] = emoji
                unlocked_ids.append(emoji_id)

            if unlocked_ids:
                update_fields = self._get_characters_schema().materialize_update_fields({"chat_emojis": emojis})
                result = await collection.update_one(matching_uid_query(uid), {"$set": update_fields})
                if result.matched_count <= 0:
                    return None
            return unlocked_ids
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def get_locked_score_titles(self, uid: int) -> dict[int, dict[str, int | str | None]] | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"score_titles": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not document:
            return None

        normalized_document = self._sanitize_characters_document(document)
        raw_titles = normalized_document.get("score_titles")
        titles = raw_titles if isinstance(raw_titles, list) else []
        qualities_by_id = {
            title_id: quality
            for owned in titles
            if isinstance(owned, dict)
            if (title_id := parse_optional_int(owned.get("_id"))) is not None
            if (quality := parse_optional_int(owned.get("Quality"))) is not None
        }
        return {
            title_id: entry
            for title_id, entry in get_score_title_entires_map().items()
            if qualities_by_id.get(title_id) != entry["MaxQuality"]
        }

    async def unlock_score_titles(self, uid: int, title_ids: list[int]) -> list[int] | None:
        entries_map = get_score_title_entires_map()
        valid_ids = set(title_ids) & set(entries_map)
        if not valid_ids:
            return []

        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"score_titles": 1})
            if not document:
                return None

            normalized_document = self._sanitize_characters_document(document)
            raw_titles = normalized_document.get("score_titles")
            titles = [entry for entry in raw_titles if isinstance(entry, dict)] if isinstance(raw_titles, list) else []
            unlocked_ids: list[int] = []
            for title_id in sorted(valid_ids):
                max_quality = entries_map[title_id]["MaxQuality"]
                existing_index = next((
                    index for index, owned in enumerate(titles)
                    if parse_optional_int(owned.get("_id")) == title_id
                ), None)
                if existing_index is not None and parse_optional_int(titles[existing_index].get("Quality")) == max_quality:
                    continue

                if existing_index is None:
                    titles.append({"_id": title_id, "Quality": max_quality, "Score": 0, "Time": 0, "WallId": 0, "ExpandInfo": None})
                else:
                    titles[existing_index]["Quality"] = max_quality
                unlocked_ids.append(title_id)

            if unlocked_ids:
                update_fields = self._get_characters_schema().materialize_update_fields({"score_titles": titles})
                result = await collection.update_one(matching_uid_query(uid), {"$set": update_fields})
                if result.matched_count <= 0:
                    return None
            return unlocked_ids
        finally:
            with contextlib.suppress(Exception):
                client.close()

    def _build_weapon_fashion_document(self, fashion_id: int, character_id: int) -> dict[str, Any]:
        fashion_document = self._get_characters_schema().materialize_write({
            "_id": fashion_id,
            "UseCharacterList": [character_id],
        }, WEAPON_FASHION_ITEM_SCHEMA_PATH)
        if not isinstance(fashion_document, dict):
            raise RuntimeError("Failed to materialize weapon fashion schema")
        return fashion_document

    def _apply_best_weapon_fashion(self, weapon_fashions: list[dict[str, Any]], character_id: int) -> list[dict[str, Any]]:
        equip_type = get_character_equip_type_map().get(character_id)
        fashion_ids = get_equip_type_weapon_fashion_ids_map().get(equip_type, [])
        best_fashion_id = _get_best_weapon_fashion_id(equip_type)
        if best_fashion_id is None:
            return weapon_fashions

        existing_fashion_ids = {
            fashion_id
            for weapon_fashion in weapon_fashions
            for fashion_id in [parse_optional_int(weapon_fashion.get("_id"))]
            if fashion_id is not None
        }
        for fashion_id in fashion_ids:
            if fashion_id in existing_fashion_ids:
                continue
            weapon_fashions.append(self._build_weapon_fashion_document(fashion_id, character_id))
            existing_fashion_ids.add(fashion_id)

        best_fashion = None
        for weapon_fashion in weapon_fashions:
            weapon_fashion_id = parse_optional_int(weapon_fashion.get("_id"))
            use_character_list = [
                listed_character_id
                for raw_character_id in weapon_fashion.get("UseCharacterList", [])
                for listed_character_id in [parse_optional_int(raw_character_id)]
                if listed_character_id is not None and listed_character_id != character_id
            ]
            weapon_fashion["UseCharacterList"] = use_character_list
            if weapon_fashion_id == best_fashion_id:
                best_fashion = weapon_fashion

        if best_fashion is None:
            weapon_fashions.append(self._build_weapon_fashion_document(best_fashion_id, character_id))
        else:
            best_fashion["UseCharacterList"].append(character_id)

        return weapon_fashions

    def _build_fashions_update(self, fashions: list[dict[str, Any]]) -> dict[str, Any]:
        materialized_update = self._get_characters_schema().materialize_update_fields({
            "fashions": self._sanitize_fashions(fashions),
        })
        if "fashions" not in materialized_update:
            raise RuntimeError("Failed to materialize fashions update")
        return materialized_update

    def _build_fashion_document(self, fashion_id: int) -> dict[str, Any]:
        fashion_document = self._get_characters_schema().materialize_write({
            "_id": fashion_id,
            "IsLock": False,
        }, FASHION_ITEM_SCHEMA_PATH)

        if not isinstance(fashion_document, dict):
            raise RuntimeError("Failed to materialize fashion schema")

        return fashion_document

    def _build_character_document(self, character_id: int, *, quality: int, fashion_id: int) -> dict[str, Any]:
        now = int(time.time())
        character_document = self._get_characters_schema().materialize_write({
            "_id": character_id,
            "Quality": quality,
            "InitQuality": quality,
            "CreateTime": Int64(now),
            "FashionId": fashion_id,
            "LiberateLv": 1,
            "CharacterHeadInfo": {
                "HeadFashionId": fashion_id,
                "HeadFashionType": 0,
            },
        }, "characters.0")

        if not isinstance(character_document, dict):
            raise RuntimeError("Failed to materialize character schema")

        if "CreateTime" in character_document:
            character_document["CreateTime"] = Int64(now)

        return character_document

    def _unlock_exhibition_fashions(self, fashions: list[dict[str, Any]], character_id: int, awaken_level: int) -> None:
        unlock_fashion_ids = set().union(*(
            get_exhibition_fashion_id_map().get((character_id, level), frozenset())
            for level in range(1, awaken_level + 1)
        ))
        if not unlock_fashion_ids:
            return

        fashions_by_id = {
            fashion_id: fashion
            for fashion in fashions
            if (fashion_id := parse_optional_int(fashion.get("_id"))) is not None
        }
        for fashion_id in unlock_fashion_ids:
            existing_fashion = fashions_by_id.get(fashion_id)
            if existing_fashion is None:
                fashions.append(self._build_fashion_document(fashion_id))
            else:
                existing_fashion["IsLock"] = False

    def _normalize_character_head_info(self, character: dict[str, Any], character_id: int, awaken_level: int) -> None:
        default_fashion_id = get_character_default_fashion_id_map().get(character_id)
        head_info = character.get("CharacterHeadInfo")
        normalized_head_info = head_info if isinstance(head_info, dict) else {}
        head_fashion_id = parse_optional_int(normalized_head_info.get("HeadFashionId"))
        if head_fashion_id is None or head_fashion_id <= 0:
            head_fashion_id = default_fashion_id
        if head_fashion_id is None:
            return

        normalized_head_info["HeadFashionId"] = head_fashion_id
        if head_fashion_id == default_fashion_id:
            normalized_head_info["HeadFashionType"] = 1 if awaken_level >= 4 else 0
        else:
            normalized_head_info["HeadFashionType"] = 2
        character["CharacterHeadInfo"] = normalized_head_info

    def _sanitize_equips(self, raw_equips: Any) -> list[dict[str, Any]]:
        sanitized = self._get_characters_schema().sanitize_read(raw_equips, EQUIPS_SCHEMA_PATH)
        return [item for item in sanitized if isinstance(item, dict)] if isinstance(sanitized, list) else []

    def _build_equips_update(self, equips: list[dict[str, Any]]) -> dict[str, Any]:
        materialized_update = self._get_characters_schema().materialize_update_fields({
            "equips": self._sanitize_equips(equips),
        })
        if "equips" not in materialized_update:
            raise RuntimeError("Failed to materialize equips update")
        return materialized_update

    def _build_players_update(self, gather_rewards: set[int] | list[int]) -> dict[str, Any]:
        normalized_gather_rewards = sorted(gather_rewards) if isinstance(gather_rewards, set) else list(gather_rewards)
        materialized_update = self._get_players_schema().materialize_update_fields({
            "gather_rewards": sorted(self._sanitize_gather_rewards(normalized_gather_rewards)),
        })
        if "gather_rewards" not in materialized_update:
            raise RuntimeError("Failed to materialize players update")
        return materialized_update

    def _build_gather_rewards_from_characters(self, characters: list[dict[str, Any]]) -> set[int]:
        character_exhibitions_map = get_character_exhibitions_map()
        gather_rewards: set[int] = set()

        for raw_character in characters:
            if not isinstance(raw_character, dict):
                continue

            character_id = parse_optional_int(raw_character.get("_id"))
            liberate_lv = max(0, parse_optional_int(raw_character.get("LiberateLv")) or 0)
            if character_id is None or liberate_lv <= 0:
                continue

            awaken_path = [
                exhibition_id
                for raw_exhibition_id in character_exhibitions_map.get(character_id, [])
                for exhibition_id in [parse_optional_int(raw_exhibition_id)]
                if exhibition_id is not None
            ]
            gather_rewards.update(awaken_path[:liberate_lv])

        return gather_rewards

    async def add_character(self, uid: int, character_id: int) -> AddCharacterResponse:
        if character_id <= 0:
            raise ValueError("character.add_invalid")

        config = get_character_add_config_map().get(character_id)
        if config is None:
            raise ValueError("character.add_invalid")
        min_quality = config["Quality"]
        fashion_id = config["FashionId"]
        weapon_template_id = config["WeaponId"]

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1, "equips": 1, "weaponFashions": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})

            normalized_characters_document = self._sanitize_characters_document(characters_document)
            normalized_players_document = self._sanitize_players_document(players_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))
            equips = self._sanitize_equips(normalized_characters_document.get("equips"))
            gather_rewards = self._sanitize_gather_rewards(normalized_players_document.get("gather_rewards"))

            if any(parse_optional_int(character.get("_id")) == character_id for character in characters):
                raise ValueError("character.add_already_owned")

            characters.append(self._build_character_document(character_id, quality=min_quality, fashion_id=fashion_id))

            fashion_index = next(
                (
                    index
                    for index, fashion in enumerate(fashions)
                    if parse_optional_int(fashion.get("_id")) == fashion_id
                ),
                None,
            )
            if fashion_index is None:
                fashions.append(self._build_fashion_document(fashion_id))
            else:
                fashions[fashion_index]["IsLock"] = False

            equips.append(self._build_equip_document(equips, {
                "TemplateId": weapon_template_id,
                "CharacterId": character_id,
                "Level": 1,
                "Exp": 0,
                "Breakthrough": 0,
                "ResonanceInfo": [],
                "AwakeSlotList": [],
                "WeaponOverrunData": {},
            }))

            awaken_path = [
                exhibition_id
                for raw_exhibition_id in get_character_exhibitions_map().get(character_id, [])
                for exhibition_id in [parse_optional_int(raw_exhibition_id)]
                if exhibition_id is not None
            ]
            updated_gather_rewards = set(gather_rewards)
            updated_gather_rewards.update(awaken_path[:1])
            self._unlock_exhibition_fashions(fashions, character_id, 1)

            characters_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {
                    "$set": {
                        "characters": characters,
                        **self._build_fashions_update(fashions),
                        **self._build_equips_update(equips),
                    },
                },
            )
            players_result = await players_collection.update_one(
                _matching_player_uid_query(uid),
                {"$set": self._build_players_update(updated_gather_rewards)},
            )
            if characters_result.matched_count <= 0 or players_result.matched_count <= 0:
                raise ValueError("character.add_failed")

            return AddCharacterResponse(
                record_id=character_id,
                CharacterId=character_id,
                added=True,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    def _build_equip_document(self, raw_equips: list[dict[str, Any]], equip_template: dict[str, Any]) -> dict[str, Any]:
        now = int(time.time())
        payload = {
            "_id": _get_next_equip_record_id(raw_equips),
            "TemplateId": equip_template.get("TemplateId"),
            "CharacterId": equip_template.get("CharacterId", 0),
            "Level": equip_template.get("Level", 1),
            "Exp": equip_template.get("Exp", 0),
            "Breakthrough": equip_template.get("Breakthrough", 0),
            "ResonanceInfo": equip_template.get("ResonanceInfo", []),
            "UnconfirmedResonanceInfo": [],
            "AwakeSlotList": list(equip_template.get("AwakeSlotList", [])),
            "IsLock": False,
            "CreateTime": Int64(now),
            "IsRecycle": False,
        }
        if _is_weapon_template_id(parse_optional_int(equip_template.get("TemplateId"))):
            payload["WeaponOverrunData"] = equip_template.get("WeaponOverrunData", {})

        equip_document = self._get_characters_schema().materialize_write(payload, "equips.0")
        if not isinstance(equip_document, dict):
            raise RuntimeError("Failed to materialize equip schema")
        if "CreateTime" in equip_document:
            equip_document["CreateTime"] = Int64(now)
        return equip_document

    def _apply_max_character_template(
        self,
        *,
        target_character: dict[str, Any],
        characters: list[dict[str, Any]],
        fashions: list[dict[str, Any]],
        equips: list[dict[str, Any]],
        weapon_fashions: list[dict[str, Any]],
        gather_rewards: set[int],
        template: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[int]]:
        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")

        equips = [
            raw_equip
            for raw_equip in equips
            if not isinstance(raw_equip, dict)
            or (parse_optional_int(raw_equip.get("CharacterId")) or 0) != character_id
        ]

        character_patch = copy.deepcopy(template.get("character", {})) if isinstance(template.get("character"), dict) else {}
        character_patch["SkillList"] = build_character_max_skills(character_id, target_character.get("SkillList"))
        for field_name, field_value in character_patch.items():
            target_character[field_name] = field_value

        fashion_template = template.get("fashion") if isinstance(template.get("fashion"), dict) else {}
        selected_fashion_id = parse_optional_int(fashion_template.get("SelectedFashionId"))
        unlock_fashion_ids = {
            fashion_id
            for raw_fashion_id in fashion_template.get("UnlockFashionIds", []) if isinstance(fashion_template.get("UnlockFashionIds"), list)
            for fashion_id in [parse_optional_int(raw_fashion_id)]
            if fashion_id is not None
        }
        existing_fashion_ids = {
            fashion_id
            for fashion in fashions
            if isinstance(fashion, dict)
            for fashion_id in [parse_optional_int(fashion.get("_id"))]
            if fashion_id is not None
        }
        for fashion_id in sorted(unlock_fashion_ids):
            if fashion_id in existing_fashion_ids:
                for fashion in fashions:
                    if parse_optional_int(fashion.get("_id")) == fashion_id:
                        fashion["IsLock"] = False
                        break
                continue
            fashion_document = self._build_fashion_document(fashion_id)
            fashion_document["IsLock"] = False
            fashions.append(fashion_document)
            existing_fashion_ids.add(fashion_id)

        if selected_fashion_id is not None:
            target_character["FashionId"] = selected_fashion_id

        memory_templates = template.get("memories") if isinstance(template.get("memories"), list) else []
        for memory_template in memory_templates:
            if not isinstance(memory_template, dict):
                continue
            if not _is_memory_template_id(parse_optional_int(memory_template.get("TemplateId"))):
                continue
            equip_document = self._build_equip_document(equips, memory_template)
            equips.append(equip_document)

        weapon_template = template.get("weapon") if isinstance(template.get("weapon"), dict) else None
        if isinstance(weapon_template, dict) and _is_weapon_template_id(parse_optional_int(weapon_template.get("TemplateId"))):
            equip_document = self._build_equip_document(equips, weapon_template)
            equips.append(equip_document)

        awaken_template = template.get("awaken") if isinstance(template.get("awaken"), dict) else {}
        awaken_rewards = {
            reward_id
            for raw_reward_id in awaken_template.get("GatherRewards", []) if isinstance(awaken_template.get("GatherRewards"), list)
            for reward_id in [parse_optional_int(raw_reward_id)]
            if reward_id is not None
        }
        character_exhibitions_map = get_character_exhibitions_map()
        awaken_path = {
            exhibition_id
            for raw_exhibition_id in character_exhibitions_map.get(character_id, [])
            for exhibition_id in [parse_optional_int(raw_exhibition_id)]
            if exhibition_id is not None
        }
        updated_gather_rewards = set(gather_rewards)
        updated_gather_rewards.difference_update(awaken_path)
        updated_gather_rewards.update(awaken_rewards)
        awaken_level = _resolve_awaken_level(character_id, updated_gather_rewards, character_exhibitions_map)
        self._unlock_exhibition_fashions(fashions, character_id, awaken_level)
        if selected_fashion_id is not None:
            target_character["CharacterHeadInfo"] = {"HeadFashionId": selected_fashion_id}
        self._normalize_character_head_info(target_character, character_id, awaken_level)
        weapon_fashions = self._apply_best_weapon_fashion(weapon_fashions, character_id)

        return characters, fashions, equips, weapon_fashions, sorted(updated_gather_rewards)

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
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            normalized_players_document = self._sanitize_players_document(players_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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
            self._unlock_exhibition_fashions(fashions, character_id, awaken_level)

            characters_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"characters": characters, **self._build_fashions_update(fashions)}},
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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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

        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
            normalized_characters_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
            if character_id is None:
                raise ValueError("character.not_found")

            trust_exp_map = get_character_trust_exp_map().get(character_id, {})
            trust_levels = sorted(level for level in trust_exp_map if level > 0)
            if not trust_levels:
                raise ValueError("character.update_invalid_trust")

            min_trust_lv = trust_levels[0]
            max_trust_lv = trust_levels[-1]
            if trust_lv < min_trust_lv or trust_lv > max_trust_lv or trust_lv not in trust_exp_map:
                raise ValueError("character.update_invalid_trust")

            raw_limit = trust_exp_map[trust_lv]
            allowed_max_exp = raw_limit if trust_lv == max_trust_lv else max(raw_limit - 1, 0)
            if trust_exp > allowed_max_exp:
                raise ValueError("character.update_invalid_trust")

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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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
                fashions.append(self._build_fashion_document(fashion_id))
                fashion_index = len(fashions) - 1

            target_fashion = fashions[fashion_index]
            target_fashion["IsLock"] = False

            normalized_fashions_update = self._build_fashions_update(fashions)
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {f"characters.{target_index}.FashionId": fashion_id, **normalized_fashions_update}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_fashion_failed")

            return UpdateCharacterFashionResponse(
                record_id=record_id,
                CharacterId=character_id,
                CurrentFahionId=fashion_id,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_head_fashion(self, uid: int, record_id: int, fashion_id: int) -> UpdateCharacterHeadFashionResponse:
        if fashion_id <= 0:
            raise ValueError("character.update_invalid_fashion")

        character_fashions_map = get_character_fashions_map()
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1})
            normalized_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_document.get("fashions"))

            target_index = next((
                index for index, character in enumerate(characters)
                if parse_optional_int(character.get("_id")) == record_id
            ), None)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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

            fashion_index = next((
                index for index, fashion in enumerate(fashions)
                if parse_optional_int(fashion.get("_id")) == fashion_id
            ), None)
            if fashion_index is None:
                fashions.append(self._build_fashion_document(fashion_id))
            else:
                fashions[fashion_index]["IsLock"] = False

            awaken_level = parse_optional_int(target_character.get("LiberateLv")) or 1
            target_character["CharacterHeadInfo"] = {"HeadFashionId": fashion_id}
            self._normalize_character_head_info(target_character, character_id, awaken_level)
            head_info = target_character["CharacterHeadInfo"]
            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {
                    f"characters.{target_index}.CharacterHeadInfo": head_info,
                    **self._build_fashions_update(fashions),
                }},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_fashion_failed")

            return UpdateCharacterHeadFashionResponse(
                record_id=record_id,
                CharacterId=character_id,
                HeadFashionId=head_info["HeadFashionId"],
                HeadFashionType=head_info["HeadFashionType"],
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def update_character_weapon_fashion(self, uid: int, record_id: int, fashion_id: int | None) -> UpdateCharacterWeaponFashionResponse:
        if fashion_id is not None and fashion_id <= 0:
            raise ValueError("character.update_invalid_weapon_fashion")

        client = create_mongo_client(self._settings)
        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(
                matching_uid_query(uid), {"characters": 1, "weaponFashions": 1},
            )
            normalized_document = self._sanitize_characters_document(characters_document)
            characters = self._sanitize_character_list(normalized_document.get("characters"))
            target_index = next((
                index for index, character in enumerate(characters)
                if parse_optional_int(character.get("_id")) == record_id
            ), None)
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
            equip_type = get_character_equip_type_map().get(character_id) if character_id is not None else None
            allowed_fashion_ids = set(get_equip_type_weapon_fashion_ids_map().get(equip_type, []))
            if character_id is None or (fashion_id is not None and fashion_id not in allowed_fashion_ids):
                raise ValueError("character.update_invalid_weapon_fashion")

            weapon_fashions = self._sanitize_weapon_fashions(normalized_document.get("weaponFashions"))
            if fashion_id is not None:
                target_fashion = next((
                    entry for entry in weapon_fashions
                    if parse_optional_int(entry.get("_id")) == fashion_id
                ), None)
                if target_fashion is None:
                    weapon_fashions.append(self._build_weapon_fashion_document(fashion_id, character_id))
                else:
                    target_fashion["UseCharacterList"] = [
                        *[
                            listed_character_id
                            for raw_character_id in target_fashion.get("UseCharacterList", [])
                            for listed_character_id in [parse_optional_int(raw_character_id)]
                            if listed_character_id is not None and listed_character_id != character_id
                        ],
                        character_id,
                    ]

            for entry in weapon_fashions:
                if fashion_id is not None and parse_optional_int(entry.get("_id")) == fashion_id:
                    continue
                entry["UseCharacterList"] = [
                    listed_character_id
                    for raw_character_id in entry.get("UseCharacterList", [])
                    for listed_character_id in [parse_optional_int(raw_character_id)]
                    if listed_character_id is not None and listed_character_id != character_id
                ]

            result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": {"weaponFashions": weapon_fashions}},
            )
            if result.matched_count <= 0:
                raise ValueError("character.update_weapon_fashion_failed")

            return UpdateCharacterWeaponFashionResponse(
                record_id=record_id,
                CharacterId=character_id,
                CurrentWeaponFashionId=fashion_id,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def max_character(self, uid: int, record_id: int) -> MaxCharacterResponse:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1, "equips": 1, "weaponFashions": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})

            normalized_characters_document = self._sanitize_characters_document(characters_document)
            normalized_players_document = self._sanitize_players_document(players_document)
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))
            equips = self._sanitize_equips(normalized_characters_document.get("equips"))
            weapon_fashions = self._sanitize_weapon_fashions(normalized_characters_document.get("weaponFashions"))
            gather_rewards = self._sanitize_gather_rewards(normalized_players_document.get("gather_rewards"))

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
            if character_id is None:
                raise ValueError("character.not_found")

            template = get_character_max_template_map().get(character_id)
            if not isinstance(template, dict):
                raise ValueError("character.max_template_not_found")

            updated_characters, updated_fashions, updated_equips, updated_weapon_fashions, updated_gather_rewards = self._apply_max_character_template(
                target_character=target_character,
                characters=characters,
                fashions=fashions,
                equips=equips,
                weapon_fashions=weapon_fashions,
                gather_rewards=gather_rewards,
                template=template,
            )

            characters_update_payload = {
                "characters": updated_characters,
                **self._build_fashions_update(updated_fashions),
                **self._build_equips_update(updated_equips),
                "weaponFashions": updated_weapon_fashions,
            }
            players_update_payload = self._build_players_update(updated_gather_rewards)

            characters_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {"$set": characters_update_payload},
            )
            players_result = await players_collection.update_one(
                _matching_player_uid_query(uid),
                {"$set": players_update_payload},
            )
            if characters_result.matched_count <= 0 or players_result.matched_count <= 0:
                raise ValueError("character.max_failed")

            return MaxCharacterResponse(
                record_id=record_id,
                CharacterId=character_id,
                updated=True,
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def max_all_characters(self, uid: int) -> MaxAllCharactersResponse:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            players_collection = database[PLAYER_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1, "equips": 1, "weaponFashions": 1})
            players_document = await players_collection.find_one(_matching_player_uid_query(uid), {"gather_rewards": 1})

            normalized_characters_document = self._sanitize_characters_document(characters_document)
            normalized_players_document = self._sanitize_players_document(players_document)
            if not isinstance(normalized_characters_document, dict) or not isinstance(normalized_players_document, dict):
                raise ValueError("character.max_all_failed")

            # Preserve existing characters/ownership, especially those skipped for missing resources.
            characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
            fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))
            equips = self._sanitize_equips(normalized_characters_document.get("equips"))
            weapon_fashions = self._sanitize_weapon_fashions(normalized_characters_document.get("weaponFashions"))
            gather_rewards = self._sanitize_gather_rewards(normalized_players_document.get("gather_rewards"))
            existing_by_id = {parse_optional_int(character.get("_id")): character for character in characters}

            quality_bound_map = get_character_quality_bound_map()
            max_template_map = get_character_max_template_map()
            available_character_ids = sorted(
                character_id
                for character_id, template in max_template_map.items()
                if isinstance(character_id, int)
                and character_id > 0
                and isinstance(template, dict)
                and character_id in get_character_add_config_map()
            )

            for character_id in available_character_ids:
                template = max_template_map.get(character_id)
                if not isinstance(template, dict):
                    continue

                quality_bound = quality_bound_map.get(character_id)
                if not isinstance(quality_bound, list) or len(quality_bound) != 2:
                    continue

                min_quality = parse_optional_int(quality_bound[0])
                if min_quality is None:
                    continue

                fashion_id = get_character_default_fashion_id_map().get(character_id)
                if fashion_id is None:
                    continue

                target_character = existing_by_id.get(character_id)
                if target_character is None:
                    target_character = self._build_character_document(character_id, quality=min_quality, fashion_id=fashion_id)
                    characters.append(target_character)

                fashion_index = next(
                    (
                        index
                        for index, fashion in enumerate(fashions)
                        if parse_optional_int(fashion.get("_id")) == fashion_id
                    ),
                    None,
                )
                if fashion_index is None:
                    fashions.append(self._build_fashion_document(fashion_id))
                else:
                    fashions[fashion_index]["IsLock"] = False

                characters, fashions, equips, weapon_fashions, updated_gather_rewards = self._apply_max_character_template(
                    target_character=target_character,
                    characters=characters,
                    fashions=fashions,
                    equips=equips,
                    weapon_fashions=weapon_fashions,
                    gather_rewards=gather_rewards,
                    template=template,
                )
                gather_rewards = set(updated_gather_rewards)

            gather_rewards = set(gather_rewards) | set(self._build_gather_rewards_from_characters(characters))

            if not available_character_ids:
                raise ValueError("character.max_template_not_found")

            characters_result = await characters_collection.update_one(
                matching_uid_query(uid),
                {
                    "$set": {
                        "characters": characters,
                        **self._build_fashions_update(fashions),
                        **self._build_equips_update(equips),
                        "weaponFashions": weapon_fashions,
                    },
                },
            )
            players_result = await players_collection.update_one(
                _matching_player_uid_query(uid),
                {"$set": {"gather_rewards": sorted(gather_rewards)}},
            )
            if characters_result.matched_count <= 0 or players_result.matched_count <= 0:
                raise ValueError("character.max_all_failed")

            return MaxAllCharactersResponse(
                updated=True,
                character_count=len(characters),
                equip_count=len(equips),
                gather_reward_count=len(gather_rewards),
                skipped_character_ids=sorted((set(get_character_log_name_map()) | {key for key in existing_by_id if key is not None}) - set(available_character_ids)),
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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
                ),
                None,
            )
            if target_index is None:
                raise ValueError("character.not_found")

            target_character = characters[target_index]
            character_id = parse_optional_int(target_character.get("_id"))
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
            if list_field_name == "SkillList":
                group_ids = next((ids for ids in get_character_skill_groups_map().get(character_id, []) if skill_id in ids), [])
                normalized_skill_list = [
                    item for item in normalized_skill_list
                    if parse_optional_int(item.get("_id")) == skill_id or parse_optional_int(item.get("_id")) not in group_ids
                ]
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

            target_index = next(
                (
                    index
                    for index, character in enumerate(characters)
                    if parse_optional_int(character.get("_id")) == record_id
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
        page_size: int = DEFAULT_LIST_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: CharacterSortField = "sequence",
        sort_order: CharacterSortOrder = "asc",
    ) -> CharacterManagementListResponse:
        current_page = max(1, int(page))
        normalized_page_size = DEFAULT_LIST_PAGE_SIZE if page_size <= 0 else min(int(page_size), DEFAULT_LIST_PAGE_SIZE)
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

            normalized_item = CharacterManagementItemRecord(
                record_id=character_id,
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

    async def list_available_characters(self, uid: int) -> CharacterAvailableListResponse:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_characters_document = self._sanitize_characters_document(characters_document)
        raw_characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
        owned_character_ids = {
            character_id
            for raw_character in raw_characters
            for character_id in [parse_optional_int(raw_character.get("_id"))]
            if character_id is not None and character_id > 0
        }

        all_character_ids = sorted(
            character_id
            for character_id in get_character_add_config_map()
            if isinstance(character_id, int) and character_id > 0
        )
        available_character_ids = [character_id for character_id in all_character_ids if character_id not in owned_character_ids]

        return CharacterAvailableListResponse(character_ids=available_character_ids)

    async def get_character_extra_info(self, uid: int, record_id: int) -> CharacterExtraInfoRecord:
        client = create_mongo_client(self._settings)

        try:
            database = client[self._settings.mongo_db]
            characters_collection = database[CHARACTERS_COLLECTION_NAME]
            characters_document = await characters_collection.find_one(matching_uid_query(uid), {"characters": 1, "fashions": 1, "equips": 1, "weaponFashions": 1})
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_characters_document = self._sanitize_characters_document(characters_document)
        characters = self._sanitize_character_list(normalized_characters_document.get("characters"))
        account_fashions = self._sanitize_fashions(normalized_characters_document.get("fashions"))
        account_equips = self._sanitize_equips(normalized_characters_document.get("equips"))
        account_weapon_fashions = self._sanitize_weapon_fashions(normalized_characters_document.get("weaponFashions"))
        target_character = next(
            (
                character
                for character in characters
                if parse_optional_int(character.get("_id")) == record_id
            ),
            None,
        )
        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")
        character_intro_map = get_character_Intro_map()
        character_fashions_map = get_character_fashions_map()
        character_levelup_template_map = get_character_levelup_template_map()
        character_max_liberate_level_map = get_character_max_liberate_level_map()
        character_quality_bound_map = get_character_quality_bound_map()
        character_equip_type_map = get_character_equip_type_map()
        weapon_fashion_ids_map = get_equip_type_weapon_fashion_ids_map()
        weapon_fashion_entries_map = get_weapon_fashion_id_entries_map()
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
            big_head_icon = str(fashion.get("BigHeadIcon") or "").strip()
            big_head_icon_fashion = str(fashion.get("BigHeadIconFashion") or "").strip()
            big_head_icon_liberation = str(fashion.get("BigHeadIconLiberation") or "").strip()
            name = str(fashion.get("Name") or "").strip()
            description = str(fashion.get("Description") or "").strip()
            if fashion_id is None or quality is None or not big_icon or not big_head_icon or not big_head_icon_fashion:
                continue

            fashions.append(
                CharacterFashionRecord(
                    Id=fashion_id,
                    Quality=quality,
                    IsLock=fashion_lock_map.get(fashion_id, True),
                    BigIcon=big_icon,
                    BigHeadIcon=big_head_icon,
                    BigHeadIconFashion=big_head_icon_fashion,
                    BigHeadIconLiberation=big_head_icon_liberation or big_head_icon,
                    Name=name,
                    Description=description
                )
            )

        equip_type = character_equip_type_map.get(character_id)
        unlocked_weapon_fashion_ids: set[int] = set()
        current_weapon_fashion_id: int | None = None
        now = int(time.time())
        for weapon_fashion in account_weapon_fashions:
            weapon_fashion_id = parse_optional_int(weapon_fashion.get("_id"))
            expire_time = parse_optional_int(weapon_fashion.get("ExpireTime")) or 0
            use_character_ids = {
                listed_character_id
                for raw_character_id in weapon_fashion.get("UseCharacterList", [])
                for listed_character_id in [parse_optional_int(raw_character_id)]
                if listed_character_id is not None
            }
            if weapon_fashion_id is None:
                continue
            if expire_time != 0 and expire_time <= now:
                continue
            unlocked_weapon_fashion_ids.add(weapon_fashion_id)
            if current_weapon_fashion_id is None and character_id in use_character_ids and weapon_fashion_id in weapon_fashion_entries_map:
                current_weapon_fashion_id = weapon_fashion_id

        weapon_fashions = [
            WeaponFashionRecord(
                Id=fashion_id,
                Quality=int(entry["Quality"]),
                IsLock=fashion_id not in unlocked_weapon_fashion_ids,
                BigIcon=str(entry["BigIcon"]),
                Name=str(entry["Name"]),
                Description=str(entry["Description"]),
            )
            for fashion_id in weapon_fashion_ids_map.get(equip_type, [])
            for entry in [weapon_fashion_entries_map.get(fashion_id)]
            if entry is not None
        ]

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
            if max_overrun_level is not None:
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
            DefaultFashionId=get_character_default_fashion_id_map().get(character_id),
            HeadFashionId=parse_optional_int((target_character.get("CharacterHeadInfo") or {}).get("HeadFashionId")) if isinstance(target_character.get("CharacterHeadInfo"), dict) else get_character_default_fashion_id_map().get(character_id),
            HeadFashionType=parse_optional_int((target_character.get("CharacterHeadInfo") or {}).get("HeadFashionType")) if isinstance(target_character.get("CharacterHeadInfo"), dict) else 0,
            Fashions=fashions,
            EquipType=equip_type,
            CurrentWeaponFashionId=current_weapon_fashion_id,
            WeaponFashions=weapon_fashions,
            Weapon=character_weapon,
            Memories=character_memories,
            SkillsList=character_skills,
            EnhanceSkillList=character_enhance_skills,
        )
