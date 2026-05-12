from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import ITEM_TSV_PATH
from backend.app.services.player.utils import normalize_int_text_map
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_item_name_map() -> dict[int, str]:
    reader = TSVReader(ITEM_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Name")[0])
