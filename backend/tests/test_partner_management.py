import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import BSON

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_equips_service as module
from backend.app.services.player.equips.partner import get_partner_entries_map
from backend.app.utils.resource_language import resource_language


@pytest.fixture
def service(monkeypatch):
    token = resource_language.set("CN")

    class Collection:
        document = {"_id": "user", "uid": 42, "partners": []}

        def __init__(self):
            self.updates = []
            self.reads = []
            self.modified_count = 1

        async def find_one(self, query, projection):
            self.reads.append((query, projection))
            return copy.deepcopy(self.document)

        async def update_one(self, query, update):
            self.updates.append((query, update))
            return SimpleNamespace(modified_count=self.modified_count)

    collection = Collection()

    class Client:
        def __getitem__(self, key):
            return self if key == "test" else collection

        def close(self):
            pass

    monkeypatch.setattr(module, "create_mongo_client", lambda _: Client())
    instance = module.PlayerEquipsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    yield instance, collection
    resource_language.reset(token)


def test_add_partners_defaults_skills_and_preserves_existing_records(service):
    instance, collection = service
    old = {"_id": 7, "TemplateId": 16010000, "CharacterId": 1011002, "future_field": "keep"}
    collection.document["partners"] = [old]
    result = asyncio.run(instance.add_partners(42, [16010000, 16030000, 16010000]))
    assert result.added_count == 2
    query, update = collection.updates[0]
    assert query["uid"] == 42 and query["partners"] == [old]
    assert set(update) == {"$push"}
    assert set(update["$push"]) == {"partners"}
    rows = update["$push"]["partners"]["$each"]
    assert [row["_id"] for row in rows] == [8, 9]
    assert [row["Quality"] for row in rows] == [2, 3]
    for row in rows:
        assert row["Level"] == 1 and row["Exp"] == row["BreakThrough"] == row["CharacterId"] == 0
        assert row["StarSchedule"] == 0 and row["IsLock"] is False
        assert row["Name"] is None and row["CreateTime"] > 0
        assert len(row["SkillList"]) == 6
        assert row["SkillList"][0]["Type"] == 1 and row["SkillList"][0]["IsWear"] is True
        assert all(skill["Type"] == 2 and skill["IsWear"] is False for skill in row["SkillList"][1:])
        assert all(skill["Level"] == 1 for skill in row["SkillList"])
        assert len(row["UnlockSkillGroup"]) == 2
        assert BSON.encode(row).decode() == row
    assert rows[0]["SkillList"][0]["_id"] == 1012
    assert rows[0]["UnlockSkillGroup"] == [101, 102]
    assert collection.document["partners"] == [old]


def test_add_invalid_template_missing_document_and_write_conflict(service):
    instance, collection = service
    with pytest.raises(ValueError, match="partner.template_invalid"):
        asyncio.run(instance.add_partners(42, [16010000, -1]))
    assert not collection.updates
    collection.document = None
    with pytest.raises(ValueError, match="partner.data_missing"):
        asyncio.run(instance.add_partners(42, [16010000]))
    collection.document = {"_id": "user"}
    collection.modified_count = 0
    with pytest.raises(ValueError, match="partner.add_failed"):
        asyncio.run(instance.add_partners(42, [16010000]))
    assert collection.updates[0][0]["partners"] == {"$exists": False}


def test_list_search_sort_pagination_and_cap_formula(service, monkeypatch):
    instance, collection = service
    monkeypatch.setattr(module, "get_character_log_name_map", lambda: {1011002: "Test Carrier"})
    collection.document["partners"] = [
        {"_id": index, "TemplateId": 16010000 if index % 2 else 16030000,
         "CharacterId": 1011002 if index == 1 else 0, "Quality": 2 if index % 2 else 6,
         "Level": 30, "BreakThrough": 3}
        for index in range(1, 13)
    ]
    result = asyncio.run(instance.list_character_partners(42, sort_by="character"))
    assert result.total == 12 and result.total_pages == 2 and len(result.items) == 10
    assert result.items[0].record_id == 1
    assert all(item.EnhancementLevel == 80 for item in result.items)
    result = asyncio.run(instance.list_character_partners(42, page=2, sort_by="quality", sort_order="desc"))
    assert len(result.items) == 2 and all(item.Quality == 2 for item in result.items)
    result = asyncio.run(instance.list_character_partners(42, keyword="carrier"))
    assert [item.record_id for item in result.items] == [1]
    result = asyncio.run(instance.list_character_partners(42, keyword="眩晕"))
    assert result.total == 6 and all(item.TemplateId == 16010000 for item in result.items)
    assert collection.reads[0][0]["uid"] == 42
    assert collection.reads[0][1] == {"partners": 1}


def test_partner_list_stars_use_template_quality_cumulative_thresholds(service):
    instance, collection = service
    collection.document["partners"] = [
        {"_id": 1, "TemplateId": 16010000, "Quality": 4, "StarSchedule": 162},
        {"_id": 2, "TemplateId": 16010000, "Quality": 4, "StarSchedule": 90},
        {"_id": 3, "TemplateId": 16010000, "Quality": 3, "StarSchedule": 54},
        {"_id": 4, "TemplateId": 16030000, "Quality": 3, "StarSchedule": 54},
        {"_id": 5, "TemplateId": 16010000, "Quality": 6, "StarSchedule": 360},
        {"_id": 6, "TemplateId": 16010000, "Quality": 4, "StarSchedule": 161},
        {"_id": 7, "TemplateId": 16010000, "Quality": 2},
    ]
    result = asyncio.run(instance.list_character_partners(42))
    assert {item.record_id: item.Star for item in result.items} == {1: 4, 2: 0, 3: 2, 4: 4, 5: 0, 6: 3, 7: 0}


def test_delete_equipped_guard_and_scoped_atomic_pull(service):
    instance, collection = service
    collection.document["partners"] = [
        {"_id": 1, "TemplateId": 16010000, "CharacterId": 1011002},
        {"_id": 2, "TemplateId": 16010000, "CharacterId": 0},
    ]
    with pytest.raises(ValueError, match="partner.equipped_delete_forbidden"):
        asyncio.run(instance.delete_unequipped_partner(42, 1))
    assert not collection.updates
    assert asyncio.run(instance.delete_unequipped_partner(42, 999)) is False
    assert asyncio.run(instance.delete_unequipped_partner(42, 2)) is True
    query, update = collection.updates[0]
    assert query["uid"] == 42
    assert query["partners"]["$elemMatch"] == {"_id": 2, "CharacterId": {"$in": [0, None]}}
    assert update == {"$pull": {"partners": {"_id": 2, "CharacterId": {"$in": [0, None]}}}}


def test_clear_matches_search_and_excludes_equipped(service):
    instance, collection = service
    collection.document["partners"] = [
        {"_id": 1, "TemplateId": 16010000, "CharacterId": 1011002},
        {"_id": 2, "TemplateId": 16010000, "CharacterId": 0},
        {"_id": 3, "TemplateId": 16030000, "CharacterId": 0},
    ]
    result = asyncio.run(instance.clear_unequipped_partners_by_keyword(42, "眩晕"))
    assert result.deleted_count == 1
    query, update = collection.updates[0]
    assert query["partners"] == collection.document["partners"]
    assert query["uid"] == 42
    assert update == {"$pull": {"partners": {"_id": {"$in": [2]}, "CharacterId": {"$in": [0, None]}}}}
    result = asyncio.run(instance.clear_unequipped_partners_by_keyword(42, ""))
    assert result.deleted_count == 2
    collection.modified_count = 0
    assert asyncio.run(instance.clear_unequipped_partners_by_keyword(42, "")).deleted_count == 0


def test_all_catalog_defaults_can_be_materialized(service):
    instance, _ = service
    for template_id in get_partner_entries_map():
        record = instance._build_partner_document(template_id, 1)
        assert record["TemplateId"] == template_id and record["SkillList"]


def test_recommended_active_elements_and_authored_group_mapping(service, monkeypatch):
    from backend.app.services.player.equips import partner
    instance, _ = service
    assert partner.get_partner_entries_map()[16010000]["RecommendElement"] == [2]
    assert [row["skill_id"] for row in partner.get_partner_recommended_main_skill_entries_map()[16010000]] == [1012, 1022]
    assert [row["skill_id"] for row in partner.get_partner_recommended_main_skill_entries_map()[16060000]] == [1122, 1112]
    assert instance._build_partner_document(16060000, 1)["SkillList"][0]["_id"] == 1122
    # Multiple elements must retain every authored variant without ID arithmetic.
    original = partner.get_partner_entries_map()
    monkeypatch.setattr(partner, "get_partner_entries_map", lambda: {16010000: {**original[16010000], "RecommendElement": [1, 2, 3]}})
    assert [row["skill_id"] for row in partner.get_partner_recommended_main_skill_entries_map.__wrapped__()[16010000]] == [1011, 1021, 1012, 1022, 1013, 1023]


def test_quality_star_progress_and_passive_capacity(service):
    instance, _ = service
    record = instance._build_partner_document(16010000, 1)
    record = instance._edit_partner(record, "quality", {"quality": 6, "star": 0})
    assert record["StarSchedule"] == 360
    for skill in record["SkillList"][1:]:
        record = instance._edit_partner(record, "passive", {"skill_id": skill["_id"], "enabled": True})
    record = instance._edit_partner(record, "quality", {"quality": 3, "star": 5})
    assert record["StarSchedule"] == 90
    assert [skill["IsWear"] for skill in record["SkillList"][1:]] == [True, True, False, False, False]
    with pytest.raises(ValueError, match="partner.passive_limit"):
        instance._edit_partner(record, "passive", {"skill_id": 50020, "enabled": True})
    record = instance._edit_partner(record, "passive", {"skill_id": 50000, "enabled": False})
    assert not record["SkillList"][1]["IsWear"]
    assert instance._edit_partner(record, "quality", {"quality": 4, "star": 0})["StarSchedule"] == 90
    with pytest.raises(ValueError, match="partner.value_invalid"):
        instance._edit_partner(record, "quality", {"quality": 6, "star": 1})
    initial_s = instance._build_partner_document(16030000, 2)
    assert instance._edit_partner(initial_s, "quality", {"quality": 6, "star": 0})["StarSchedule"] == 330
    with pytest.raises(ValueError, match="partner.value_invalid"):
        instance._edit_partner(initial_s, "quality", {"quality": 2, "star": 0})


def test_active_switch_preserves_level_and_unlocks_group(service):
    instance, _ = service
    record = instance._build_partner_document(16010000, 1)
    record["UnlockSkillGroup"] = [101]
    record["SkillList"][0].update(Level=4, future="keep")
    result = instance._edit_partner(record, "main-skill", {"skill_id": 1022})
    assert result["SkillList"][0] == {"_id": 1022, "Type": 1, "IsWear": True, "Level": 4, "future": "keep"}
    assert result["UnlockSkillGroup"] == [101, 102]
    assert len(result["SkillList"]) == 6 and record["SkillList"][0]["_id"] == 1012
    with pytest.raises(ValueError, match="partner.skill_invalid"):
        instance._edit_partner(record, "main-skill", {"skill_id": 1021})
    with pytest.raises(ValueError, match="partner.skill_invalid"):
        instance._edit_partner(record, "main-skill", {"skill_id": 1032})
    result = instance._edit_partner(result, "skill-level", {"skill_id": 1022, "value": 5})
    detail = instance._partner_detail(result)
    assert detail["skills"][0]["Level"] == detail["skills"][0]["MaxLevel"] == 5
    assert "500%" in detail["skills"][0]["Desc"]
    with pytest.raises(ValueError, match="partner.value_invalid"):
        instance._edit_partner(result, "skill-level", {"skill_id": 1022, "value": 6})


def test_partner_enhancement_caps_and_exp_clamping(service):
    instance, _ = service
    record = instance._build_partner_document(16010000, 1)
    record = instance._edit_partner(record, "enhance", {"field": "breakthrough", "value": 3})
    record = instance._edit_partner(record, "enhance", {"field": "level", "value": 30})
    record = instance._edit_partner(record, "enhance", {"field": "exp", "value": 130})
    assert instance._partner_detail(record)["record"]["EnhancementLevel"] == 80
    for field, value in [("breakthrough", 4), ("level", 31), ("level", 0), ("exp", 131), ("exp", -1)]:
        with pytest.raises(ValueError):
            instance._edit_partner(record, "enhance", {"field": field, "value": value})
    lowered = instance._edit_partner(record, "enhance", {"field": "breakthrough", "value": 0})
    assert lowered["Level"] == 10
    assert lowered["Exp"] <= instance._partner_detail(lowered)["level_exp_map"][0][10]
    lowered = instance._edit_partner(lowered, "enhance", {"field": "level", "value": 1})
    threshold = instance._partner_detail(lowered)["level_exp_map"][0][1]
    with pytest.raises(ValueError, match="equips.exp_above_limit"):
        instance._edit_partner(lowered, "enhance", {"field": "exp", "value": threshold})


def test_detail_atomic_target_updates_unknown_fields_noop_and_conflict(service):
    instance, collection = service
    record = instance._build_partner_document(16010000, 7)
    record["SkillList"][0]["future"] = "keep"
    collection.document["partners"] = [{"_id": 6, "future": "untouched"}, record]
    response = asyncio.run(instance.partner_detail(42, 7, "skill-level", {"skill_id": 1012, "value": 3}))
    assert response["skills"][0]["Level"] == 3
    query, update = collection.updates[-1]
    assert query["partners"] == collection.document["partners"] and query["uid"] == 42
    assert set(update["$set"]) == {"partners.1.SkillList"}
    assert update["$set"]["partners.1.SkillList"][0]["future"] == "keep"
    assert BSON.encode(update).decode() == update
    collection.updates.clear()
    asyncio.run(instance.partner_detail(42, 7, "skill-level", {"skill_id": 1012, "value": 1}))
    assert not collection.updates
    collection.modified_count = 0
    with pytest.raises(ValueError, match="partner.conflict"):
        asyncio.run(instance.partner_detail(42, 7, "quality", {"quality": 6, "star": 0}))
    with pytest.raises(ValueError, match="partner.not_found"):
        asyncio.run(instance.partner_detail(42, 99))


def test_character_partner_candidates_swap_transfer_and_noop(service):
    instance, collection = service
    collection.document["characters"] = [{"_id": 1011002}, {"_id": 1021001}]
    collection.document["partners"] = [
        {"_id": i, "TemplateId": 16010000, "CharacterId": 1011002 if i == 1 else 1021001 if i == 2 else 0,
         "Quality": 4, "StarSchedule": 162, "Level": 30, "BreakThrough": 3, "future": {"keep": True}}
        for i in range(1, 13)
    ]
    original = copy.deepcopy(collection.document)
    result = asyncio.run(instance.character_partners(42, 1011002))
    assert len(result["items"]) == 12 and result["current_partner"].record_id == 1
    assert all(item.Star == 4 and item.EnhancementLevel == 80 for item in result["items"])
    asyncio.run(instance.character_partners(42, 1011002, 1))
    assert not collection.updates
    result = asyncio.run(instance.character_partners(42, 1011002, 2))
    assert result["current_partner"].CharacterId == 1011002
    query, update = collection.updates[-1]
    assert query["uid"] == 42 and query["partners"] == original["partners"] and query["characters"] == original["characters"]
    assert update == {"$set": {"partners.0.CharacterId": 1021001, "partners.1.CharacterId": 1011002}}
    assert collection.document == original
    asyncio.run(instance.character_partners(42, 1011002, 3))
    assert collection.updates[-1][1] == {"$set": {"partners.0.CharacterId": 0, "partners.2.CharacterId": 1011002}}
    collection.document["partners"][0]["CharacterId"] = 0
    asyncio.run(instance.character_partners(42, 1011002, 2))
    assert collection.updates[-1][1] == {"$set": {"partners.1.CharacterId": 1011002}}
    assert BSON.encode(collection.updates[-1][1]).decode() == collection.updates[-1][1]


def test_character_partner_conflicts_and_missing_records(service):
    instance, collection = service
    collection.document["characters"] = [{"_id": 1011002}, {"_id": 1021001}]
    collection.document["partners"] = [{"_id": 1, "TemplateId": 16010000, "CharacterId": 0}]
    for character_id, partner_id, code in [(999, 1, "character.not_found"), (1011002, 999, "partner.not_found")]:
        with pytest.raises(ValueError, match=code):
            asyncio.run(instance.character_partners(42, character_id, partner_id))
    collection.modified_count = 0
    with pytest.raises(ValueError, match="partner.conflict"):
        asyncio.run(instance.character_partners(42, 1011002, 1))
    collection.document["partners"].append(copy.deepcopy(collection.document["partners"][0]))
    with pytest.raises(ValueError, match="partner.conflict"):
        asyncio.run(instance.character_partners(42, 1011002, 1))
    collection.document["partners"] = [
        {"_id": i, "TemplateId": 16010000, "CharacterId": 1021001} for i in (1, 2)]
    with pytest.raises(ValueError, match="partner.conflict"):
        asyncio.run(instance.character_partners(42, 1011002, 1))


def test_partner_routes_selection_validation_errors_and_response_models(service, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from backend.app import apis
    from backend.app.config import Settings
    from backend.app.services import init_app

    instance, collection = service
    session = SimpleNamespace(selected_account_uid=42)
    monkeypatch.setattr(apis, "_get_active_session", lambda _: session)
    monkeypatch.setattr(apis, "get_database_health_snapshot", lambda _: {})
    monkeypatch.setattr(apis, "is_database_snapshot_healthy", lambda _: True)

    class Accounts:
        async def account_exists(self, uid):
            return uid == 42

    app = FastAPI()
    init_app(app, Settings({"ENABLE_SERVER_MANAGEMENT": "false"}))
    app.state.settings = SimpleNamespace()
    app.state.player_equips_service = instance
    app.state.database_accounts_service = Accounts()
    client = TestClient(app)
    collection.document["partners"] = [instance._build_partner_document(16010000, 1)]
    collection.document["characters"] = [{"_id": 1011002}]
    candidates = client.get("/api/database-characters/selected/1011002/partner-candidates")
    assert candidates.status_code == 200 and candidates.json()["current_partner"] is None
    assert candidates.json()["items"][0]["record_id"] == 1
    response = client.put("/api/database-characters/selected/1011002/partner", json={"PartnerRecordId": 1})
    assert response.status_code == 200 and response.json()["current_partner"]["CharacterId"] == 1011002
    for value in (True, "1", 1.5, 0, -1):
        assert client.put("/api/database-characters/selected/1011002/partner", json={"PartnerRecordId": value}).status_code == 422
    assert client.put("/api/database-characters/selected/1011002/partner", json={"PartnerRecordId": 999}).status_code == 404
    assert client.get("/api/database-characters/selected/999/partner-candidates").status_code == 404
    collection.modified_count = 0
    assert client.put("/api/database-characters/selected/1011002/partner", json={"PartnerRecordId": 1}).status_code == 409
    collection.modified_count = 1
    detail_response = client.get("/api/database-partners/selected/1/extra-info", headers={"Accept-Language": "zh-CN"})
    assert detail_response.status_code == 200 and detail_response.json()["skills"][0]["skill_id"] == 1012
    for action, data in [("quality", {"quality": 6, "star": 0}),
                         ("enhance", {"field": "breakthrough", "value": 3}),
                         ("main-skill", {"skill_id": 1022}),
                         ("skill-level", {"skill_id": 50000, "value": 5}),
                         ("passive", {"skill_id": 50000, "enabled": True})]:
        response = client.put(f"/api/database-partners/selected/1/{action}", json=data, headers={"Accept-Language": "zh-CN"})
        assert response.status_code == 200, response.text
    assert client.put("/api/database-partners/selected/1/enhance", json={"value": 1}).status_code == 422
    assert client.put("/api/database-partners/selected/1/enhance", json={"field": "level", "value": 1.5}).status_code == 422
    assert client.put("/api/database-partners/selected/1/main-skill", json={"skill_id": 1021}).status_code == 422
    assert client.get("/api/database-partners/selected/999/extra-info").status_code == 404
    collection.document["partners"] = []
    assert client.get("/api/database-partners/selected").json()["total"] == 0
    assert client.get("/api/database-partners/selected?sort_by=invalid").status_code == 422
    assert client.post("/api/database-partners/selected", json={"template_ids": []}).status_code == 422
    response = client.post("/api/database-partners/selected", json={"template_ids": [16010000, 16030000]})
    assert response.status_code == 200 and response.json() == {"added": True, "added_count": 2}
    response = client.post("/api/database-partners/selected", json={"template_ids": [-1]})
    assert response.status_code == 422 and response.json()["code"] == "partner.template_invalid"
    collection.document["partners"] = [{"_id": 1, "TemplateId": 16010000, "CharacterId": 1011002}]
    response = client.delete("/api/database-partners/selected/1")
    assert response.status_code == 409 and response.json()["code"] == "partner.equipped_delete_forbidden"
    assert client.delete("/api/database-partners/selected/99").status_code == 404
    response = client.request("DELETE", "/api/database-partners/selected", json={"keyword": ""})
    assert response.status_code == 200 and response.json()["deleted_count"] == 0
    session.selected_account_uid = None
    assert client.get("/api/database-characters/selected/1011002/partner-candidates").status_code == 409
    assert client.get("/api/database-partners/selected").status_code == 409
    monkeypatch.setattr(apis, "is_database_snapshot_healthy", lambda _: False)
    assert client.put("/api/database-characters/selected/1011002/partner", json={"PartnerRecordId": 1}).status_code == 409
    assert client.post("/api/database-partners/selected", json={"template_ids": [16010000]}).status_code == 409
