from __future__ import annotations

from pydantic import Field
from pydantic import BaseModel


class CharacterManagementItemRecord(BaseModel):
    record_id: int
    CharacterId: int
    Sequence: int
    Level: int | None = None
    Quality: int | None = None
    Star: int | None = None
    Grade: int | None = None
    GradeName: str | None = None
    AwakenLevel: int = 0


class CharacterManagementListResponse(BaseModel):
    items: list[CharacterManagementItemRecord]
    page: int = 1
    page_size: int = 10
    total: int = 0
    total_pages: int = 0


class SetCharacterSupportResponse(BaseModel):
    record_id: int
    updated: bool = True


class UpdateCharacterResponse(BaseModel):
    record_id: int
    CharacterId: int
    Quality: int | None = None
    Star: int | None = None


class UpdateCharacterGradeResponse(BaseModel):
    record_id: int
    CharacterId: int
    Grade: int | None = None


class UpdateCharacterLevelupResponse(BaseModel):
    record_id: int
    CharacterId: int
    Level: int | None = None
    Exp: int | None = None


class UpdateCharacterTrustResponse(BaseModel):
    record_id: int
    CharacterId: int
    TrustLv: int | None = None
    TrustExp: int | None = None


class UpdateCharacterAwakenResponse(BaseModel):
    record_id: int
    CharacterId: int
    AwakenLevel: int = 1
    LiberateLv: int = 1


class UpdateCharacterFashionResponse(BaseModel):
    record_id: int
    CharacterId: int
    CurrentFahionId: int
    HeadFashionId: int
    HeadFashionType: int | None = None


class UpdateCharacterSkillResponse(BaseModel):
    record_id: int
    CharacterId: int
    SkillId: int
    Level: int = 0
    MaxLevel: int = 0


class CharacterFashionRecord(BaseModel):
    Id: int
    Quality: int
    IsLock: bool = True
    BigIcon: str
    BigHeadIconFashion: str
    Name: str
    Description: str


class CharacterEquipRecord(BaseModel):
    record_id: int
    TemplateId: int
    Breakthrough: int | None = None
    Level: int | None = None


class CharacterEquipResonanceRecord(BaseModel):
    slot: int
    type: int | None = None
    template_id: int | None = None
    character_id: int | None = None


class CharacterWeaponOverrunRecord(BaseModel):
    level: int | None = None
    max_level: int | None = None
    chose_suit: int | None = None


class CharacterDetailWeaponRecord(CharacterEquipRecord):
    Description: str | None = None
    resonance_info: list[CharacterEquipResonanceRecord] | None = None
    weapon_overrun_data: CharacterWeaponOverrunRecord | None = None


class CharacterDetailMemoryRecord(CharacterEquipRecord):
    Description: str | None = None
    resonance_info: list[CharacterEquipResonanceRecord] | None = None


class CharacterSkillInfoRecord(BaseModel):
    SkillId: int
    Name: str = ""
    Level: int = 0
    MaxLevel: int = 0


class CharacterExtraInfoRecord(BaseModel):
    TrustLv: int | None = None
    TrustExp: int | None = None
    Exp: int | None = None
    MaxLiberateLevel: int | None = None
    LevelExpMap: dict[int, int] = Field(default_factory=dict)
    QualityBound: list[int] = Field(default_factory=list)
    Intro: str | None = None
    CurrentFahionId: int | None = None
    Fashions: list[CharacterFashionRecord] = Field(default_factory=list)
    Weapon: CharacterDetailWeaponRecord | None = None
    Memories: list[CharacterDetailMemoryRecord] = Field(default_factory=list)
    SkillsList: list[CharacterSkillInfoRecord] = Field(default_factory=list)
    EnhanceSkillList: list[CharacterSkillInfoRecord] = Field(default_factory=list)
