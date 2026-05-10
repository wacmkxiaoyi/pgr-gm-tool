from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from backend.app.utils.tsv_reader import TSVReader


ITEM_TSV_PATH = Path("assets/Item.tsv")


@lru_cache(maxsize=1)
def get_item_name_map() -> dict[int, str]:
    reader = TSVReader(ITEM_TSV_PATH, typed=True)
    item_name_map = reader.get_maps("Id", "Name")[0]

    name_map: dict[int, str] = {}
    for item_id_raw, item_name_raw in item_name_map.items():
        try:
            item_id = int(item_id_raw)
        except (TypeError, ValueError):
            continue

        item_name = str(item_name_raw).strip()
        if not item_name:
            continue

        name_map[item_id] = item_name

    return name_map
