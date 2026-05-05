from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.utils.tsv_reader import TSVReader


HEAD_PORTRAIT_TSV_PATH = Path("backend/resources/HeadPortrait.tsv")
BACKGROUND_TSV_PATH = Path("backend/resources/Background.tsv")
CHARACTER_TSV_PATH = Path("backend/resources/Character.tsv")
FASHION_TSV_PATH = Path("backend/resources/Fashion.tsv")
PLAYER_LEVEL_TSV_PATH = Path("backend/resources/Player.tsv")
PORTRAIT_TYPE = "1"
PORTRAIT_FRAME_TYPE = "2"
ROLE_PLAYER_ASSET_PREFIX = "/assets/roleplayersp/"
ROLE_CHARACTER_ASSET_PREFIX = "/assets/rolecharacter/"
UI_PHOTOGRAPH_ASSET_PREFIX = "/assets/uiphotograph/"


def _normalize_asset_path(raw_path: str, prefix: str) -> str | None:
    filename = Path(str(raw_path).strip()).name.strip().lower()
    if not filename:
        return None
    return f"{prefix}{filename}"


@lru_cache(maxsize=1)
def _get_player_portrait_url_map_by_type(portrait_type: str) -> dict[int, str]:
    reader = TSVReader(HEAD_PORTRAIT_TSV_PATH, typed=True)
    portrait_asset_map = reader.get_maps("Id", "ImgSrc", f"Type = {portrait_type}")[0]

    portrait_map: dict[int, str] = {}
    for portrait_id_raw, asset_path_raw in portrait_asset_map.items():
        try:
            portrait_id = int(portrait_id_raw)
        except (TypeError, ValueError):
            continue

        asset_path = _normalize_asset_path(str(asset_path_raw), ROLE_PLAYER_ASSET_PREFIX)
        if asset_path is None:
            continue

        portrait_map[portrait_id] = asset_path

    return portrait_map


@lru_cache(maxsize=1)
def _get_player_portrait_name_map_by_type(portrait_type: str) -> dict[int, str]:
    reader = TSVReader(HEAD_PORTRAIT_TSV_PATH, typed=True)
    portrait_name_map = reader.get_maps("Id", "Name", f"Type = {portrait_type}")[0]

    name_map: dict[int, str] = {}
    for portrait_id_raw, portrait_name_raw in portrait_name_map.items():
        try:
            portrait_id = int(portrait_id_raw)
        except (TypeError, ValueError):
            continue

        portrait_name = str(portrait_name_raw).strip()
        if not portrait_name:
            continue

        name_map[portrait_id] = portrait_name

    return name_map


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
    background_asset_map = reader.get_maps("Id", "IconPath")[0]

    background_map: dict[int, str] = {}
    for background_id_raw, asset_path_raw in background_asset_map.items():
        try:
            background_id = int(background_id_raw)
        except (TypeError, ValueError):
            continue

        asset_path = _normalize_asset_path(str(asset_path_raw), UI_PHOTOGRAPH_ASSET_PREFIX)
        if asset_path is None:
            continue

        background_map[background_id] = asset_path

    return background_map


@lru_cache(maxsize=1)
def get_player_background_name_map() -> dict[int, str]:
    reader = TSVReader(BACKGROUND_TSV_PATH, typed=True)
    background_name_map = reader.get_maps("Id", "Name")[0]

    name_map: dict[int, str] = {}
    for background_id_raw, background_name_raw in background_name_map.items():
        try:
            background_id = int(background_id_raw)
        except (TypeError, ValueError):
            continue

        background_name = str(background_name_raw).strip()
        if not background_name:
            continue

        name_map[background_id] = background_name

    return name_map


@lru_cache(maxsize=1)
def get_character_log_name_map() -> dict[int, str]:
    reader = TSVReader(CHARACTER_TSV_PATH, typed=True)
    character_name_map = reader.get_maps("Id", "LogName")[0]

    normalized_map: dict[int, str] = {}
    for character_id_raw, character_name_raw in character_name_map.items():
        try:
            character_id = int(character_id_raw)
        except (TypeError, ValueError):
            continue

        character_name = str(character_name_raw).strip()
        if not character_name:
            continue

        normalized_map[character_id] = character_name

    return normalized_map


@lru_cache(maxsize=1)
def get_character_head_icon_url_map() -> dict[int, str]:
    reader = TSVReader(FASHION_TSV_PATH, typed=True)
    normalized_map: dict[int, str] = {}

    for row in reader.data:
        if not isinstance(row, dict):
            continue

        try:
            character_id = int(row.get("CharacterId"))
        except (TypeError, ValueError):
            continue

        if character_id in normalized_map:
            continue

        asset_path = _normalize_asset_path(str(row.get("BigHeadIcon", "")), ROLE_CHARACTER_ASSET_PREFIX)
        if asset_path is None:
            continue

        normalized_map[character_id] = asset_path

    return normalized_map


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
