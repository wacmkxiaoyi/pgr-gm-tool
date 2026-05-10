from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class WeaponResonanceRecord(BaseModel):
    Slot: int | None = None
    Type: int | None = None
    CharacterId: int | None = None
    TemplateId: int | None = None


class WeaponOverrunRecord(BaseModel):
    Level: int | None = None
    ActiveSuits: list[int] = Field(default_factory=list)
    ChoseSuit: int | None = None


class WeaponOverrunExtraInfoRecord(BaseModel):
    level: int | None = None
    max_level: int | None = None
    chose_suit: int | None = None


class WeaponItemRecord(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    record_id: int = Field(alias="_id", serialization_alias="_id")
    TemplateId: int
    CharacterId: int | None = None
    Level: int | None = None
    Exp: int | None = None
    Breakthrough: int | None = None
    EnhancementLevel: int | None = None


class WeaponResonanceExtraInfoRecord(BaseModel):
    slot: int
    type: int | None = None
    template_id: int | None = None
    character_id: int | None = None


class WeaponExtraInfoRecord(BaseModel):
    max_breakthrough: int
    breakthrough_level_limit_map: dict[int, int] = Field(default_factory=dict)
    current_level_exp_limit: int | None = None
    resonance_info: list[WeaponResonanceExtraInfoRecord] | None = None
    weapon_overrun_data: WeaponOverrunExtraInfoRecord | None = None


class WeaponListResponse(BaseModel):
    items: list[WeaponItemRecord] = Field(default_factory=list)
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class UpdateWeaponRequest(BaseModel):
    field: str
    value: int


class UpdateWeaponOverrunRequest(BaseModel):
    chose_suit: int | None = None


class ClearWeaponsResponse(BaseModel):
    keyword: str
    deleted_count: int


class AddWeaponResponse(BaseModel):
    added: bool
    added_count: int
