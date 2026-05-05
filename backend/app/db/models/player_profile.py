from __future__ import annotations

from pydantic import BaseModel


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
