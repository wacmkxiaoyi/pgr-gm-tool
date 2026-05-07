from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader

from backend.app.services.player.equips import EQUIP_BREAK_THROUGH_TSV_PATH


LEVELUP_TEMPLATE_DIR = Path("resources/leveluptemplate")


@lru_cache(maxsize=128)
def _load_levelup_template(template_id: int) -> list[dict]:
    file_path = LEVELUP_TEMPLATE_DIR / f"{template_id}.tsv"
    reader = TSVReader(file_path, typed=True)
    return reader.data


def get_levelup_template_data(template_id: int) -> list[dict]:
    return _load_levelup_template(template_id)


def get_levelup_template_max_level(template_id: int) -> int | None:
    data = _load_levelup_template(template_id)
    if not data:
        return None
    return max(int(row.get("Level", 0)) for row in data)


def get_level_all_exp(template_id: int, level: int) -> int | None:
    data = _load_levelup_template(template_id)
    for row in data:
        if int(row.get("Level", 0)) == level:
            all_exp = row.get("AllExp")
            if all_exp == "" or all_exp is None:
                return 0
            return int(all_exp)
    return None


def get_level_per_exp(template_id: int, level: int) -> int | None:
    data = _load_levelup_template(template_id)
    for row in data:
        if int(row.get("Level", 0)) == level:
            return int(row.get("Exp", 0))
    return None


def get_level_from_total_exp(total_exp: int, template_id: int) -> tuple[int, int]:
    data = _load_levelup_template(template_id)
    max_level = get_levelup_template_max_level(template_id)

    sorted_data = sorted(data, key=lambda row: int(row.get("Level", 0)), reverse=True)
    for row in sorted_data:
        level = int(row.get("Level", 0))
        all_exp = row.get("AllExp")
        if all_exp == "" or all_exp is None:
            all_exp = 0
        else:
            all_exp = int(all_exp)

        if all_exp <= total_exp:
            current_level_exp = total_exp - all_exp
            if max_level is not None and level == max_level:
                max_per_exp = int(row.get("Exp", 0))
                if current_level_exp > max_per_exp:
                    current_level_exp = max_per_exp
            return level, current_level_exp

    return 1, 0


@lru_cache(maxsize=1)
def get_breakthrough_levelup_template_map() -> dict[int, dict[int, int]]:
    reader = TSVReader(EQUIP_BREAK_THROUGH_TSV_PATH, typed=True)
    normalized_map: dict[int, dict[int, int]] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        try:
            equip_id = int(row.get("EquipId"))
            breakthrough_times = int(row.get("Times"))
            levelup_template_id = int(row.get("LevelUpTemplateId"))
        except (TypeError, ValueError):
            continue

        if equip_id not in normalized_map:
            normalized_map[equip_id] = {}

        normalized_map[equip_id][breakthrough_times] = levelup_template_id

    return normalized_map
