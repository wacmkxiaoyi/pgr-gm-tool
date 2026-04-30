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
