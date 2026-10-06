import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import BSON, Binary
from bson.int64 import Int64

from backend.app.services import database_accounts
from backend.app.services.database_accounts import DatabaseAccountsService
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_characters as resources
from backend.app.services.player import player_characters_service, player_equips_service, player_items_service
from backend.app.services.player.player_characters_service import PlayerCharactersService
from backend.app.services.player.player_equips_service import PlayerEquipsService
from backend.app.services.player.player_items_service import PlayerItemsService
from backend.app.services.player.resource_validation import get_resource_issues
from backend.app.services.player.equips.weapon import get_weapon_overrun_character_max_level_skill_upgrade_map
from backend.app.utils.resource_language import resource_language


class Collection:
    def __init__(self, document=None):
        self.document = document
        self.updates = []
        self.deletes = []

    async def find_one(self, *args, **kwargs):
        return copy.deepcopy(self.document)

    async def update_one(self, query, update, **kwargs):
        self.updates.append((query, update, kwargs))
        return SimpleNamespace(matched_count=1, modified_count=1)

    async def delete_many(self, query):
        self.deletes.append(query)
        return SimpleNamespace(deleted_count=1)


class Client:
    def __init__(self, collections):
        self.collections = collections

    def __getitem__(self, name):
        return self if name == "test" else self.collections[name]

    def close(self):
        pass


def test_pending_draw_bson_roundtrip_preserves_binary_receipts_and_forward_fields():
    schema = DatabaseSchemaRuntime().get_collection_schema("players")
    state = {
        "pending_free_draw": {
            "ClientDrawInfo": Binary(b"\x00\xff\x81"),
            "OccurredAt": Int64(1_900_000_000),
            "ClaimKey": "draw:42:7",
            "Costs": [{"k": 2, "v": 250}],
            "Goods": [{"_id": 1, "TemplateId": 1411003, "Count": 1}],
            "server_future": {"nonce": 99},
        },
        "free_ticket_reward_claims": ["ticket:42:7"],
        "last_draw_progress_claim": "draw:42:6",
    }
    normalized = schema.materialize_subpath("draw_state", state)
    decoded = BSON.encode(normalized).decode()
    pending = decoded["pending_free_draw"]
    assert bytes(pending["ClientDrawInfo"]) == b"\x00\xff\x81"
    assert isinstance(pending["OccurredAt"], Int64)
    assert pending["Costs"] == state["pending_free_draw"]["Costs"]
    assert pending["server_future"] == {"nonce": 99}
    assert pending["Goods"][0]["_id"] == 1
    assert decoded["free_ticket_reward_claims"] == ["ticket:42:7"]
    assert decoded["last_draw_progress_claim"] == "draw:42:6"


def test_new_activity_defaults_and_server_only_paths():
    runtime = DatabaseSchemaRuntime()
    schema = runtime.get_collection_schema("players")
    assert schema.build_default("transfinite_tower") is None
    assert schema.build_default("mine_sweeping.stages.0.v")["status"] == 1
    assert schema.build_default("same_color_game")["run"] is None
    assert schema.build_default("punishaar")["StageSaves"] == []
    for path in (
        "fang_kuai.StageDataDict.0.v.Blocks.0._id",
        "punishaar.StageSaves.0.v.CurrentNode.FightStarted",
        "punishaar.StageSaves.0.v.TotalMasterCards.0.v._id",
        "transfinite_tower.ChapterInfoList.0.CurBattleInfo.PendingStageRecord.Charged.0.UsedCount",
        "transfinite_tower.PendingFight.Selection.RobotIds",
        "transfinite_tower_rank_rewards.0.delivered",
        "version47_envelope.pending_task_reissues.0.k",
        "gacha.infos.0._id",
        "draw_state.free_tickets.0._id",
        "lotto.selected_primary_id_to_lotto_id.0.v",
    ):
        assert schema.allows_update_path(path), path
    assert not schema.allows_update_path("draw_state.pending_free_draw.Unconfirmed")
    assert runtime.get_collection_schema("characters").allows_update_path("team_recommend_targets.0.v.TargetFormation.CharacterDatas.0.PartnerId")
    assert runtime.get_collection_schema("same_color_game_rank_entries").build_default("_id") == ""
    assert runtime.get_collection_schema("transfinite_tower_rank_entries").allows_update_path("characters.0.IsTrial")


def test_max_skills_cover_all_variants_and_preserve_each_skill_metadata():
    character_id = 1031005
    group = [103528, 103518]
    assert group in resources.get_character_skill_groups_map()[character_id]
    default = resources.build_character_max_skills(character_id)
    assert [entry["_id"] for entry in default if entry["_id"] in group] == group
    selected = resources.build_character_max_skills(character_id, [
        {"_id": 103528, "Level": 2, "other_metadata": 7},
        {"_id": 103518, "Level": 3, "server_future": True},
    ])
    assert [entry for entry in selected if entry["_id"] in group] == [
        {"_id": 103528, "Level": 35, "other_metadata": 7},
        {"_id": 103518, "Level": 35, "server_future": True},
    ]
    for cid, skills in ((cid, resources.build_character_max_skills(cid)) for cid in resources.get_character_skill_groups_map()):
        for ids in resources.get_character_skill_groups_map()[cid]:
            assert {entry["_id"] for entry in skills if entry["_id"] in ids} == set(ids)


def test_missing_resources_are_reported_and_not_offered(monkeypatch):
    issues = get_resource_issues()
    quality_missing = {issue["id"] for issue in issues if issue["dependency"] == "CharacterQuality"}
    assert quality_missing.isdisjoint(resources.get_character_add_config_map())
    collection = Collection({"characters": [{"_id": 1011002}]})
    service = PlayerCharactersService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    monkeypatch.setattr(player_characters_service, "create_mongo_client", lambda _: Client({"characters": collection}))
    result = asyncio.run(service.list_available_characters(42))
    assert set(result.character_ids) == set(resources.get_character_add_config_map()) - {1011002}
    monkeypatch.setattr(player_characters_service, "get_character_add_config_map", lambda: {})
    with pytest.raises(ValueError, match="character.add_invalid"):
        asyncio.run(service.add_character(42, 1011002))
    assert not collection.updates


def test_weapon_transfer_rejected_without_return_weapon(monkeypatch):
    service = object.__new__(PlayerEquipsService)
    document = {"characters": [{"_id": 1011002}], "equips": []}
    equips = [{"_id": 7, "TemplateId": 100, "CharacterId": 1021001}]

    async def load(_uid):
        return document, copy.deepcopy(equips)

    service._get_uid_equips_document = load
    service._sanitize_character_list = lambda value: value
    monkeypatch.setattr(player_equips_service, "get_character_equip_type_map", lambda: {1011002: 1})
    monkeypatch.setattr(player_equips_service, "_is_weapon_template_id", lambda _: True)
    monkeypatch.setattr(player_equips_service, "_get_weapon_type_id", lambda _: 1)
    with pytest.raises(ValueError, match="character.weapon_swap_requires_weapon"):
        asyncio.run(service.switch_character_weapon(42, 1011002, SimpleNamespace(WeaponRecordId=7)))
    assert equips[0]["CharacterId"] == 1021001


def test_weapon_transfer_swaps_both_owners_and_preserves_forward_fields(monkeypatch):
    collection = Collection()
    service = object.__new__(PlayerEquipsService)
    service._settings = SimpleNamespace(mongo_db="test")
    document = {"_id": "characters", "characters": [{"_id": 1011002}], "equips": [
        {"_id": 7, "TemplateId": 100, "CharacterId": 1021001, "server_future": 1},
        {"_id": 8, "TemplateId": 100, "CharacterId": 1011002, "server_future": 2},
    ]}

    async def load(_uid):
        return copy.deepcopy(document), copy.deepcopy(document["equips"])

    service._get_uid_equips_document = load
    service._sanitize_character_list = lambda value: value
    service._sanitize_equips = lambda value: value
    service._build_equips_update = lambda value: {"equips": value}
    monkeypatch.setattr(player_equips_service, "get_character_equip_type_map", lambda: {1011002: 1})
    monkeypatch.setattr(player_equips_service, "_is_weapon_template_id", lambda _: True)
    monkeypatch.setattr(player_equips_service, "_get_weapon_type_id", lambda _: 1)
    monkeypatch.setattr(player_equips_service, "_build_weapon_item_record", lambda value: None)
    monkeypatch.setattr(player_equips_service, "create_mongo_client", lambda _: Client({"characters": collection}))
    asyncio.run(service.switch_character_weapon(42, 1011002, SimpleNamespace(WeaponRecordId=7)))
    updated = collection.updates[0][1]["$set"]["equips"]
    assert [(item["CharacterId"], item["server_future"]) for item in updated] == [(1011002, 1), (1021001, 2)]


def test_manual_skill_update_preserves_other_group_variant(monkeypatch):
    collection = Collection({"characters": [{"_id": 1031005, "SkillList": [
        {"_id": 103528, "Level": 7}, {"_id": 103517, "Level": 4},
    ]}]})
    monkeypatch.setattr(player_characters_service, "create_mongo_client", lambda _: Client({"characters": collection}))
    service = PlayerCharactersService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    asyncio.run(service.update_character_skill_level(42, 1031005, 103518, 10))
    skills = collection.updates[0][1]["$set"]["characters"][0]["SkillList"]
    assert {entry["_id"] for entry in skills} == {103528, 103518, 103517}
    assert next(entry for entry in skills if entry["_id"] == 103528)["Level"] == 7
    assert next(entry for entry in skills if entry["_id"] == 103518)["Level"] == 10


def test_delete_account_removes_every_player_rank_projection(monkeypatch):
    names = ("accounts", "players", "characters", "inventory", "stages", "boss_inshot_rank_entries",
             "same_color_game_rank_entries", "transfinite_tower_rank_entries")
    collections = {name: Collection() for name in names}
    monkeypatch.setattr(database_accounts, "create_mongo_client", lambda _: Client(collections))
    service = DatabaseAccountsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    assert asyncio.run(service.delete_account(42))
    for name in names[-3:]:
        assert collections[name].deletes == [{"player_id": 42}]


def test_add_existing_item_updates_only_count_preserving_purchase_metadata(monkeypatch):
    collection = Collection({"_id": "inventory", "items": [{
        "_id": 100, "Count": Int64(5), "CreateTime": Int64(123),
        "BuyTimes": 2, "TotalBuyTimes": 10, "LastBuyTime": Int64(456),
    }]})
    monkeypatch.setattr(player_items_service, "create_mongo_client", lambda _: Client({"inventory": collection}))
    service = PlayerItemsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    asyncio.run(service.add_inventory_items(42, [{"item_id": 100, "quantity": 3}]))
    assert collection.updates[0][1] == {"$set": {"items.$[item_100].Count": Int64(8)}}


def test_bulk_max_preserves_skipped_character_and_assets(monkeypatch):
    character = {"_id": 9999999, "Level": 17, "server_future": "keep"}
    equip = {"_id": 9, "TemplateId": 2606001, "CharacterId": 9999999, "server_future": 7}
    chars = Collection({"characters": [character], "equips": [equip], "fashions": [], "weaponFashions": []})
    players = Collection({"gather_rewards": [999]})
    monkeypatch.setattr(player_characters_service, "create_mongo_client", lambda _: Client({"characters": chars, "players": players}))
    monkeypatch.setattr(player_characters_service, "get_character_max_template_map", lambda: {1011002: {}})
    service = PlayerCharactersService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())

    def apply(**kwargs):
        return (kwargs["characters"], kwargs["fashions"], kwargs["equips"], kwargs["weapon_fashions"], sorted(kwargs["gather_rewards"]))

    service._apply_max_character_template = apply
    result = asyncio.run(service.max_all_characters(42))
    update = chars.updates[0][1]["$set"]
    assert any(entry["_id"] == 9999999 and entry["server_future"] == "keep" for entry in update["characters"])
    assert update["equips"][0]["server_future"] == 7
    assert 9999999 in result.skipped_character_ids
    assert 999 in players.updates[0][1]["$set"]["gather_rewards"]


@pytest.mark.parametrize("language", ["CN", "EN"])
@pytest.mark.parametrize("bulk", [False, True])
@pytest.mark.parametrize("character_id", [1031005, 1531005])
def test_single_and_bulk_max_reserve_harmony_skill_levels(monkeypatch, language, bulk, character_id):
    token = resource_language.set(language)
    try:
        template = resources.get_character_max_template_map()[character_id]
        monkeypatch.setattr(player_characters_service, "get_character_max_template_map", lambda: {character_id: template})
        # Maximize every variant and preserve forward-compatible fields while rebuilding skills.
        variant = 103518 if character_id == 1031005 else 153518
        chars = Collection({"characters": [{"_id": character_id, "SkillList": [
            {"_id": variant, "Level": 3, "server_future": True},
        ]}], "equips": [], "fashions": [], "weaponFashions": []})
        players = Collection({"gather_rewards": []})
        monkeypatch.setattr(player_characters_service, "create_mongo_client", lambda _: Client({"characters": chars, "players": players}))
        service = PlayerCharactersService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
        bonuses = get_weapon_overrun_character_max_level_skill_upgrade_map()[template["weapon"]["TemplateId"]][character_id]
        for _ in range(2):
            if bulk:
                asyncio.run(service.max_all_characters(42))
            else:
                asyncio.run(service.max_character(42, character_id))
            update = chars.updates[-1][1]["$set"]
            skills = {entry["_id"]: entry for entry in update["characters"][0]["SkillList"]}
            assert set(skills) == set(resources.get_character_skill_ids_map()[character_id])
            for group in resources.get_character_skill_groups_map()[character_id]:
                if variant in group:
                    assert all(skills[skill_id]["Level"] == resources.get_character_skill_entries_map()[skill_id]["MaxLevel"] for skill_id in group)
            for group_id, bonus in bonuses.items():
                for skill_id in resources.get_character_skill_group_skill_ids_map()[group_id]:
                    if skill_id in skills:
                        assert skills[skill_id]["Level"] + bonus == resources.get_character_skill_entries_map()[skill_id]["MaxLevel"]
            assert skills[variant]["Level"] == resources.get_character_skill_entries_map()[variant]["MaxLevel"]
            assert skills[variant]["server_future"] is True
            assert update["equips"][-1]["WeaponOverrunData"]["Level"] == 7
            chars.document.update(update)
            players.document.update(players.updates[-1][1]["$set"])
    finally:
        resource_language.reset(token)
