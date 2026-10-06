from __future__ import annotations

import contextlib
import copy
import math
import time
from typing import Literal
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AddEquipResponse, CharacterMemoryCandidatesRecord, CharacterWeaponCandidatesRecord, ClearEquipsResponse, MemoryExtraInfoRecord, EquipListResponse, SwitchCharacterMemoryRequest, SwitchCharacterMemoryResponse, SwitchCharacterWeaponRequest, SwitchCharacterWeaponResponse, UpdateEquipRequest, WeaponExtraInfoRecord, WeaponItemRecord, WeaponOverrunExtraInfoRecord, WeaponOverrunRecord, WeaponResonanceExtraInfoRecord, WeaponResonanceRecord
from backend.app.db.models.player_characters import CHARACTER_LIST_SCHEMA_PATH, CHARACTERS_COLLECTION_NAME, EQUIPS_SCHEMA_PATH, FASHIONS_SCHEMA_PATH
from backend.app.db.models.player_equips import EQUIP_ITEM_SCHEMA_PATH
from backend.app.db.models.player_equips import PartnerItemRecord, PartnerListResponse
from backend.app.services.player.equips.partner import (
    build_partner_item_record,
    get_partner_entries_map, get_partner_breakthrough_level_limit_map,
    get_partner_skill_config_map, get_partner_main_skill_group_skill_ids_map,
    get_partner_passive_skill_groups_map,
    get_partner_recommended_main_skill_entries_map, get_partner_star_schedule_options_map,
    get_partner_quality_entries_map, get_partner_level_exp_map,
    get_partner_skill_level_entries_map, get_partner_passive_skill_ids_map,
    get_partner_main_skill_ids_map,
)
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
from backend.app.services.constants import DEFAULT_LIST_PAGE_SIZE
from backend.app.services.player.utils import matching_uid_query, normalize_search_keyword, ordered_number_key, ordered_text_key, parse_optional_int
from backend.app.services.player.equips import (
    get_breakthrough_levelup_template_map,
    get_equip_awake_template_id_set,
    get_equip_resonance_map,
    get_equip_breakthrough_level_limit_map,
    get_equip_breakthrough_max_map,
    get_equip_descriptions_map,
    get_equip_name_map,
    get_equip_site_map,
    get_equip_star_map,
)
from backend.app.services.player.player_characters import (
    get_attrib_pool_entries_map,
    get_character_equip_type_map,
    get_character_skill_pool_entries_map,
    get_character_log_name_map,
)
from backend.app.services.player.levelup_template import (
    get_level_per_exp,
    get_levelup_template_max_level,
)
from backend.app.services.player.equips.weapon import (
    get_weapon_overrun_suit_entries_map,
    get_weapon_skill_pool_entries_map,
    get_weapon_overrun_max_level_map,
    get_weapon_type_id_map,
    get_weapon_type_name_map,
)
WeaponSortField = Literal["name", "character", "type", "star", "enhancement"]
MemorySortField = Literal["name", "character", "position", "star", "enhancement"]
WeaponSortOrder = Literal["asc", "desc"]


def _normalize_awake_slot_list(raw_awake_slot_list: Any, allowed_slots: set[int]) -> list[int]:
    if not isinstance(raw_awake_slot_list, list):
        return []

    normalized_slots: list[int] = []
    seen_slots: set[int] = set()
    for raw_entry in raw_awake_slot_list:
        slot = parse_optional_int(raw_entry)

        if slot is None or slot not in allowed_slots or slot in seen_slots:
            continue

        seen_slots.add(slot)
        normalized_slots.append(slot)

    return normalized_slots


def _get_weapon_search_priority(
    keyword: str,
    weapon_name: str,
    character_name: str,
    weapon_type_name: str,
) -> int | None:
    if not keyword:
        return 0

    normalized_weapon_name = normalize_search_keyword(weapon_name)
    if keyword in normalized_weapon_name:
        return 0

    normalized_character_name = normalize_search_keyword(character_name)
    if keyword in normalized_character_name:
        return 1

    normalized_weapon_type_name = normalize_search_keyword(weapon_type_name)
    if keyword in normalized_weapon_type_name:
        return 2

    return None


def _is_weapon_template_id(template_id: int | None) -> bool:
    if template_id is None:
        return False

    site_value = get_equip_site_map().get(template_id)
    return site_value in {"", "0"}


def _is_memory_template_id(template_id: int | None) -> bool:
    if template_id is None:
        return False

    site_value = str(get_equip_site_map().get(template_id, "")).strip()
    return bool(site_value) and site_value != "0"


def _get_memory_slot_id(template_id: int | None) -> int | None:
    if template_id is None:
        return None

    site_value = str(get_equip_site_map().get(template_id, "")).strip()
    if not site_value or site_value == "0":
        return None

    return parse_optional_int(site_value)




def _weapon_enhancement_level(item: WeaponItemRecord, breakthrough_level_limit_map: dict[int, dict[int, int]]) -> int:
    breakthrough = max(0, int(item.Breakthrough or 0))
    level = max(0, int(item.Level or 0))
    stage_map = breakthrough_level_limit_map.get(item.TemplateId)
    if not isinstance(stage_map, dict):
        return level

    total = level
    for stage in range(breakthrough):
        level_limit = stage_map.get(stage)
        if not isinstance(level_limit, int):
            break
        total += level_limit

    return total


def _weapon_sort_key(
    item: WeaponItemRecord,
    sort_by: WeaponSortField,
    sort_order: WeaponSortOrder,
    search_priority: int,
    weapon_name_map: dict[int, str],
    character_name_map: dict[int, str],
    weapon_type_name_map: dict[int, str],
    weapon_star_map: dict[int, int],
    breakthrough_level_limit_map: dict[int, dict[int, int]],
) -> tuple[Any, ...]:
    weapon_name = weapon_name_map.get(item.TemplateId, "")

    if sort_by == "character":
        character_id = int(item.CharacterId or 0)
        is_unequipped = 1 if character_id == 0 else 0
        return (
            search_priority,
            is_unequipped,
            ordered_text_key(character_name_map.get(character_id, ""), sort_order),
            ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "type":
        return (
            search_priority,
            ordered_text_key(weapon_type_name_map.get(item.TemplateId, ""), sort_order),
            ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "star":
        return (
            search_priority,
            ordered_number_key(int(weapon_star_map.get(item.TemplateId, 0)), sort_order),
            ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "enhancement":
        return (
            search_priority,
            ordered_number_key(_weapon_enhancement_level(item, breakthrough_level_limit_map), sort_order),
            ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    return (
        search_priority,
        ordered_text_key(weapon_name, sort_order),
        item.record_id,
    )


def _get_memory_search_priority(
    keyword: str,
    memory_name: str,
    character_name: str,
) -> int | None:
    if not keyword:
        return 0

    normalized_memory_name = str(memory_name or "").strip().lower()
    if keyword in normalized_memory_name:
        return 0

    normalized_character_name = str(character_name or "").strip().lower()
    if keyword in normalized_character_name:
        return 1

    return None


def _memory_sort_key(
    item: WeaponItemRecord,
    sort_by: MemorySortField,
    sort_order: WeaponSortOrder,
    search_priority: int,
    memory_name_map: dict[int, str],
    character_name_map: dict[int, str],
    equip_site_map: dict[int, str],
    memory_star_map: dict[int, int],
    breakthrough_level_limit_map: dict[int, dict[int, int]],
) -> tuple[Any, ...]:
    memory_name = memory_name_map.get(item.TemplateId, "")

    if sort_by == "character":
        character_id = int(item.CharacterId or 0)
        is_unequipped = 1 if character_id == 0 else 0
        return (
            search_priority,
            is_unequipped,
            ordered_text_key(character_name_map.get(character_id, ""), sort_order),
            ordered_text_key(memory_name, sort_order),
            item.record_id,
        )

    if sort_by == "position":
        position_value = parse_optional_int(equip_site_map.get(item.TemplateId)) or 0
        return (
            search_priority,
            ordered_number_key(position_value, sort_order),
            ordered_text_key(memory_name, sort_order),
            item.record_id,
        )

    if sort_by == "star":
        return (
            search_priority,
            ordered_number_key(int(memory_star_map.get(item.TemplateId, 0)), sort_order),
            ordered_text_key(memory_name, sort_order),
            item.record_id,
        )

    if sort_by == "enhancement":
        return (
            search_priority,
            ordered_number_key(_weapon_enhancement_level(item, breakthrough_level_limit_map), sort_order),
            ordered_text_key(memory_name, sort_order),
            item.record_id,
        )

    return (
        search_priority,
        ordered_text_key(memory_name, sort_order),
        item.record_id,
    )


def _normalize_weapon_resonance_list(value: Any) -> list[WeaponResonanceRecord]:
    normalized_list: list[WeaponResonanceRecord] = []
    for entry in value if isinstance(value, list) else []:
        if not isinstance(entry, dict):
            continue

        normalized_list.append(WeaponResonanceRecord(
            Slot=parse_optional_int(entry.get("Slot")),
            Type=parse_optional_int(entry.get("Type")),
            CharacterId=parse_optional_int(entry.get("CharacterId")),
            TemplateId=parse_optional_int(entry.get("TemplateId")),
        ))

    return normalized_list


def _is_awake_supported_template_id(template_id: int | None) -> bool:
    return template_id is not None and template_id in get_equip_awake_template_id_set()


def _resolve_awake_slot_list(raw_awake_slot_list: Any, template_id: int | None, allowed_slots: set[int]) -> list[int] | None:
    if not _is_awake_supported_template_id(template_id):
        return None

    return _normalize_awake_slot_list(raw_awake_slot_list, allowed_slots)


def _apply_awake_slot_update(existing_awake_slot_list: list[int], slot: int, awake_enabled: bool) -> list[int]:
    updated_awake_slots = [item for item in existing_awake_slot_list if item != slot]
    if awake_enabled:
        updated_awake_slots.append(slot)
        updated_awake_slots.sort()
    return updated_awake_slots


def _is_valid_weapon_resonance_entry(
    weapon_template_id: int,
    slot: int,
    entry_type: int,
    template_id: int,
    character_id: int,
) -> bool:
    resonance_map = get_equip_resonance_map()
    resonance_pools = resonance_map.get(weapon_template_id)
    if not isinstance(resonance_pools, list) or len(resonance_pools) < 3:
        return False

    slot_index = int(slot) - 1
    if slot_index < 0:
        return False

    if entry_type == 1:
        attrib_pool_ids = resonance_pools[0] if isinstance(resonance_pools[0], list) else []
        if slot_index >= len(attrib_pool_ids):
            return False
        pool_id = attrib_pool_ids[slot_index]
        attrib_pool_entries_map = get_attrib_pool_entries_map()
        return any(int(entry.get("TemplateId", -1)) == template_id for entry in attrib_pool_entries_map.get(pool_id, []))

    if entry_type == 2:
        character_skill_pool_ids = resonance_pools[1] if isinstance(resonance_pools[1], list) else []
        if slot_index >= len(character_skill_pool_ids):
            return False
        pool_id = character_skill_pool_ids[slot_index]
        character_skill_pool_entries_map = get_character_skill_pool_entries_map()
        return any(
            int(entry.get("TemplateId", -1)) == template_id
            for entry in character_skill_pool_entries_map.get(pool_id, {}).get(character_id, [])
        )

    if entry_type == 3:
        weapon_skill_pool_ids = resonance_pools[2] if isinstance(resonance_pools[2], list) else []
        if slot_index >= len(weapon_skill_pool_ids):
            return False
        pool_id = weapon_skill_pool_ids[slot_index]
        weapon_skill_pool_entries_map = get_weapon_skill_pool_entries_map()
        return template_id in weapon_skill_pool_entries_map.get(pool_id, {}).get(character_id, [])

    return False


def _normalize_weapon_overrun_data(value: Any) -> WeaponOverrunRecord | None:
    if not isinstance(value, dict):
        return None

    active_suits: list[int] = []
    for suit_id in value.get("ActiveSuits") if isinstance(value.get("ActiveSuits"), list) else []:
        normalized_suit_id = parse_optional_int(suit_id)
        if normalized_suit_id is not None:
            active_suits.append(normalized_suit_id)

    return WeaponOverrunRecord(
        Level=parse_optional_int(value.get("Level")),
        ActiveSuits=active_suits,
        ChoseSuit=parse_optional_int(value.get("ChoseSuit")),
    )


def _build_weapon_item_record(raw_equip: dict[str, Any]) -> WeaponItemRecord | None:
    record_id = parse_optional_int(raw_equip.get("_id"))
    template_id = parse_optional_int(raw_equip.get("TemplateId"))
    if record_id is None or template_id is None or not _is_weapon_template_id(template_id):
        return None

    breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()
    normalized_item = WeaponItemRecord(
        record_id=record_id,
        TemplateId=template_id,
        CharacterId=parse_optional_int(raw_equip.get("CharacterId")) or 0,
        Level=parse_optional_int(raw_equip.get("Level")),
        Exp=parse_optional_int(raw_equip.get("Exp")),
        Breakthrough=parse_optional_int(raw_equip.get("Breakthrough")),
    )
    normalized_item.EnhancementLevel = _weapon_enhancement_level(normalized_item, breakthrough_level_limit_map)
    return normalized_item


def _build_memory_item_record(raw_equip: dict[str, Any]) -> WeaponItemRecord | None:
    record_id = parse_optional_int(raw_equip.get("_id"))
    template_id = parse_optional_int(raw_equip.get("TemplateId"))
    if record_id is None or template_id is None or not _is_memory_template_id(template_id):
        return None

    breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()
    normalized_item = WeaponItemRecord(
        record_id=record_id,
        TemplateId=template_id,
        CharacterId=parse_optional_int(raw_equip.get("CharacterId")) or 0,
        Level=parse_optional_int(raw_equip.get("Level")),
        Exp=parse_optional_int(raw_equip.get("Exp")),
        Breakthrough=parse_optional_int(raw_equip.get("Breakthrough")),
    )
    normalized_item.EnhancementLevel = _weapon_enhancement_level(normalized_item, breakthrough_level_limit_map)
    return normalized_item


def _get_equip_allowed_max_exp(template_id: int, level: int) -> int | None:
    per_exp = get_level_per_exp(template_id, level)
    if per_exp is None:
        return None

    max_level = get_levelup_template_max_level(template_id)
    if max_level is not None and level == max_level:
        return per_exp

    return max(per_exp - 1, 0)


def _get_weapon_type_id(template_id: int | None) -> int | None:
    if template_id is None:
        return None

    return parse_optional_int(get_weapon_type_id_map().get(template_id))


def _get_next_weapon_record_id(raw_equips: list[Any]) -> int:
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


class PlayerEquipsService:
    def __init__(self, settings: Settings, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._schema_runtime = schema_runtime
        self._collection_schema = schema_runtime.get_collection_schema(CHARACTERS_COLLECTION_NAME)

    def _get_characters_schema(self) -> CompiledCollectionSchema:
        if self._collection_schema is None:
            raise RuntimeError(f"Missing schema for collection: {CHARACTERS_COLLECTION_NAME}")
        return self._collection_schema

    def _build_default_weapon_overrun_data(self) -> dict[str, Any]:
        default_value = self._get_characters_schema().build_default(f"{EQUIP_ITEM_SCHEMA_PATH}.WeaponOverrunData")
        return default_value if isinstance(default_value, dict) else {}

    def _get_default_weapon_overrun_level(self) -> int:
        default_value = self._get_characters_schema().build_default(f"{EQUIP_ITEM_SCHEMA_PATH}.WeaponOverrunData.Level")
        return max(0, int(parse_optional_int(default_value) or 0))

    def _serialize_weapon_overrun_data(self, value: Any) -> dict[str, Any]:
        normalized_value = _normalize_weapon_overrun_data(value)
        if normalized_value is None:
            return {}

        level = parse_optional_int(normalized_value.Level)
        chose_suit = parse_optional_int(normalized_value.ChoseSuit)
        active_suits = [
            suit_id
            for suit_id in normalized_value.ActiveSuits
            if parse_optional_int(suit_id) is not None
        ]

        if level is None and chose_suit is None and not active_suits:
            return {}

        serialized: dict[str, Any] = {}
        if level is not None:
            serialized["Level"] = level
        if active_suits:
            serialized["ActiveSuits"] = active_suits
        if chose_suit is not None:
            serialized["ChoseSuit"] = chose_suit

        return serialized

    async def _get_uid_equips_document(self, uid: int) -> tuple[dict[str, Any], list[dict[str, Any]]]:
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1, "characters": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))
        return normalized_document, raw_equips

    async def get_character_weapon_candidates(self, uid: int, character_record_id: int) -> CharacterWeaponCandidatesRecord:
        normalized_record_id = int(character_record_id)
        normalized_document, raw_equips = await self._get_uid_equips_document(uid)

        raw_characters = self._sanitize_character_list(normalized_document.get("characters"))
        target_character = next(
            (
                raw_character
                for raw_character in raw_characters
                if parse_optional_int(raw_character.get("_id")) == normalized_record_id
            ),
            None,
        )

        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")

        equip_type = get_character_equip_type_map().get(character_id)
        current_weapon: WeaponItemRecord | None = None
        items: list[WeaponItemRecord] = []

        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            normalized_item = _build_weapon_item_record(raw_equip)
            if normalized_item is None:
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if equip_type is not None and _get_weapon_type_id(template_id) != equip_type:
                continue

            items.append(normalized_item)
            if int(normalized_item.CharacterId or 0) == character_id and current_weapon is None:
                current_weapon = normalized_item

        return CharacterWeaponCandidatesRecord(
            character_record_id=normalized_record_id,
            character_id=character_id,
            current_weapon=current_weapon,
            items=items,
        )

    async def switch_character_weapon(self, uid: int, character_record_id: int, payload: SwitchCharacterWeaponRequest) -> SwitchCharacterWeaponResponse:
        normalized_record_id = int(character_record_id)
        target_weapon_record_id = int(payload.WeaponRecordId)
        normalized_document, raw_equips = await self._get_uid_equips_document(uid)

        raw_characters = self._sanitize_character_list(normalized_document.get("characters"))
        target_character = next(
            (
                raw_character
                for raw_character in raw_characters
                if parse_optional_int(raw_character.get("_id")) == normalized_record_id
            ),
            None,
        )

        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")

        equip_type = get_character_equip_type_map().get(character_id)
        if equip_type is None:
            raise ValueError("character.equip_type_invalid")

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        current_weapon_indices: list[int] = []

        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_weapon_template_id(template_id):
                continue

            if int(parse_optional_int(raw_equip.get("CharacterId")) or 0) == character_id:
                current_weapon_indices.append(index)

            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == target_weapon_record_id:
                target_index = index
                target_equip = dict(raw_equip)

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        target_template_id = parse_optional_int(target_equip.get("TemplateId"))
        if not _is_weapon_template_id(target_template_id):
            raise ValueError("equips.template_invalid")
        if _get_weapon_type_id(target_template_id) != equip_type:
            raise ValueError("character.weapon_type_mismatch")

        target_original_character_id = int(parse_optional_int(target_equip.get("CharacterId")) or 0)
        swap_source_index: int | None = None
        if target_original_character_id > 0 and target_original_character_id != character_id:
            for index in current_weapon_indices:
                if index != target_index:
                    swap_source_index = index
                    break
            if swap_source_index is None:
                raise ValueError("character.weapon_swap_requires_weapon")

        for index in current_weapon_indices:
            if index == target_index:
                continue
            raw_equips[index] = dict(raw_equips[index])
            raw_equips[index]["CharacterId"] = 0

        if swap_source_index is not None:
            raw_equips[swap_source_index]["CharacterId"] = target_original_character_id

        updated_target = dict(target_equip)
        updated_target["CharacterId"] = character_id
        raw_equips[target_index] = updated_target

        if self._sanitize_equips(normalized_document.get("equips")) == self._sanitize_equips(raw_equips):
            current_weapon = _build_weapon_item_record(updated_target)
            return SwitchCharacterWeaponResponse(updated=True, current_weapon=current_weapon)

        normalized_update = self._build_equips_update(raw_equips)
        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": normalized_document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        current_weapon = _build_weapon_item_record(updated_target)
        return SwitchCharacterWeaponResponse(updated=True, current_weapon=current_weapon)

    async def get_character_memory_candidates(self, uid: int, character_record_id: int, slot: int) -> CharacterMemoryCandidatesRecord:
        normalized_record_id = int(character_record_id)
        normalized_slot = int(slot)
        if normalized_slot <= 0:
            raise ValueError("character.memory_slot_invalid")

        normalized_document, raw_equips = await self._get_uid_equips_document(uid)
        raw_characters = self._sanitize_character_list(normalized_document.get("characters"))
        target_character = next(
            (
                raw_character
                for raw_character in raw_characters
                if parse_optional_int(raw_character.get("_id")) == normalized_record_id
            ),
            None,
        )

        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")

        current_memory: WeaponItemRecord | None = None
        items: list[WeaponItemRecord] = []

        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_memory_template_id(template_id):
                continue
            if _get_memory_slot_id(template_id) != normalized_slot:
                continue

            normalized_item = _build_memory_item_record(raw_equip)
            if normalized_item is None:
                continue

            items.append(normalized_item)
            if int(normalized_item.CharacterId or 0) == character_id and current_memory is None:
                current_memory = normalized_item

        return CharacterMemoryCandidatesRecord(
            character_record_id=normalized_record_id,
            character_id=character_id,
            slot=normalized_slot,
            current_memory=current_memory,
            items=items,
        )

    async def switch_character_memory(self, uid: int, character_record_id: int, payload: SwitchCharacterMemoryRequest) -> SwitchCharacterMemoryResponse:
        normalized_record_id = int(character_record_id)
        target_memory_record_id = parse_optional_int(payload.MemoryRecordId)
        normalized_slot = int(payload.Slot)
        if normalized_slot <= 0:
            raise ValueError("character.memory_slot_invalid")

        normalized_document, raw_equips = await self._get_uid_equips_document(uid)
        raw_characters = self._sanitize_character_list(normalized_document.get("characters"))
        target_character = next(
            (
                raw_character
                for raw_character in raw_characters
                if parse_optional_int(raw_character.get("_id")) == normalized_record_id
            ),
            None,
        )

        if target_character is None:
            raise ValueError("character.not_found")

        character_id = parse_optional_int(target_character.get("_id"))
        if character_id is None:
            raise ValueError("character.not_found")

        current_memory_indices: list[int] = []
        target_index: int | None = None
        target_equip: dict[str, Any] | None = None

        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_memory_template_id(template_id):
                continue
            if _get_memory_slot_id(template_id) != normalized_slot:
                continue

            if int(parse_optional_int(raw_equip.get("CharacterId")) or 0) == character_id:
                current_memory_indices.append(index)

            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if target_memory_record_id is not None and current_record_id == target_memory_record_id:
                target_index = index
                target_equip = dict(raw_equip)

        if target_memory_record_id is None:
            for index in current_memory_indices:
                raw_equips[index] = dict(raw_equips[index])
                raw_equips[index]["CharacterId"] = 0

            if self._sanitize_equips(normalized_document.get("equips")) == self._sanitize_equips(raw_equips):
                return SwitchCharacterMemoryResponse(updated=True, current_memory=None)

            normalized_update = self._build_equips_update(raw_equips)
            client = create_mongo_client(self._settings)
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            try:
                result = await collection.update_one(
                    {"_id": normalized_document.get("_id")},
                    {"$set": {"equips": normalized_update["equips"]}},
                )
            finally:
                with contextlib.suppress(Exception):
                    client.close()

            if result.modified_count <= 0:
                raise ValueError("equips.update_failed")

            return SwitchCharacterMemoryResponse(updated=True, current_memory=None)

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        target_template_id = parse_optional_int(target_equip.get("TemplateId"))
        if not _is_memory_template_id(target_template_id):
            raise ValueError("equips.template_invalid")
        if _get_memory_slot_id(target_template_id) != normalized_slot:
            raise ValueError("character.memory_slot_mismatch")

        target_original_character_id = int(parse_optional_int(target_equip.get("CharacterId")) or 0)
        swap_source_index: int | None = None
        if target_original_character_id > 0 and target_original_character_id != character_id:
            for index in current_memory_indices:
                if index != target_index:
                    swap_source_index = index
                    break

        for index in current_memory_indices:
            if index == target_index:
                continue
            raw_equips[index] = dict(raw_equips[index])
            raw_equips[index]["CharacterId"] = 0

        if swap_source_index is not None:
            raw_equips[swap_source_index]["CharacterId"] = target_original_character_id

        updated_target = dict(target_equip)
        updated_target["CharacterId"] = character_id
        raw_equips[target_index] = updated_target

        if self._sanitize_equips(normalized_document.get("equips")) == self._sanitize_equips(raw_equips):
            current_memory = _build_memory_item_record(updated_target)
            return SwitchCharacterMemoryResponse(updated=True, current_memory=current_memory)

        normalized_update = self._build_equips_update(raw_equips)
        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": normalized_document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        current_memory = _build_memory_item_record(updated_target)
        return SwitchCharacterMemoryResponse(updated=True, current_memory=current_memory)

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

    def _build_equips_update(self, equips: list[dict[str, Any]]) -> dict[str, Any]:
        materialized_update = self._get_characters_schema().materialize_update_fields({
            "equips": self._sanitize_equips(equips),
        })
        if "equips" not in materialized_update:
            raise RuntimeError("Failed to materialize equips update")
        return materialized_update

    def _build_weapon_document(self, template_id: int, raw_equips: list[Any]) -> dict[str, Any]:
        now = int(time.time())
        equip_document = self._get_characters_schema().materialize_write({
            "_id": _get_next_weapon_record_id(raw_equips),
            "TemplateId": template_id,
            "CharacterId": 0,
            "Level": 1,
            "Exp": 0,
            "Breakthrough": 0,
            "ResonanceInfo": [],
            "UnconfirmedResonanceInfo": [],
            "AwakeSlotList": [],
            "IsLock": False,
            "CreateTime": Int64(now),
            "WeaponOverrunData": {},
            "IsRecycle": False,
        }, EQUIP_ITEM_SCHEMA_PATH)

        if not isinstance(equip_document, dict):
            raise RuntimeError("Failed to materialize weapon schema")

        if "CreateTime" in equip_document:
            equip_document["CreateTime"] = Int64(now)

        return equip_document

    def _build_memory_document(self, template_id: int, raw_equips: list[Any]) -> dict[str, Any]:
        return self._build_weapon_document(template_id, raw_equips)

    def _build_partner_document(self, template_id: int, record_id: int) -> dict[str, Any]:
        entry = get_partner_entries_map().get(template_id)
        config = get_partner_skill_config_map().get(template_id)
        if entry is None or config is None:
            raise ValueError("partner.template_invalid")
        recommended = get_partner_recommended_main_skill_entries_map().get(template_id, [])
        main_ids = [row["skill_id"] for row in recommended if row["skill_group_id"] == config["DefaultMainSkillGroupId"]]
        if not main_ids:
            main_ids = [row["skill_id"] for row in recommended]
        passive_groups = get_partner_passive_skill_groups_map().get(template_id, [])
        if not main_ids or not passive_groups or any(not group for group in passive_groups):
            raise ValueError("partner.template_invalid")
        return self._get_characters_schema().materialize_write({
            "_id": record_id, "TemplateId": template_id, "Level": 1,
            "Quality": entry["InitQuality"], "CreateTime": Int64(int(time.time())),
            "SkillList": [
                {"_id": main_ids[0], "Level": 1, "IsWear": True, "Type": 1},
                *[{"_id": skill_id, "Level": 1, "IsWear": False, "Type": 2}
                  for group in passive_groups for skill_id in group],
            ],
            "UnlockSkillGroup": config["MainSkillGroupId"],
        }, "partners.0")

    async def add_partners(self, uid: int, template_ids: list[int]) -> AddEquipResponse:
        ids = list(dict.fromkeys(template_ids))
        if not ids:
            raise ValueError("partner.template_invalid")
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"partners": 1})
            if not isinstance(document, dict):
                raise ValueError("partner.data_missing")
            raw = document.get("partners")
            records = raw if isinstance(raw, list) else []
            next_id = max((parse_optional_int(row.get("_id")) or 0 for row in records if isinstance(row, dict)), default=0) + 1
            additions = [self._build_partner_document(template_id, next_id + index) for index, template_id in enumerate(ids)]
            result = await collection.update_one(
                {"_id": document["_id"], **matching_uid_query(uid),
                 "partners": raw if "partners" in document else {"$exists": False}},
                {"$push": {"partners": {"$each": additions}}},
            )
            if result.modified_count <= 0:
                raise ValueError("partner.add_failed")
            return AddEquipResponse(added=True, added_count=len(additions))
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def list_character_partners(
        self, uid: int, page: int = 1, page_size: int = DEFAULT_LIST_PAGE_SIZE,
        keyword: str | None = None, sort_by: str = "character", sort_order: str = "asc",
    ) -> PartnerListResponse:
        client = create_mongo_client(self._settings)
        try:
            document = await client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME].find_one(
                matching_uid_query(uid), {"partners": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()
        entries = get_partner_entries_map()
        names = get_character_log_name_map()
        limits = get_partner_breakthrough_level_limit_map()
        star_options = get_partner_star_schedule_options_map()
        search = normalize_search_keyword(keyword)
        items = []
        rows = document.get("partners", []) if isinstance(document, dict) else []
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict):
                continue
            record_id = parse_optional_int(row.get("_id"))
            template_id = parse_optional_int(row.get("TemplateId"))
            if record_id is None or template_id is None:
                continue
            character_id = parse_optional_int(row.get("CharacterId")) or 0
            entry = entries.get(template_id, {})
            priority = _get_weapon_search_priority(search, str(entry.get("Name", "")), names.get(character_id, ""), str(entry.get("Desc", "")))
            if priority is None:
                continue
            level = parse_optional_int(row.get("Level")) or 0
            breakthrough = parse_optional_int(row.get("BreakThrough")) or 0
            enhancement = max(0, level) + sum(limit for stage, limit in limits.get(template_id, {}).items() if stage < breakthrough)
            quality = parse_optional_int(row.get("Quality")) or 0
            schedule = parse_optional_int(row.get("StarSchedule")) or 0
            thresholds = star_options.get(template_id, {}).get(quality, [])
            star = max((index for index, threshold in enumerate(thresholds) if schedule >= threshold), default=0) if quality < 6 else 0
            item = PartnerItemRecord(
                record_id=record_id, TemplateId=template_id, CharacterId=character_id,
                Quality=quality, Star=star, Level=level,
                Exp=parse_optional_int(row.get("Exp")) or 0, BreakThrough=breakthrough,
                EnhancementLevel=enhancement,
            )
            name = str(entry.get("Name", ""))
            if sort_by == "character":
                key = (priority, int(character_id == 0), ordered_text_key(names.get(character_id, ""), sort_order), ordered_text_key(name, sort_order), record_id)
            elif sort_by in ("quality", "enhancement"):
                key = (priority, ordered_number_key(item.Quality if sort_by == "quality" else enhancement, sort_order), ordered_text_key(name, sort_order), record_id)
            else:
                key = (priority, ordered_text_key(name, sort_order), record_id)
            items.append((key, item))
        items.sort(key=lambda pair: pair[0])
        page = max(1, page)
        size = max(1, min(page_size, DEFAULT_LIST_PAGE_SIZE))
        total = len(items)
        return PartnerListResponse(items=[item for _, item in items[(page - 1) * size:page * size]],
                                   page=page, page_size=size, total=total, total_pages=math.ceil(total / size))

    async def character_partners(self, uid: int, record_id: int, partner_record_id: int | None = None) -> dict:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"characters": 1, "partners": 1})
            if not isinstance(document, dict):
                raise ValueError("character.not_found")
            characters = self._sanitize_character_list(document.get("characters"))
            if not any(parse_optional_int(row.get("_id")) == record_id for row in characters):
                raise ValueError("character.not_found")
            original = document.get("partners", [])
            rows = original if isinstance(original, list) else []
            items = [item for row in rows if isinstance(row, dict) for item in [build_partner_item_record(row)] if item is not None]
            current = [i for i, row in enumerate(rows) if isinstance(row, dict) and parse_optional_int(row.get("CharacterId")) == record_id]
            if len(current) > 1 or len({item.record_id for item in items}) != len(items):
                raise ValueError("partner.conflict")
            if partner_record_id is None:
                return {"character_record_id": record_id, "character_id": record_id,
                        "current_partner": next((item for item in items if item.CharacterId == record_id), None), "items": items}
            target = next((i for i, row in enumerate(rows) if isinstance(row, dict) and parse_optional_int(row.get("_id")) == partner_record_id), None)
            if target is None:
                raise ValueError("partner.not_found")
            if parse_optional_int(rows[target].get("TemplateId")) not in get_partner_entries_map():
                raise ValueError("partner.template_invalid")
            owner = parse_optional_int(rows[target].get("CharacterId")) or 0
            if owner and owner != record_id:
                if not any(parse_optional_int(row.get("_id")) == owner for row in characters):
                    raise ValueError("character.not_found")
                if sum(isinstance(row, dict) and parse_optional_int(row.get("CharacterId")) == owner for row in rows) != 1:
                    raise ValueError("partner.conflict")
            updated = copy.deepcopy(rows)
            changed = {target}
            if current and current[0] != target:
                changed.add(current[0])
                updated[current[0]]["CharacterId"] = owner
            updated[target]["CharacterId"] = record_id
            if updated != rows:
                updates = {f"partners.{index}.CharacterId": self._get_characters_schema().materialize_write(
                    updated[index]["CharacterId"], f"partners.{index}.CharacterId") for index in changed}
                result = await collection.update_one(
                    {"_id": document["_id"], **matching_uid_query(uid), "partners": original, "characters": document.get("characters")},
                    {"$set": updates},
                )
                if result.modified_count <= 0:
                    raise ValueError("partner.conflict")
            return {"updated": True, "current_partner": build_partner_item_record(updated[target])}
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def delete_unequipped_partner(self, uid: int, record_id: int) -> bool:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"partners": 1})
            rows = document.get("partners", []) if isinstance(document, dict) else []
            rows = rows if isinstance(rows, list) else []
            target = next((row for row in rows if isinstance(row, dict) and parse_optional_int(row.get("_id")) == record_id), None)
            if target is None:
                return False
            if parse_optional_int(target.get("CharacterId")) not in (None, 0):
                raise ValueError("partner.equipped_delete_forbidden")
            result = await collection.update_one(
                {"_id": document["_id"], **matching_uid_query(uid),
                 "partners": {"$elemMatch": {"_id": record_id, "CharacterId": {"$in": [0, None]}}}},
                {"$pull": {"partners": {"_id": record_id, "CharacterId": {"$in": [0, None]}}}},
            )
            return result.modified_count > 0
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def clear_unequipped_partners_by_keyword(self, uid: int, keyword: str) -> ClearEquipsResponse:
        search = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"partners": 1})
            rows = document.get("partners", []) if isinstance(document, dict) else []
            rows = rows if isinstance(rows, list) else []
            entries = get_partner_entries_map()
            ids = [row["_id"] for row in rows if isinstance(row, dict)
                   and parse_optional_int(row.get("CharacterId")) in (None, 0)
                   and parse_optional_int(row.get("_id")) is not None
                   and _get_weapon_search_priority(search,
                       str(entries.get(parse_optional_int(row.get("TemplateId")), {}).get("Name", "")), "",
                       str(entries.get(parse_optional_int(row.get("TemplateId")), {}).get("Desc", ""))) is not None]
            if not ids:
                return ClearEquipsResponse(keyword=search, deleted_count=0)
            result = await collection.update_one(
                {"_id": document["_id"], **matching_uid_query(uid), "partners": rows},
                {"$pull": {"partners": {"_id": {"$in": ids}, "CharacterId": {"$in": [0, None]}}}},
            )
            return ClearEquipsResponse(keyword=search, deleted_count=len(ids) if result.modified_count else 0)
        finally:
            with contextlib.suppress(Exception):
                client.close()

    def _partner_detail(self, target: dict[str, Any]) -> dict[str, Any]:
        pid = int(target["TemplateId"])
        limits = get_partner_breakthrough_level_limit_map().get(pid, {})
        levels = get_partner_skill_level_entries_map()
        skills = []
        for saved in target.get("SkillList", []):
            skill_id = parse_optional_int(saved.get("_id"))
            level = parse_optional_int(saved.get("Level")) or 1
            entries = levels.get(skill_id, {})
            skills.append({"skill_id": skill_id, "Level": level, "Type": saved.get("Type", 0),
                           "IsWear": bool(saved.get("IsWear")), "MaxLevel": max(entries, default=0),
                           **entries.get(level, entries.get(min(entries, default=0), {}))})
        bt = int(target.get("BreakThrough", 0))
        return {
            "record": {"record_id": int(target["_id"]), **{key: int(target.get(key, 0)) for key in
                       ("TemplateId", "CharacterId", "Quality", "StarSchedule", "Level", "Exp", "BreakThrough")},
                       "EnhancementLevel": int(target.get("Level", 0)) + sum(cap for stage, cap in limits.items() if stage < bt)},
            "skills": skills, "breakthrough_level_limit_map": limits,
            "level_exp_map": get_partner_level_exp_map().get(pid, {}),
            "quality_entries_map": get_partner_quality_entries_map().get(pid, {}),
            "star_schedule_options_map": get_partner_star_schedule_options_map().get(pid, {}),
        }

    def _edit_partner(self, target: dict[str, Any], action: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Validate a target-only transformation, preserving unrelated/unknown save fields."""
        updated = copy.deepcopy(target)
        pid = int(target["TemplateId"])
        if pid not in get_partner_entries_map():
            raise ValueError("partner.template_invalid")
        if action == "enhance":
            field = payload["field"]
            value = payload["value"]
            limits = get_partner_breakthrough_level_limit_map()[pid]
            bt = int(target.get("BreakThrough", 0))
            level = int(target.get("Level", 1))
            exp = int(target.get("Exp", 0))
            if field == "breakthrough":
                if value not in limits:
                    raise ValueError("equips.breakthrough_out_of_range")
                bt = value
                level = min(max(1, level), limits[bt])
            elif field == "level":
                if value < 1 or value > limits.get(bt, 0):
                    raise ValueError("equips.level_above_limit")
                level = value
            elif field != "exp":
                raise ValueError("equips.invalid_field")
            threshold = get_partner_level_exp_map()[pid].get(bt, {}).get(level)
            if threshold is None:
                raise ValueError("partner.template_invalid")
            allowed = threshold if level == limits[bt] else max(0, threshold - 1)
            if field == "exp":
                if value < 0 or value > allowed:
                    raise ValueError("equips.exp_above_limit")
                exp = value
            updated.update(BreakThrough=bt, Level=level, Exp=min(exp, allowed))
        elif action == "quality":
            quality, star = payload["quality"], payload["star"]
            options = get_partner_star_schedule_options_map()[pid].get(quality, [])
            if not 0 <= star < len(options):
                raise ValueError("partner.value_invalid")
            updated.update(Quality=quality, StarSchedule=options[star])
            capacity = get_partner_quality_entries_map()[pid][quality]["SkillColumnCount"]
            count = 0
            for skill in updated.get("SkillList", []):
                if skill.get("Type") == 2 and skill.get("IsWear"):
                    count += 1
                    if count > capacity:
                        skill["IsWear"] = False
        elif action == "main-skill":
            skill_id = payload["skill_id"]
            candidate = next((row for row in get_partner_recommended_main_skill_entries_map()[pid]
                              if row["skill_id"] == skill_id), None)
            if candidate is None:
                raise ValueError("partner.skill_invalid")
            previous = next((skill for skill in updated.get("SkillList", []) if skill.get("Type") == 1), {})
            replacement = {**previous, "_id": skill_id, "Type": 1, "IsWear": True,
                           "Level": int(previous.get("Level", 1))}
            if replacement["Level"] not in get_partner_skill_level_entries_map().get(skill_id, {}):
                raise ValueError("partner.value_invalid")
            updated["SkillList"] = [replacement, *[skill for skill in updated.get("SkillList", []) if skill.get("Type") != 1]]
            updated["UnlockSkillGroup"] = list(dict.fromkeys([*updated.get("UnlockSkillGroup", []), candidate["skill_group_id"]]))
        elif action in ("skill-level", "passive"):
            skill_id = payload["skill_id"]
            matches = [skill for skill in updated.get("SkillList", []) if skill.get("_id") == skill_id]
            if len(matches) != 1:
                raise ValueError("partner.skill_invalid")
            skill = matches[0]
            if action == "skill-level":
                if skill.get("Type") not in (1, 2):
                    raise ValueError("partner.skill_invalid")
                if skill.get("Type") == 1 and skill_id not in get_partner_main_skill_ids_map()[pid]:
                    raise ValueError("partner.skill_invalid")
                if payload["value"] not in get_partner_skill_level_entries_map().get(skill_id, {}):
                    raise ValueError("partner.value_invalid")
                if skill.get("Type") == 2 and skill_id not in get_partner_passive_skill_ids_map()[pid]:
                    raise ValueError("partner.skill_invalid")
                skill["Level"] = payload["value"]
            else:
                if skill.get("Type") != 2 or skill_id not in get_partner_passive_skill_ids_map()[pid]:
                    raise ValueError("partner.skill_invalid")
                skill["IsWear"] = payload["enabled"]
                capacity = get_partner_quality_entries_map()[pid][int(updated["Quality"])]["SkillColumnCount"]
                if sum(1 for row in updated["SkillList"] if row.get("Type") == 2 and row.get("IsWear")) > capacity:
                    raise ValueError("partner.passive_limit")
        else:
            raise ValueError("equips.invalid_field")
        return updated

    async def partner_detail(self, uid: int, record_id: int, action: str | None = None,
                             payload: dict[str, Any] | None = None) -> dict[str, Any]:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"partners": 1})
            rows = document.get("partners", []) if isinstance(document, dict) else []
            matches = [(index, row) for index, row in enumerate(rows) if isinstance(row, dict)
                       and parse_optional_int(row.get("_id")) == record_id]
            if not matches:
                raise ValueError("partner.not_found")
            if len(matches) != 1:
                raise ValueError("partner.conflict")
            index, target = matches[0]
            if action is not None:
                updated = self._edit_partner(target, action, payload or {})
                if updated != target:
                    changes = {key: value for key, value in updated.items() if target.get(key) != value}
                    fields = self._get_characters_schema().materialize_update_fields(
                        {f"partners.{index}.{key}": value for key, value in changes.items()})
                    skill_path = f"partners.{index}.SkillList"
                    if skill_path in fields:
                        fields[skill_path] = [{**raw, **typed} for raw, typed in
                                              zip(updated["SkillList"], fields[skill_path])]
                    result = await collection.update_one(
                        {"_id": document["_id"], **matching_uid_query(uid), "partners": rows}, {"$set": fields})
                    if not result.modified_count:
                        raise ValueError("partner.conflict")
                target = updated
            return self._partner_detail(target)
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def add_weapons(self, uid: int, template_ids: list[int]) -> AddEquipResponse:
        normalized_template_ids = list(dict.fromkeys(int(template_id) for template_id in template_ids))
        if not normalized_template_ids:
            raise ValueError("equips.template_invalid")

        for normalized_template_id in normalized_template_ids:
            if not _is_weapon_template_id(normalized_template_id) or normalized_template_id not in get_equip_name_map():
                raise ValueError("equips.template_invalid")

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"equips": 1})
            if not isinstance(document, dict):
                raise ValueError("equips.equips_missing")

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))

            weapon_documents = []
            for normalized_template_id in normalized_template_ids:
                weapon_document = self._build_weapon_document(normalized_template_id, raw_equips)
                weapon_documents.append(weapon_document)
                raw_equips.append(weapon_document)

            normalized_update = self._build_equips_update(raw_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.add_failed")

        return AddEquipResponse(added=True, added_count=len(weapon_documents))

    async def add_memories(self, uid: int, template_ids: list[int]) -> AddEquipResponse:
        normalized_template_ids = list(dict.fromkeys(int(template_id) for template_id in template_ids))
        if not normalized_template_ids:
            raise ValueError("equips.template_invalid")

        for normalized_template_id in normalized_template_ids:
            if not _is_memory_template_id(normalized_template_id) or normalized_template_id not in get_equip_name_map():
                raise ValueError("equips.template_invalid")

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(matching_uid_query(uid), {"equips": 1})
            if not isinstance(document, dict):
                raise ValueError("equips.equips_missing")

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))

            memory_documents = []
            for normalized_template_id in normalized_template_ids:
                memory_document = self._build_memory_document(normalized_template_id, raw_equips)
                memory_documents.append(memory_document)
                raw_equips.append(memory_document)

            normalized_update = self._build_equips_update(raw_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.add_failed")

        return AddEquipResponse(added=True, added_count=len(memory_documents))

    async def delete_unequipped_weapon(self, uid: int, record_id: int) -> bool:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                return False

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            target_exists = False

            for raw_equip in raw_equips:
                if not isinstance(raw_equip, dict):
                    continue

                current_record_id = parse_optional_int(raw_equip.get("_id"))
                if current_record_id != normalized_record_id:
                    continue

                target_exists = True
                template_id = parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_weapon_template_id(template_id):
                    return False

                character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    raise ValueError("equips.equipped_delete_forbidden")

                break

            if not target_exists:
                return False

            remaining_equips = [
                raw_equip
                for raw_equip in raw_equips
                if parse_optional_int(raw_equip.get("_id")) != normalized_record_id
            ]
            normalized_update = self._build_equips_update(remaining_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.modified_count > 0

    async def delete_unequipped_memory(self, uid: int, record_id: int) -> bool:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                return False

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            target_exists = False

            for raw_equip in raw_equips:
                if not isinstance(raw_equip, dict):
                    continue

                current_record_id = parse_optional_int(raw_equip.get("_id"))
                if current_record_id != normalized_record_id:
                    continue

                target_exists = True
                template_id = parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_memory_template_id(template_id):
                    return False

                character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    raise ValueError("equips.equipped_delete_forbidden")

                break

            if not target_exists:
                return False

            remaining_equips = [
                raw_equip
                for raw_equip in raw_equips
                if parse_optional_int(raw_equip.get("_id")) != normalized_record_id
            ]

            normalized_update = self._build_equips_update(remaining_equips)
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.modified_count > 0

    async def update_weapon(self, uid: int, record_id: int, payload: UpdateEquipRequest) -> WeaponItemRecord:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                raise ValueError("equips.not_found")

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            target_index: int | None = None
            target_equip: dict[str, Any] | None = None

            for index, raw_equip in enumerate(raw_equips):
                if not isinstance(raw_equip, dict):
                    continue

                current_record_id = parse_optional_int(raw_equip.get("_id"))
                if current_record_id == normalized_record_id:
                    target_index = index
                    target_equip = dict(raw_equip)
                    break

            if target_index is None or target_equip is None:
                raise ValueError("equips.not_found")

            template_id = parse_optional_int(target_equip.get("TemplateId"))
            if template_id is None or not _is_weapon_template_id(template_id):
                raise ValueError("equips.template_invalid")

            current_level = max(1, int(parse_optional_int(target_equip.get("Level")) or 1))
            current_exp = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))
            current_breakthrough = max(0, int(parse_optional_int(target_equip.get("Breakthrough")) or 0))

            breakthrough_levelup_template_map = get_breakthrough_levelup_template_map()
            breakthrough_max_map = get_equip_breakthrough_max_map()
            breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()

            stage_template_map = breakthrough_levelup_template_map.get(template_id, {})
            max_bt_data = breakthrough_max_map.get(template_id, {})
            max_breakthrough = max_bt_data.get("max_breakthrough", 0)
            stage_limit_map = breakthrough_level_limit_map.get(template_id, {})

            current_template_id = stage_template_map.get(current_breakthrough)

            field_name = str(payload.field).strip().lower()
            field_value = int(payload.value)

            if field_name == "breakthrough":
                if field_value < 0 or field_value > max_breakthrough:
                    raise ValueError("equips.breakthrough_out_of_range")
                current_breakthrough = field_value
                new_template_id = stage_template_map.get(current_breakthrough)
                if new_template_id is not None:
                    current_template_id = new_template_id
                    stage_level_limit = stage_limit_map.get(current_breakthrough)
                    new_level = current_level
                    if isinstance(stage_level_limit, int) and new_level > stage_level_limit:
                        new_level = stage_level_limit
                    max_lvl = get_levelup_template_max_level(current_template_id)
                    if max_lvl is not None and new_level > max_lvl:
                        new_level = max_lvl
                    current_level = new_level
                    allowed_max = _get_equip_allowed_max_exp(current_template_id, current_level)
                    if allowed_max is None:
                        raise ValueError("equips.template_invalid")
                    current_exp = min(current_exp, allowed_max)

            elif field_name == "level":
                if field_value < 1:
                    raise ValueError("equips.level_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                stage_level_limit = stage_limit_map.get(current_breakthrough)
                if isinstance(stage_level_limit, int) and field_value > stage_level_limit:
                    raise ValueError("equips.level_above_limit")

                max_lvl = get_levelup_template_max_level(current_template_id) or 1
                if field_value > max_lvl:
                    raise ValueError("equips.level_above_limit")

                allowed_max = _get_equip_allowed_max_exp(current_template_id, field_value)
                if allowed_max is None:
                    raise ValueError("equips.template_invalid")

                current_level = field_value
                current_exp = min(current_exp, allowed_max)

            elif field_name == "exp":
                if field_value < 0:
                    raise ValueError("equips.exp_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                allowed_max = _get_equip_allowed_max_exp(current_template_id, current_level)
                if allowed_max is None:
                    raise ValueError("equips.template_invalid")

                if field_value > allowed_max:
                    raise ValueError("equips.exp_above_limit")

                current_exp = field_value

            else:
                raise ValueError("equips.invalid_field")

            target_equip["Level"] = current_level
            target_equip["Exp"] = current_exp
            target_equip["Breakthrough"] = current_breakthrough

            raw_equips[target_index] = target_equip
            normalized_update = self._build_equips_update(raw_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        response_item = WeaponItemRecord(
            record_id=normalized_record_id,
            TemplateId=template_id,
            CharacterId=parse_optional_int(target_equip.get("CharacterId")),
            Level=current_level,
            Exp=current_exp,
            Breakthrough=current_breakthrough,
        )
        response_item.EnhancementLevel = _weapon_enhancement_level(response_item, get_equip_breakthrough_level_limit_map())
        return response_item

    async def update_memory(self, uid: int, record_id: int, payload: UpdateEquipRequest) -> WeaponItemRecord:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                raise ValueError("equips.not_found")

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            target_index: int | None = None
            target_equip: dict[str, Any] | None = None

            for index, raw_equip in enumerate(raw_equips):
                if not isinstance(raw_equip, dict):
                    continue

                current_record_id = parse_optional_int(raw_equip.get("_id"))
                if current_record_id == normalized_record_id:
                    target_index = index
                    target_equip = dict(raw_equip)
                    break

            if target_index is None or target_equip is None:
                raise ValueError("equips.not_found")

            template_id = parse_optional_int(target_equip.get("TemplateId"))
            if template_id is None or not _is_memory_template_id(template_id):
                raise ValueError("equips.template_invalid")

            current_level = max(1, int(parse_optional_int(target_equip.get("Level")) or 1))
            current_exp = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))
            current_breakthrough = max(0, int(parse_optional_int(target_equip.get("Breakthrough")) or 0))

            breakthrough_levelup_template_map = get_breakthrough_levelup_template_map()
            breakthrough_max_map = get_equip_breakthrough_max_map()
            breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()

            stage_template_map = breakthrough_levelup_template_map.get(template_id, {})
            max_bt_data = breakthrough_max_map.get(template_id, {})
            max_breakthrough = max_bt_data.get("max_breakthrough", 0)
            stage_limit_map = breakthrough_level_limit_map.get(template_id, {})

            current_template_id = stage_template_map.get(current_breakthrough)

            field_name = str(payload.field).strip().lower()
            field_value = int(payload.value)

            if field_name == "breakthrough":
                if field_value < 0 or field_value > max_breakthrough:
                    raise ValueError("equips.breakthrough_out_of_range")
                current_breakthrough = field_value
                new_template_id = stage_template_map.get(current_breakthrough)
                if new_template_id is not None:
                    current_template_id = new_template_id
                    stage_level_limit = stage_limit_map.get(current_breakthrough)
                    new_level = current_level
                    if isinstance(stage_level_limit, int) and new_level > stage_level_limit:
                        new_level = stage_level_limit
                    max_lvl = get_levelup_template_max_level(current_template_id)
                    if max_lvl is not None and new_level > max_lvl:
                        new_level = max_lvl
                    current_level = new_level
                    allowed_max = _get_equip_allowed_max_exp(current_template_id, current_level)
                    if allowed_max is None:
                        raise ValueError("equips.template_invalid")
                    current_exp = min(current_exp, allowed_max)

            elif field_name == "level":
                if field_value < 1:
                    raise ValueError("equips.level_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                stage_level_limit = stage_limit_map.get(current_breakthrough)
                if isinstance(stage_level_limit, int) and field_value > stage_level_limit:
                    raise ValueError("equips.level_above_limit")

                max_lvl = get_levelup_template_max_level(current_template_id) or 1
                if field_value > max_lvl:
                    raise ValueError("equips.level_above_limit")

                allowed_max = _get_equip_allowed_max_exp(current_template_id, field_value)
                if allowed_max is None:
                    raise ValueError("equips.template_invalid")

                current_level = field_value
                current_exp = min(current_exp, allowed_max)

            elif field_name == "exp":
                if field_value < 0:
                    raise ValueError("equips.exp_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                allowed_max = _get_equip_allowed_max_exp(current_template_id, current_level)
                if allowed_max is None:
                    raise ValueError("equips.template_invalid")

                if field_value > allowed_max:
                    raise ValueError("equips.exp_above_limit")

                current_exp = field_value

            else:
                raise ValueError("equips.invalid_field")

            target_equip["Level"] = current_level
            target_equip["Exp"] = current_exp
            target_equip["Breakthrough"] = current_breakthrough

            raw_equips[target_index] = target_equip
            normalized_update = self._build_equips_update(raw_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        response_item = WeaponItemRecord(
            record_id=normalized_record_id,
            TemplateId=template_id,
            CharacterId=parse_optional_int(target_equip.get("CharacterId")),
            Level=current_level,
            Exp=current_exp,
            Breakthrough=current_breakthrough,
        )
        response_item.EnhancementLevel = _weapon_enhancement_level(response_item, get_equip_breakthrough_level_limit_map())
        return response_item

    async def get_weapon_extra_info(self, uid: int, record_id: int) -> WeaponExtraInfoRecord:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))
        original_raw_equips = document.get("equips") if isinstance(document.get("equips"), list) else []

        target_equip: dict[str, Any] | None = None
        original_target_equip: dict[str, Any] | None = None
        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_equip = raw_equip
                break

        for raw_equip in original_raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                original_target_equip = raw_equip
                break

        if target_equip is None:
            raise ValueError("equips.not_found")

        if original_target_equip is None:
            original_target_equip = {}

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_weapon_template_id(template_id):
            raise ValueError("equips.template_invalid")

        breakthrough = max(0, int(parse_optional_int(target_equip.get("Breakthrough")) or 0))
        level = max(1, int(parse_optional_int(target_equip.get("Level")) or 1))
        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map().get(template_id, {})
        max_breakthrough = get_equip_breakthrough_max_map().get(template_id, {}).get("max_breakthrough", 0)
        description = get_equip_descriptions_map().get(template_id)

        current_level_exp_limit: int | None = None
        template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
        if isinstance(template_stage_map, dict):
            template_id_for_stage = template_stage_map.get(breakthrough)
            if template_id_for_stage is not None:
                current_level_exp_limit = get_level_per_exp(template_id_for_stage, level)

        resonance_info = None
        resonance_raw = target_equip.get("ResonanceInfo")
        if isinstance(resonance_raw, list):
            resonance_entries = _normalize_weapon_resonance_list(resonance_raw)
            resonance_info = []
            for entry in resonance_entries:
                slot = parse_optional_int(entry.Slot)
                if slot is None:
                    continue

                resonance_info.append(WeaponResonanceExtraInfoRecord(
                    slot=slot,
                    type=parse_optional_int(entry.Type),
                    template_id=parse_optional_int(entry.TemplateId),
                    character_id=parse_optional_int(entry.CharacterId),
                ))

        current_character_memories = None
        character_id = parse_optional_int(target_equip.get("CharacterId")) or 0
        if character_id > 0:
            current_character_memories = [
                memory_template_id
                for raw_equip in raw_equips
                if isinstance(raw_equip, dict)
                and (parse_optional_int(raw_equip.get("CharacterId")) or 0) == character_id
                for memory_template_id in [parse_optional_int(raw_equip.get("TemplateId"))]
                if _is_memory_template_id(memory_template_id)
            ]

        weapon_overrun_data = None
        weapon_overrun_max_level_map = get_weapon_overrun_max_level_map()
        max_overrun_level = weapon_overrun_max_level_map.get(template_id)
        if max_overrun_level is not None:
            raw_weapon_overrun_data = original_target_equip.get("WeaponOverrunData")
            normalized_weapon_overrun_data = _normalize_weapon_overrun_data(raw_weapon_overrun_data)
            has_raw_weapon_overrun_data = isinstance(raw_weapon_overrun_data, dict) and len(raw_weapon_overrun_data) > 0

            if not has_raw_weapon_overrun_data or normalized_weapon_overrun_data is None:
                weapon_overrun_data = WeaponOverrunExtraInfoRecord()
            else:
                weapon_overrun_data = WeaponOverrunExtraInfoRecord(
                    level=parse_optional_int(normalized_weapon_overrun_data.Level),
                    max_level=max_overrun_level,
                    chose_suit=parse_optional_int(normalized_weapon_overrun_data.ChoseSuit),
                )

        return WeaponExtraInfoRecord(
            max_breakthrough=max_breakthrough,
            breakthrough_level_limit_map={
                int(stage): int(level_limit)
                for stage, level_limit in breakthrough_level_limit_map.items()
                if isinstance(stage, int) and isinstance(level_limit, int)
            },
            description=description,
            current_level_exp_limit=current_level_exp_limit,
            resonance_info=resonance_info,
            weapon_overrun_data=weapon_overrun_data,
            current_character_memories=current_character_memories,
        )

    async def get_memory_extra_info(self, uid: int, record_id: int) -> MemoryExtraInfoRecord:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))

        target_equip: dict[str, Any] | None = None
        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_equip = raw_equip
                break

        if target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_memory_template_id(template_id):
            raise ValueError("equips.template_invalid")

        breakthrough = max(0, int(parse_optional_int(target_equip.get("Breakthrough")) or 0))
        level = max(1, int(parse_optional_int(target_equip.get("Level")) or 1))
        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map().get(template_id, {})
        max_breakthrough = get_equip_breakthrough_max_map().get(template_id, {}).get("max_breakthrough", 0)
        description = get_equip_descriptions_map().get(template_id)

        current_level_exp_limit: int | None = None
        template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
        if isinstance(template_stage_map, dict):
            template_id_for_stage = template_stage_map.get(breakthrough)
            if template_id_for_stage is not None:
                current_level_exp_limit = get_level_per_exp(template_id_for_stage, level)

        resonance_info = None
        resonance_raw = target_equip.get("ResonanceInfo")
        if isinstance(resonance_raw, list):
            resonance_entries = _normalize_weapon_resonance_list(resonance_raw)
            resonance_info = []
            for entry in resonance_entries:
                slot = parse_optional_int(entry.Slot)
                if slot is None or slot not in {1, 2}:
                    continue

                resonance_info.append(WeaponResonanceExtraInfoRecord(
                    slot=slot,
                    type=parse_optional_int(entry.Type),
                    template_id=parse_optional_int(entry.TemplateId),
                    character_id=parse_optional_int(entry.CharacterId),
                ))

        awake_slot_list = _resolve_awake_slot_list(target_equip.get("AwakeSlotList"), template_id, {1, 2})

        return MemoryExtraInfoRecord(
            max_breakthrough=max_breakthrough,
            breakthrough_level_limit_map={
                int(stage): int(level_limit)
                for stage, level_limit in breakthrough_level_limit_map.items()
                if isinstance(stage, int) and isinstance(level_limit, int)
            },
            description=description,
            current_level_exp_limit=current_level_exp_limit,
            resonance_info=resonance_info,
            awake_slot_list=awake_slot_list,
        )

    async def set_weapon_resonance(self, uid: int, record_id: int, payload) -> WeaponResonanceRecord:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not isinstance(document, dict):
            raise ValueError("equips.not_found")

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue
            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_index = index
                target_equip = dict(raw_equip)
                break

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_weapon_template_id(template_id):
            raise ValueError("equips.template_invalid")

        resonance_raw = target_equip.get("ResonanceInfo")
        existing_resonance = (
            _normalize_weapon_resonance_list(resonance_raw)
            if isinstance(resonance_raw, list)
            else []
        )

        slot = int(payload.Slot)
        entry_type = int(payload.Type)
        template_id_value = int(payload.TemplateId)
        character_id = int(payload.CharacterId)
        awake_enabled = bool(payload.Awake) if payload.Awake is not None else None

        if not _is_valid_weapon_resonance_entry(template_id, slot, entry_type, template_id_value, character_id):
            raise ValueError("equips.resonance_invalid")

        new_entry = WeaponResonanceRecord(
            Slot=slot,
            Type=entry_type,
            CharacterId=character_id,
            TemplateId=template_id_value,
        )

        updated = False
        for i, entry in enumerate(existing_resonance):
            if parse_optional_int(entry.Slot) == slot:
                existing_resonance[i] = new_entry
                updated = True
                break

        if not updated:
            existing_resonance.append(new_entry)

        awake_slot_list = _normalize_awake_slot_list(target_equip.get("AwakeSlotList"), {1, 2, 3})
        if _is_awake_supported_template_id(template_id):
            if awake_enabled is not None:
                awake_slot_list = _apply_awake_slot_update(awake_slot_list, slot, awake_enabled)
        else:
            awake_slot_list = []

        target_equip["ResonanceInfo"] = [
            entry.model_dump() for entry in existing_resonance
        ]
        target_equip["AwakeSlotList"] = awake_slot_list
        raw_equips[target_index] = target_equip
        normalized_update = self._build_equips_update(raw_equips)

        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        return new_entry

    async def set_memory_resonance(self, uid: int, record_id: int, payload) -> WeaponResonanceRecord:
        if int(payload.Slot) not in {1, 2}:
            raise ValueError("equips.resonance_invalid")

        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not isinstance(document, dict):
            raise ValueError("equips.not_found")

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue
            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_index = index
                target_equip = dict(raw_equip)
                break

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_memory_template_id(template_id):
            raise ValueError("equips.template_invalid")

        resonance_raw = target_equip.get("ResonanceInfo")
        existing_resonance = (
            _normalize_weapon_resonance_list(resonance_raw)
            if isinstance(resonance_raw, list)
            else []
        )

        slot = int(payload.Slot)
        entry_type = int(payload.Type)
        template_id_value = int(payload.TemplateId)
        character_id = int(payload.CharacterId)
        awake_enabled = bool(payload.Awake) if payload.Awake is not None else None

        if not _is_valid_weapon_resonance_entry(template_id, slot, entry_type, template_id_value, character_id):
            raise ValueError("equips.resonance_invalid")

        new_entry = WeaponResonanceRecord(
            Slot=slot,
            Type=entry_type,
            CharacterId=character_id,
            TemplateId=template_id_value,
        )

        updated = False
        filtered_resonance = [entry for entry in existing_resonance if parse_optional_int(entry.Slot) in {1, 2}]
        for i, entry in enumerate(filtered_resonance):
            if parse_optional_int(entry.Slot) == slot:
                filtered_resonance[i] = new_entry
                updated = True
                break

        if not updated:
            filtered_resonance.append(new_entry)

        awake_slot_list = _normalize_awake_slot_list(target_equip.get("AwakeSlotList"), {1, 2})
        if _is_awake_supported_template_id(template_id):
            if awake_enabled is not None:
                awake_slot_list = _apply_awake_slot_update(awake_slot_list, slot, awake_enabled)
        else:
            awake_slot_list = []

        target_equip["ResonanceInfo"] = [entry.model_dump() for entry in filtered_resonance]
        target_equip["AwakeSlotList"] = awake_slot_list
        raw_equips[target_index] = target_equip
        normalized_update = self._build_equips_update(raw_equips)

        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        return new_entry

    async def set_weapon_overrun(self, uid: int, record_id: int, payload) -> None:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not isinstance(document, dict):
            raise ValueError("equips.not_found")

        raw_equips = document.get("equips") if isinstance(document.get("equips"), list) else []

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue
            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_index = index
                target_equip = dict(raw_equip)
                break

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_weapon_template_id(template_id):
            raise ValueError("equips.template_invalid")

        weapon_overrun_max_level_map = get_weapon_overrun_max_level_map()
        if weapon_overrun_max_level_map.get(template_id) is None:
            raise ValueError("equips.overrun_not_supported")

        chose_suit = parse_optional_int(getattr(payload, "chose_suit", None))
        requested_level = parse_optional_int(getattr(payload, "level", None))
        max_overrun_level = weapon_overrun_max_level_map.get(template_id)
        if max_overrun_level is None:
            raise ValueError("equips.overrun_not_supported")

        existing_overrun_data = _normalize_weapon_overrun_data(target_equip.get("WeaponOverrunData"))
        existing_level = parse_optional_int(existing_overrun_data.Level) if existing_overrun_data is not None else None
        existing_chose_suit = parse_optional_int(existing_overrun_data.ChoseSuit) if existing_overrun_data is not None else None

        if chose_suit is not None and chose_suit > 0 and chose_suit not in get_weapon_overrun_suit_entries_map():
            raise ValueError("equips.overrun_invalid")

        resolved_chose_suit = chose_suit if chose_suit is not None else existing_chose_suit
        weapon_overrun_data: dict[str, Any]
        if resolved_chose_suit is None or resolved_chose_suit <= 0:
            weapon_overrun_data = {}
        else:
            resolved_level = requested_level if requested_level is not None else existing_level
            if resolved_level is None or resolved_level <= 0:
                # Selecting a Harmony suit enables it at its first valid level.
                resolved_level = 1
            if resolved_level > max_overrun_level:
                raise ValueError("equips.overrun_level_above_limit")

            weapon_overrun_data = {
                "Level": resolved_level,
                "ActiveSuits": [resolved_chose_suit],
                "ChoseSuit": resolved_chose_suit,
            }

        if self._serialize_weapon_overrun_data(target_equip.get("WeaponOverrunData")) == weapon_overrun_data:
            return

        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {f"equips.{target_index}.WeaponOverrunData": weapon_overrun_data}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

    async def delete_weapon_resonance(self, uid: int, record_id: int, slot: int) -> bool:
        normalized_record_id = int(record_id)
        normalized_slot = int(slot)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not isinstance(document, dict):
            raise ValueError("equips.not_found")

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue
            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_index = index
                target_equip = dict(raw_equip)
                break

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_weapon_template_id(template_id):
            raise ValueError("equips.template_invalid")

        resonance_raw = target_equip.get("ResonanceInfo")
        existing_resonance = (
            _normalize_weapon_resonance_list(resonance_raw)
            if isinstance(resonance_raw, list)
            else []
        )

        filtered_resonance = [
            entry for entry in existing_resonance if parse_optional_int(entry.Slot) != normalized_slot
        ]
        if len(filtered_resonance) == len(existing_resonance):
            return False

        awake_slot_list = _normalize_awake_slot_list(target_equip.get("AwakeSlotList"), {1, 2, 3})
        awake_slot_list = [slot for slot in awake_slot_list if slot != normalized_slot]

        target_equip["ResonanceInfo"] = [
            entry.model_dump() for entry in filtered_resonance
        ]
        target_equip["AwakeSlotList"] = awake_slot_list
        raw_equips[target_index] = target_equip
        normalized_update = self._build_equips_update(raw_equips)

        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        return True

    async def delete_memory_resonance(self, uid: int, record_id: int, slot: int) -> bool:
        normalized_record_id = int(record_id)
        normalized_slot = int(slot)
        if normalized_slot not in {1, 2}:
            return False

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not isinstance(document, dict):
            raise ValueError("equips.not_found")

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))

        target_index: int | None = None
        target_equip: dict[str, Any] | None = None
        for index, raw_equip in enumerate(raw_equips):
            if not isinstance(raw_equip, dict):
                continue
            current_record_id = parse_optional_int(raw_equip.get("_id"))
            if current_record_id == normalized_record_id:
                target_index = index
                target_equip = dict(raw_equip)
                break

        if target_index is None or target_equip is None:
            raise ValueError("equips.not_found")

        template_id = parse_optional_int(target_equip.get("TemplateId"))
        if template_id is None or not _is_memory_template_id(template_id):
            raise ValueError("equips.template_invalid")

        resonance_raw = target_equip.get("ResonanceInfo")
        existing_resonance = (
            _normalize_weapon_resonance_list(resonance_raw)
            if isinstance(resonance_raw, list)
            else []
        )

        filtered_resonance = [
            entry for entry in existing_resonance if parse_optional_int(entry.Slot) != normalized_slot and parse_optional_int(entry.Slot) in {1, 2}
        ]
        if len(filtered_resonance) == len([entry for entry in existing_resonance if parse_optional_int(entry.Slot) in {1, 2}]):
            return False

        awake_slot_list = _normalize_awake_slot_list(target_equip.get("AwakeSlotList"), {1, 2})
        awake_slot_list = [slot for slot in awake_slot_list if slot != normalized_slot]

        target_equip["ResonanceInfo"] = [entry.model_dump() for entry in filtered_resonance]
        target_equip["AwakeSlotList"] = awake_slot_list
        raw_equips[target_index] = target_equip
        normalized_update = self._build_equips_update(raw_equips)

        client = create_mongo_client(self._settings)
        collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
        try:
            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("equips.update_failed")

        return True

    async def list_character_weapons(
        self,
        uid: int,
        page: int = 1,
        page_size: int = DEFAULT_LIST_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: WeaponSortField = "character",
        sort_order: WeaponSortOrder = "asc",
    ) -> EquipListResponse:
        current_page = max(1, int(page))
        normalized_page_size = DEFAULT_LIST_PAGE_SIZE if page_size <= 0 else min(int(page_size), DEFAULT_LIST_PAGE_SIZE)
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))
        weapon_name_map = get_equip_name_map()
        character_name_map = get_character_log_name_map()
        weapon_type_name_map = get_weapon_type_name_map()
        weapon_star_map = get_equip_star_map()
        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()
        normalized_items: list[WeaponItemRecord] = []

        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_weapon_template_id(template_id):
                continue

            character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
            search_priority = _get_weapon_search_priority(
                normalized_keyword,
                weapon_name_map.get(template_id, "") if template_id is not None else "",
                character_name_map.get(character_id, ""),
                weapon_type_name_map.get(template_id, "") if template_id is not None else "",
            )
            if search_priority is None:
                continue

            normalized_item = _build_weapon_item_record(raw_equip)
            if normalized_item is None or template_id is None:
                continue

            normalized_items.append(normalized_item)

        normalized_items.sort(
            key=lambda item: _weapon_sort_key(
                item,
                sort_by,
                sort_order,
                _get_weapon_search_priority(
                    normalized_keyword,
                    weapon_name_map.get(item.TemplateId, ""),
                    character_name_map.get(int(item.CharacterId or 0), ""),
                    weapon_type_name_map.get(item.TemplateId, ""),
                )
                or 0,
                weapon_name_map,
                character_name_map,
                weapon_type_name_map,
                weapon_star_map,
                breakthrough_level_limit_map,
            ),
        )

        total = len(normalized_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return EquipListResponse(
            items=normalized_items[start:end],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )

    async def clear_unequipped_weapons_by_keyword(self, uid: int, keyword: str) -> ClearEquipsResponse:
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            weapon_name_map = get_equip_name_map()
            character_name_map = get_character_log_name_map()
            weapon_type_name_map = get_weapon_type_name_map()
            deletable_record_ids: list[int] = []

            for raw_equip in raw_equips:
                if not isinstance(raw_equip, dict):
                    continue

                template_id = parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_weapon_template_id(template_id):
                    continue

                character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    continue

                search_priority = _get_weapon_search_priority(
                    normalized_keyword,
                    weapon_name_map.get(template_id, "") if template_id is not None else "",
                    character_name_map.get(character_id, ""),
                    weapon_type_name_map.get(template_id, "") if template_id is not None else "",
                )
                if search_priority is None:
                    continue

                record_id = parse_optional_int(raw_equip.get("_id"))
                if record_id is None:
                    continue

                deletable_record_ids.append(record_id)

            if not deletable_record_ids:
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            remaining_equips = [
                raw_equip
                for raw_equip in raw_equips
                if parse_optional_int(raw_equip.get("_id")) not in deletable_record_ids
            ]
            if len(remaining_equips) == len(raw_equips):
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            normalized_update = self._build_equips_update(remaining_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

        return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=len(deletable_record_ids))

    async def list_character_memories(
        self,
        uid: int,
        page: int = 1,
        page_size: int = DEFAULT_LIST_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: MemorySortField = "character",
        sort_order: WeaponSortOrder = "asc",
    ) -> EquipListResponse:
        current_page = max(1, int(page))
        normalized_page_size = DEFAULT_LIST_PAGE_SIZE if page_size <= 0 else min(int(page_size), DEFAULT_LIST_PAGE_SIZE)
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        normalized_document = self._sanitize_characters_document(document)
        raw_equips = self._sanitize_equips(normalized_document.get("equips"))
        memory_name_map = get_equip_name_map()
        character_name_map = get_character_log_name_map()
        equip_site_map = get_equip_site_map()
        memory_star_map = get_equip_star_map()
        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map()
        normalized_items: list[WeaponItemRecord] = []

        for raw_equip in raw_equips:
            if not isinstance(raw_equip, dict):
                continue

            template_id = parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_memory_template_id(template_id):
                continue

            character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
            search_priority = _get_memory_search_priority(
                normalized_keyword,
                memory_name_map.get(template_id, "") if template_id is not None else "",
                character_name_map.get(character_id, ""),
            )
            if search_priority is None:
                continue

            normalized_item = _build_memory_item_record(raw_equip)
            if normalized_item is None or template_id is None:
                continue

            normalized_items.append(normalized_item)

        normalized_items.sort(
            key=lambda item: _memory_sort_key(
                item,
                sort_by,
                sort_order,
                _get_memory_search_priority(
                    normalized_keyword,
                    memory_name_map.get(item.TemplateId, ""),
                    character_name_map.get(int(item.CharacterId or 0), ""),
                ) or 0,
                memory_name_map,
                character_name_map,
                equip_site_map,
                memory_star_map,
                breakthrough_level_limit_map,
            ),
        )

        total = len(normalized_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return EquipListResponse(
            items=normalized_items[start:end],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )

    async def clear_unequipped_memories_by_keyword(self, uid: int, keyword: str) -> ClearEquipsResponse:
        normalized_keyword = normalize_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                matching_uid_query(uid),
                {"equips": 1},
            )

            if not isinstance(document, dict):
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            normalized_document = self._sanitize_characters_document(document)
            raw_equips = self._sanitize_equips(normalized_document.get("equips"))
            memory_name_map = get_equip_name_map()
            character_name_map = get_character_log_name_map()
            deletable_record_ids: list[int] = []

            for raw_equip in raw_equips:
                if not isinstance(raw_equip, dict):
                    continue

                template_id = parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_memory_template_id(template_id):
                    continue

                character_id = parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    continue

                search_priority = _get_memory_search_priority(
                    normalized_keyword,
                    memory_name_map.get(template_id, "") if template_id is not None else "",
                    character_name_map.get(character_id, ""),
                )
                if search_priority is None:
                    continue

                record_id = parse_optional_int(raw_equip.get("_id"))
                if record_id is None:
                    continue

                deletable_record_ids.append(record_id)

            if not deletable_record_ids:
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            remaining_equips = [
                raw_equip
                for raw_equip in raw_equips
                if parse_optional_int(raw_equip.get("_id")) not in deletable_record_ids
            ]
            if len(remaining_equips) == len(raw_equips):
                return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

            normalized_update = self._build_equips_update(remaining_equips)

            result = await collection.update_one(
                {"_id": document.get("_id")},
                {"$set": {"equips": normalized_update["equips"]}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=0)

        return ClearEquipsResponse(keyword=normalized_keyword, deleted_count=len(deletable_record_ids))
