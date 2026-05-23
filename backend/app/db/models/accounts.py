from __future__ import annotations

from pydantic import BaseModel, Field


ACCOUNT_COLLECTION_NAME = "accounts"


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
