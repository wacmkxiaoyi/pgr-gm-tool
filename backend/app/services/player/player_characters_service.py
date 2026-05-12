from __future__ import annotations

import contextlib
import math
from typing import Any, Literal

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import CharacterDetailMemoryRecord, CharacterDetailWeaponRecord, CharacterEquipRecord, CharacterEquipResonanceRecord, CharacterExtraInfoRecord, CharacterFashionRecord, CharacterManagementItemRecord, CharacterManagementListResponse, CharacterSkillInfoRecord, CharacterWeaponOverrunRecord
from backend.app.services.db_schema_runtime import CompiledCollectionSchema, DatabaseSchemaRuntime
from backend.app.services.player.equips import get_equip_site_map
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
    get_character_skill_entries_map,
    get_character_skill_ids_map,
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

            record_id = parse_optional_int(raw_character.get("_id")) or character_id
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
                if parse_optional_int(character.get("_id")) == record_id
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
            if fashion_id is None or quality is None or not big_icon or not big_head_icon_fashion:
                continue

            fashions.append(
                CharacterFashionRecord(
                    Id=fashion_id,
                    Quality=quality,
                    IsLock=fashion_lock_map.get(fashion_id, True),
                    BigIcon=big_icon,
                    BigHeadIconFashion=big_head_icon_fashion,
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
            LevelExpMap=level_exp_map,
            Intro=character_intro_map.get(character_id) if character_id is not None else None,
            CurrentFahionId=parse_optional_int(target_character.get("FashionId")),
            Fashions=fashions,
            Weapon=character_weapon,
            Memories=character_memories,
            SkillsList=character_skills,
            EnhanceSkillList=character_enhance_skills,
        )
