import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import BSON

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_characters as resources
from backend.app.services.player import player_characters_service as module
from backend.app.services.player.equips.partner import build_partner_max_save_template
from backend.app.utils.resource_language import resource_language


class Collection:
    def __init__(self, document):
        self.document = document
        self.updates = []
        self.projections = []

    async def find_one(self, query, projection):
        self.projections.append(projection)
        return copy.deepcopy(self.document)

    async def update_one(self, query, update):
        self.updates.append(update)
        self.document.update(copy.deepcopy(update["$set"]))
        return SimpleNamespace(matched_count=1, modified_count=1)


@pytest.mark.parametrize("language", ["CN", "EN"])
@pytest.mark.parametrize("bulk", [False, True])
def test_max_partner_reuses_and_preserves_ownership_and_forward_fields(monkeypatch, language, bulk):
    token = resource_language.set(language)
    try:
        character_ids = [1011002, 1021001] if bulk else [1011002]
        templates = {cid: copy.deepcopy(resources.get_character_max_template_map()[cid]) for cid in character_ids}
        for template in templates.values():
            template["partner"] = build_partner_max_save_template(16010000)
        target = templates[1011002]["partner"]
        skill_id = target["SkillList"][0]["_id"]
        existing = [
            {"_id": 7, "TemplateId": 16010000, "CharacterId": 1011002, "CreateTime": 123,
             "future": "keep", "SkillList": [{"_id": skill_id, "Level": 1, "future_skill": True}]},
            {"_id": 8, "TemplateId": 16030000, "CharacterId": 1011002, "future": "old"},
            {"_id": 9, "TemplateId": 16010000, "CharacterId": 9999999, "future": "other"},
            {"_id": 10, "TemplateId": 16010000, "CharacterId": 0, "future": "spare"},
        ]
        chars = Collection({"characters": [{"_id": cid} for cid in character_ids], "partners": existing,
                            "fashions": [], "equips": [], "weaponFashions": []})
        protected_state = {
            "mission_progress": {"condition_counters": [{"k": 25001001, "v": 1234567}]},
            "pending_partner_decompose": {"ClaimKey": "keep", "PartnerIds": [9]},
            "partner_decompose_completions": [{"ClaimKey": "completed"}],
            "pending_purchase": {"Key": "purchase"},
            "pending_recharge": {"Key": "recharge"},
        }
        players = Collection({"gather_rewards": [], **copy.deepcopy(protected_state)})

        class Client:
            def __getitem__(self, name):
                return self if name == "test" else chars if name == "characters" else players

            def close(self):
                pass

        monkeypatch.setattr(module, "create_mongo_client", lambda _: Client())
        monkeypatch.setattr(module, "get_character_max_template_map", lambda: templates)
        service = module.PlayerCharactersService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
        for _ in range(2):
            asyncio.run(service.max_all_characters(42) if bulk else service.max_character(42, 1011002))
            rows = chars.document["partners"]
            assert len(rows) == 4
            by_id = {row["_id"]: row for row in rows}
            assert by_id[7]["CharacterId"] == 1011002 and by_id[7]["CreateTime"] == 123
            assert by_id[7]["future"] == "keep" and by_id[7]["SkillList"][0]["future_skill"] is True
            assert by_id[8]["CharacterId"] == 0 and by_id[8]["future"] == "old"
            assert by_id[9]["CharacterId"] == 9999999 and by_id[9]["future"] == "other"
            if bulk:
                assert by_id[10]["CharacterId"] == 1021001 and by_id[10]["future"] == "spare"
                assert by_id[10]["SkillList"] is not by_id[7]["SkillList"]
            else:
                assert by_id[10]["CharacterId"] == 0
            for key in ("Quality", "StarSchedule", "Level", "Exp", "BreakThrough", "UnlockSkillGroup"):
                assert by_id[7][key] == target[key]
            assert BSON.encode(chars.updates[-1]).decode() == chars.updates[-1]
            assert {key: players.document[key] for key in protected_state} == protected_state
            assert set(players.updates[-1]['$set']) == {'gather_rewards'}
        assert all(projection["partners"] == 1 for projection in chars.projections)
    finally:
        resource_language.reset(token)


def test_apply_max_partner_creates_unique_instances_and_zero_recommendation_preserves():
    service = module.PlayerCharactersService(SimpleNamespace(), DatabaseSchemaRuntime())
    template = {"partner": build_partner_max_save_template(16010000)}
    original = copy.deepcopy(template)
    rows = [{"_id": 99, "TemplateId": 16030000, "CharacterId": 123, "future": True}]
    service._apply_max_partner_template(rows, 123, template)
    service._apply_max_partner_template(rows, 456, template)
    assert [row["_id"] for row in rows] == [99, 100, 101]
    assert [row["CharacterId"] for row in rows] == [0, 123, 456]
    assert rows[1]["CreateTime"] > 0 and rows[2]["CreateTime"] > 0
    assert rows[1]["SkillList"] is not rows[2]["SkillList"]
    service._apply_max_partner_template(rows, 123, template)
    assert len(rows) == 3 and template == original
    before = copy.deepcopy(rows)
    service._apply_max_partner_template(rows, 123, {"partner": None})
    assert rows == before
