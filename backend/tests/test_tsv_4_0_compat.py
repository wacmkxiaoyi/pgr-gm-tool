from backend.app.services.player.equips import (
    get_breakthrough_levelup_template_map,
    get_equip_breakthrough_level_limit_map,
    get_equip_resonance_map,
)
from backend.app.services.player.equips.weapon import get_weapon_skill_pool_entries_map
from backend.app.services.player.player_characters import (
    _parse_skill_level_id,
    get_character_enhance_skill_ids_map,
    get_character_skill_entries_map,
    get_character_skill_ids_map,
)
from backend.app.services.player.utils import extract_int_list


def test_extract_int_list_supports_4_0_array_and_slot_dict_columns() -> None:
    assert extract_int_list({"SkillId": [3, "4", "invalid"]}, ["SkillId"]) == [3, 4]
    assert extract_int_list({"PoolId": {"3": 9, 1: 5, "2": 8}}, ["PoolId"]) == [5, 8, 9]
    assert extract_int_list({"SkillId": [3, 3, 4]}, ["SkillId"], dedupe=True) == [3, 4]


def test_parse_4_0_character_skill_level_id() -> None:
    assert _parse_skill_level_id(10120135) == (101201, 35)
    assert _parse_skill_level_id("invalid") is None


def test_4_0_character_skill_maps_are_populated() -> None:
    character_skill_ids_map = get_character_skill_ids_map()
    character_skill_entries_map = get_character_skill_entries_map()

    assert character_skill_ids_map
    assert any(skill_ids for skill_ids in character_skill_ids_map.values())
    assert any(entry["MaxLevel"] > 0 for entry in character_skill_entries_map.values())
    assert get_character_enhance_skill_ids_map()


def test_4_0_equip_maps_include_initial_breakthrough_and_resonance_data() -> None:
    level_limit_map = get_equip_breakthrough_level_limit_map()
    levelup_template_map = get_breakthrough_levelup_template_map()
    resonance_map = get_equip_resonance_map()

    assert level_limit_map
    assert levelup_template_map
    assert all(0 in stage_map for stage_map in level_limit_map.values())
    assert all(0 in stage_map for stage_map in levelup_template_map.values())
    assert any(any(pool_ids for pool_ids in resonance_pools) for resonance_pools in resonance_map.values())


def test_4_0_weapon_skill_pool_map_is_populated() -> None:
    weapon_skill_pool_entries_map = get_weapon_skill_pool_entries_map()

    assert weapon_skill_pool_entries_map
    assert any(
        skill_ids
        for character_skill_ids_map in weapon_skill_pool_entries_map.values()
        for skill_ids in character_skill_ids_map.values()
    )

