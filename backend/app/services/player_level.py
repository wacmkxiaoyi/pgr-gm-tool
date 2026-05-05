from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.utils.tsv_reader import TSVReader


PLAYER_LEVEL_TSV_PATH = Path("backend/resources/Player.tsv")


@lru_cache(maxsize=1)
def get_player_level_max_exp_map() -> dict[int, int]:
    reader = TSVReader(PLAYER_LEVEL_TSV_PATH, typed=True)
    raw_map = reader.get_maps("Level", "MaxExp")[0]

    level_max_exp_map: dict[int, int] = {}
    for level_raw, max_exp_raw in raw_map.items():
        try:
            level = int(level_raw)
            max_exp = int(max_exp_raw)
        except (TypeError, ValueError):
            continue

        if level < 0 or max_exp < 0:
            continue

        level_max_exp_map[level] = max_exp

    return dict(sorted(level_max_exp_map.items()))


@lru_cache(maxsize=1)
def get_player_level_max() -> int:
    level_max_exp_map = get_player_level_max_exp_map()
    if not level_max_exp_map:
        return 0

    return max(level_max_exp_map)


def get_player_level_max_exp(level: int) -> int | None:
    return get_player_level_max_exp_map().get(level)


def get_player_level_allowed_exp_max(level: int) -> int | None:
    level_max = get_player_level_max()
    current_max_exp = get_player_level_max_exp(level)
    if current_max_exp is None:
        return None

    if level >= level_max:
        return current_max_exp

    return max(0, current_max_exp - 1)
