from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader


EQUIP_TSV_PATH = Path("assets/Equip.tsv")
EQUIP_RES_TSV_PATH = Path("assets/EquipRes.tsv")
EQUIP_BREAK_THROUGH_TSV_PATH = Path("assets/EquipBreakThrough.tsv")
EQUIP_RESONANCE_TSV_PATH = Path("assets/EquipResonance.tsv")
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
def get_equip_name_map() -> dict[int, str]:
    equip_name_map = _get_equip_map("Name")
    return {
        equip_id: str(name).strip()
        for equip_id, name in equip_name_map.items()
        if isinstance(name, str) and str(name).strip()
    }


@lru_cache(maxsize=1)
def get_equip_descriptions_map() -> dict[int, str]:
    equip_description_map = _get_equip_map("Description")
    return {
        equip_id: str(description).strip()
        for equip_id, description in equip_description_map.items()
        if isinstance(description, str) and str(description).strip()
    }

@lru_cache(maxsize=1)
def get_equip_star_map() -> dict[int, int]:
    equip_star_map = _get_equip_map("Star")
    return {
        equip_id: int(equip_star)
        for equip_id, equip_star in equip_star_map.items()
        if isinstance(equip_star, int)
    }


@lru_cache(maxsize=1)
def get_equip_site_map() -> dict[int, str]:
    equip_site_map = _get_equip_map("Site")
    normalized_map: dict[int, str] = {}
    for equip_id, site in equip_site_map.items():
        if isinstance(site, int):
            normalized_map[equip_id] = str(site)
            continue

        normalized_map[equip_id] = str(site).strip()

    return normalized_map


@lru_cache(maxsize=1)
def get_equip_icon_url_map() -> dict[int, str]:
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
def get_equip_breakthrough_level_limit_map() -> dict[int, dict[int, int]]:
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
def get_equip_breakthrough_max_map() -> dict[int, dict[str, int]]:
    level_limit_map = get_equip_breakthrough_level_limit_map()
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


@lru_cache(maxsize=1)
def get_equip_resonance_map() -> dict[int, list[list[int]]]:
    reader = TSVReader(EQUIP_RESONANCE_TSV_PATH, typed=True)
    normalized_map: dict[int, list[list[int]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        raw_id = row.get("Id")
        try:
            equip_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        attrib_pool_ids: list[int] = []
        for idx in (1, 2, 3):
            attrib_col = f"AttribPoolId[{idx}]"
            raw_val = row.get(attrib_col)
            if isinstance(raw_val, int):
                attrib_pool_ids.append(raw_val)
            elif isinstance(raw_val, str) and raw_val.strip():
                try:
                    attrib_pool_ids.append(int(raw_val.strip()))
                except (TypeError, ValueError):
                    pass

        character_skill_pool_ids: list[int] = []
        for idx in (1, 2, 3):
            skill_col = f"CharacterSkillPoolId[{idx}]"
            raw_val = row.get(skill_col)
            if isinstance(raw_val, int):
                character_skill_pool_ids.append(raw_val)
            elif isinstance(raw_val, str) and raw_val.strip():
                try:
                    character_skill_pool_ids.append(int(raw_val.strip()))
                except (TypeError, ValueError):
                    pass

        weapon_skill_pool_ids: list[int] = []
        for idx in (1, 2, 3):
            weapon_col = f"WeaponSkillPoolId[{idx}]"
            raw_val = row.get(weapon_col)
            if isinstance(raw_val, int):
                weapon_skill_pool_ids.append(raw_val)
            elif isinstance(raw_val, str) and raw_val.strip():
                try:
                    weapon_skill_pool_ids.append(int(raw_val.strip()))
                except (TypeError, ValueError):
                    pass

        normalized_map[equip_id] = [
            attrib_pool_ids,
            character_skill_pool_ids,
            weapon_skill_pool_ids,
        ]

    return normalized_map
