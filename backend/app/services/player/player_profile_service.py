from __future__ import annotations

import contextlib
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import PlayerProfileRecord, UpdatePlayerProfilePayload
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
from backend.app.services.player.player_items_service import PlayerItemsService


PLAYER_COLLECTION_NAME = "players"
INVENTORY_COLLECTION_NAME = "inventory"
PLAYER_HEAD_FRAME_ID_FIELD = "CurrHeadFrameId"
PLAYER_BACKGROUND_ID_FIELD = "use_background_id"
PLAYER_EDITABLE_FIELDS = {
    "name": "Name",
    "gender": "Gender",
    "level": "Level",
    "likes": "Likes",
}
PLAYER_PROFILE_ITEM_FIELD_MAP = {
    "exp": 7,
    "money": 1,
    "serum": 4,
    "black_card": 3,
    "rainbow_card": 5,
}
PLAYER_DOCUMENT_FIELD_PATHS = {
    "name": "player_data.Name",
    "gender": "player_data.Gender",
    "level": "player_data.Level",
    "likes": "player_data.Likes",
    "head_portrait_id": "player_data.CurrHeadPortraitId",
    "head_frame_id": f"player_data.{PLAYER_HEAD_FRAME_ID_FIELD}",
    "use_background_id": PLAYER_BACKGROUND_ID_FIELD,
}
PLAYER_DATA_SCHEMA_PATH = "player_data"


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


def _parse_optional_string(value: Any) -> str | None:
    if value is None:
        return None
    normalized = _unwrap_bson_numeric(value)
    text = str(normalized)
    return text if text else None


class PlayerProfileService:
    def __init__(self, settings: Settings, items_service: PlayerItemsService, schema_runtime: DatabaseSchemaRuntime) -> None:
        self._settings = settings
        self._items_service = items_service
        self._schema_runtime = schema_runtime
        self._collection_schema = schema_runtime.get_collection_schema(PLAYER_COLLECTION_NAME)

    def _get_player_schema(self) -> CompiledCollectionSchema:
        if self._collection_schema is None:
            raise RuntimeError(f"Missing schema for collection: {PLAYER_COLLECTION_NAME}")
        return self._collection_schema

    def _sanitize_player_data(self, player_data: Any) -> dict[str, Any]:
        sanitized = self._get_player_schema().sanitize_read(player_data, PLAYER_DATA_SCHEMA_PATH)
        return sanitized if isinstance(sanitized, dict) else {}

    def _sanitize_player_document(self, document: Any) -> dict[str, Any]:
        sanitized = self._get_player_schema().sanitize_document(document)
        return sanitized if isinstance(sanitized, dict) else {}

    def _allows_player_field(self, path: str) -> bool:
        return self._get_player_schema().allows_field(path)

    def _filter_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        return self._get_player_schema().normalize_update_fields(update_fields)

    async def update_player_profile(self, uid: int, payload: UpdatePlayerProfilePayload) -> PlayerProfileRecord | None:
        update_fields: dict[str, Any] = {}
        inventory_field_updates: dict[str, int] = {}
        if payload.name is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["name"]] = payload.name
        if payload.gender is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["gender"]] = payload.gender
        if payload.level is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["level"]] = payload.level
        if payload.likes is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["likes"]] = payload.likes
        if payload.exp is not None:
            inventory_field_updates["exp"] = payload.exp
        if payload.money is not None:
            inventory_field_updates["money"] = payload.money
        if payload.serum is not None:
            inventory_field_updates["serum"] = payload.serum
        if payload.black_card is not None:
            inventory_field_updates["black_card"] = payload.black_card
        if payload.rainbow_card is not None:
            inventory_field_updates["rainbow_card"] = payload.rainbow_card
        if payload.head_portrait_id is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["head_portrait_id"]] = payload.head_portrait_id
        if payload.head_frame_id is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["head_frame_id"]] = payload.head_frame_id
        if payload.use_background_id is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["use_background_id"]] = payload.use_background_id

        update_fields = self._filter_update_fields(update_fields)

        if not update_fields and not inventory_field_updates:
            return await self.get_player_profile(uid)

        if update_fields:
            client = create_mongo_client(self._settings)
            try:
                collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
                result = await collection.update_one(
                    {"player_data._id": {"$in": [uid, Int64(uid), str(uid)]}},
                    {"$set": update_fields},
                )
            finally:
                with contextlib.suppress(Exception):
                    client.close()

            if result.matched_count <= 0:
                return None

        for field_name, quantity in inventory_field_updates.items():
            updated = await self.update_player_profile_item_quantity(uid, PLAYER_PROFILE_ITEM_FIELD_MAP[field_name], quantity)
            if not updated:
                return None

        return await self.get_player_profile(uid)

    async def update_player_profile_item_quantity(self, uid: int, item_id: int, quantity: int) -> bool:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": {"$in": [uid, Int64(uid), str(uid)]}},
                {"items": 1},
            )

            if isinstance(document, dict):
                raw_items = self._items_service.sanitize_inventory_items(document.get("items"))
                item_found = False
                for raw_item in raw_items:
                    if not isinstance(raw_item, dict):
                        continue

                    current_item_id = _parse_optional_int(raw_item.get("_id"))
                    if current_item_id != item_id:
                        continue

                    raw_item["Count"] = Int64(quantity)
                    item_found = True
                    break

                if not item_found:
                    raw_items.append(self._items_service.inventory_item_template(item_id, quantity))

                result = await collection.update_one(
                    {"_id": document.get("_id")},
                    {"$set": {"items": raw_items}},
                )
                return result.matched_count > 0

            result = await collection.insert_one({
                "uid": Int64(uid),
                "items": [self._items_service.inventory_item_template(item_id, quantity)],
            })
            return bool(result.inserted_id)
        finally:
            with contextlib.suppress(Exception):
                client.close()

    async def get_player_profile(self, uid: int) -> PlayerProfileRecord | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            document = await collection.find_one(
                {"player_data._id": {"$in": [uid, Int64(uid), str(uid)]}},
                {
                    "player_data._id": 1,
                    "player_data.Name": 1,
                    "player_data.Gender": 1,
                    "player_data.Level": 1,
                    "player_data.Likes": 1,
                    "player_data.CurrHeadPortraitId": 1,
                    f"player_data.{PLAYER_HEAD_FRAME_ID_FIELD}": 1,
                    PLAYER_BACKGROUND_ID_FIELD: 1,
                },
            )
        finally:
            with contextlib.suppress(Exception):
                client.close()

        if not document:
            return None

        normalized_document = self._sanitize_player_document(document)
        player_data = self._sanitize_player_data(normalized_document.get("player_data"))
        if not isinstance(player_data, dict):
            return None

        normalized_uid = _parse_optional_int(player_data.get("_id"))
        if normalized_uid is None:
            return None

        head_portrait_id = _parse_optional_int(player_data.get("CurrHeadPortraitId"))
        head_frame_id = _parse_optional_int(player_data.get(PLAYER_HEAD_FRAME_ID_FIELD))
        use_background_id = _parse_optional_int(normalized_document.get(PLAYER_BACKGROUND_ID_FIELD))
        inventory_quantities = await self._items_service.get_inventory_quantities(uid)

        return PlayerProfileRecord(
            uid=normalized_uid,
            name=_parse_optional_string(player_data.get("Name")),
            gender=_parse_optional_int(player_data.get("Gender")),
            level=_parse_optional_int(player_data.get("Level")),
            likes=_parse_optional_int(player_data.get("Likes")),
            exp=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["exp"], 0),
            money=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["money"], 0),
            serum=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["serum"], 0),
            black_card=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["black_card"], 0),
            rainbow_card=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["rainbow_card"], 0),
            head_portrait_id=head_portrait_id,
            head_frame_id=head_frame_id,
            use_background_id=use_background_id,
        )
