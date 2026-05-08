from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.app.utils.tsv_reader import TSVReader


ATTRIB_POOL_TSV_PATH = Path("resources/AttribPool.tsv")
CHARACTER_SKILL_POOL_TSV_PATH = Path("resources/CharacterSkillPool.tsv")


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


def get_character_skill_pool_entries_map() -> dict[int, list[dict[str, Any]]]:
    reader = TSVReader(CHARACTER_SKILL_POOL_TSV_PATH, typed=True)
    normalized_map: dict[int, list[dict[str, Any]]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        pool_id = _parse_int(row.get("PoolId"))
        if pool_id is None:
            continue

        entry = _build_skill_entry(row.get("SkillId"), row.get("Name"), row.get("Description"))
        if entry is None:
            continue

        normalized_map.setdefault(pool_id, []).append(entry)

    return normalized_map
