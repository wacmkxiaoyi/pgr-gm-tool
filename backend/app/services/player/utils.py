from __future__ import annotations

from pathlib import Path
from typing import Any

from bson.int64 import Int64


def parse_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def normalize_asset_path(raw_path: object, prefix: str) -> str | None:
    filename = Path(str(raw_path).strip()).name.strip().lower()
    if not filename:
        return None
    return f"{prefix}{Path(filename).stem}.webp"


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


def normalize_int_asset_map(raw_map: dict[object, object], prefix: str) -> dict[int, str]:
    normalized_map: dict[int, str] = {}
    for raw_key, raw_value in raw_map.items():
        normalized_key = parse_int(raw_key)
        if normalized_key is None:
            continue

        asset_path = normalize_asset_path(raw_value, prefix)
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
            continue
        if isinstance(raw_value, dict):
            for _, item in sorted(
                raw_value.items(),
                key=lambda pair: parse_int(pair[0]) if parse_int(pair[0]) is not None else float("inf"),
            ):
                append_value(item)
            continue
        append_value(raw_value)
    return values


def unwrap_bson_numeric(value: Any) -> Any:
    if isinstance(value, dict):
        if "$numberLong" in value:
            return parse_optional_int(value.get("$numberLong"))
        if "$numberInt" in value:
            return parse_optional_int(value.get("$numberInt"))
        if "$numberDouble" in value:
            raw = value.get("$numberDouble")
            try:
                return float(raw)
            except (TypeError, ValueError):
                return raw
    return value


def parse_optional_int(value: Any) -> int | None:
    normalized = unwrap_bson_numeric(value)
    try:
        return int(normalized)
    except (TypeError, ValueError):
        return None


def parse_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = unwrap_bson_numeric(value)
    text = str(normalized)
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
    return {
        "$or": [
            {"_id": {"$in": [uid, Int64(uid), str(uid)]}},
            {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
        ],
    }
