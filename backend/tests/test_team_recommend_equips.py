import json
from collections import Counter

import pytest

from backend.app.services.player import player_characters as characters
from backend.app.services.player.constants import FIXED_CHARACTER_MAX_MEMORY_RESONANCES
from backend.app.config import Settings
from backend.app.utils import resource_language as resources
from backend.app.utils.tsv_reader import TSVReader


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_real_recommendations_use_first_target_for_two_and_multiple_options(language):
    token = resources.resource_language.set(language)
    try:
        targets = TSVReader("assets/TeamRecommendCharacterTarget.tsv", typed=True).get_maps("CharacterId", "BaseCharacterIds")[0]
        bases = TSVReader("assets/TeamRecommendBaseCharacter.tsv", typed=True).get_sub_table("Id", ["WeaponId", "EquipIds", "PartnerId", "WeaponOverrunChoseSuit"])
        recommendations = characters.get_character_recommend_equips_map()
        assert len(targets[1011002]) == 2
        assert len(targets[1321003]) > 2
        for character_id, base_ids in targets.items():
            result = recommendations[character_id]
            source = bases[base_ids[0]]
            assert result["BaseCharacterId"] == base_ids[0]
            assert result["WeaponId"] == source["WeaponId"]
            assert result["Memories"] == source["EquipIds"]
            assert result["PartnerId"] == source["PartnerId"]
            assert result["WeaponOverrunChoseSuit"] == (source["WeaponOverrunChoseSuit"] or 0)
    finally:
        resources.resource_language.reset(token)


def test_slots_pool_resolution_and_invalid_first_target(tmp_path, monkeypatch):
    monkeypatch.setattr(resources, "BACKEND_DIR", tmp_path)
    directory = tmp_path / "assets" / "EN"
    directory.mkdir(parents=True)
    (directory / "TeamRecommendCharacterTarget.tsv").write_text(
        'CharacterId\tBaseCharacterIds\n10\t[1,2,3]\n20\t[999,2]\n30\t[2]\n40\t[]\n', encoding="utf-8",
    )
    columns = ["Id", "CharacterId", "WeaponId", "WeaponResonanceTypes", "WeaponResonanceSkillIds",
               "EquipIds", "EquipResonanceTypes", "EquipSkillIds", "PartnerId", "WeaponOverrunChoseSuit"]
    rows = [
        [1, 10, 200, [3, 0, 3], [101, 0, 500], list(range(301, 307)), [1, 2] * 6,
         [8, 99, 5, 100, 8, 99, 5, 100, 8, 99, 5, 100], 123, 1604],
        [2, 20, 201, [], [], [], [], [], 0, 0],
    ]
    # JSON array cells have no quotes here, so TSVReader can parse them directly.
    (directory / "TeamRecommendBaseCharacter.tsv").write_text(
        "\t".join(columns) + "\n" + "\n".join("\t".join(json.dumps(value) for value in row) for row in rows),
        encoding="utf-8",
    )
    (directory / "CharacterSkillPool.tsv").write_text("Id\tSkillId\n99\t123456\n", encoding="utf-8")
    characters.get_character_recommend_equips_map.cache_clear()
    try:
        result = characters.get_character_recommend_equips_map()
        assert set(result) == {10}
        assert result[10]["WeaponResonances"] == [
            {"Type": 3, "TemplateId": 101}, {"Type": 0, "TemplateId": 0}, {"Type": 3, "TemplateId": 500},
        ]
        assert [entry["TemplateId"] for entry in result[10]["MemoryResonances"][0]] == [8, 5, 8, 5, 8, 5]
        assert [entry["TemplateId"] for entry in result[10]["MemoryResonances"][1]] == [123456, 100] * 3
    finally:
        characters.get_character_recommend_equips_map.cache_clear()


@pytest.mark.parametrize("language", ["CN", "EN"])
@pytest.mark.parametrize("fixed", [True, False])
@pytest.mark.parametrize("recommended_harmony", [True, False])
def test_max_template_preserves_independent_resonance_and_harmony_settings(monkeypatch, language, fixed, recommended_harmony):
    token = resources.resource_language.set(language)
    monkeypatch.setattr(characters.settings, "max_character_use_fix_memory_resonance", fixed)
    monkeypatch.setattr(characters.settings, "max_character_use_recommend_harmony", recommended_harmony)
    characters.get_character_max_template_map.cache_clear()
    try:
        # This character's recommended Harmony suit differs from automatic selection.
        character_id = 1401003
        recommendation = characters.get_character_recommend_equips_map()[character_id]
        template = characters.get_character_max_template_map()[character_id]
        assert template["weapon"]["TemplateId"] == recommendation["WeaponId"]
        assert [memory["TemplateId"] for memory in template["memories"]] == recommendation["Memories"]
        resonance_source = FIXED_CHARACTER_MAX_MEMORY_RESONANCES if fixed else recommendation["MemoryResonances"]
        for site, memory in enumerate(template["memories"]):
            assert memory["ResonanceInfo"] == [
                {**entries[site % len(entries)], "Slot": slot + 1, "CharacterId": character_id}
                for slot, entries in enumerate(resonance_source)
            ]
        automatic_suit = characters._choose_weapon_overrun_suit(recommendation["Memories"])
        assert recommendation["WeaponOverrunChoseSuit"] != automatic_suit
        expected_suit = recommendation["WeaponOverrunChoseSuit"] if recommended_harmony else automatic_suit
        assert template["weapon"]["WeaponOverrunData"]["ChoseSuit"] == expected_suit
        assert template["weapon"]["WeaponOverrunData"]["ActiveSuits"] == [expected_suit]
        assert template["partner"]["TemplateId"] == recommendation["PartnerId"]
        assert template["partner"]["Quality"] == 6
    finally:
        characters.get_character_max_template_map.cache_clear()
        resources.resource_language.reset(token)


def test_zero_recommended_harmony_does_not_fall_back_to_automatic(monkeypatch):
    recommendation = dict(characters.get_character_recommend_equips_map()[1031005], WeaponOverrunChoseSuit=0)
    monkeypatch.setattr(characters, "get_character_recommend_equips_map", lambda: {1031005: recommendation})
    monkeypatch.setattr(characters.settings, "max_character_use_recommend_harmony", True)
    characters.get_character_max_template_map.cache_clear()
    try:
        assert characters._choose_weapon_overrun_suit(recommendation["Memories"]) is not None
        overrun = characters.get_character_max_template_map()[1031005]["weapon"]["WeaponOverrunData"]
        assert "Level" in overrun
        assert "ChoseSuit" not in overrun
        assert "ActiveSuits" not in overrun
    finally:
        characters.get_character_max_template_map.cache_clear()


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_max_template_local_hash_resolves_shared_rules_once(monkeypatch, language):
    token = resources.resource_language.set(language)
    original_equip = characters._resolve_equip_max_level_exp
    original_partner = characters.build_partner_max_save_template
    equip_calls, partner_calls = Counter(), Counter()

    def equip(template_id, breakthrough):
        equip_calls[template_id] += 1
        return original_equip(template_id, breakthrough)

    def partner(template_id):
        partner_calls[template_id] += 1
        return original_partner(template_id)

    monkeypatch.setattr(characters, "_resolve_equip_max_level_exp", equip)
    monkeypatch.setattr(characters, "build_partner_max_save_template", partner)
    characters.get_character_max_template_map.cache_clear()
    try:
        templates = characters.get_character_max_template_map()
        assert templates and equip_calls and partner_calls
        assert set(equip_calls.values()) == {1}
        assert set(partner_calls.values()) == {1}
        same_partner = {}
        same_equip = {}
        for character_id, template in templates.items():
            for item in [template["weapon"], *template["memories"]]:
                assert item["CharacterId"] == character_id
                assert all(row["CharacterId"] == character_id for row in item["ResonanceInfo"])
                previous = same_equip.setdefault(item["TemplateId"], item)
                if previous is not item:
                    assert previous["ResonanceInfo"] is not item["ResonanceInfo"]
            item = template["partner"]
            if item:
                previous = same_partner.setdefault(item["TemplateId"], item)
                if previous is not item:
                    assert previous is not item and previous["SkillList"] is not item["SkillList"]
                    assert previous["SkillList"][0] is not item["SkillList"][0]
        before = (dict(equip_calls), dict(partner_calls))
        assert characters.get_character_max_template_map() is templates
        assert (dict(equip_calls), dict(partner_calls)) == before
    finally:
        characters.get_character_max_template_map.cache_clear()
        resources.resource_language.reset(token)


def test_harmony_setting_defaults_to_recommended_and_supports_env_and_cli(monkeypatch):
    monkeypatch.delenv("MAX_CHARACTER_USE_RECOMMEND_HARMONY", raising=False)
    assert Settings(discover_launcher=False).max_character_use_recommend_harmony is True
    monkeypatch.setenv("MAX_CHARACTER_USE_RECOMMEND_HARMONY", "false")
    assert Settings(discover_launcher=False).max_character_use_recommend_harmony is False
    assert Settings({"MAX_CHARACTER_USE_RECOMMEND_HARMONY": "true"}, discover_launcher=False).max_character_use_recommend_harmony is True
