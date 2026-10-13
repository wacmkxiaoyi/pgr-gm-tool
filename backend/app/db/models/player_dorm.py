from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


FurnitureSortField = Literal["record_id", "name", "type", "description", "suit", "beauty", "comfort", "utility"]


class FurnitureRecord(BaseModel):
    record_id: int
    config_id: int
    dormitory_id: int | None = None
    addition: int = 0
    beauty: int | None = None
    comfort: int | None = None
    utility: int | None = None


class FurnitureListResponse(BaseModel):
    items: list[FurnitureRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class DeleteFurnitureResponse(BaseModel):
    record_id: int
    deleted: bool


class ClearFurnitureResponse(BaseModel):
    deleted_count: int


class AddFurnitureRequest(BaseModel):
    config_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(default_factory=list)
    template_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(default_factory=list)
    suit_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(default_factory=list)
    unlock_all: bool = False
    attr_mode: Literal["auto", "custom"] = "auto"
    attr_list: list[Annotated[int, Field(strict=True, ge=0, le=9999999)]] | None = Field(
        default=None, min_length=3, max_length=3,
    )
    addition_ids: list[Annotated[int, Field(strict=True, gt=0)]] = Field(default_factory=lambda: [321, 322])

    @model_validator(mode="after")
    def validate_selection(self) -> AddFurnitureRequest:
        if sum((bool(self.config_ids), bool(self.template_ids), bool(self.suit_ids), self.unlock_all)) != 1:
            raise ValueError("Select exactly one furniture, template, suit or unlock-all mode")
        if self.attr_mode == "custom" and self.attr_list is None:
            raise ValueError("Custom attributes require three values")
        return self


class AddFurnitureResponse(BaseModel):
    added_count: int
    unlock_all: bool
