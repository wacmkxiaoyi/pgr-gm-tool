from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.utils.tsv_reader import TSVReader


HEAD_PORTRAIT_TSV_PATH = Path("backend/resources/HeadPortrait.tsv")
PORTRAIT_TYPE = "1"
PORTRAIT_FRAME_TYPE = "2"
ROLE_PLAYER_ASSET_PREFIX = "/assets/roleplayersp/"


def _normalize_portrait_asset_path(raw_path: str) -> str | None:
    filename = Path(str(raw_path).strip()).name.strip().lower()
    if not filename:
        return None
    return f"{ROLE_PLAYER_ASSET_PREFIX}{filename}"


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

        asset_path = _normalize_portrait_asset_path(str(asset_path_raw))
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

