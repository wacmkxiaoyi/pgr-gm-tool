from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import STAGE_TSV_PATH
from backend.app.services.player.utils import parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_stage_entries_map() -> dict[int, dict[str, str]]:
    reader = TSVReader(STAGE_TSV_PATH, typed=True)
    raw_map = reader.get_sub_table("StageId", ["Name", "Description"])
    normalized_map: dict[int, dict[str, str]] = {}

    for stage_id_raw, entry in raw_map.items():
        stage_id = parse_int(stage_id_raw)
        if stage_id is None:
            continue

        name = str(entry.get("Name", "")).strip()
        if not name:
            continue

        normalized_map[stage_id] = {
            "Name": name,
            "Description": str(entry.get("Description", "")).strip(),
        }

    return normalized_map
