from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader


EQUIP_TSV_PATH = Path("resources/Equip.tsv")
EQUIP_RES_TSV_PATH = Path("resources/EquipRes.tsv")
ARCHIVE_WEAPON_GROUP_TSV_PATH = Path("resources/ArchiveWeaponGroup.tsv")
EQUIP_BREAK_THROUGH_TSV_PATH = Path("resources/EquipBreakThrough.tsv")
ICON_TOOLS_ASSET_PREFIX = "/assets/icontools/"


def _normalize_asset_path(raw_path: str, prefix: str) -> str | None:
    filename = Path(str(raw_path).strip()).name.strip().lower()
    if not filename:
        return None
    return f"{prefix}{filename}"


@lru_cache(maxsize=1)
def _get_equip_map(value_field: str) -> dict[int, str | int]:
    reader = TSVReader(EQUIP_TSV_PATH, typed=True)
    equip_map = reader.get_maps("Id", value_field)[0]

    normalized_map: dict[int, str | int] = {}
    for equip_id_raw, value_raw in equip_map.items():
        try:
            equip_id = int(equip_id_raw)
        except (TypeError, ValueError):
            continue

        if isinstance(value_raw, int):
            normalized_map[equip_id] = value_raw
            continue

        text_value = str(value_raw).strip()
        if not text_value:
            normalized_map[equip_id] = ""
            continue

        try:
            normalized_map[equip_id] = int(text_value)
        except (TypeError, ValueError):
            normalized_map[equip_id] = text_value

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_name_map() -> dict[int, str]:
    equip_name_map = _get_equip_map("Name")
    return {
        equip_id: str(name).strip()
        for equip_id, name in equip_name_map.items()
        if isinstance(name, str) and str(name).strip()
    }


@lru_cache(maxsize=1)
def get_weapon_type_map() -> dict[int, int]:
    equip_type_map = _get_equip_map("Type")
    return {
        equip_id: int(equip_type)
        for equip_id, equip_type in equip_type_map.items()
        if isinstance(equip_type, int)
    }


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
    weapon_type_map = get_weapon_type_map()
    weapon_group_name_map = get_weapon_group_name_map()

    return {
        equip_id: weapon_group_name_map[equip_type]
        for equip_id, equip_type in weapon_type_map.items()
        if equip_type in weapon_group_name_map
    }


@lru_cache(maxsize=1)
def get_weapon_star_map() -> dict[int, int]:
    equip_star_map = _get_equip_map("Star")
    return {
        equip_id: int(equip_star)
        for equip_id, equip_star in equip_star_map.items()
        if isinstance(equip_star, int)
    }


@lru_cache(maxsize=1)
def get_weapon_site_map() -> dict[int, str]:
    equip_site_map = _get_equip_map("Site")
    normalized_map: dict[int, str] = {}
    for equip_id, site in equip_site_map.items():
        if isinstance(site, int):
            normalized_map[equip_id] = str(site)
            continue

        normalized_map[equip_id] = str(site).strip()

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_icon_url_map() -> dict[int, str]:
    reader = TSVReader(EQUIP_RES_TSV_PATH, typed=True)
    icon_map = reader.get_maps("Id", "BigIconPath")[0]

    normalized_map: dict[int, str] = {}
    for equip_id_raw, asset_path_raw in icon_map.items():
        try:
            equip_id = int(equip_id_raw)
        except (TypeError, ValueError):
            continue

        asset_path = _normalize_asset_path(str(asset_path_raw), ICON_TOOLS_ASSET_PREFIX)
        if asset_path is None:
            continue

        normalized_map[equip_id] = asset_path

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_breakthrough_level_limit_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_BREAK_THROUGH_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[int, int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        try:
            equip_id = int(row.get("EquipId"))
            breakthrough_times = int(row.get("Times"))
            level_limit = int(row.get("LevelLimit"))
        except (TypeError, ValueError):
            continue

        if equip_id not in normalized_map:
            normalized_map[equip_id] = {}

        normalized_map[equip_id][breakthrough_times] = level_limit

    return normalized_map


@lru_cache(maxsize=1)
def get_weapon_breakthrough_max_map() -> dict[int, dict[str, int]]:
    level_limit_map = get_weapon_breakthrough_level_limit_map()
    normalized_map: dict[int, dict[str, int]] = {}

    for equip_id, stage_map in level_limit_map.items():
        if not stage_map:
            continue

        max_breakthrough = max(stage_map)
        normalized_map[equip_id] = {
            "max_breakthrough": max_breakthrough,
            "max_level_limit": stage_map[max_breakthrough],
        }

    return normalized_map
