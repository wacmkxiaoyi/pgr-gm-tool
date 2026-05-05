from __future__ import annotations

import contextlib
import math
import time
from typing import Literal
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import AddWeaponResponse, ClearWeaponsResponse, WeaponItemRecord, WeaponListResponse, WeaponOverrunRecord, WeaponResonanceRecord
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


def _get_weapon_search_priority(
    keyword: str,
    weapon_name: str,
    character_name: str,
    weapon_type_name: str,
) -> int | None:
    if not keyword:
        return 0

    normalized_weapon_name = str(weapon_name or "").strip().lower()
    if keyword in normalized_weapon_name:
        return 0

    normalized_character_name = str(character_name or "").strip().lower()
    if keyword in normalized_character_name:
        return 1

    normalized_weapon_type_name = str(weapon_type_name or "").strip().lower()
    if keyword in normalized_weapon_type_name:
        return 2

    return None


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
    search_priority: int,
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
            search_priority,
            is_unequipped,
            _ordered_text_key(character_name_map.get(character_id, ""), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "type":
        return (
            search_priority,
            _ordered_text_key(weapon_type_name_map.get(item.TemplateId, ""), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "star":
        return (
            search_priority,
            _ordered_number_key(int(weapon_star_map.get(item.TemplateId, 0)), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    if sort_by == "enhancement":
        return (
            search_priority,
            _ordered_number_key(_weapon_enhancement_level(item, breakthrough_level_limit_map), sort_order),
            _ordered_text_key(weapon_name, sort_order),
            item.record_id,
        )

    return (
        search_priority,
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


def _matching_uid_query(uid: int) -> dict[str, Any]:
    return {
        "$or": [
            {"_id": {"$in": [uid, Int64(uid), str(uid)]}},
            {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
        ],
    }


def _collect_weapon_field_names(raw_equips: list[Any]) -> set[str]:
    field_names: set[str] = set()
    for raw_equip in raw_equips:
        if isinstance(raw_equip, dict):
            field_names.update(raw_equip.keys())
    return field_names


def _get_next_weapon_record_id(raw_equips: list[Any]) -> int:
    existing_ids = sorted({
        current_id
        for raw_equip in raw_equips
        if isinstance(raw_equip, dict)
        for current_id in [_parse_optional_int(raw_equip.get("_id"))]
        if current_id is not None and current_id > 0
    })

    next_id = 1
    for current_id in existing_ids:
        if current_id != next_id:
            return next_id
        next_id += 1

    return next_id


def _build_weapon_document(template_id: int, raw_equips: list[Any]) -> dict[str, Any]:
    present_fields = _collect_weapon_field_names(raw_equips)
    if not present_fields:
        present_fields = {
            "_id",
            "TemplateId",
            "CharacterId",
            "Level",
            "Exp",
            "Breakthrough",
            "ResonanceInfo",
        }

    default_document = {
        "_id": _get_next_weapon_record_id(raw_equips),
        "TemplateId": template_id,
        "CharacterId": 0,
        "Level": 1,
        "Exp": 0,
        "Breakthrough": 0,
        "ResonanceInfo": [],
        "UnconfirmedResonanceInfo": [],
        "AwakeSlotList": [],
        "IsLock": False,
        "CreateTime": Int64(int(time.time())),
        "WeaponOverrunData": {},
        "IsRecycle": False,
    }

    return {
        field_name: field_value
        for field_name, field_value in default_document.items()
        if field_name in present_fields
    }


class PlayerEquipsService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def add_weapons(self, uid: int, template_ids: list[int]) -> AddWeaponResponse:
        normalized_template_ids = list(dict.fromkeys(int(template_id) for template_id in template_ids))
        if not normalized_template_ids:
            raise ValueError("weapon.template_invalid")

        for normalized_template_id in normalized_template_ids:
            if not _is_weapon_template_id(normalized_template_id) or normalized_template_id not in get_weapon_name_map():
                raise ValueError("weapon.template_invalid")

        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(_matching_uid_query(uid), {"equips": 1})
            raw_equips = list(document.get("equips") or []) if isinstance(document, dict) else []
            if not raw_equips:
                raise ValueError("weapon.equips_missing")

            weapon_documents = []
            for normalized_template_id in normalized_template_ids:
                weapon_document = _build_weapon_document(normalized_template_id, raw_equips)
                weapon_documents.append(weapon_document)
                raw_equips.append(weapon_document)

            result = await collection.update_one(
                _matching_uid_query(uid),
                {"$push": {"equips": {"$each": weapon_documents}}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            raise ValueError("weapon.add_failed")

        return AddWeaponResponse(added=True, added_count=len(weapon_documents))

    async def delete_unequipped_weapon(self, uid: int, record_id: int) -> bool:
        normalized_record_id = int(record_id)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                _matching_uid_query(uid),
                {"equips": 1},
            )

            raw_equips = document.get("equips") if isinstance(document, dict) else []
            target_exists = False

            for raw_equip in raw_equips if isinstance(raw_equips, list) else []:
                if not isinstance(raw_equip, dict):
                    continue

                current_record_id = _parse_optional_int(raw_equip.get("_id"))
                if current_record_id != normalized_record_id:
                    continue

                target_exists = True
                template_id = _parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_weapon_template_id(template_id):
                    return False

                character_id = _parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    raise ValueError("weapon.equipped_delete_forbidden")

                break

            if not target_exists:
                return False

            result = await collection.update_one(
                _matching_uid_query(uid),
                {"$pull": {"equips": {"_id": normalized_record_id}}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return result.modified_count > 0

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
                _matching_uid_query(uid),
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

            character_id = _parse_optional_int(raw_equip.get("CharacterId")) or 0
            search_priority = _get_weapon_search_priority(
                normalized_keyword,
                weapon_name_map.get(template_id, "") if template_id is not None else "",
                character_name_map.get(character_id, ""),
                weapon_type_name_map.get(template_id, "") if template_id is not None else "",
            )
            if search_priority is None:
                continue

            record_id = _parse_optional_int(raw_equip.get("_id"))
            if record_id is None or template_id is None:
                continue

            normalized_items.append(WeaponItemRecord(
                record_id=record_id,
                TemplateId=template_id,
                CharacterId=character_id,
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
                _get_weapon_search_priority(
                    normalized_keyword,
                    weapon_name_map.get(item.TemplateId, ""),
                    character_name_map.get(int(item.CharacterId or 0), ""),
                    weapon_type_name_map.get(item.TemplateId, ""),
                )
                or 0,
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

    async def clear_unequipped_weapons_by_keyword(self, uid: int, keyword: str) -> ClearWeaponsResponse:
        normalized_keyword = _normalize_weapon_search_keyword(keyword)
        client = create_mongo_client(self._settings)

        try:
            collection = client[self._settings.mongo_db][CHARACTERS_COLLECTION_NAME]
            document = await collection.find_one(
                _matching_uid_query(uid),
                {"equips": 1},
            )

            raw_equips = document.get("equips") if isinstance(document, dict) else []
            weapon_name_map = get_weapon_name_map()
            character_name_map = get_character_log_name_map()
            weapon_type_name_map = get_weapon_type_name_map()
            deletable_record_ids: list[int] = []

            for raw_equip in raw_equips if isinstance(raw_equips, list) else []:
                if not isinstance(raw_equip, dict):
                    continue

                template_id = _parse_optional_int(raw_equip.get("TemplateId"))
                if not _is_weapon_template_id(template_id):
                    continue

                character_id = _parse_optional_int(raw_equip.get("CharacterId")) or 0
                if character_id != 0:
                    continue

                search_priority = _get_weapon_search_priority(
                    normalized_keyword,
                    weapon_name_map.get(template_id, "") if template_id is not None else "",
                    character_name_map.get(character_id, ""),
                    weapon_type_name_map.get(template_id, "") if template_id is not None else "",
                )
                if search_priority is None:
                    continue

                record_id = _parse_optional_int(raw_equip.get("_id"))
                if record_id is None:
                    continue

                deletable_record_ids.append(record_id)

            if not deletable_record_ids:
                return ClearWeaponsResponse(keyword=normalized_keyword, deleted_count=0)

            result = await collection.update_one(
                _matching_uid_query(uid),
                {"$pull": {"equips": {"_id": {"$in": deletable_record_ids}}}},
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if result.modified_count <= 0:
            return ClearWeaponsResponse(keyword=normalized_keyword, deleted_count=0)

        return ClearWeaponsResponse(keyword=normalized_keyword, deleted_count=len(deletable_record_ids))
