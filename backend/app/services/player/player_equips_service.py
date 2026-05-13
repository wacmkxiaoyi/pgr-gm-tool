from __future__ import annotations

import contextlib
import math
import time
from typing import Literal
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AddEquipResponse, AddEquipResponse, ClearEquipsResponse, MemoryExtraInfoRecord, EquipListResponse, UpdateEquipRequest, WeaponExtraInfoRecord, WeaponItemRecord, EquipListResponse, WeaponOverrunExtraInfoRecord, WeaponOverrunRecord, WeaponResonanceExtraInfoRecord, WeaponResonanceRecord
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
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
    get_character_skill_pool_entries_map,
    get_character_log_name_map,
)
from backend.app.services.player.levelup_template import (
    get_level_all_exp,
    get_level_from_total_exp,
    get_level_per_exp,
    get_levelup_template_max_level,
)
from backend.app.services.player.equips.weapon import (
    get_weapon_overrun_suit_entries_map,
    get_weapon_skill_pool_entries_map,
    get_weapon_overrun_max_level_map,
    get_weapon_type_name_map,
)
CHARACTERS_COLLECTION_NAME = "characters"
ITEM_PAGE_SIZE = 10
WeaponSortField = Literal["name", "character", "type", "star", "enhancement"]
MemorySortField = Literal["name", "character", "position", "star", "enhancement"]
WeaponSortOrder = Literal["asc", "desc"]
CHARACTER_LIST_SCHEMA_PATH = "characters"
FASHIONS_SCHEMA_PATH = "fashions"
EQUIPS_SCHEMA_PATH = "equips"
EQUIP_ITEM_SCHEMA_PATH = "equips.0"


def _normalize_awake_slot_list(raw_awake_slot_list: Any, allowed_slots: set[int]) -> list[int]:
    if not isinstance(raw_awake_slot_list, list):
        return []

    normalized_slots: list[int] = []
    seen_slots: set[int] = set()
    for raw_entry in raw_awake_slot_list:
        slot: int | None = None
        if isinstance(raw_entry, dict):
            slot = parse_optional_int(raw_entry.get("_id"))
            if slot is None:
                slot = parse_optional_int(raw_entry.get("Slot"))
        else:
            slot = parse_optional_int(raw_entry)

        if slot is None or slot not in allowed_slots or slot in seen_slots:
            continue

        seen_slots.add(slot)
        normalized_slots.append(slot)

    return normalized_slots


def _serialize_awake_slot_list(awake_slot_list: list[int]) -> list[dict[str, int]]:
    return [{"_id": int(slot)} for slot in awake_slot_list if isinstance(slot, int)]


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

    def supports_weapon_overrun_data(self) -> bool:
        return self._get_characters_schema().allows_field(f"{EQUIP_ITEM_SCHEMA_PATH}.WeaponOverrunData")

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
        normalized_update = self._get_characters_schema().normalize_update_fields({
            "equips": self._sanitize_equips(equips),
        })
        if "equips" not in normalized_update:
            raise RuntimeError("Failed to normalize equips update")
        return normalized_update

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
            current_exp_total = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))
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
                    new_level, _new_current_exp = get_level_from_total_exp(current_exp_total, current_template_id)
                    stage_level_limit = stage_limit_map.get(current_breakthrough)
                    if isinstance(stage_level_limit, int) and new_level > stage_level_limit:
                        new_level = stage_level_limit
                        _new_current_exp = get_level_per_exp(current_template_id, new_level) or 0
                    max_lvl = get_levelup_template_max_level(current_template_id)
                    if max_lvl is not None and new_level > max_lvl:
                        new_level = max_lvl
                    current_level = new_level
                    all_exp = get_level_all_exp(current_template_id, current_level) or 0
                    per_exp = get_level_per_exp(current_template_id, current_level) or 0
                    if max_lvl is not None and current_level == max_lvl and _new_current_exp > per_exp:
                        _new_current_exp = per_exp
                    current_exp_total = all_exp + _new_current_exp

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

                all_exp = get_level_all_exp(current_template_id, field_value)
                if all_exp is None:
                    raise ValueError("equips.template_invalid")

                if field_value < current_level:
                    per_exp = get_level_per_exp(current_template_id, field_value) or 0
                    current_exp_total = all_exp + max(0, per_exp - 1)
                else:
                    current_exp_total = all_exp

                current_level = field_value

            elif field_name == "exp":
                if field_value < 0:
                    raise ValueError("equips.exp_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                all_exp = get_level_all_exp(current_template_id, current_level)
                per_exp = get_level_per_exp(current_template_id, current_level)
                if all_exp is None or per_exp is None:
                    raise ValueError("equips.template_invalid")

                max_lvl = get_levelup_template_max_level(current_template_id)
                if max_lvl is not None and current_level == max_lvl:
                    allowed_max = per_exp
                else:
                    allowed_max = per_exp - 1

                if field_value > allowed_max:
                    raise ValueError("equips.exp_above_limit")

                current_exp_total = all_exp + field_value

            else:
                raise ValueError("equips.invalid_field")

            target_equip["Level"] = current_level
            target_equip["Exp"] = current_exp_total
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

        response_exp = current_exp_total
        if current_template_id is not None:
            all_exp = get_level_all_exp(current_template_id, current_level)
            if all_exp is not None:
                response_exp = max(0, current_exp_total - all_exp)

        response_item = WeaponItemRecord(
            record_id=normalized_record_id,
            TemplateId=template_id,
            CharacterId=parse_optional_int(target_equip.get("CharacterId")),
            Level=current_level,
            Exp=response_exp,
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
            current_exp_total = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))
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
                    new_level, new_current_exp = get_level_from_total_exp(current_exp_total, current_template_id)
                    stage_level_limit = stage_limit_map.get(current_breakthrough)
                    if isinstance(stage_level_limit, int) and new_level > stage_level_limit:
                        new_level = stage_level_limit
                        new_current_exp = get_level_per_exp(current_template_id, new_level) or 0
                    max_lvl = get_levelup_template_max_level(current_template_id)
                    if max_lvl is not None and new_level > max_lvl:
                        new_level = max_lvl
                    current_level = new_level
                    all_exp = get_level_all_exp(current_template_id, current_level) or 0
                    per_exp = get_level_per_exp(current_template_id, current_level) or 0
                    if max_lvl is not None and current_level == max_lvl and new_current_exp > per_exp:
                        new_current_exp = per_exp
                    current_exp_total = all_exp + new_current_exp

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

                all_exp = get_level_all_exp(current_template_id, field_value)
                if all_exp is None:
                    raise ValueError("equips.template_invalid")

                if field_value < current_level:
                    per_exp = get_level_per_exp(current_template_id, field_value) or 0
                    current_exp_total = all_exp + max(0, per_exp - 1)
                else:
                    current_exp_total = all_exp

                current_level = field_value

            elif field_name == "exp":
                if field_value < 0:
                    raise ValueError("equips.exp_below_min")

                if current_template_id is None:
                    raise ValueError("equips.template_invalid")

                all_exp = get_level_all_exp(current_template_id, current_level)
                per_exp = get_level_per_exp(current_template_id, current_level)
                if all_exp is None or per_exp is None:
                    raise ValueError("equips.template_invalid")

                max_lvl = get_levelup_template_max_level(current_template_id)
                allowed_max = per_exp if max_lvl is not None and current_level == max_lvl else per_exp - 1

                if field_value > allowed_max:
                    raise ValueError("equips.exp_above_limit")

                current_exp_total = all_exp + field_value

            else:
                raise ValueError("equips.invalid_field")

            target_equip["Level"] = current_level
            target_equip["Exp"] = current_exp_total
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

        response_exp = current_exp_total
        if current_template_id is not None:
            all_exp = get_level_all_exp(current_template_id, current_level)
            if all_exp is not None:
                response_exp = max(0, current_exp_total - all_exp)

        response_item = WeaponItemRecord(
            record_id=normalized_record_id,
            TemplateId=template_id,
            CharacterId=parse_optional_int(target_equip.get("CharacterId")),
            Level=current_level,
            Exp=response_exp,
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
        raw_exp = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))

        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map().get(template_id, {})
        max_breakthrough = get_equip_breakthrough_max_map().get(template_id, {}).get("max_breakthrough", 0)
        description = get_equip_descriptions_map().get(template_id)

        current_level_exp_limit: int | None = None
        template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
        if isinstance(template_stage_map, dict):
            template_id_for_stage = template_stage_map.get(breakthrough)
            if template_id_for_stage is not None:
                all_exp = get_level_all_exp(template_id_for_stage, level)
                per_exp = get_level_per_exp(template_id_for_stage, level)
                if all_exp is not None and per_exp is not None and raw_exp >= all_exp:
                    current_level_exp_limit = per_exp

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

        allows_overrun_data = self.supports_weapon_overrun_data()

        weapon_overrun_data = None
        weapon_overrun_max_level_map = get_weapon_overrun_max_level_map()
        max_overrun_level = weapon_overrun_max_level_map.get(template_id)
        if allows_overrun_data and max_overrun_level is not None:
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
        raw_exp = max(0, int(parse_optional_int(target_equip.get("Exp")) or 0))

        breakthrough_level_limit_map = get_equip_breakthrough_level_limit_map().get(template_id, {})
        max_breakthrough = get_equip_breakthrough_max_map().get(template_id, {}).get("max_breakthrough", 0)
        description = get_equip_descriptions_map().get(template_id)

        current_level_exp_limit: int | None = None
        template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
        if isinstance(template_stage_map, dict):
            template_id_for_stage = template_stage_map.get(breakthrough)
            if template_id_for_stage is not None:
                all_exp = get_level_all_exp(template_id_for_stage, level)
                per_exp = get_level_per_exp(template_id_for_stage, level)
                if all_exp is not None and per_exp is not None and raw_exp >= all_exp:
                    current_level_exp_limit = per_exp

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
        target_equip["AwakeSlotList"] = _serialize_awake_slot_list(awake_slot_list)
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
        target_equip["AwakeSlotList"] = _serialize_awake_slot_list(awake_slot_list)
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

        if not self.supports_weapon_overrun_data():
            raise ValueError("equips.overrun_not_supported")

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

        resolved_level = requested_level if requested_level is not None else existing_level
        if resolved_level is None:
            resolved_level = self._get_default_weapon_overrun_level()

        if resolved_level <= 0:
            raise ValueError("equips.overrun_level_below_min")
        if resolved_level > max_overrun_level:
            raise ValueError("equips.overrun_level_above_limit")

        if chose_suit is not None and chose_suit > 0 and chose_suit not in get_weapon_overrun_suit_entries_map():
            raise ValueError("equips.overrun_invalid")

        resolved_chose_suit = chose_suit if chose_suit is not None else existing_chose_suit
        weapon_overrun_data: dict[str, Any]
        if resolved_chose_suit is None or resolved_chose_suit <= 0:
            weapon_overrun_data = {}
        else:
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
        target_equip["AwakeSlotList"] = _serialize_awake_slot_list(awake_slot_list)
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
        target_equip["AwakeSlotList"] = _serialize_awake_slot_list(awake_slot_list)
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
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: WeaponSortField = "character",
        sort_order: WeaponSortOrder = "asc",
    ) -> EquipListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ITEM_PAGE_SIZE if page_size <= 0 else min(int(page_size), ITEM_PAGE_SIZE)
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

            raw_exp = parse_optional_int(raw_equip.get("Exp"))
            current_breakthrough = max(0, int(normalized_item.Breakthrough or 0))
            template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
            if isinstance(template_stage_map, dict) and normalized_item.Level is not None and raw_exp is not None:
                template_id_for_stage = template_stage_map.get(current_breakthrough)
                if template_id_for_stage is not None:
                    all_exp = get_level_all_exp(template_id_for_stage, normalized_item.Level)
                    if all_exp is not None:
                        normalized_item.Exp = max(0, raw_exp - all_exp)

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
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: MemorySortField = "character",
        sort_order: WeaponSortOrder = "asc",
    ) -> EquipListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ITEM_PAGE_SIZE if page_size <= 0 else min(int(page_size), ITEM_PAGE_SIZE)
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

            raw_exp = parse_optional_int(raw_equip.get("Exp"))
            current_breakthrough = max(0, int(normalized_item.Breakthrough or 0))
            template_stage_map = get_breakthrough_levelup_template_map().get(template_id)
            if isinstance(template_stage_map, dict) and normalized_item.Level is not None and raw_exp is not None:
                template_id_for_stage = template_stage_map.get(current_breakthrough)
                if template_id_for_stage is not None:
                    all_exp = get_level_all_exp(template_id_for_stage, normalized_item.Level)
                    if all_exp is not None:
                        normalized_item.Exp = max(0, raw_exp - all_exp)

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
