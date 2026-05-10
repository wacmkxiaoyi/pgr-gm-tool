from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from backend.app.utils.tsv_reader import TSVReader


ATTRIB_POOL_TSV_PATH = Path("assets/AttribPool.tsv")
CHARACTER_SKILL_TSV_PATH = Path("assets/CharacterSkill.tsv")
CHARACTER_SKILL_GROUP_TSV_PATH = Path("assets/CharacterSkillGroup.tsv")
CHARACTER_SKILL_POOL_TSV_PATH = Path("assets/CharacterSkillPool.tsv")
CHARACTER_GRADE_TSV_PATH = Path("assets/CharacterGrade.tsv")
CHARACTER_QUALITY_TSV_PATH = Path("assets/CharacterQuality.tsv")
EXHIBITION_REWARD_TSV_PATH = Path("assets/ExhibitionReward.tsv")


def _parse_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_skill_entry(template_id: Any, name: Any, description: Any) -> dict[str, Any] | None:
    normalized_template_id = _parse_int(template_id)
    if normalized_template_id is None:
        return None

    normalized_name = str(name or "").strip()
    normalized_description = str(description or "").strip()
    return {
        "TemplateId": normalized_template_id,
        "Name": normalized_name,
        "Description": normalized_description,
    }


@lru_cache(maxsize=1)
def get_attrib_pool_entries_map() -> dict[int, list[dict[str, Any]]]:
    reader = TSVReader(ATTRIB_POOL_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = _parse_int(row.get("PoolId"))
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
    normalized_map: dict[int, list[int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = _parse_int(row.get("CharacterId"))
        if character_id is None:
            continue

        skill_group_ids: list[int] = []
        seen_group_ids: set[int] = set()
        for idx in range(1, 17):
            skill_group_id = _parse_int(row.get(f"SkillGroupId[{idx}]"))
            if skill_group_id is None or skill_group_id in seen_group_ids:
                continue
            seen_group_ids.add(skill_group_id)
            skill_group_ids.append(skill_group_id)

        normalized_map[character_id] = skill_group_ids

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_group_skill_ids_map() -> dict[int, list[int]]:
    reader = TSVReader(CHARACTER_SKILL_GROUP_TSV_PATH, typed=True)
    normalized_map: dict[int, list[int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        group_id = _parse_int(row.get("Id"))
        if group_id is None:
            continue

        skill_ids: list[int] = []
        seen_skill_ids: set[int] = set()
        for idx in range(3):
            skill_id = _parse_int(row.get(f"SkillId[{idx}]"))
            if skill_id is None or skill_id in seen_skill_ids:
                continue
            seen_skill_ids.add(skill_id)
            skill_ids.append(skill_id)

        normalized_map[group_id] = skill_ids

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_ids_map() -> dict[int, list[int]]:
    character_skill_group_ids_map = get_character_skill_group_ids_map()
    character_skill_group_skill_ids_map = get_character_skill_group_skill_ids_map()
    normalized_map: dict[int, list[int]] = {}

    for character_id, group_ids in character_skill_group_ids_map.items():
        skill_ids: list[int] = []
        seen_skill_ids: set[int] = set()
        for group_id in group_ids:
            for skill_id in character_skill_group_skill_ids_map.get(group_id, []):
                if skill_id in seen_skill_ids:
                    continue
                seen_skill_ids.add(skill_id)
                skill_ids.append(skill_id)

        normalized_map[character_id] = skill_ids

    return normalized_map


@lru_cache(maxsize=1)
def get_character_skill_pool_entries_map() -> dict[int, dict[int, list[dict[str, Any]]]]:
    reader = TSVReader(CHARACTER_SKILL_POOL_TSV_PATH, typed=True)
    character_skill_ids_map = get_character_skill_ids_map()
    pool_skill_entry_map: dict[int, dict[int, dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = _parse_int(row.get("PoolId"))
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
def get_character_grade_name_map() -> dict[int, list[str]]:
    reader = TSVReader(CHARACTER_GRADE_TSV_PATH, typed=True)
    grade_pairs: dict[int, list[tuple[int, str]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = _parse_int(row.get("CharacterId"))
        grade = _parse_int(row.get("Grade"))
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
    quality_values: dict[int, list[int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = _parse_int(row.get("CharacterId"))
        quality = _parse_int(row.get("Quality"))

        if character_id is None or quality is None:
            continue

        quality_values.setdefault(character_id, []).append(quality)

    return {
        character_id: [min(values), max(values)]
        for character_id, values in quality_values.items()
    }


@lru_cache(maxsize=1)
def get_character_exhibitions_map() -> dict[int, list[int]]:
    reader = TSVReader(EXHIBITION_REWARD_TSV_PATH, typed=True)
    exhibition_ids: dict[int, list[int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        character_id = _parse_int(row.get("CharacterId"))
        exhibition_id = _parse_int(row.get("Id"))

        if character_id is None or exhibition_id is None:
            continue

        exhibition_ids.setdefault(character_id, []).append(exhibition_id)

    return {
        character_id: sorted(ids)
        for character_id, ids in exhibition_ids.items()
    }
