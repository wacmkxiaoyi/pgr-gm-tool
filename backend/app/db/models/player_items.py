from __future__ import annotations

from pydantic import BaseModel, Field


class InventoryItemRecord(BaseModel):
    item_id: int
    quantity: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0
