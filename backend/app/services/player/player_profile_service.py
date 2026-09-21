from __future__ import annotations

import contextlib
import time
from typing import Any

from bson.int64 import Int64

from backend.app.config import Settings
from backend.app.db import create_mongo_client
from backend.app.db.models import PlayerProfileRecord, UpdatePlayerProfilePayload
from backend.app.db.models.player_items import INVENTORY_COLLECTION_NAME
from backend.app.db.models.player_profile import PLAYER_BACKGROUND_ID_FIELD, PLAYER_DATA_SCHEMA_PATH, PLAYER_DOCUMENT_FIELD_PATHS, PLAYER_HEAD_FRAME_ID_FIELD, PLAYER_PROFILE_ITEM_FIELD_MAP, PLAYER_COLLECTION_NAME
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime, CompiledCollectionSchema
from backend.app.services.player.player_items_service import PlayerItemsService
from backend.app.services.player.player_profile import (
    get_player_portrait_frame_validity_map,
    get_player_portrait_validity_map,
    is_player_head_resource_active,
)
from backend.app.services.player.medals import get_medal_entires_map, get_medal_keep_time_map, is_unlocked_medal_active
from backend.app.services.player.chat_boards import (
    DEFAULT_CHAT_BOARD_ID,
    get_chat_board_entires_map,
    is_unlocked_chat_board_active,
)
from backend.app.services.player.utils import parse_optional_int, parse_optional_string


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

    def allows_player_profile_field_update(self, field_name: str) -> bool:
        update_path = PLAYER_DOCUMENT_FIELD_PATHS.get(field_name)
        if not update_path:
            return field_name in PLAYER_PROFILE_ITEM_FIELD_MAP
        return self._get_player_schema().allows_update_path(update_path)

    def _filter_update_fields(self, update_fields: dict[str, Any]) -> dict[str, Any]:
        return self._get_player_schema().materialize_update_fields(update_fields)

    async def update_player_profile(self, uid: int, payload: UpdatePlayerProfilePayload) -> PlayerProfileRecord | None:
        update_fields: dict[str, Any] = {}
        inventory_field_updates: dict[str, int] = {}
        if payload.name is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["name"]] = payload.name
        if payload.gender is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["gender"]] = payload.gender
        if payload.level is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["level"]] = payload.level
        if payload.honor_level is not None:
            update_fields[PLAYER_DOCUMENT_FIELD_PATHS["honor_level"]] = payload.honor_level
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
                    {"player_data._id": Int64(uid)},
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

    async def select_player_appearance(self, uid: int, field_name: str, resource_id: int) -> PlayerProfileRecord | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            document = await collection.find_one(
                {"player_data._id": Int64(uid)},
                {"head_portraits": 1, "owned_background_ids": 1},
            )
            if not document:
                return None

            normalized_document = self._sanitize_player_document(document)
            update_fields: dict[str, Any] = {}
            if field_name == "use_background_id":
                owned_background_ids = normalized_document.get("owned_background_ids")
                owned_background_ids = owned_background_ids if isinstance(owned_background_ids, list) else []
                normalized_owned_ids = {
                    background_id
                    for value in owned_background_ids
                    if (background_id := parse_optional_int(value)) is not None and background_id > 0
                }
                if resource_id > 0:
                    normalized_owned_ids.add(resource_id)
                update_fields[PLAYER_DOCUMENT_FIELD_PATHS["use_background_id"]] = resource_id
                update_fields["owned_background_ids"] = sorted(normalized_owned_ids)
            else:
                validity_map = (
                    get_player_portrait_validity_map()
                    if field_name == "head_portrait_id"
                    else get_player_portrait_frame_validity_map()
                )
                head_portraits = normalized_document.get("head_portraits")
                normalized_head_portraits = head_portraits if isinstance(head_portraits, list) else []
                now_unix_seconds = int(time.time())
                existing_index = next((
                    index
                    for index, owned in enumerate(normalized_head_portraits)
                    if isinstance(owned, dict) and parse_optional_int(owned.get("_id")) == resource_id
                ), None)
                if resource_id > 0 and existing_index is None:
                    normalized_head_portraits.append({"_id": resource_id, "LeftCount": 1, "BeginTime": now_unix_seconds})
                elif resource_id > 0 and not is_player_head_resource_active(
                    validity_map[resource_id], normalized_head_portraits[existing_index], now_unix_seconds,
                ):
                    normalized_head_portraits[existing_index]["BeginTime"] = now_unix_seconds
                update_fields[PLAYER_DOCUMENT_FIELD_PATHS[field_name]] = resource_id
                update_fields["head_portraits"] = normalized_head_portraits

            result = await collection.update_one(
                {"player_data._id": Int64(uid)},
                {"$set": self._filter_update_fields(update_fields)},
            )
            if result.matched_count <= 0:
                return None
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return await self.get_player_profile(uid)

    async def select_medal(self, uid: int, medal_id: int) -> PlayerProfileRecord | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            document = await collection.find_one(
                {"player_data._id": Int64(uid)},
                {"unlocked_medals": 1},
            )
            if not document:
                return None

            update_fields: dict[str, Any] = {PLAYER_DOCUMENT_FIELD_PATHS["current_medal_id"]: medal_id}
            if medal_id > 0:
                unlocked_medals = document.get("unlocked_medals")
                normalized_medals = [entry for entry in unlocked_medals if isinstance(entry, dict)] if isinstance(unlocked_medals, list) else []
                now_unix_seconds = int(time.time())
                existing_index = next((
                    index for index, entry in enumerate(normalized_medals)
                    if parse_optional_int(entry.get("id")) == medal_id
                ), None)
                if existing_index is None or not is_unlocked_medal_active(normalized_medals[existing_index], now_unix_seconds):
                    unlocked_medal = {
                        "id": medal_id,
                        "time": now_unix_seconds,
                        "keep_time": get_medal_keep_time_map().get(medal_id, 0),
                    }
                    if existing_index is None:
                        normalized_medals.append(unlocked_medal)
                    else:
                        normalized_medals[existing_index] = unlocked_medal
                    update_fields["unlocked_medals"] = normalized_medals

            result = await collection.update_one(
                {"player_data._id": Int64(uid)},
                {"$set": self._filter_update_fields(update_fields)},
            )
            if result.matched_count <= 0:
                return None
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return await self.get_player_profile(uid)

    async def select_chat_board(self, uid: int, chat_board_id: int) -> PlayerProfileRecord | None:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][PLAYER_COLLECTION_NAME]
            document = await collection.find_one(
                {"player_data._id": Int64(uid)},
                {"unlocked_chat_boards": 1},
            )
            if not document:
                return None

            unlocked_chat_boards = document.get("unlocked_chat_boards")
            normalized_boards = [entry for entry in unlocked_chat_boards if isinstance(entry, dict)] if isinstance(unlocked_chat_boards, list) else []
            now_unix_seconds = int(time.time())
            existing_index = next((
                index for index, entry in enumerate(normalized_boards)
                if parse_optional_int(entry.get("id")) == chat_board_id
            ), None)
            if existing_index is None or not is_unlocked_chat_board_active(normalized_boards[existing_index], now_unix_seconds):
                unlocked_chat_board = {"id": chat_board_id, "get_time": now_unix_seconds, "end_time": 0}
                if existing_index is None:
                    normalized_boards.append(unlocked_chat_board)
                else:
                    normalized_boards[existing_index] = unlocked_chat_board

            result = await collection.update_one(
                {"player_data._id": Int64(uid)},
                {"$set": self._filter_update_fields({
                    PLAYER_DOCUMENT_FIELD_PATHS["current_chat_board_id"]: chat_board_id,
                    "unlocked_chat_boards": normalized_boards,
                })},
            )
            if result.matched_count <= 0:
                return None
        finally:
            with contextlib.suppress(Exception):
                client.close()

        return await self.get_player_profile(uid)

    async def update_player_profile_item_quantity(self, uid: int, item_id: int, quantity: int) -> bool:
        client = create_mongo_client(self._settings)
        try:
            collection = client[self._settings.mongo_db][INVENTORY_COLLECTION_NAME]
            document = await collection.find_one(
                {"uid": Int64(uid)},
                {"items": 1},
            )

            if isinstance(document, dict):
                raw_items = document.get("items") if isinstance(document.get("items"), list) else []
                item_found = any(
                    isinstance(raw_item, dict) and parse_optional_int(raw_item.get("_id")) == item_id
                    for raw_item in raw_items
                )
                result = await collection.update_one(
                    {"_id": document.get("_id"), "items._id": item_id} if item_found else {"_id": document.get("_id")},
                    {"$set": {"items.$.Count": Int64(quantity)}} if item_found else {
                        "$push": {"items": self._items_service.inventory_item_template(item_id, quantity)},
                    },
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
                {"player_data._id": Int64(uid)},
                {
                    "player_data._id": 1,
                    "player_data.Name": 1,
                    "player_data.Gender": 1,
                    "player_data.Level": 1,
                    "player_data.HonorLevel": 1,
                    "player_data.Likes": 1,
                    "player_data.CurrHeadPortraitId": 1,
                    "player_data.CurrMedalId": 1,
                    "player_data.CurrentChatBoardId": 1,
                    f"player_data.{PLAYER_HEAD_FRAME_ID_FIELD}": 1,
                    PLAYER_BACKGROUND_ID_FIELD: 1,
                    "head_portraits": 1,
                    "owned_background_ids": 1,
                    "unlocked_medals": 1,
                    "unlocked_chat_boards": 1,
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

        normalized_uid = parse_optional_int(player_data.get("_id"))
        if normalized_uid is None:
            return None

        head_portrait_id = parse_optional_int(player_data.get("CurrHeadPortraitId"))
        head_frame_id = parse_optional_int(player_data.get(PLAYER_HEAD_FRAME_ID_FIELD))
        use_background_id = parse_optional_int(normalized_document.get(PLAYER_BACKGROUND_ID_FIELD))
        current_medal_id = parse_optional_int(player_data.get("CurrMedalId")) or 0
        current_chat_board_id = parse_optional_int(player_data.get("CurrentChatBoardId")) or DEFAULT_CHAT_BOARD_ID
        now_unix_seconds = int(time.time())
        portrait_validity_map = get_player_portrait_validity_map()
        frame_validity_map = get_player_portrait_frame_validity_map()
        head_portraits = normalized_document.get("head_portraits")
        unlock_head_portraits: set[int] = set()
        unlock_head_frames: set[int] = set()
        for owned in head_portraits if isinstance(head_portraits, list) else []:
            if not isinstance(owned, dict):
                continue
            resource_id = parse_optional_int(owned.get("_id"))
            if resource_id in portrait_validity_map and is_player_head_resource_active(portrait_validity_map[resource_id], owned, now_unix_seconds):
                unlock_head_portraits.add(resource_id)
            if resource_id in frame_validity_map and is_player_head_resource_active(frame_validity_map[resource_id], owned, now_unix_seconds):
                unlock_head_frames.add(resource_id)
        owned_background_ids = normalized_document.get("owned_background_ids")
        raw_owned_background_ids = owned_background_ids if isinstance(owned_background_ids, list) else []
        normalized_owned_background_ids = sorted({
            background_id
            for value in raw_owned_background_ids
            if (background_id := parse_optional_int(value)) is not None and background_id > 0
        })
        medal_entries_map = get_medal_entires_map()
        unlock_medals: set[int] = set()
        unlocked_medals = normalized_document.get("unlocked_medals")
        for unlocked_medal in unlocked_medals if isinstance(unlocked_medals, list) else []:
            if not isinstance(unlocked_medal, dict):
                continue
            medal_id = parse_optional_int(unlocked_medal.get("id"))
            if medal_id in medal_entries_map and is_unlocked_medal_active(unlocked_medal, now_unix_seconds):
                unlock_medals.add(medal_id)
        if current_medal_id not in unlock_medals:
            current_medal_id = 0
        chat_board_entries_map = get_chat_board_entires_map()
        unlock_chat_boards: set[int] = set()
        unlocked_chat_boards = normalized_document.get("unlocked_chat_boards")
        for unlocked_chat_board in unlocked_chat_boards if isinstance(unlocked_chat_boards, list) else []:
            if not isinstance(unlocked_chat_board, dict):
                continue
            chat_board_id = parse_optional_int(unlocked_chat_board.get("id"))
            if chat_board_id in chat_board_entries_map and is_unlocked_chat_board_active(unlocked_chat_board, now_unix_seconds):
                unlock_chat_boards.add(chat_board_id)
        if current_chat_board_id not in unlock_chat_boards:
            current_chat_board_id = DEFAULT_CHAT_BOARD_ID
        inventory_quantities = await self._items_service.get_inventory_quantities(uid)

        return PlayerProfileRecord(
            uid=normalized_uid,
            name=parse_optional_string(player_data.get("Name")),
            gender=parse_optional_int(player_data.get("Gender")),
            level=parse_optional_int(player_data.get("Level")),
            honor_level=parse_optional_int(player_data.get("HonorLevel")),
            likes=parse_optional_int(player_data.get("Likes")),
            exp=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["exp"], 0),
            money=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["money"], 0),
            serum=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["serum"], 0),
            black_card=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["black_card"], 0),
            rainbow_card=inventory_quantities.get(PLAYER_PROFILE_ITEM_FIELD_MAP["rainbow_card"], 0),
            head_portrait_id=head_portrait_id,
            head_frame_id=head_frame_id,
            use_background_id=use_background_id,
            unlock_head_portraits=sorted(unlock_head_portraits),
            unlock_head_frames=sorted(unlock_head_frames),
            owned_background_ids=normalized_owned_background_ids,
            current_medal_id=current_medal_id,
            unlock_medals=sorted(unlock_medals),
            current_chat_board_id=current_chat_board_id,
            unlock_chat_boards=sorted(unlock_chat_boards),
        )
