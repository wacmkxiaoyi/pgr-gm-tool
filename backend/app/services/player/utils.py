from __future__ import annotations

from typing import Any

from bson.int64 import Int64


def parse_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


ASSET_TEXTURE_PATH_PREFIX = "assets/product/texture/"


def normalize_asset_path(raw_path: object) -> str | None:
    normalized_path = str(raw_path or "").strip().replace("\\", "/")
    texture_path_start = normalized_path.lower().find(ASSET_TEXTURE_PATH_PREFIX)
    if texture_path_start < 0:
        return None

    relative_path = normalized_path[texture_path_start + len(ASSET_TEXTURE_PATH_PREFIX):].strip("/")
    if not relative_path or "/" not in relative_path:
        return None

    directory, _, filename = relative_path.rpartition("/")
    stem, _, _ = filename.rpartition(".")
    if not directory or not stem:
        return None

    return f"/assets/{directory.lower()}/{stem.lower()}.webp"


def normalize_int_text_map(raw_map: dict[object, object]) -> dict[int, str]:
    normalized_map: dict[int, str] = {}
    for raw_key, raw_value in raw_map.items():
        normalized_key = parse_int(raw_key)
        if normalized_key is None:
            continue

        normalized_value = str(raw_value).strip()
        if not normalized_value:
            continue

        normalized_map[normalized_key] = normalized_value

    return normalized_map


def normalize_int_asset_map(raw_map: dict[object, object]) -> dict[int, str]:
    normalized_map: dict[int, str] = {}
    for raw_key, raw_value in raw_map.items():
        normalized_key = parse_int(raw_key)
        if normalized_key is None:
            continue

        asset_path = normalize_asset_path(raw_value)
        if asset_path is None:
            continue

        normalized_map[normalized_key] = asset_path

    return normalized_map


def extract_int_list(sub_row: dict[str, object], columns: list[str], dedupe: bool = False) -> list[int]:
    values: list[int] = []
    seen_values: set[int] = set()

    def append_value(raw_value: object) -> None:
        normalized_value = parse_int(raw_value)
        if normalized_value is None:
            return
        if dedupe and normalized_value in seen_values:
            return
        seen_values.add(normalized_value)
        values.append(normalized_value)

    for column in columns:
        raw_value = sub_row.get(column)
        if isinstance(raw_value, list):
            for item in raw_value:
                append_value(item)

    return values


def parse_optional_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def parse_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def normalize_search_keyword(keyword: str | None) -> str:
    return str(keyword or "").strip().lower()


def normalize_sort_text(value: Any) -> str:
    return str(value or "").strip().lower()


def descending_text_key(value: str) -> tuple[int, ...]:
    return tuple(-ord(character) for character in value)


def ordered_text_key(value: Any, sort_order: str) -> str | tuple[int, ...]:
    normalized = normalize_sort_text(value)
    if sort_order == "desc":
        return descending_text_key(normalized)
    return normalized


def ordered_number_key(value: int, sort_order: str) -> int:
    return -value if sort_order == "desc" else value


def matching_uid_query(uid: int) -> dict[str, Any]:
    return {"uid": Int64(uid)}
