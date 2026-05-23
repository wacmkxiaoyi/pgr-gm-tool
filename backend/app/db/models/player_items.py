from __future__ import annotations

from pydantic import BaseModel, Field


INVENTORY_COLLECTION_NAME = "inventory"
INVENTORY_ITEMS_SCHEMA_PATH = "items"
INVENTORY_ITEM_SCHEMA_PATH = "items.0"


class InventoryItemRecord(BaseModel):
    item_id: int
    quantity: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0
