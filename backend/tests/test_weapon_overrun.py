import json

from backend.app.services.player.equips.weapon import (
    _normalize_weapon_overrun_skill_description,
    get_weapon_overrun_max_level_map,
    get_weapon_overrun_suit_entries_map,
    get_weapon_overrun_suit_memory_ids_map,
)
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


def test_4_7_weapon_overrun_skill_description_uses_piece_map() -> None:
    description = _normalize_weapon_overrun_skill_description([
        "",
        "Two-piece effect",
        "",
        "Four-piece effect",
    ])

    assert json.loads(description) == {
        "2": "Two-piece effect",
        "4": "Four-piece effect",
    }


def test_weapon_overrun_suit_entries_expose_parseable_descriptions() -> None:
    entries = get_weapon_overrun_suit_entries_map()

    assert entries
    assert any(
        json.loads(entry["SkillDescription"])
        for entry in entries.values()
        if entry["SkillDescription"].startswith("{")
    )


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
        assert overrun_data["ActiveSuits"] == [overrun_data["ChoseSuit"]]
