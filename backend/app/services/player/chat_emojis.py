from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import EMOJI_TSV_PATH
from backend.app.services.player.utils import normalize_asset_path, parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_emoji_entires_map() -> dict[int, dict[str, str | None]]:
    reader = TSVReader(EMOJI_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("Id", ["ConnotationDesc", "BigIcon", "WorldDesc"])
    entries_map: dict[int, dict[str, str | None]] = {}

    for raw_id, row in raw_table.items():
        emoji_id = parse_int(raw_id)
        if emoji_id is None or emoji_id <= 0:
            continue
        entries_map[emoji_id] = {
            "Name": str(row.get("ConnotationDesc") or ""),
            "BigIcon": normalize_asset_path(row.get("BigIcon")),
            "WorldDesc": str(row.get("WorldDesc") or ""),
        }

    return entries_map
