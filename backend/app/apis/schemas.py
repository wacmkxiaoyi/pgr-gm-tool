from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str | None = None
    expires_at: str | None = None


class ApiErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, object] | None = None


class SessionResponse(BaseModel):
    authenticated: bool


class AppInfoResponse(BaseModel):
    name: str
    environment: str
    mongo_db: str
    mongo_configured: bool
    server_controls_visible: bool
    player_portrait_url_map: dict[int, str]
    player_portrait_frame_url_map: dict[int, str]
    player_portrait_name_map: dict[int, str]
    player_portrait_frame_name_map: dict[int, str]
    player_background_url_map: dict[int, str]
    player_background_name_map: dict[int, str]
    item_name_map: dict[int, str]


class InventoryItemResponse(BaseModel):
    item_id: int
    quantity: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class ClearInventoryItemsRequest(BaseModel):
    keyword: str | None = None


class DeleteInventoryItemResponse(BaseModel):
    item_id: int
    deleted: bool


class ClearInventoryItemsResponse(BaseModel):
    keyword: str
    deleted_count: int


class UpdateInventoryItemRequest(BaseModel):
    quantity: int


class UpdateInventoryItemResponse(BaseModel):
    item_id: int
    quantity: int
    updated: bool


class AddInventoryItemPayload(BaseModel):
    item_id: int
    quantity: int


class AddInventoryItemsRequest(BaseModel):
    items: list[AddInventoryItemPayload] = Field(default_factory=list)


class AddInventoryItemsResponse(BaseModel):
    added_count: int
    created_count: int
    updated_count: int


class SelectAccountRequest(BaseModel):
    uid: int


class SelectedAccountResponse(BaseModel):
    selected_uid: int | None = None


class ResetAccountPasswordRequest(BaseModel):
    uid: int
    password: str = Field(min_length=6)


class ResetAccountPasswordResponse(BaseModel):
    uid: int
    updated: bool


class PlayerProfileResponse(BaseModel):
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


class UpdateSelectedPlayerProfileRequest(BaseModel):
    field: str
    value: str | int


class HealthStatusResponse(BaseModel):
    checked_at: str | None = None
    server_version: str | None = None
    interval_seconds: int
    sections: list[dict[str, object]]
    controls: dict[str, object]


class DatabaseHealthStatusResponse(BaseModel):
    checked_at: str | None = None
    interval_seconds: int
    sections: list[dict[str, object]]


class ServerConfigResponse(BaseModel):
    path: str
    text: str
    editable: bool


class SaveServerConfigRequest(BaseModel):
    text: str
