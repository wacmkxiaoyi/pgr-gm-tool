from __future__ import annotations

from collections import Counter

from backend.app.utils.resource_language import language_cache as lru_cache

from backend.app.services.player.constants import (
    DORM_TEMPLATE_TSV_PATH,
    FURNITURE_ADDITIONAL_ATTR_TSV_PATH,
    FURNITURE_CREATE_ATTR_TSV_PATH,
    FURNITURE_SUIT_TSV_PATH,
    FURNITURE_TSV_PATH,
    FURNITURE_TYPE_TSV_PATH,
)
from backend.app.services.player.utils import extract_int_list, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_dorm_template_entries_map() -> dict[int, dict[str, str | list[int]]]:
    reader = TSVReader(DORM_TEMPLATE_TSV_PATH, typed=True)
    return {template_id: {"Name": str(row.get("Name") or "").strip(),
                          "FurnitureId": extract_int_list(row, ["FurnitureId"])}
            for raw_id, row in reader.get_sub_table("Id", ["Name", "FurnitureId"]).items()
            if (template_id := parse_int(raw_id)) is not None}


@lru_cache(maxsize=1)
def get_base_furniture_list() -> list[int]:
    """Basic furniture configurations provided by the empty dormitory template."""
    reader = TSVReader(DORM_TEMPLATE_TSV_PATH, typed=True)
    return [furniture_id for row in reader.select(["FurnitureId"], "Id = 20")
            for furniture_id in extract_int_list(row, ["FurnitureId"])]


@lru_cache(maxsize=1)
def get_furniture_template_count_map() -> dict[int, int]:
    """Total occurrences of each furniture configuration across all templates."""
    reader = TSVReader(DORM_TEMPLATE_TSV_PATH, typed=True)
    return dict(Counter(furniture_id for row in reader.select(["FurnitureId"])
                        for furniture_id in extract_int_list(row, ["FurnitureId"])))


@lru_cache(maxsize=1)
def get_furniture_entries_map() -> dict[int, dict[str, int | str]]:
    reader = TSVReader(FURNITURE_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("Id", ["Name", "Desc", "TypeId", "SuitId"])
    entries_map: dict[int, dict[str, int | str]] = {}

    for raw_id, row in raw_table.items():
        furniture_id = parse_int(raw_id)
        type_id = parse_int(row.get("TypeId"))
        suit_id = parse_int(row.get("SuitId"))
        if furniture_id is None or type_id is None or suit_id is None:
            continue

        entries_map[furniture_id] = {
            "Name": str(row.get("Name") or "").strip(),
            "Desc": str(row.get("Desc") or "").strip(),
            "TypeId": type_id,
            "SuitId": suit_id,
        }

    return entries_map


@lru_cache(maxsize=1)
def get_furniture_type_entires_map() -> dict[int, dict[str, int | str]]:
    reader = TSVReader(FURNITURE_TYPE_TSV_PATH, typed=True)
    entries_map: dict[int, dict[str, int | str]] = {}
    for raw_id, row in reader.get_sub_table("Id", ["CategoryName", "MajorType"]).items():
        type_id = parse_int(raw_id)
        major_type = parse_int(row.get("MajorType"))
        if type_id is not None and major_type is not None:
            entries_map[type_id] = {
                "CategoryName": str(row.get("CategoryName") or "").strip(),
                "MajorType": major_type,
            }
    return entries_map


@lru_cache(maxsize=1)
def get_furniture_suit_name_map() -> dict[int, str]:
    reader = TSVReader(FURNITURE_SUIT_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "SuitName")[0])


@lru_cache(maxsize=1)
def get_furniture_create_max_attr_map() -> dict[int, int]:
    """Maximum AttrTotal value per furniture type when MinConsume is 10."""
    reader = TSVReader(FURNITURE_CREATE_ATTR_TSV_PATH, typed=True)
    max_attr_map: dict[int, int] = {}

    for row in reader.select(["FurnitureType", "AttrTotal"], "MinConsume = 10"):
        furniture_type = parse_int(row.get("FurnitureType"))
        attr_totals = extract_int_list(row, ["AttrTotal"])
        if furniture_type is None or not attr_totals:
            continue

        max_attr = max(attr_totals)
        max_attr_map[furniture_type] = max(max_attr_map.get(furniture_type, max_attr), max_attr)

    return max_attr_map


@lru_cache(maxsize=1)
def get_furniture_additional_attr_entries_map() -> dict[int, dict[str, int | str]]:
    reader = TSVReader(FURNITURE_ADDITIONAL_ATTR_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table("AttributeId", ["AddScore", "Introduce"])
    entries_map: dict[int, dict[str, int | str]] = {}

    for raw_id, row in raw_table.items():
        attribute_id = parse_int(raw_id)
        add_score = parse_int(row.get("AddScore"))
        if attribute_id is None or add_score is None:
            continue

        entries_map[attribute_id] = {
            "AddScore": add_score,
            "Introduce": str(row.get("Introduce") or "").strip(),
        }

    return entries_map
