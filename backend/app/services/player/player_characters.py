from __future__ import annotations

from functools import lru_cache
from typing import Any

from backend.app.services.player.constants import ATTRIB_POOL_TSV_PATH, CHARACTER_GRADE_TSV_PATH, CHARACTER_QUALITY_TSV_PATH, CHARACTER_SKILL_GROUP_TSV_PATH, CHARACTER_SKILL_LEVEL_EFFECT_TSV_PATH, CHARACTER_SKILL_POOL_TSV_PATH, CHARACTER_SKILL_TSV_PATH, CHARACTER_SKILL_UPGRADE_DES_TSV_PATH, CHARACTER_TRUST_EXP_TSV_PATH, CHARACTER_TSV_PATH, ENHANCE_SKILL_GROUP_TSV_PATH, ENHANCE_SKILL_LEVEL_EFFECT_TSV_PATH, ENHANCE_SKILL_TSV_PATH, ENHANCE_SKILL_UPGRADE_DES_TSV_PATH, EXHIBITION_REWARD_TSV_PATH, FASHION_TSV_PATH, ICON_TOOLS_ASSET_PREFIX, ROLE_CHARACTER_ASSET_PREFIX
from backend.app.services.player.utils import extract_int_list, normalize_asset_path, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


def _build_skill_entry(template_id: Any, name: Any, description: Any) -> dict[str, Any] | None:
    normalized_template_id = parse_int(template_id)
    if normalized_template_id is None:
        return None

    normalized_name = str(name or "").strip()
    normalized_description = str(description or "").strip()
    return {
        "TemplateId": normalized_template_id,
        "Name": normalized_name,
        "Description": normalized_description,
    }


def _build_character_skill_ids_map(character_skill_tsv_path: Any, skill_group_tsv_path: Any) -> dict[int, list[int]]:
    character_skill_reader = TSVReader(character_skill_tsv_path, typed=True)
    skill_group_columns = [f"SkillGroupId[{idx}]" for idx in range(1, 17)]
    character_skill_group_table = character_skill_reader.get_sub_table("CharacterId", skill_group_columns)
    character_skill_group_ids_map: dict[int, list[int]] = {}

    for character_id_raw, row in character_skill_group_table.items():
        character_id = parse_int(character_id_raw)
        if character_id is None:
            continue

        character_skill_group_ids_map[character_id] = extract_int_list(row, skill_group_columns, dedupe=True)

    skill_group_reader = TSVReader(skill_group_tsv_path, typed=True)
    skill_columns = [f"SkillId[{idx}]" for idx in range(3)]
    skill_group_table = skill_group_reader.get_sub_table("Id", skill_columns)
    skill_group_skill_ids_map: dict[int, list[int]] = {}

    for group_id_raw, row in skill_group_table.items():
        group_id = parse_int(group_id_raw)
        if group_id is None:
            continue

        skill_group_skill_ids_map[group_id] = extract_int_list(row, skill_columns, dedupe=True)

    normalized_map: dict[int, list[int]] = {}
    for character_id, group_ids in character_skill_group_ids_map.items():
        skill_ids: list[int] = []
        seen_skill_ids: set[int] = set()
        for group_id in group_ids:
            for skill_id in skill_group_skill_ids_map.get(group_id, []):
                if skill_id in seen_skill_ids:
                    continue
                seen_skill_ids.add(skill_id)
                skill_ids.append(skill_id)

        normalized_map[character_id] = skill_ids

    return normalized_map


def _build_skill_entries_map(level_effect_tsv_path: Any, upgrade_des_tsv_path: Any) -> dict[int, dict[str, int | str]]:
    level_effect_reader = TSVReader(level_effect_tsv_path, typed=True)
    upgrade_des_reader = TSVReader(upgrade_des_tsv_path, typed=True)
    max_level_map: dict[int, int] = {}
    name_map: dict[int, str] = {}

    for row in level_effect_reader.data:
        if not isinstance(row, dict):
            continue

        skill_id = parse_int(row.get("SkillId"))
        level = parse_int(row.get("Level"))
        if skill_id is None or level is None:
            continue

        max_level_map[skill_id] = max(max_level_map.get(skill_id, 0), level)

    for row in upgrade_des_reader.data:
        if not isinstance(row, dict):
            continue

        skill_id = parse_int(row.get("SkillId"))
        if skill_id is None or skill_id in name_map:
            continue

        name = str(row.get("Name", "")).strip()
        if not name:
            continue

        name_map[skill_id] = name

    return {
        skill_id: {
            "MaxLevel": max_level_map.get(skill_id, 0),
            "Name": name_map.get(skill_id, ""),
        }
        for skill_id in sorted(set(max_level_map) | set(name_map))
    }


@lru_cache(maxsize=1)
def get_character_levelup_template_map() -> dict[int, int]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Id", "LevelUpTemplateId")[0]
    normalized_map: dict[int, int] = {}

    for character_id_raw, levelup_template_id_raw in raw_map.items():
        character_id = parse_int(character_id_raw)
        levelup_template_id = parse_int(levelup_template_id_raw)

        if character_id is None or levelup_template_id is None:
            continue

        normalized_map[character_id] = levelup_template_id

    return normalized_map

@lru_cache(maxsize=1)
def get_attrib_pool_entries_map() -> dict[int, list[dict[str, Any]]]:
    reader = TSVReader(ATTRIB_POOL_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = parse_int(row.get("PoolId"))
        if pool_id is None:
            continue

        entry = _build_skill_entry(row.get("Id"), row.get("Name"), row.get("Description"))
        if entry is None:
            continue

        normalized_map.setdefault(pool_id, []).append(entry)

    return normalized_map

@lru_cache(maxsize=1)
def get_character_skill_group_ids_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_SKILL_TSV_PATH, typed=True)
    skill_group_columns = [f"SkillGroupId[{idx}]" for idx in range(1, 17)]
    skill_group_table = reader.get_sub_table("CharacterId", skill_group_columns)
    normalized_map: dict[int, list[int]] = {}

    for character_id_raw, row in skill_group_table.items():
        character_id = parse_int(character_id_raw)
        if character_id is None:
            continue

        normalized_map[character_id] = extract_int_list(row, skill_group_columns, dedupe=True)

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_group_skill_ids_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_SKILL_GROUP_TSV_PATH, typed=True)
    skill_columns = [f"SkillId[{idx}]" for idx in range(3)]
    skill_group_table = reader.get_sub_table("Id", skill_columns)
    normalized_map: dict[int, list[int]] = {}

    for group_id_raw, row in skill_group_table.items():
        group_id = parse_int(group_id_raw)
        if group_id is None:
            continue

        normalized_map[group_id] = extract_int_list(row, skill_columns, dedupe=True)

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_ids_map() -> dict[int, list[int]]:
    return _build_character_skill_ids_map(CHARACTER_SKILL_TSV_PATH, CHARACTER_SKILL_GROUP_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_skill_entries_map() -> dict[int, dict[str, int | str]]:
    return _build_skill_entries_map(CHARACTER_SKILL_LEVEL_EFFECT_TSV_PATH, CHARACTER_SKILL_UPGRADE_DES_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_skill_pool_entries_map() -> dict[int, dict[int, list[dict[str, Any]]]]:
    reader = TSVReader(CHARACTER_SKILL_POOL_TSV_PATH, typed=True)
    character_skill_ids_map = get_character_skill_ids_map()
    pool_skill_entry_map: dict[int, dict[int, dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = parse_int(row.get("PoolId"))
        if pool_id is None:
            continue

        entry = _build_skill_entry(row.get("SkillId"), row.get("Name"), row.get("Description"))
        if entry is None:
            continue

        pool_skill_entry_map.setdefault(pool_id, {})[entry["TemplateId"]] = entry

    normalized_map: dict[int, dict[int, list[dict[str, Any]]]] = {}
    for pool_id, skill_entry_map in pool_skill_entry_map.items():
        character_entries_map: dict[int, list[dict[str, Any]]] = {}
        for character_id, skill_ids in character_skill_ids_map.items():
            entries = [skill_entry_map[skill_id] for skill_id in skill_ids if skill_id in skill_entry_map]
            if entries:
                character_entries_map[character_id] = entries

        normalized_map[pool_id] = character_entries_map

    return normalized_map

@lru_cache(maxsize=1)
def get_character_enhance_skill_ids_map() -> dict[int, list[int]]:
    return _build_character_skill_ids_map(ENHANCE_SKILL_TSV_PATH, ENHANCE_SKILL_GROUP_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_enhance_skill_entries_map() -> dict[int, dict[str, int | str]]:
    return _build_skill_entries_map(ENHANCE_SKILL_LEVEL_EFFECT_TSV_PATH, ENHANCE_SKILL_UPGRADE_DES_TSV_PATH)

@lru_cache(maxsize=1)
def get_character_grade_name_map() -> dict[int, list[str]]:
    reader = TSVReader(CHARACTER_GRADE_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Grade", "GradeName"])
    grade_pairs: dict[int, list[tuple[int, str]]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        grade = parse_int(row.get("Grade"))
        grade_name = str(row.get("GradeName", "")).strip()

        if character_id is None or grade is None or not grade_name:
            continue

        grade_pairs.setdefault(character_id, []).append((grade, grade_name))

    return {
        character_id: [name for _, name in sorted(pairs, key=lambda pair: pair[0])]
        for character_id, pairs in grade_pairs.items()
    }


@lru_cache(maxsize=1)
def get_character_quality_bound_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_QUALITY_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Quality"])
    quality_values: dict[int, list[int]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        quality = parse_int(row.get("Quality"))

        if character_id is None or quality is None:
            continue

        quality_values.setdefault(character_id, []).append(quality)

    return {
        character_id: [min(values), max(values)]
        for character_id, values in quality_values.items()
    }


@lru_cache(maxsize=1)
def get_character_trust_exp_map() -> dict[int, int]:
    reader = TSVReader(CHARACTER_TRUST_EXP_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Level", "Exp")[0]
    normalized_map: dict[int, int] = {}

    for level_raw, exp_raw in raw_map.items():
        level = parse_int(level_raw)
        exp = parse_int(exp_raw)

        if level is None or exp is None:
            continue

        normalized_map[level] = exp

    return normalized_map


@lru_cache(maxsize=1)
def get_character_exhibitions_map() -> dict[int, list[int]]:
    reader = TSVReader(EXHIBITION_REWARD_TSV_PATH, typed=True)
    rows = reader.select(["CharacterId", "Id"])
    exhibition_ids: dict[int, list[int]] = {}

    for row in rows:
        character_id = parse_int(row.get("CharacterId"))
        exhibition_id = parse_int(row.get("Id"))

        if character_id is None or exhibition_id is None:
            continue

        exhibition_ids.setdefault(character_id, []).append(exhibition_id)

    return {
        character_id: sorted(ids)
        for character_id, ids in exhibition_ids.items()
    }


@lru_cache(maxsize=1)
def get_character_log_name_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "LogName")[0])


@lru_cache(maxsize=1)
def get_character_head_icon_url_map() -> dict[int, str]:
    reader = TSVReader(FASHION_TSV_PATH, typed=True)
    normalized_map: dict[int, str] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = parse_int(row.get("CharacterId"))
        if character_id is None:
            continue

        if character_id in normalized_map:
            continue

        asset_path = normalize_asset_path(str(row.get("BigHeadIcon", "")), ROLE_CHARACTER_ASSET_PREFIX)
        if asset_path is None:
            continue

        normalized_map[character_id] = asset_path

    return normalized_map


@lru_cache(maxsize=1)
def get_character_Intro_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Intro")[0])


@lru_cache(maxsize=1)
def get_character_fashions_map() -> dict[int, list[dict[str, int | str]]]:
    reader = TSVReader(FASHION_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, int | str]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = parse_int(row.get("CharacterId"))
        fashion_id = parse_int(row.get("Id"))
        quality = parse_int(row.get("Quality"))

        if character_id is None or fashion_id is None or quality is None:
            continue

        big_icon = normalize_asset_path(str(row.get("BigIcon", "")), ICON_TOOLS_ASSET_PREFIX)
        big_head_icon_fashion = normalize_asset_path(str(row.get("BigHeadIconFashion", "")), ROLE_CHARACTER_ASSET_PREFIX)

        if big_icon is None or big_head_icon_fashion is None:
            continue

        normalized_map.setdefault(character_id, []).append(
            {
                "Id": fashion_id,
                "Quality": quality,
                "BigIcon": big_icon,
                "BigHeadIconFashion": big_head_icon_fashion,
            }
        )

    return normalized_map
