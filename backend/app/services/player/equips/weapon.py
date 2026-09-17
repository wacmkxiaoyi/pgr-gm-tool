from __future__ import annotations

import ast
import json
from functools import lru_cache

from backend.app.services.player.equips.constants import ARCHIVE_WEAPON_GROUP_TSV_PATH, EQUIP_SUIT_TSV_PATH, EQUIP_TSV_PATH, ROLE_WAFER_BAG_ASSET_PREFIX, WEAPON_OVERRUN_TSV_PATH, WEAPON_SKILL_POOL_TSV_PATH, WEAPON_SKILL_TSV_PATH
from backend.app.services.player.utils import extract_int_list, normalize_asset_path, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


def _normalize_weapon_overrun_skill_description(value: object) -> str:
    """Convert 4.7's indexed skill-description array to the legacy piece map."""
    if not isinstance(value, list):
        return str(value or "").strip()

    descriptions = {
        str(index + 1): text
        for index, raw_text in enumerate(value)
        for text in [str(raw_text or "").strip()]
        if index % 2 == 1 and text
    }
    return json.dumps(descriptions, ensure_ascii=False, separators=(",", ":"))


@lru_cache(maxsize=1)
def get_weapon_group_name_map() -> dict[int, str]:
    reader = TSVReader(ARCHIVE_WEAPON_GROUP_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "GroupName")[0])


@lru_cache(maxsize=1)
def get_weapon_type_name_map() -> dict[int, str]:
    equip_reader = TSVReader(EQUIP_TSV_PATH, typed=True)
    raw_equip_type_map = equip_reader.get_maps("Id", "Type")[0]
    weapon_group_name_map = get_weapon_group_name_map()

    normalized_map: dict[int, str] = {}
    for equip_id_raw, equip_type_raw in raw_equip_type_map.items():
        try:
            equip_id = int(equip_id_raw)
            equip_type = int(equip_type_raw)
        except (TypeError, ValueError):
            continue

        weapon_type_name = weapon_group_name_map.get(equip_type)
        if not weapon_type_name:
            continue

        normalized_map[equip_id] = weapon_type_name

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_type_id_map() -> dict[int, int]:
    equip_reader = TSVReader(EQUIP_TSV_PATH, typed=True)
    raw_equip_type_map = equip_reader.get_maps("Id", "Type")[0]

    normalized_map: dict[int, int] = {}
    for equip_id_raw, equip_type_raw in raw_equip_type_map.items():
        try:
            equip_id = int(equip_id_raw)
            equip_type = int(equip_type_raw)
        except (TypeError, ValueError):
            continue

        normalized_map[equip_id] = equip_type

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_skill_entries_map() -> dict[int, dict[str, str]]:
    reader = TSVReader(WEAPON_SKILL_TSV_PATH, typed=True)
    skill_table = reader.get_sub_table("Id", ["Name", "Description"])
    normalized_map: dict[int, dict[str, str]] = {}

    for raw_id, row in skill_table.items():
        try:
            skill_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        normalized_map[skill_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "Description": str(row.get("Description") or "").strip(),
        }

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_skill_pool_entries_map() -> dict[int, dict[int, list[int]]]:
    reader = TSVReader(WEAPON_SKILL_POOL_TSV_PATH, typed=True)
    columns = list(reader.data[0]) if reader.data else []
    skill_columns = ["SkillId"] if "SkillId" in columns else [
        column
        for column in columns
        if str(column).startswith("SkillId[")
    ]
    rows = reader.select(["PoolId", "CharacterId", *skill_columns])
    normalized_map: dict[int, dict[int, list[int]]] = {}

    for row in rows:
        pool_id = parse_int(row.get("PoolId"))
        character_id = parse_int(row.get("CharacterId"))
        if pool_id is None or character_id is None:
            continue

        skill_ids = extract_int_list(row, skill_columns)

        if not skill_ids:
            continue

        normalized_map.setdefault(pool_id, {})[character_id] = skill_ids

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_overrun_suit_entries_map() -> dict[int, dict[str, str]]:
    reader = TSVReader(EQUIP_SUIT_TSV_PATH, typed=True)
    columns = list(reader.data[0]) if reader.data else []
    icon_column = "BigIconPath" if "BigIconPath" in columns else "WaferBagPath"
    suit_table = reader.get_sub_table("Id", ["Name", "SkillDescription", icon_column])
    normalized_map: dict[int, dict[str, str]] = {}

    for suit_id_raw, row in suit_table.items():
        try:
            suit_id = int(suit_id_raw)
        except (TypeError, ValueError):
            continue

        normalized_map[suit_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "SkillDescription": _normalize_weapon_overrun_skill_description(row.get("SkillDescription")),
            "WaferBagPath": normalize_asset_path(str(row.get(icon_column) or ""), ROLE_WAFER_BAG_ASSET_PREFIX) or "",
        }

    return normalized_map

@lru_cache(maxsize=1)
def get_weapon_overrun_suit_memory_ids_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_SUIT_TSV_PATH, typed=True)
    raw_equip_ids_map = reader.get_maps("Id", "EquipIds")[0]
    normalized_map: dict[int, dict[int, int]] = {}

    for suit_id_raw, equip_ids_raw in raw_equip_ids_map.items():
        try:
            suit_id = int(suit_id_raw)
        except (TypeError, ValueError):
            continue

        if equip_ids_raw == "" or equip_ids_raw is None:
            continue

        if isinstance(equip_ids_raw, list):
            parsed_map = {
                slot: equip_id
                for slot, raw_equip_id in enumerate(equip_ids_raw, start=1)
                for equip_id in [parse_int(raw_equip_id)]
                if equip_id is not None and equip_id > 0
            }
            if parsed_map:
                normalized_map[suit_id] = parsed_map
        elif isinstance(equip_ids_raw, dict):
            parsed_map: dict[int, int] = {}
            for slot_key, equip_id_val in equip_ids_raw.items():
                try:
                    slot = int(slot_key)
                    equip_id = int(equip_id_val)
                    parsed_map[slot] = equip_id
                except (TypeError, ValueError):
                    continue
            if parsed_map:
                normalized_map[suit_id] = parsed_map
        elif isinstance(equip_ids_raw, str):
            stripped = equip_ids_raw.strip()
            try:
                parsed = json.loads(stripped)
            except (json.JSONDecodeError, ValueError):
                try:
                    parsed = ast.literal_eval(stripped)
                except (ValueError, SyntaxError):
                    continue
            if isinstance(parsed, dict):
                parsed_map: dict[int, int] = {}
                for slot_key, equip_id_val in parsed.items():
                    try:
                        slot = int(slot_key)
                        equip_id = int(equip_id_val)
                        parsed_map[slot] = equip_id
                    except (TypeError, ValueError):
                        continue
                if parsed_map:
                    normalized_map[suit_id] = parsed_map

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_overrun_max_level_map() -> dict[int, int]:
    reader = TSVReader(WEAPON_OVERRUN_TSV_PATH, typed=True)
    rows = reader.select(["WeaponId", "Level"])
    weapon_max_level_map: dict[int, int] = {}

    for row in rows:
        weapon_id = parse_int(row.get("WeaponId"))
        level = parse_int(row.get("Level"))
        if weapon_id is None or level is None:
            continue

        current_max = weapon_max_level_map.get(weapon_id)
        if current_max is None or level > current_max:
            weapon_max_level_map[weapon_id] = level

    return weapon_max_level_map
