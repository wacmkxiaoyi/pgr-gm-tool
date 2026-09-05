from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import BACKGROUND_TSV_PATH, HEAD_PORTRAIT_TSV_PATH, HONOR_LEVEL_TSV_PATH, PLAYER_LEVEL_TSV_PATH, ROLE_PLAYER_ASSET_PREFIX, UI_PHOTOGRAPH_ASSET_PREFIX
from backend.app.services.player.utils import normalize_int_asset_map, normalize_int_text_map
from backend.app.utils.tsv_reader import TSVReader


PORTRAIT_TYPE = "1"
PORTRAIT_FRAME_TYPE = "2"


@lru_cache(maxsize=1)
def _get_player_portrait_url_map_by_type(portrait_type: str) -> dict[int, str]:
    reader = TSVReader(HEAD_PORTRAIT_TSV_PATH, typed=True)
    return normalize_int_asset_map(
        reader.get_maps("Id", "ImgSrc", f"Type = {portrait_type}")[0],
        ROLE_PLAYER_ASSET_PREFIX,
    )


@lru_cache(maxsize=1)
def _get_player_portrait_name_map_by_type(portrait_type: str) -> dict[int, str]:
    reader = TSVReader(HEAD_PORTRAIT_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Name", f"Type = {portrait_type}")[0])


@lru_cache(maxsize=1)
def get_player_portrait_url_map() -> dict[int, str]:
    return _get_player_portrait_url_map_by_type(PORTRAIT_TYPE)


@lru_cache(maxsize=1)
def get_player_portrait_name_map() -> dict[int, str]:
    return _get_player_portrait_name_map_by_type(PORTRAIT_TYPE)


@lru_cache(maxsize=1)
def get_player_portrait_frame_url_map() -> dict[int, str]:
    return _get_player_portrait_url_map_by_type(PORTRAIT_FRAME_TYPE)


@lru_cache(maxsize=1)
def get_player_portrait_frame_name_map() -> dict[int, str]:
    return _get_player_portrait_name_map_by_type(PORTRAIT_FRAME_TYPE)


@lru_cache(maxsize=1)
def get_player_background_url_map() -> dict[int, str]:
    reader = TSVReader(BACKGROUND_TSV_PATH, typed=True)
    return normalize_int_asset_map(reader.get_maps("Id", "IconPath")[0], UI_PHOTOGRAPH_ASSET_PREFIX)


@lru_cache(maxsize=1)
def get_player_background_name_map() -> dict[int, str]:
    reader = TSVReader(BACKGROUND_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Name")[0])


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


@lru_cache(maxsize=1)
def get_player_honor_level_max_exp_map() -> dict[int, int]:
    reader = TSVReader(HONOR_LEVEL_TSV_PATH, typed=True)
    raw_map = reader.get_maps("HonorLevel", "MaxExp")[0]

    honor_level_max_exp_map: dict[int, int] = {}
    for honor_level_raw, max_exp_raw in raw_map.items():
        try:
            honor_level = int(honor_level_raw)
            max_exp = int(max_exp_raw)
        except (TypeError, ValueError):
            continue

        if honor_level < 0 or max_exp < 0:
            continue

        honor_level_max_exp_map[honor_level] = max_exp

    return dict(sorted(honor_level_max_exp_map.items()))


@lru_cache(maxsize=1)
def get_player_honor_level_max() -> int:
    honor_level_max_exp_map = get_player_honor_level_max_exp_map()
    if not honor_level_max_exp_map:
        return 0

    return max(honor_level_max_exp_map)


def get_player_honor_level_max_exp(level: int) -> int | None:
    return get_player_honor_level_max_exp_map().get(level)


def get_player_honor_level_allowed_exp_max(level: int) -> int | None:
    current_max_exp = get_player_honor_level_max_exp(level)
    if current_max_exp is None:
        return None

    if level >= get_player_honor_level_max():
        return current_max_exp

    return max(0, current_max_exp - 1)
