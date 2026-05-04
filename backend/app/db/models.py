from __future__ import annotations

from pydantic import BaseModel, Field


class AccountRecord(BaseModel):
    id: str
    uid: int
    username: str


class AccountListResponse(BaseModel):
    items: list[AccountRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


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


class InventoryItemRecord(BaseModel):
    item_id: int
    quantity: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


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
