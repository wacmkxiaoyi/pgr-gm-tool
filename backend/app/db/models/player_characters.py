from __future__ import annotations

from pydantic import Field
from pydantic import BaseModel
from backend.app.db.models.player_equips import PartnerItemRecord


CHARACTERS_COLLECTION_NAME = "characters"
CHARACTER_LIST_SCHEMA_PATH = "characters"
FASHIONS_SCHEMA_PATH = "fashions"
FASHION_ITEM_SCHEMA_PATH = "fashions.0"
EQUIPS_SCHEMA_PATH = "equips"
WEAPON_FASHIONS_SCHEMA_PATH = "weaponFashions"
WEAPON_FASHION_ITEM_SCHEMA_PATH = "weaponFashions.0"


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


class CharacterAvailableListResponse(BaseModel):
    character_ids: list[int]


class AddCharacterResponse(BaseModel):
    record_id: int
    CharacterId: int
    added: bool = True


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


class UpdateCharacterHeadFashionResponse(BaseModel):
    record_id: int
    CharacterId: int
    HeadFashionId: int
    HeadFashionType: int


class UpdateCharacterWeaponFashionResponse(BaseModel):
    record_id: int
    CharacterId: int
    CurrentWeaponFashionId: int | None = None


class UpdateCharacterSkillResponse(BaseModel):
    record_id: int
    CharacterId: int
    SkillId: int
    Level: int = 0
    MaxLevel: int = 0


class MaxCharacterResponse(BaseModel):
    record_id: int
    CharacterId: int
    updated: bool = True


class MaxAllCharactersResponse(BaseModel):
    updated: bool = True
    character_count: int = 0
    equip_count: int = 0
    gather_reward_count: int = 0
    skipped_character_ids: list[int] = Field(default_factory=list)


class CharacterFashionRecord(BaseModel):
    Id: int
    Quality: int
    IsLock: bool = True
    BigIcon: str
    BigHeadIcon: str
    BigHeadIconFashion: str
    BigHeadIconLiberation: str
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


class WeaponFashionRecord(BaseModel):
    Id: int
    Quality: int
    IsLock: bool = True
    BigIcon: str
    Name: str
    Description: str


class CharacterExtraInfoRecord(BaseModel):
    Partner: PartnerItemRecord | None = None
    TrustLv: int | None = None
    TrustExp: int | None = None
    Exp: int | None = None
    MaxLiberateLevel: int | None = None
    LevelExpMap: dict[int, int] = Field(default_factory=dict)
    QualityBound: list[int] = Field(default_factory=list)
    Intro: str | None = None
    CurrentFahionId: int | None = None
    DefaultFashionId: int | None = None
    HeadFashionId: int | None = None
    HeadFashionType: int | None = None
    Fashions: list[CharacterFashionRecord] = Field(default_factory=list)
    EquipType: int | None = None
    CurrentWeaponFashionId: int | None = None
    WeaponFashions: list[WeaponFashionRecord] = Field(default_factory=list)
    Weapon: CharacterDetailWeaponRecord | None = None
    Memories: list[CharacterDetailMemoryRecord] = Field(default_factory=list)
    SkillsList: list[CharacterSkillInfoRecord] = Field(default_factory=list)
    EnhanceSkillList: list[CharacterSkillInfoRecord] = Field(default_factory=list)
