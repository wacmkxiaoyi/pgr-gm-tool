from __future__ import annotations

from pydantic import BaseModel


PLAYER_COLLECTION_NAME = "players"
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


class PlayerProfileRecord(BaseModel):
    uid: int
    name: str | None = None
    gender: int | None = None
    level: int | None = None
    likes: int | None = None
    exp: int = 0
    money: int = 0
    serum: int = 0
    black_card: int = 0
    rainbow_card: int = 0
    head_portrait_id: int | None = None
    head_frame_id: int | None = None
    use_background_id: int | None = None


class UpdatePlayerProfilePayload(BaseModel):
    name: str | None = None
    gender: int | None = None
    level: int | None = None
    likes: int | None = None
    exp: int | None = None
    money: int | None = None
    serum: int | None = None
    black_card: int | None = None
    rainbow_card: int | None = None
    head_portrait_id: int | None = None
    head_frame_id: int | None = None
    use_background_id: int | None = None
