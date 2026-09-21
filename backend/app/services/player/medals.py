from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import MEDAL_TSV_PATH
from backend.app.services.player.utils import normalize_asset_path, parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_medal_entires_map() -> dict[int, dict[str, str | None]]:
    reader = TSVReader(MEDAL_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("Id", ["Name", "Desc", "MedalImg"])
    entries_map: dict[int, dict[str, str | None]] = {}

    for raw_id, row in raw_table.items():
        medal_id = parse_int(raw_id)
        if medal_id is None or medal_id <= 0:
            continue
        entries_map[medal_id] = {
            "Name": str(row.get("Name") or ""),
            "Desc": str(row.get("Desc") or ""),
            "MedalImg": normalize_asset_path(row.get("MedalImg")),
        }

    return entries_map


@lru_cache(maxsize=1)
def get_medal_keep_time_map() -> dict[int, int]:
    reader = TSVReader(MEDAL_TSV_PATH, typed=True)
    raw_keep_times = reader.get_maps("Id", "KeepTime")[0]
    return {
        medal_id: max(0, parse_int(keep_time) or 0)
        for raw_id, keep_time in raw_keep_times.items()
        if (medal_id := parse_int(raw_id)) is not None and medal_id > 0
    }


def is_unlocked_medal_active(unlocked_medal: object, now_unix_seconds: int) -> bool:
    if not isinstance(unlocked_medal, dict):
        return False
    keep_time = parse_int(unlocked_medal.get("keep_time"))
    if keep_time is None or keep_time < 0:
        return False
    if keep_time == 0:
        return True
    unlock_time = parse_int(unlocked_medal.get("time"))
    return unlock_time is not None and unlock_time + keep_time > now_unix_seconds
