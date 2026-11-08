from __future__ import annotations

from backend.app.utils.resource_language import language_cache as lru_cache

from backend.app.services.player.constants import ITEM_TSV_PATH
from backend.app.services.player.utils import extract_int_list, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


# AscNet.Common.ItemType.WeaponFashion
WEAPON_FASHION_ITEM_TYPE = 1 << 5


@lru_cache(maxsize=1)
def get_item_name_map() -> dict[int, str]:
    reader = TSVReader(ITEM_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Name")[0])


@lru_cache(maxsize=1)
def get_item_weapon_fashion_map() -> dict[int, int]:
    """WeaponFashion tickets map to the first SubTypeParams entry, not the item ID."""
    result = {}
    for row in TSVReader(ITEM_TSV_PATH, typed=True).data:
        params = extract_int_list(row, ["SubTypeParams"])
        if parse_int(row.get("ItemType")) == WEAPON_FASHION_ITEM_TYPE and params and params[0] > 0:
            result[int(row["Id"])] = params[0]
    return result
