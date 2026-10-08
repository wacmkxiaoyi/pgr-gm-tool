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
TEAM_RECOMMEND_CHARACTER_TARGET_TSV_PATH = Path("assets/TeamRecommendCharacterTarget.tsv")
TEAM_RECOMMEND_BASE_CHARACTER_TSV_PATH = Path("assets/TeamRecommendBaseCharacter.tsv")
FASHION_TSV_PATH = Path("assets/Fashion.tsv")

HEAD_PORTRAIT_TSV_PATH = Path("assets/HeadPortrait.tsv")
BACKGROUND_TSV_PATH = Path("assets/Background.tsv")
PLAYER_LEVEL_TSV_PATH = Path("assets/Player.tsv")
HONOR_LEVEL_TSV_PATH = Path("assets/HonorLevel.tsv")

ITEM_TSV_PATH = Path("assets/Item.tsv")
STAGE_TSV_PATH = Path("assets/Stage.tsv")
NAMEPLATE_TSV_PATH = Path("assets/Nameplate.tsv")
NAMEPLATE_CONTENT_MAP_TSV_PATH = Path("assets/NameplateContentMap.tsv")
MEDAL_TSV_PATH = Path("assets/Medal.tsv")
CHAT_BOARD_TSV_PATH = Path("assets/ChatBoard.tsv")
EMOJI_TSV_PATH = Path("assets/Emoji.tsv")
SCORE_TITLE_TSV_PATH = Path("assets/ScoreTitle.tsv")

FIXED_CHARACTER_MAX_MEMORY_RESONANCES = {
    (1, 2, 3, 4, 5, 6, 7, 8, 9): [
        [
            {
                "Type": 1,
                "TemplateId": 5
            }
        ]
    ] * 2,
    (5, 6, 9): [
        [
            {
                "Type": 1,
                "TemplateId": 5
            },
            {
                "Type": 1,
                "TemplateId": 8
            }
        ]
    ] * 2,
    (7,): [
        [
            {
                "Type": 1,
                "TemplateId": 8
            },
            {
                "Type": 1,
                "TemplateId": 5
            }
        ]
    ] * 2,
    (2, 3): [
        [
            {
                "Type": 1,
                "TemplateId": 8
            }
        ]
    ] * 2
}

MAXIMUM_STAGE_ID = 30000000
