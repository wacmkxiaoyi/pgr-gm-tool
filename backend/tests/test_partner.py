import pytest

from backend.app.services.player.equips import partner
from backend.app.utils.resource_language import resource_language
from backend.app.utils.tsv_reader import TSVReader


@pytest.fixture(autouse=True)
def clear_partner_caches():
    def clear():
        for name in dir(partner):
            function = getattr(partner, name)
            if name.startswith("get_partner_") and hasattr(function, "cache_clear"):
                function.cache_clear()

    clear()
    yield
    clear()


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_max_save_templates_use_defined_caps_and_recommended_skills(language):
    token = resource_language.set(language)
    try:
        for partner_id, target in partner.get_partner_max_template_map().items():
            template = partner.build_partner_max_save_template(partner_id)
            assert template is not None
            assert template["Quality"] == target["Quality"]
            assert template["StarSchedule"] == partner.get_partner_star_schedule_options_map()[partner_id][target["Quality"]][-1]
            assert template["BreakThrough"] == target["Breakthrough"]
            assert template["Level"] == target["Level"] and template["Exp"] == target["Exp"]
            active, *passive = template["SkillList"]
            recommended = partner.get_partner_recommended_main_skill_entries_map()[partner_id]
            config = partner.get_partner_skill_config_map()[partner_id]
            expected = next((row for row in recommended if row["skill_group_id"] == config["DefaultMainSkillGroupId"]), recommended[0])
            assert active["_id"] == expected["skill_id"] and active["IsWear"] is True
            assert {row["_id"]: row["Level"] for row in passive} == target["PassiveSkill"]
            assert sum(row["IsWear"] for row in passive) == min(len(passive), partner.get_partner_quality_entries_map()[partner_id][target["Quality"]]["SkillColumnCount"])
            assert all(row["Level"] == partner.get_partner_skill_max_level_map()[row["_id"]] for row in template["SkillList"])
            assert template["UnlockSkillGroup"] == config["MainSkillGroupId"]
            assert "CharacterId" not in template and "_id" not in template
        assert partner.build_partner_max_save_template(-1) is None
    finally:
        resource_language.reset(token)


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_real_partner_table_links_and_max_targets(language):
    token = resource_language.set(language)
    try:
        entries = partner.get_partner_entries_map()
        limits = partner.get_partner_breakthrough_level_limit_map()
        template_ids = partner.get_partner_breakthrough_levelup_template_map()
        level_exp = partner.get_partner_level_exp_map()
        max_levels = partner.get_partner_skill_max_level_map()
        skills = partner.get_partner_skill_level_entries_map()
        configs = partner.get_partner_skill_config_map()
        main_groups = partner.get_partner_main_skill_group_entries_map()
        elements = partner.get_partner_main_skill_group_element_skill_ids_map()
        qualities = partner.get_partner_quality_entries_map()
        bounds = partner.get_partner_quality_bound_map()
        targets = partner.get_partner_max_template_map()

        assert entries
        assert set(entries) == set(limits) == set(configs) == set(qualities) == set(targets)
        assert partner.get_partner_name_map()[16010000] == entries[16010000]["Name"]
        assert partner.get_partner_descriptions_map()[16010000] == entries[16010000]["Desc"]
        assert partner.get_partner_icon_url_map()[16010000] == \
            "/assets/image/rolepartner/rolepartnerpet2niu2.webp"
        assert limits[16010000] == {0: 10, 1: 15, 2: 25, 3: 30}
        assert template_ids[16010000] == {0: 501, 1: 502, 2: 503, 3: 504}

        for partner_id, entry in entries.items():
            assert bounds[partner_id][0] == entry["InitQuality"]
            assert bounds[partner_id] == [min(qualities[partner_id]), max(qualities[partner_id])]
            for times, limit in limits[partner_id].items():
                template = TSVReader(f"assets/leveluptemplate/{template_ids[partner_id][times]}.tsv", typed=True)
                expected = {row["Level"]: row["Exp"] for row in template.data if 1 <= row["Level"] <= limit}
                assert level_exp[partner_id][times] == expected
                assert max(level_exp[partner_id][times]) == limit

            config = configs[partner_id]
            assert config["DefaultMainSkillGroupId"] in config["MainSkillGroupId"]
            assert all(group_id in main_groups for group_id in config["MainSkillGroupId"])
            for kind, groups, ids in (
                ("MainSkill", partner.get_partner_main_skill_groups_map(), partner.get_partner_main_skill_ids_map()),
                ("PassiveSkill", partner.get_partner_passive_skill_groups_map(), partner.get_partner_passive_skill_ids_map()),
            ):
                assert all(groups[partner_id])
                assert ids[partner_id] == list(dict.fromkeys(skill_id for group in groups[partner_id] for skill_id in group))
                assert targets[partner_id][kind] == {skill_id: max(skills[skill_id]) for skill_id in ids[partner_id]}

            times = max(limits[partner_id])
            assert targets[partner_id]["Breakthrough"] == times
            assert targets[partner_id]["Level"] == limits[partner_id][times]
            assert targets[partner_id]["Exp"] == level_exp[partner_id][times][limits[partner_id][times]]
            assert targets[partner_id]["Quality"] == max(qualities[partner_id])

        for group_id, row in main_groups.items():
            assert len(row["SkillId"]) == len(row["Element"])
            assert elements[group_id] == dict(zip(row["Element"], row["SkillId"]))
        assert max_levels == {skill_id: max(levels) for skill_id, levels in skills.items()}
        assert skills[1011][1]["Desc"] != skills[1011][5]["Desc"]
        assert partner.get_partner_skill_entries_map()[1011] == {**skills[1011][1], "MaxLevel": 5}
        assert targets[16010000]["Level"] == 30
        assert targets[16010000]["Exp"] == 130
    finally:
        resource_language.reset(token)


def test_partner_caches_are_language_partitioned():
    token = resource_language.set("CN")
    try:
        cn = partner.get_partner_entries_map()
        cn_skills = partner.get_partner_skill_level_entries_map()
        assert partner.get_partner_entries_map() is cn
        resource_language.set("EN")
        en = partner.get_partner_entries_map()
        en_skills = partner.get_partner_skill_level_entries_map()
        assert en is not cn
        assert en[16010000]["Name"] != cn[16010000]["Name"]
        assert en_skills[1011][1]["Name"] != cn_skills[1011][1]["Name"]
        resource_language.set("CN")
        assert partner.get_partner_entries_map() is cn
        assert partner.get_partner_skill_level_entries_map() is cn_skills
    finally:
        resource_language.reset(token)


def test_skill_levels_use_explicit_columns_and_handle_unordered_rows(monkeypatch):
    class Reader:
        def __init__(self, path, typed):
            assert typed is True

        def select(self, columns):
            return [
                {"SkillId": 7, "Level": 9, "Name": "Max", "Desc": "Nine", "Icon": ""},
                {"SkillId": 7, "Level": 2, "Name": "Base", "Desc": "Two", "Icon": ""},
                {"SkillId": "invalid", "Level": 99},
                {"SkillId": 8, "Level": "invalid"},
            ]

    monkeypatch.setattr(partner, "TSVReader", Reader)
    assert partner.get_partner_skill_max_level_map() == {7: 9}
    assert partner.get_partner_skill_entries_map() == {
        7: {"Name": "Base", "Desc": "Two", "Icon": "", "MaxLevel": 9},
    }


def test_incomplete_stage_and_skill_data_do_not_produce_max_target(monkeypatch):
    monkeypatch.setattr(partner, "get_partner_entries_map", lambda: {1: {"Name": "Test"}})
    monkeypatch.setattr(partner, "get_partner_breakthrough_entries_map", lambda: {
        1: {0: {"LevelLimit": 2, "LevelUpTemplateId": 501}},
    })
    monkeypatch.setattr(partner, "get_level_exp_map", lambda template_id: {1: 10, 3: 30})
    monkeypatch.setattr(partner, "get_partner_quality_bound_map", lambda: {1: [2, 6]})
    monkeypatch.setattr(partner, "get_partner_skill_config_map", lambda: {
        1: {"MainSkillGroupId": [101], "PassiveSkillGroupId": [5000]},
    })
    monkeypatch.setattr(partner, "get_partner_main_skill_group_skill_ids_map", lambda: {101: [7]})
    monkeypatch.setattr(partner, "get_partner_passive_skill_group_skill_ids_map", lambda: {5000: [8]})
    monkeypatch.setattr(partner, "get_partner_skill_max_level_map", lambda: {7: 5})
    assert partner.get_partner_level_exp_map() == {1: {0: {1: 10}}}
    assert partner.get_partner_breakthrough_max_level_exp_map() == {1: {}}
    assert partner.get_partner_max_template_map() == {}

    partner.get_partner_level_exp_map.cache_clear()
    partner.get_partner_breakthrough_max_level_exp_map.cache_clear()
    partner.get_partner_max_template_map.cache_clear()
    monkeypatch.setattr(partner, "get_level_exp_map", lambda template_id: {1: 10, 2: 20, 3: 30})
    assert partner.get_partner_breakthrough_max_level_exp_map() == {1: {0: {"Level": 2, "Exp": 20}}}
    assert partner.get_partner_max_template_map() == {}
