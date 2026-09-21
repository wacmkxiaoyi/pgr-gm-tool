from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import SCORE_TITLE_TSV_PATH
from backend.app.services.player.utils import normalize_asset_path, parse_int
from backend.app.utils.tsv_reader import TSVReader


def _get_max_quality(row: dict[str, object]) -> int | None:
    qualities = row.get("Qualities")
    if isinstance(qualities, list):
        parsed_qualities = [quality for value in qualities if (quality := parse_int(value)) is not None]
        if parsed_qualities:
            return max(parsed_qualities)
    return parse_int(row.get("InitQuality"))


@lru_cache(maxsize=1)
def get_score_title_entires_map() -> dict[int, dict[str, int | str | None]]:
    reader = TSVReader(SCORE_TITLE_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("Id", ["Name", "InitQuality", "Qualities", "WorldDesc", "MedalImg"])
    entries_map: dict[int, dict[str, int | str | None]] = {}

    for raw_id, row in raw_table.items():
        score_title_id = parse_int(raw_id)
        max_quality = _get_max_quality(row)
        if score_title_id is None or score_title_id <= 0 or max_quality is None:
            continue
        entries_map[score_title_id] = {
            "Name": str(row.get("Name") or ""),
            "MaxQuality": max_quality,
            "WorldDesc": str(row.get("WorldDesc") or ""),
            "MedalImg": normalize_asset_path(row.get("MedalImg")),
        }

    return entries_map
