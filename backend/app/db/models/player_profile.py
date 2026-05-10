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


class CharacterManagementItemRecord(BaseModel):
    record_id: int
    CharacterId: int
    Sequence: int
    Level: int | None = None
    Quality: int | None = None
    Grade: int | None = None
    GradeName: str | None = None
    AwakenLevel: int = 0


class CharacterManagementListResponse(BaseModel):
    items: list[CharacterManagementItemRecord]
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class SetCharacterSupportResponse(BaseModel):
    record_id: int
    updated: bool = True
