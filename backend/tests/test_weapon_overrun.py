import pytest

from backend.app.services.player import player_characters as resources
from backend.app.utils.resource_language import resource_language
from backend.app.services.player.equips.weapon import (
    get_weapon_overrun_character_max_level_skill_upgrade_map,
    get_weapon_overrun_max_level_map,
    get_weapon_overrun_suit_entries_map,
    get_weapon_overrun_suit_memory_ids_map,
)
from backend.app.apis.schemas import AppInfoResponse
from backend.app.services.player.player_characters import (
    _choose_weapon_overrun_suit,
    get_character_max_template_map,
)


def test_weapon_overrun_suit_memory_ids_are_suitable_for_frontend_matching() -> None:
    suit_memory_ids_map = get_weapon_overrun_suit_memory_ids_map()

    assert set(suit_memory_ids_map[1201].values()) == {
        3012001,
        3022001,
        3032001,
        3042001,
        3052001,
        3062001,
    }


def test_weapon_overrun_suit_entries_expose_structured_descriptions() -> None:
    entries = get_weapon_overrun_suit_entries_map()

    assert entries
    assert any(isinstance(entry["SkillDescription"], list) and entry["SkillDescription"] for entry in entries.values())


def test_app_info_accepts_structured_weapon_overrun_descriptions() -> None:
    entries = get_weapon_overrun_suit_entries_map()

    response = AppInfoResponse.model_validate({
        "name": "test",
        "mongo_db": "test",
        "mongo_configured": True,
        "server_management_enabled": False,
        "server_controls_visible": False,
        "player_level_max": 1,
        "player_level_max_exp_map": {},
        "player_honor_level_max": 1,
        "player_honor_level_max_exp_map": {},
        "player_portrait_url_map": {},
        "player_portrait_frame_url_map": {},
        "player_portrait_name_map": {},
        "player_portrait_frame_name_map": {},
        "player_background_url_map": {},
        "player_background_name_map": {},
        "item_name_map": {},
        "equip_name_map": {},
        "weapon_type_name_map": {},
        "equip_star_map": {},
        "equip_site_map": {},
        "equippable_memory_nums": 6,
        "equip_icon_url_map": {},
        "character_log_name_map": {},
        "character_head_icon_url_map": {},
        "weapon_overrun_suit_entries_map": entries,
    })

    assert all(isinstance(entry.SkillDescription, list) for entry in response.weapon_overrun_suit_entries_map.values())


def test_weapon_overrun_suit_memory_ids_support_list_equip_ids() -> None:
    suit_memory_ids_map = get_weapon_overrun_suit_memory_ids_map()

    assert suit_memory_ids_map
    assert suit_memory_ids_map[1201] == {
        1: 3012001,
        2: 3022001,
        3: 3032001,
        4: 3042001,
        5: 3052001,
        6: 3062001,
    }


def test_weapon_overrun_suit_uses_most_matching_memories() -> None:
    assert _choose_weapon_overrun_suit([3012001, 3022001, 3032001, 3042001]) == 1201


def test_character_max_templates_set_weapon_overrun_data() -> None:
    weapon_overrun_max_level_map = get_weapon_overrun_max_level_map()
    max_template_map = get_character_max_template_map()

    templates_with_overrun_weapons = [
        template
        for template in max_template_map.values()
        if template.get("weapon", {}).get("TemplateId") in weapon_overrun_max_level_map
    ]

    assert templates_with_overrun_weapons
    for template in templates_with_overrun_weapons:
        weapon = template["weapon"]
        overrun_data = weapon["WeaponOverrunData"]
        assert overrun_data["Level"] == weapon_overrun_max_level_map[weapon["TemplateId"]]
        if "ChoseSuit" in overrun_data:
            assert overrun_data["ChoseSuit"] > 0
            assert overrun_data["ActiveSuits"] == [overrun_data["ChoseSuit"]]
        else:
            assert "ActiveSuits" not in overrun_data


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_weapon_harmony_accumulates_all_max_level_skill_bonuses(language) -> None:
    token = resource_language.set(language)
    try:
        bonuses = get_weapon_overrun_character_max_level_skill_upgrade_map()
        assert bonuses[2526001] == {1531005: {1535210: 3, 1535170: 2}}
        assert bonuses[2606001] == {1031005: {1035210: 2, 1035170: 3}}
        assert 2016001 not in bonuses
    finally:
        resource_language.reset(token)


def test_max_harmony_supports_enhanced_skill_groups_and_weapon_character_matching(monkeypatch) -> None:
    monkeypatch.setattr(resources, "get_weapon_overrun_character_max_level_skill_upgrade_map", lambda: {
        100: {200: {300: 3}},
    })
    monkeypatch.setattr(resources, "get_character_skill_group_skill_ids_map", lambda: {})
    monkeypatch.setattr(resources, "get_character_enhance_skill_group_skill_ids_map", lambda: {300: [400, 401]})
    monkeypatch.setattr(resources, "get_character_enhance_skill_entries_map", lambda: {
        400: {"MaxLevel": 10}, 401: {"MaxLevel": 2}, 402: {"MaxLevel": 5},
    })
    character = {"EnhanceSkillList": [
        {"_id": 400, "Level": 10}, {"_id": 401, "Level": 2}, {"_id": 402, "Level": 5},
    ]}
    resources.apply_character_max_weapon_skill_upgrades(201, 100, character)
    resources.apply_character_max_weapon_skill_upgrades(200, 101, character)
    assert [entry["Level"] for entry in character["EnhanceSkillList"]] == [10, 2, 5]
    for _ in range(2):
        resources.apply_character_max_weapon_skill_upgrades(200, 100, character)
        assert [entry["Level"] for entry in character["EnhanceSkillList"]] == [7, 0, 5]
