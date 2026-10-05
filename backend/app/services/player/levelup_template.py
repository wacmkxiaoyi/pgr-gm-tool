from __future__ import annotations

from backend.app.utils.resource_language import language_cache as lru_cache

from backend.app.services.player.equips.constants import LEVELUP_TEMPLATE_DIR
from backend.app.services.player.utils import parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=128)
def load_levelup_template(template_id: int) -> list[dict]:
    file_path = LEVELUP_TEMPLATE_DIR / f"{template_id}.tsv"
    reader = TSVReader(file_path, typed=True)
    return reader.data

def get_levelup_template_data(template_id: int) -> list[dict]:
    return load_levelup_template(template_id)


def get_level_exp_map(template_id: int) -> dict[int, int]:
    data = load_levelup_template(template_id)
    level_exp_map: dict[int, int] = {}

    for row in data:
        if not isinstance(row, dict):
            continue

        level = parse_int(row.get("Level"))
        exp = parse_int(row.get("Exp"))
        if level is None or exp is None:
            continue

        level_exp_map[level] = exp

    return level_exp_map


def get_levelup_template_max_level(template_id: int) -> int | None:
    data = load_levelup_template(template_id)
    if not data:
        return None
    return max(int(row.get("Level", 0)) for row in data)


def get_level_per_exp(template_id: int, level: int) -> int | None:
    data = load_levelup_template(template_id)
    for row in data:
        if int(row.get("Level", 0)) == level:
            return int(row.get("Exp", 0))
    return None
