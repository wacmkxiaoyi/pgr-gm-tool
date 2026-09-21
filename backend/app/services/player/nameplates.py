from __future__ import annotations

from functools import lru_cache

from backend.app.services.player.constants import NAMEPLATE_CONTENT_MAP_TSV_PATH, NAMEPLATE_TSV_PATH
from backend.app.services.player.utils import normalize_asset_path, normalize_int_text_map, parse_int
from backend.app.utils.tsv_reader import TSVReader


@lru_cache(maxsize=1)
def get_nameplate_content_map() -> dict[int, str]:
    reader = TSVReader(NAMEPLATE_CONTENT_MAP_TSV_PATH, typed=True)
    return normalize_int_text_map(reader.get_maps("Id", "Text")[0])


def _resolve_nameplate_text(value: object, content_map: dict[int, str]) -> str:
    text_id = parse_int(value)
    if text_id is None:
        return ""
    if text_id < 10_000:
        return content_map.get(text_id, "")
    if text_id > 10_000:
        return content_map.get(text_id % 10_000, "").replace("{0}", str(text_id // 10_000))
    return ""


@lru_cache(maxsize=1)
def get_nameplate_entires_map() -> dict[int, dict[str, int | str | None]]:
    reader = TSVReader(NAMEPLATE_TSV_PATH, typed=True)
    raw_table = reader.get_sub_table(
        "Id",
        ["NameplateQuality", "Name", "Title", "Description", "IconType", "Icon", "BackBoard", "OutLineColor"],
    )
    content_map = get_nameplate_content_map()
    entries_map: dict[int, dict[str, int | str | None]] = {}

    for raw_id, row in raw_table.items():
        nameplate_id = parse_int(raw_id)
        nameplate_quality = parse_int(row.get("NameplateQuality"))
        icon_type = parse_int(row.get("IconType"))
        if nameplate_id is None or nameplate_quality is None or icon_type is None:
            continue

        entries_map[nameplate_id] = {
            "Id": nameplate_id,
            "NameplateQuality": nameplate_quality,
            "Name": _resolve_nameplate_text(row.get("Name"), content_map),
            "Title": _resolve_nameplate_text(row.get("Title"), content_map),
            "Description": _resolve_nameplate_text(row.get("Description"), content_map),
            "IconType": icon_type,
            "Icon": normalize_asset_path(row.get("Icon")),
            "BackBoard": normalize_asset_path(row.get("BackBoard")),
            "OutLineColor": normalize_asset_path(row.get("OutLineColor")),
        }

    return entries_map
