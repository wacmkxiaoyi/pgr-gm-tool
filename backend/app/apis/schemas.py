from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


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
    player_level_max: int
    player_level_max_exp_map: dict[int, int]
    player_portrait_url_map: dict[int, str]
    player_portrait_frame_url_map: dict[int, str]
    player_portrait_name_map: dict[int, str]
    player_portrait_frame_name_map: dict[int, str]
    player_background_url_map: dict[int, str]
    player_background_name_map: dict[int, str]
    item_name_map: dict[int, str]
    weapon_name_map: dict[int, str]
    weapon_type_map: dict[int, int]
    weapon_type_name_map: dict[int, str]
    weapon_star_map: dict[int, int]
    weapon_site_map: dict[int, str]
    weapon_icon_url_map: dict[int, str]
    weapon_breakthrough_level_limit_map: dict[int, dict[int, int]]
    weapon_breakthrough_max_map: dict[int, dict[str, int]]
    character_log_name_map: dict[int, str]
    character_head_icon_url_map: dict[int, str]


class InventoryItemResponse(BaseModel):
    item_id: int
    quantity: int


class InventoryListResponse(BaseModel):
    items: list[InventoryItemResponse] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class WeaponResonanceResponse(BaseModel):
    Slot: int | None = None
    Type: int | None = None
    CharacterId: int | None = None
    TemplateId: int | None = None


class WeaponOverrunResponse(BaseModel):
    Level: int | None = None
    ActiveSuits: list[int] = Field(default_factory=list)
    ChoseSuit: int | None = None


class WeaponItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    TemplateId: int
    CharacterId: int | None = None
    Level: int | None = None
    Exp: int | None = None
    Breakthrough: int | None = None
    ResonanceInfo: list[WeaponResonanceResponse] = Field(default_factory=list)
    WeaponOverrunData: WeaponOverrunResponse | None = None


class WeaponListResponse(BaseModel):
    items: list[WeaponItemResponse] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class ClearWeaponsRequest(BaseModel):
    keyword: str | None = None


class ClearWeaponsResponse(BaseModel):
    keyword: str
    deleted_count: int


class AddWeaponRequest(BaseModel):
    template_ids: list[int] = Field(min_length=1)


class AddWeaponResponse(BaseModel):
    added: bool
    added_count: int


class DeleteWeaponResponse(BaseModel):
    record_id: int = Field(alias="_id", serialization_alias="_id")
    deleted: bool


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
