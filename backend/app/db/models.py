from __future__ import annotations

from pydantic import BaseModel, Field


class AccountRecord(BaseModel):
    id: str
    uid: int
    username: str


class AccountListResponse(BaseModel):
    items: list[AccountRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 25
    total: int = 0
    total_pages: int = 0


class PlayerProfileRecord(BaseModel):
    uid: int
    name: str | None = None
    gender: int | None = None
    level: int | None = None
    likes: int | None = None
    head_portrait_id: int | None = None
    head_frame_id: int | None = None
    use_background_id: int | None = None


class UpdatePlayerProfilePayload(BaseModel):
    name: str | None = None
    gender: int | None = None
    level: int | None = None
    likes: int | None = None
    head_portrait_id: int | None = None
    head_frame_id: int | None = None
    use_background_id: int | None = None
