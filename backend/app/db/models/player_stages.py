from __future__ import annotations

from pydantic import BaseModel, Field


STAGES_COLLECTION_NAME = "stages"
STAGES_SCHEMA_PATH = "stages"


class StageRecord(BaseModel):
    stage_id: int
    k: int | None = None
    v: dict[str, object] = Field(default_factory=dict)


class StageListResponse(BaseModel):
    items: list[StageRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class StageClearedIdsResponse(BaseModel):
    stage_ids: list[int] = Field(default_factory=list)


class AddStagesRequest(BaseModel):
    stage_ids: list[int] = Field(default_factory=list)


class AddStagesResponse(BaseModel):
    added_count: int


class DeleteStageResponse(BaseModel):
    stage_id: int
    deleted: bool


class ClearStagesResponse(BaseModel):
    deleted_count: int
