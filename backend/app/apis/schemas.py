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
    equip_name_map: dict[int, str]
    weapon_type_name_map: dict[int, str]
    equip_star_map: dict[int, int]
    equip_site_map: dict[int, str]
    equippable_memory_nums: int
    equip_icon_url_map: dict[int, str]
    character_log_name_map: dict[int, str]
    character_head_icon_url_map: dict[int, str]
    weapon_skill_entries_map: dict[int, dict[str, str]] = Field(default_factory=dict)
    weapon_overrun_suit_entries_map: dict[int, dict[str, str]] | None = None
    weapon_skill_pool_entries_map: dict[int, dict[int, list[int]]] = Field(default_factory=dict)
    attrib_pool_entries_map: dict[int, list[dict[str, object]]] = Field(default_factory=dict)
    character_skill_pool_entries_map: dict[int, dict[int, list[dict[str, object]]]] = Field(default_factory=dict)
    equip_resonance_map: dict[int, list[list[int]]] = Field(default_factory=dict)
    character_grade_name_map: dict[int, list[str]] = Field(default_factory=dict)
    character_trust_exp_map: dict[int, int] = Field(default_factory=dict)


class CharacterManagementItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    CharacterId: int
    Sequence: int
    Level: int | None = None
    Quality: int | None = None
    Star: int | None = None
    Grade: int | None = None
    GradeName: str | None = None
    AwakenLevel: int = 0


class CharacterManagementListResponse(BaseModel):
    items: list[CharacterManagementItemResponse] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class SetCharacterSupportResponse(BaseModel):
    record_id: int
    updated: bool = True


class CharacterFashionResponse(BaseModel):
    Id: int
    Quality: int
    IsLock: bool = True
    BigIcon: str
    BigHeadIconFashion: str


class CharacterEquipResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    TemplateId: int
    Breakthrough: int | None = None
    Level: int | None = None


class CharacterEquipResonanceResponse(BaseModel):
    slot: int
    type: int | None = None
    template_id: int | None = None
    character_id: int | None = None


class CharacterWeaponOverrunResponse(BaseModel):
    level: int | None = None
    max_level: int | None = None
    chose_suit: int | None = None


class CharacterDetailWeaponResponse(CharacterEquipResponse):
    resonance_info: list[CharacterEquipResonanceResponse] | None = None
    weapon_overrun_data: CharacterWeaponOverrunResponse | None = None


class CharacterDetailMemoryResponse(CharacterEquipResponse):
    resonance_info: list[CharacterEquipResonanceResponse] | None = None


class CharacterSkillInfoResponse(BaseModel):
    SkillId: int
    Name: str = ""
    Level: int = 0
    MaxLevel: int = 0


class CharacterExtraInfoResponse(BaseModel):
    TrustLv: int | None = None
    TrustExp: int | None = None
    LevelExpMap: dict[int, int] = Field(default_factory=dict)
    Intro: str | None = None
    CurrentFahionId: int | None = None
    Fashions: list[CharacterFashionResponse] = Field(default_factory=list)
    Weapon: CharacterDetailWeaponResponse | None = None
    Memories: list[CharacterDetailMemoryResponse] = Field(default_factory=list)
    SkillsList: list[CharacterSkillInfoResponse] = Field(default_factory=list)
    EnhanceSkillList: list[CharacterSkillInfoResponse] = Field(default_factory=list)


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


class WeaponOverrunExtraInfoResponse(BaseModel):
    level: int | None = None
    max_level: int | None = None
    chose_suit: int | None = None


class WeaponItemResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    TemplateId: int
    CharacterId: int | None = None
    Level: int | None = None
    Exp: int | None = None
    Breakthrough: int | None = None
    EnhancementLevel: int | None = None


class WeaponListResponse(BaseModel):
    items: list[WeaponItemResponse] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class MemoryListResponse(BaseModel):
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


class AddMemoryResponse(BaseModel):
    added: bool
    added_count: int


class DeleteWeaponResponse(BaseModel):
    record_id: int = Field(alias="_id", serialization_alias="_id")
    deleted: bool


class UpdateWeaponRequest(BaseModel):
    field: str
    value: int


class UpdateWeaponOverrunRequest(BaseModel):
    chose_suit: int | None = None
    level: int | None = None


class UpdateWeaponResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    TemplateId: int
    CharacterId: int | None = None
    Level: int | None = None
    Exp: int | None = None
    Breakthrough: int | None = None
    EnhancementLevel: int | None = None


class WeaponResonanceExtraInfoResponse(BaseModel):
    slot: int
    type: int | None = None
    template_id: int | None = None
    character_id: int | None = None


class WeaponExtraInfoResponse(BaseModel):
    max_breakthrough: int
    breakthrough_level_limit_map: dict[int, int]
    description: str | None = None
    current_level_exp_limit: int | None = None
    resonance_info: list[WeaponResonanceExtraInfoResponse] | None = None
    awake_slot_list: list[int] | None = None
    weapon_overrun_data: WeaponOverrunExtraInfoResponse | None = None


class MemoryExtraInfoResponse(BaseModel):
    max_breakthrough: int
    breakthrough_level_limit_map: dict[int, int]
    description: str | None = None
    current_level_exp_limit: int | None = None
    resonance_info: list[WeaponResonanceExtraInfoResponse] | None = None
    awake_slot_list: list[int] | None = None


class UpdateWeaponResonanceRequest(BaseModel):
    Slot: int
    Type: int
    TemplateId: int
    CharacterId: int
    Awake: bool | None = None


class UpdateWeaponResonanceResponse(BaseModel):
    Slot: int
    Type: int | None = None
    TemplateId: int | None = None
    CharacterId: int | None = None


class DeleteWeaponResonanceResponse(BaseModel):
    Slot: int
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


class DeleteAccountResponse(BaseModel):
    uid: int
    deleted: bool


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
