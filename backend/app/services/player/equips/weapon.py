from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader

from backend.app.services.player.equips import get_equip_type_map


ARCHIVE_WEAPON_GROUP_TSV_PATH = Path("resources/ArchiveWeaponGroup.tsv")
WEAPON_SKILL_TSV_PATH = Path("resources/WeaponSkill.tsv")
EQUIP_SUIT_TSV_PATH = Path("resources/EquipSuit.tsv")


@lru_cache(maxsize=1)
def get_weapon_group_name_map() -> dict[int, str]:
    reader = TSVReader(ARCHIVE_WEAPON_GROUP_TSV_PATH, typed=True)
    raw_group_name_map = reader.get_maps("Id", "GroupName")[0]

    group_name_map: dict[int, str] = {}
    for group_id_raw, group_name_raw in raw_group_name_map.items():
        try:
            group_id = int(group_id_raw)
        except (TypeError, ValueError):
            continue

        group_name = str(group_name_raw).strip()
        if not group_name:
            continue

        group_name_map[group_id] = group_name

    return group_name_map


@lru_cache(maxsize=1)
def get_weapon_type_name_map() -> dict[int, str]:
    equip_type_map = get_equip_type_map()
    weapon_group_name_map = get_weapon_group_name_map()

    return {
        equip_id: weapon_group_name_map[equip_type]
        for equip_id, equip_type in equip_type_map.items()
        if equip_type in weapon_group_name_map
    }


@lru_cache(maxsize=1)
def get_weapon_skill_name_map() -> dict[int, str]:
    reader = TSVReader(WEAPON_SKILL_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "Name")[0]
    return {
        int(rid): str(val).strip()
        for rid, val in raw_map.items()
        if str(val).strip()
    }


@lru_cache(maxsize=1)
def get_weapon_overrun_suit_name_map() -> dict[int, str]:
    reader = TSVReader(EQUIP_SUIT_TSV_PATH, typed=True)
    normalized_map: dict[int, str] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        suit_id_raw = row.get("Id")
        if suit_id_raw == "" or suit_id_raw is None:
            continue

        try:
            suit_id = int(suit_id_raw)
        except (TypeError, ValueError):
            continue

        equip_ids_raw = row.get("EquipIds")
        if equip_ids_raw == "" or equip_ids_raw is None:
            continue

        name = str(row.get("Name", "")).strip()
        if not name or name.upper() == "N/A":
            continue

        normalized_map[suit_id] = name

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_overrun_suit_equip_ids_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_SUIT_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[int, int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        suit_id_raw = row.get("Id")
        if suit_id_raw == "" or suit_id_raw is None:
            continue

        try:
            suit_id = int(suit_id_raw)
        except (TypeError, ValueError):
            continue

        equip_ids_raw = row.get("EquipIds")
        if equip_ids_raw == "" or equip_ids_raw is None:
            continue

        if isinstance(equip_ids_raw, dict):
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
            import ast
            import json
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
