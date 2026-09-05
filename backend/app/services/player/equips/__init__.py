from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import ICON_TOOLS_ASSET_PREFIX
from backend.app.services.player.equips.constants import EQUIP_AWAKE_TSV_PATH, EQUIP_BREAK_THROUGH_TSV_PATH, EQUIP_RESONANCE_TSV_PATH, EQUIP_RES_TSV_PATH, EQUIP_TSV_PATH
from backend.app.services.player.utils import extract_int_list, normalize_asset_path, parse_int
from backend.app.utils.tsv_reader import TSVReader


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

        asset_path = normalize_asset_path(str(asset_path_raw), ICON_TOOLS_ASSET_PREFIX)
        if asset_path is None:
            continue

        normalized_map[equip_id] = asset_path

    return normalized_map


@lru_cache(maxsize=1)
def get_equip_breakthrough_level_limit_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_BREAK_THROUGH_TSV_PATH, typed=True)
    rows = reader.select(["EquipId", "Times", "LevelLimit"])
    normalized_map: dict[int, dict[int, int]] = {}

    for row in rows:
        try:
            equip_id = int(row.get("EquipId"))
            level_limit = int(row.get("LevelLimit"))
        except (TypeError, ValueError):
            continue

        raw_breakthrough_times = row.get("Times")
        breakthrough_times = parse_int(raw_breakthrough_times)
        if raw_breakthrough_times in (None, ""):
            breakthrough_times = 0
        elif breakthrough_times is None:
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
    columns = list(reader.data[0]) if reader.data else []
    attrib_columns = ["AttribPoolId"] if "AttribPoolId" in columns else [f"AttribPoolId[{idx}]" for idx in (1, 2, 3)]
    character_skill_columns = ["CharacterSkillPoolId"] if "CharacterSkillPoolId" in columns else [f"CharacterSkillPoolId[{idx}]" for idx in (1, 2, 3)]
    weapon_skill_columns = ["WeaponSkillPoolId"] if "WeaponSkillPoolId" in columns else [f"WeaponSkillPoolId[{idx}]" for idx in (1, 2, 3)]
    resonance_table = reader.get_sub_table(
        "Id",
        [*attrib_columns, *character_skill_columns, *weapon_skill_columns],
    )
    normalized_map: dict[int, list[list[int]]] = {}

    for raw_id, row in resonance_table.items():
        try:
            equip_id = int(raw_id)
        except (TypeError, ValueError):
            continue

        normalized_map[equip_id] = [
            extract_int_list(row, attrib_columns),
            extract_int_list(row, character_skill_columns),
            extract_int_list(row, weapon_skill_columns),
        ]

    return normalized_map


@lru_cache(maxsize=1)
def get_equip_awake_template_id_set() -> set[int]:
    reader = TSVReader(EQUIP_AWAKE_TSV_PATH, typed=True)
    awake_template_map = reader.get_maps("Id", "Id")[0]
    template_ids: set[int] = set()

    for raw_id in awake_template_map.values():
        try:
            template_ids.add(int(raw_id))
        except (TypeError, ValueError):
            continue

    return template_ids

@lru_cache(maxsize=1)
def get_breakthrough_levelup_template_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_BREAK_THROUGH_TSV_PATH, typed=True)
    rows = reader.select(["EquipId", "Times", "LevelUpTemplateId"])
    normalized_map: dict[int, dict[int, int]] = {}

    for row in rows:
        try:
            equip_id = int(row.get("EquipId"))
            levelup_template_id = int(row.get("LevelUpTemplateId"))
        except (TypeError, ValueError):
            continue

        raw_breakthrough_times = row.get("Times")
        breakthrough_times = parse_int(raw_breakthrough_times)
        if raw_breakthrough_times in (None, ""):
            breakthrough_times = 0
        elif breakthrough_times is None:
            continue

        if equip_id not in normalized_map:
            normalized_map[equip_id] = {}

        normalized_map[equip_id][breakthrough_times] = levelup_template_id

    return normalized_map
