from __future__ import annotations

import contextlib
import math
from typing import Literal
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import WeaponItemRecord, WeaponListResponse, WeaponOverrunRecord, WeaponResonanceRecord
from backend.app.services.player.player_equips import (
    get_weapon_breakthrough_level_limit_map,
    get_weapon_name_map,
    get_weapon_site_map,
    get_weapon_star_map,
    get_weapon_type_name_map,
)
from backend.app.services.player.player_profile import get_character_log_name_map


CHARACTERS_COLLECTION_NAME = "characters"
ITEM_PAGE_SIZE = 10
WeaponSortField = Literal["name", "character", "type", "star", "enhancement"]
WeaponSortOrder = Literal["asc", "desc"]


def _unwrap_bson_numeric(value: Any) -> Any:
    if isinstance(value, dict):
        if "$numberLong" in value:
            return _parse_optional_int(value.get("$numberLong"))
        if "$numberInt" in value:
            return _parse_optional_int(value.get("$numberInt"))
        if "$numberDouble" in value:
            raw = value.get("$numberDouble")
            try:
                return float(raw)
            except (TypeError, ValueError):
                return raw
    return value


def _parse_optional_int(value: Any) -> int | None:
    normalized = _unwrap_bson_numeric(value)
    try:
        return int(normalized)
    except (TypeError, ValueError):
        return None


def _normalize_weapon_search_keyword(keyword: str | None) -> str:
    return str(keyword or "").strip().lower()


def _is_weapon_template_id(template_id: int | None) -> bool:
    if template_id is None:
        return False

    site_value = get_weapon_site_map().get(template_id)
    return site_value in {"", "0"}


def _normalize_sort_text(value: Any) -> str:
    return str(value or "").strip().lower()


def _descending_text_key(value: str) -> tuple[int, ...]:
    return tuple(-ord(character) for character in value)


def _ordered_text_key(value: Any, sort_order: WeaponSortOrder) -> str | tuple[int, ...]:
    normalized = _normalize_sort_text(value)
    if sort_order == "desc":
        return _descending_text_key(normalized)
    return normalized


def _ordered_number_key(value: int, sort_order: WeaponSortOrder) -> int:
    return -value if sort_order == "desc" else value


def _weapon_enhancement_level(item: WeaponItemRecord, breakthrough_level_limit_map: dict[int, dict[int, int]]) -> int:
    breakthrough = max(0, int(item.Breakthrough or 0))
    level = max(0, int(item.Level or 0))
    stage_map = breakthrough_level_limit_map.get(item.TemplateId)
    if not isinstance(stage_map, dict):
        return level

    total = level
    for stage in range(breakthrough):
        level_limit = stage_map.get(stage)
        if not isinstance(level_limit, int):
            break
        total += level_limit

    return total


def _weapon_sort_key(
    item: WeaponItemRecord,
    sort_by: WeaponSortField,
    sort_order: WeaponSortOrder,
    weapon_name_map: dict[int, str],
    character_name_map: dict[int, str],
    weapon_type_name_map: dict[int, str],
    weapon_star_map: dict[int, int],
    breakthrough_level_limit_map: dict[int, dict[int, int]],
) -> tuple[Any, ...]:
    weapon_name = weapon_name_map.get(item.TemplateId, "")

    if sort_by == "character":
        character_id = int(item.CharacterId or 0)
        is_unequipped = 1 if character_id == 0 else 0
        return (
            is_unequipped,
            _ordered_text_key(character_name_map.get(character_id, ""), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "type":
        return (
            _ordered_text_key(weapon_type_name_map.get(item.TemplateId, ""), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "star":
        return (
            _ordered_number_key(int(weapon_star_map.get(item.TemplateId, 0)), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "enhancement":
        return (
            _ordered_number_key(_weapon_enhancement_level(item, breakthrough_level_limit_map), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    return (
        _ordered_text_key(weapon_name, sort_order),
        item.record_id,
    )


def _normalize_weapon_resonance_list(value: Any) -> list[WeaponResonanceRecord]:
    normalized_list: list[WeaponResonanceRecord] = []
    for entry in value if isinstance(value, list) else []:
        if not isinstance(entry, dict):
            continue

        normalized_list.append(WeaponResonanceRecord(
            Slot=_parse_optional_int(entry.get("Slot")),
            Type=_parse_optional_int(entry.get("Type")),
            CharacterId=_parse_optional_int(entry.get("CharacterId")),
            TemplateId=_parse_optional_int(entry.get("TemplateId")),
        ))

    return normalized_list


def _normalize_weapon_overrun_data(value: Any) -> WeaponOverrunRecord | None:
    if not isinstance(value, dict):
        return None

    active_suits: list[int] = []
    for suit_id in value.get("ActiveSuits") if isinstance(value.get("ActiveSuits"), list) else []:
        normalized_suit_id = _parse_optional_int(suit_id)
        if normalized_suit_id is not None:
            active_suits.append(normalized_suit_id)

    return WeaponOverrunRecord(
        Level=_parse_optional_int(value.get("Level")),
        ActiveSuits=active_suits,
        ChoseSuit=_parse_optional_int(value.get("ChoseSuit")),
    )


class PlayerEquipsService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def list_character_weapons(
        self,
        uid: int,
        page: int = 1,
        page_size: int = ITEM_PAGE_SIZE,
        keyword: str | None = None,
        sort_by: WeaponSortField = "character",
        sort_order: WeaponSortOrder = "asc",
    ) -> WeaponListResponse:
        current_page = max(1, int(page))
        normalized_page_size = ITEM_PAGE_SIZE if page_size <= 0 else min(int(page_size), ITEM_PAGE_SIZE)
        normalized_keyword = _normalize_weapon_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                {
                    "$or": [
                        {"_id": {"$in": [uid, Int64(uid), str(uid)]}},
                        {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                    ],
                },
                {"equips": 1},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        raw_equips = document.get("equips") if isinstance(document, dict) else []
        weapon_name_map = get_weapon_name_map()
        character_name_map = get_character_log_name_map()
        weapon_type_name_map = get_weapon_type_name_map()
        weapon_star_map = get_weapon_star_map()
        breakthrough_level_limit_map = get_weapon_breakthrough_level_limit_map()
        normalized_items: list[WeaponItemRecord] = []

        for raw_equip in raw_equips if isinstance(raw_equips, list) else []:
            if not isinstance(raw_equip, dict):
                continue

            template_id = _parse_optional_int(raw_equip.get("TemplateId"))
            if not _is_weapon_template_id(template_id):
                continue

            weapon_name = str(weapon_name_map.get(template_id, "")).strip().lower() if template_id is not None else ""
            if normalized_keyword and normalized_keyword not in weapon_name:
                continue

            record_id = _parse_optional_int(raw_equip.get("_id"))
            if record_id is None or template_id is None:
                continue

            normalized_items.append(WeaponItemRecord(
                record_id=record_id,
                TemplateId=template_id,
                CharacterId=_parse_optional_int(raw_equip.get("CharacterId")),
                Level=_parse_optional_int(raw_equip.get("Level")),
                Exp=_parse_optional_int(raw_equip.get("Exp")),
                Breakthrough=_parse_optional_int(raw_equip.get("Breakthrough")),
                ResonanceInfo=_normalize_weapon_resonance_list(raw_equip.get("ResonanceInfo")),
                WeaponOverrunData=_normalize_weapon_overrun_data(raw_equip.get("WeaponOverrunData")),
            ))

        normalized_items.sort(
            key=lambda item: _weapon_sort_key(
                item,
                sort_by,
                sort_order,
                weapon_name_map,
                character_name_map,
                weapon_type_name_map,
                weapon_star_map,
                breakthrough_level_limit_map,
            ),
        )

        total = len(normalized_items)
        total_pages = math.ceil(total / normalized_page_size) if total > 0 else 0
        start = (current_page - 1) * normalized_page_size
        end = start + normalized_page_size

        return WeaponListResponse(
            items=normalized_items[start:end],
            page=current_page,
            page_size=normalized_page_size,
            total=total,
            total_pages=total_pages,
        )
