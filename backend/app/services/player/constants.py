from pathlib import Path


ATTRIB_POOL_TSV_PATH = Path("assets/AttribPool.tsv")
CHARACTER_SKILL_TSV_PATH = Path("assets/CharacterSkill.tsv")
CHARACTER_SKILL_GROUP_TSV_PATH = Path("assets/CharacterSkillGroup.tsv")
CHARACTER_SKILL_POOL_TSV_PATH = Path("assets/CharacterSkillPool.tsv")
CHARACTER_SKILL_LEVEL_EFFECT_TSV_PATH = Path("assets/CharacterSkillLevelEffect.tsv")
CHARACTER_SKILL_UPGRADE_DES_TSV_PATH = Path("assets/CharacterSkillUpgradeDes.tsv")
ENHANCE_SKILL_TSV_PATH = Path("assets/EnhanceSkill.tsv")
ENHANCE_SKILL_GROUP_TSV_PATH = Path("assets/EnhanceSkillGroup.tsv")
ENHANCE_SKILL_LEVEL_EFFECT_TSV_PATH = Path("assets/EnhanceSkillLevelEffect.tsv")
ENHANCE_SKILL_UPGRADE_DES_TSV_PATH = Path("assets/EnhanceSkillUpgradeDes.tsv")
CHARACTER_GRADE_TSV_PATH = Path("assets/CharacterGrade.tsv")
CHARACTER_QUALITY_TSV_PATH = Path("assets/CharacterQuality.tsv")
CHARACTER_TRUST_EXP_TSV_PATH = Path("assets/CharacterTrustExp.tsv")
EXHIBITION_REWARD_TSV_PATH = Path("assets/ExhibitionReward.tsv")
REWARD_TSV_PATH = Path("assets/Reward.tsv")
REWARD_GOODS_TSV_PATH = Path("assets/RewardGoods.tsv")
CHARACTER_TSV_PATH = Path("assets/Character.tsv")
CHARACTER_RECOMMEND_EQUIPS_TSV_PATH = Path("assets/CharacterRecommendEquips.tsv")
FASHION_TSV_PATH = Path("assets/Fashion.tsv")

HEAD_PORTRAIT_TSV_PATH = Path("assets/HeadPortrait.tsv")
BACKGROUND_TSV_PATH = Path("assets/Background.tsv")
PLAYER_LEVEL_TSV_PATH = Path("assets/Player.tsv")
HONOR_LEVEL_TSV_PATH = Path("assets/HonorLevel.tsv")

ITEM_TSV_PATH = Path("assets/Item.tsv")
STAGE_TSV_PATH = Path("assets/Stage.tsv")

FIXED_CHARACTER_MAX_MEMORY_RESONANCES = [
    [
        {
            "Type": 1,
            "TemplateId": 8
        },
        #{
        #    "Type": 1,
        #    "TemplateId": 6
        #},
        {
            "Type": 1,
            "TemplateId": 5
        }
    ]
] * 2

MAXIMUM_STAGE_ID = 30000000
