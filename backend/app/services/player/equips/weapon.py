from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader

from backend.app.services.player.equips import EQUIP_TSV_PATH


ARCHIVE_WEAPON_GROUP_TSV_PATH = Path("assets/ArchiveWeaponGroup.tsv")
WEAPON_SKILL_TSV_PATH = Path("assets/WeaponSkill.tsv")
WEAPON_SKILL_POOL_TSV_PATH = Path("assets/WeaponSkillPool.tsv")
EQUIP_SUIT_TSV_PATH = Path("assets/EquipSuit.tsv")
WEAPON_OVERRUN_TSV_PATH = Path("assets/WeaponOverrun.tsv")
ROLE_WAFER_BAG_ASSET_PREFIX = "/assets/rolewaferbag/"


def _normalize_asset_path(raw_path: str, prefix: str) -> str | None:
    filename = Path(str(raw_path).strip()).name.strip().lower()
    if not filename:
        return None
    return f"{prefix}{filename}"


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
def get_weapon_skill_entries_map() -> dict[int, dict[str, str]]:
    reader = TSVReader(WEAPON_SKILL_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[str, str]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        try:
            skill_id = int(row.get("Id"))
        except (TypeError, ValueError):
            continue

        normalized_map[skill_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "Description": str(row.get("Description") or "").strip(),
        }

    return normalized_map


def _parse_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@lru_cache(maxsize=1)
def get_weapon_skill_pool_entries_map() -> dict[int, dict[int, list[int]]]:
    reader = TSVReader(WEAPON_SKILL_POOL_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[int, list[int]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = _parse_int(row.get("PoolId"))
        character_id = _parse_int(row.get("CharacterId"))
        if pool_id is None or character_id is None:
            continue

        skill_ids: list[int] = []
        for column_name, raw_value in row.items():
            if not str(column_name).startswith("SkillId["):
                continue

            skill_id = _parse_int(raw_value)
            if skill_id is None:
                continue
            skill_ids.append(skill_id)

        if not skill_ids:
            continue

        normalized_map.setdefault(pool_id, {})[character_id] = skill_ids

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_overrun_suit_entries_map() -> dict[int, dict[str, str]]:
    reader = TSVReader(EQUIP_SUIT_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[str, str]] = {}

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

        normalized_map[suit_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "SkillDescription": str(row.get("SkillDescription") or "").strip(),
            "WaferBagPath": _normalize_asset_path(str(row.get("WaferBagPath") or ""), ROLE_WAFER_BAG_ASSET_PREFIX) or "",
        }

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


@lru_cache(maxsize=1)
def get_weapon_overrun_max_level_map() -> dict[int, int]:
    reader = TSVReader(WEAPON_OVERRUN_TSV_PATH, typed=True)
    weapon_max_level_map: dict[int, int] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        weapon_id = _parse_int(row.get("WeaponId"))
        level = _parse_int(row.get("Level"))
        if weapon_id is None or level is None:
            continue

        current_max = weapon_max_level_map.get(weapon_id)
        if current_max is None or level > current_max:
            weapon_max_level_map[weapon_id] = level

    return weapon_max_level_map
