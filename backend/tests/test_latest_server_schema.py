import asyncio
import copy
import os
from pathlib import Path
import re
import shutil
import subprocess
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import BSON, Binary, json_util
from bson.int64 import Int64

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_stages_service
from backend.app.services.player import player_profile_service
from backend.app.services.player import player_equips_service
from backend.app.services.player import player_items_service
from backend.app.db.models.player_equips import SwitchCharacterMemoryRequest, UpdateEquipRequest
from backend.app.db.models import UpdatePlayerProfilePayload
from backend.app.services.player.player_profile_service import PlayerProfileService
from backend.app.services.player.player_stages_service import PlayerStagesService
from backend.app.services.player.player_equips_service import PlayerEquipsService
from backend.app.services.player.player_items_service import PlayerItemsService
from backend.app.services.player.player_characters_service import PlayerCharactersService
from backend.app.services.player.player_characters import get_character_max_template_map
from backend.app.services.player.equips.partner import build_partner_max_save_template, get_partner_entries_map
from backend.app.utils.resource_language import resource_language


def _small_rewards_sample():
    return {
        'birthday_single_story_ids': [1, 3],
        'stage_memory_claims': [{'activity_id': 2, 'indices': [1, 3]}],
        'board_effect_last_trigger': Int64(2**40),
        'version_gift': {'activity_id': 9, 'daily_claimed_until': Int64(2**40 + 1),
                         'version_claimed': True, 'progress_indexes': [1, 3]},
        'accumulate_expend_shop': {'activity_id': 1, 'spent_baseline': Int64(2**40 + 2),
                                  'converted_count': 60, 'sign_count': 2, 'signed_until': Int64(2**40 + 3)},
    }


def test_small_rewards_defaults_and_populated_bson():
    runtime = DatabaseSchemaRuntime()
    schema = runtime.get_collection_schema('players')
    assert schema.build_default('birthday_single_story_ids') == []
    assert schema.build_default('stage_memory_claims') == []
    assert schema.build_default('stage_memory_claims.0') == {'activity_id': 0, 'indices': []}
    assert schema.build_default('board_effect_last_trigger') == 0
    assert schema.build_default('version_gift') == {
        'activity_id': 0, 'daily_claimed_until': 0, 'version_claimed': False, 'progress_indexes': [],
    }
    assert schema.build_default('accumulate_expend_shop') == {
        'activity_id': 0, 'spent_baseline': 0, 'converted_count': 0, 'sign_count': 0, 'signed_until': 0,
    }
    for path, value in _small_rewards_sample().items():
        normalized = schema.materialize_subpath(path, value)
        assert normalized == value
        assert BSON.encode({'value': normalized}).decode()['value'] == value
    inventory = runtime.get_collection_schema('inventory')
    assert inventory.build_default('spent_totals') == {}
    totals = {'5': Int64(2**40 + 60), '6': Int64(0)}
    decoded = BSON.encode(inventory.materialize_document({'spent_totals': totals})).decode()
    assert decoded['spent_totals'] == totals
    assert all(isinstance(value, Int64) for value in decoded['spent_totals'].values())
    for path, value in {
        'boss_inshot.characters': [{'character_id': 1011002, 'selected_talents': [7, 0, 9]}],
        'version47_concert_preheating': {'activity_id': 1, 'completed_stage_ids': [101, 109]},
    }.items():
        assert schema.sanitize_subpath(path, value, fill_defaults=False) == value


@pytest.mark.parametrize('operation', ['quantity', 'delete', 'clear', 'add'])
def test_inventory_edits_do_not_record_spending_or_reset_receipts(monkeypatch, operation):
    document = {'_id': 'inventory', 'uid': Int64(42),
                'items': [{'_id': 60, 'Count': Int64(60)}],
                'spent_totals': {'60': Int64(2**40)},
                'applied_reward_claims': ['accumulate-expend-shop:1:sign:0'],
                'reward_claim_times': {'accumulate-expend-shop:1:sign:0': Int64(2**40)}}
    writes = []

    class Collection:
        async def find_one(self, *args, **kwargs):
            return copy.deepcopy(document)

        async def update_one(self, query, update, **kwargs):
            writes.append(update)
            return SimpleNamespace(modified_count=1)

    collection = Collection()

    class Client:
        def __getitem__(self, name):
            return self if name == 'test' else collection

        def close(self):
            pass

    monkeypatch.setattr(player_items_service, 'create_mongo_client', lambda _: Client())
    service = PlayerItemsService(SimpleNamespace(mongo_db='test'), DatabaseSchemaRuntime())
    if operation == 'quantity':
        assert asyncio.run(service.update_inventory_item_quantity(42, 60, 30))
        expected = {'$set': {'items.$.Count': Int64(30)}}
    elif operation == 'delete':
        assert asyncio.run(service.delete_inventory_item(42, 60))
        expected = {'$pull': {'items': {'_id': 60}}}
    elif operation == 'clear':
        assert asyncio.run(service.clear_inventory_items_by_keyword(42, '')) == 1
        expected = {'$pull': {'items': {'_id': {'$in': [60]}}}}
    else:
        asyncio.run(service.add_inventory_items(42, [{'item_id': 60, 'quantity': 30}]))
        expected = {'$set': {'items.$[item_60].Count': Int64(90)}}
    # Only item mutations may reach MongoDB; the spend ledger and once-only
    # reward receipts must remain untouched even when the balance decreases.
    assert writes == [expected]


def _everyday_sample():
    return {
        'social': {'Friends': [{'k': 2000000000, 'v': 1900000000}],
                   'Remarks': [{'k': 2000000000, 'v': '好友备注'}], 'ApplicationDay': Int64(-1)},
        'chat_social': {'GiftReceiveDay': Int64(-1), 'ReportDay': Int64(20001),
                        'GiftSentDays': [{'k': 2000000000, 'v': Int64(20001)}],
                        'Gifts': [{'GiftId': 7, 'SenderId': 2000000000, 'ItemId': 60,
                                   'Count': 2, 'CreateTime': Int64(2**40), 'Status': 1}],
                        'Reports': [{'TargetId': Int64(2**40), 'TargetName': '测试玩家',
                                     'Message': '消息', 'ReportMessage': '说明', 'Time': Int64(2**40)}]},
        'profile': {'LikePeriod': Int64(-(2**63)), 'NextDiaryId': Int64(2**40),
                    'Diaries': [{'_id': Int64(2**40), 'PlayerId': Int64(42), 'Name': '指挥官',
                                 'Content': '日记正文', 'LikedPlayerIds': [Int64(2**40 + 1)],
                                 'Msgs': [{'_id': Int64(2**40 + 2), 'DailyId': Int64(2**40),
                                           'Content': '留言', 'LeaveMsgTime': Int64(2**40)}]}],
                    'Walls': [{'_id': 1, 'IsShow': True,
                               'CollectionSetInfos': [{'_id': 13019636, 'X': -3, 'Y': 4, 'SizeId': 1}]}]},
        'random_background': {'enabled': True, 'fashion_enabled': True,
                              'pool': [{'background_id': 1, 'chars': [
                                  {'char_id': 1011002, 'is_random': True, 'fashions': [6110101, 6110102]}]}]},
        'auto_fight_records': [{'stage_id': 1, 'card_ids': [Int64(2**40)],
                                'times': 3, 'complete_time': Int64(2**40)}],
        'movie_options': [{'movie_id': '剧情/001', 'option_ids': [1, 3]}],
        'total_pay_money': Int64(2**40 + 100),
        'pending_purchase_combo': {'_id': 7, 'BuyTime': Int64(2**40), 'Subs': [
            {'_id': 8, 'Count': 1, 'BuyTime': Int64(2**40),
             'Goods': [{'_id': 1, 'TemplateId': 60, 'Count': 2}],
             'DailyPasses': [{'k': 8, 'v': {'FirstDay': Int64(20000),
                                          'ClaimedDays': [Int64(20000), Int64(20002)]}}]}]},
        'shop_manual_refresh_periods': [{'k': 1, 'v': Int64(2**40)}],
        'archive_unlocks': [{'Kind': 'weapon', '_id': 101}],
        'weekly_task_activeness_progress': [1, 3],
        'extra_chapter_treasures': [11], 'short_story_treasures': [12],
        'received_favorite_mail_ids': [13],
    }


def test_everyday_defaults_and_populated_bson():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    assert schema.build_default('profile')['LikePeriod'] == -(2**63)
    assert schema.build_default('social')['ApplicationDay'] == -1
    assert schema.build_default('chat_social')['GiftReceiveDay'] == -1
    assert schema.build_default('chat_social')['ReportDay'] == -1
    assert schema.build_default('pending_purchase_combo') is None
    assert schema.build_default('player_data.NewPlayerTaskActiveUi') == 0
    for path in ('purchase_daily_passes.0.v', 'pending_purchase.DailyPasses.0.v',
                 'pending_purchase_combo.Subs.0.DailyPasses.0.v'):
        assert schema.build_default(path)['FirstDay'] == 0
        assert schema.build_default(path)['ClaimedDays'] == []
        normalized = schema.materialize_subpath(path, {'FirstDay': Int64(20000),
                                                      'ClaimedDays': [Int64(20000), Int64(20002)]})
        decoded = BSON.encode(normalized).decode()
        assert decoded['ClaimedDays'] == [20000, 20002]
        assert all(isinstance(day, Int64) for day in decoded['ClaimedDays'])
    for path, value in _everyday_sample().items():
        normalized = schema.materialize_subpath(path, value)
        assert schema.sanitize_subpath(path, value, fill_defaults=False) == value
        assert BSON.encode({'value': normalized}).decode()['value'] == normalized


@pytest.mark.parametrize('operation', ['wear', 'level', 'exp', 'breakthrough'])
def test_memory_edits_clear_only_target_recycle_mark(monkeypatch, operation):
    runtime = DatabaseSchemaRuntime()
    service = PlayerEquipsService(SimpleNamespace(mongo_db='test'), runtime)
    template_id = next(template_id for template_id in player_equips_service.get_equip_breakthrough_max_map()
                       if player_equips_service._is_memory_template_id(template_id)
                       and player_equips_service.get_equip_breakthrough_max_map()[template_id]['max_breakthrough'] > 0)
    slot = player_equips_service._get_memory_slot_id(template_id)
    rows = [service._build_memory_document(template_id, [])]
    rows.append(service._build_memory_document(template_id, rows))
    for row in rows:
        row['IsRecycle'] = True
    document = {'_id': 'character', 'characters': [{'_id': 1011002}], 'equips': rows}
    writes = []

    class Collection:
        async def find_one(self, *args, **kwargs):
            return copy.deepcopy(document)

        async def update_one(self, query, update):
            writes.append(update)
            return SimpleNamespace(modified_count=1)

    collection = Collection()

    class Client:
        def __getitem__(self, name):
            return self if name == 'test' else collection

        def close(self):
            pass

    monkeypatch.setattr(player_equips_service, 'create_mongo_client', lambda _: Client())
    if operation == 'wear':
        asyncio.run(service.switch_character_memory(42, 1011002,
                    SwitchCharacterMemoryRequest(Slot=slot, MemoryRecordId=rows[0]['_id'])))
    else:
        asyncio.run(service.update_memory(42, rows[0]['_id'],
                    UpdateEquipRequest(field=operation, value=2 if operation == 'level' else 1)))
    updated = writes[0]['$set']['equips']
    assert updated[0]['IsRecycle'] is False
    assert updated[1]['IsRecycle'] is True
    assert updated[1] == rows[1]
    if operation == 'wear':
        assert updated[0]['CharacterId'] == 1011002


def test_latest_state_defaults_and_removed_fields():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    assert schema.build_default('purchase_daily_passes.0.v')['LastClaimDay'] == -1
    assert schema.build_default('pending_purchase.DailyPasses.0.v')['LastClaimDay'] == -1
    assert schema.build_default('partner_decompose_completions') is None
    assert schema.materialize_subpath('partner_decompose_completions', None) is None
    assert schema.materialize_subpath('partner_decompose_completions', []) == []
    assert schema.build_default('pending_partner_decompose') is None
    assert schema.build_default('pending_recharge') is None
    assert schema.build_default('recharge_sequence') == 0
    assert schema.build_default('accumulated_pay_money') == 0
    assert schema.build_default('accumulated_pay_reward_ids') == []
    assert schema.build_default('accumulated_extra_pay_reward_ids') == []
    assert schema.build_default('pending_item_use') is None
    assert schema.build_default('pending_item_use.SelectRewardIds') == []
    world = schema.build_default('big_world_state')
    for field in ('last_self_runtime_id', 'big_world_course_read_element_ids', 'big_world_course_task_progress'):
        assert field not in world
        assert not schema.allows_update_path('big_world_state.' + field)
    assert world['sg_cafe'] is None and world['sg_dorm'] is None and world['sg_drone_current'] is None
    assert world['sg_street']['CurStageData'] is None
    assert world['scene_object_states'] == []
    assert world['quest_data']['ActiveQuests'] == []
    assert DatabaseSchemaRuntime().get_collection_schema('stages').build_default('boss_single_activity_no') is None


def test_bigworld_binary_ledgers_and_nested_ids_survive_materialization():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    value = {
        'scene_object_states': [{'k': 1, 'v': {'states': [{'k': 900, 'v': Binary(b'\x81\xff\x00')} ]}}],
        'sg_drone_current': {'stage_id': 2, 'seed': 4, 'is_hard_mode': True, 'save_data': Binary(b'\x92\x01\x02')},
        'album_photos': [{'_id': 7, 'create_time': Int64(1900000000), 'remark': 'photo'}],
        'sg_street': {'CurStageData': {'TaskDatas': [{'_id': 9, 'ConfigId': 17}], 'OperatingData': {
            'CustomerDatas': [{'_id': 21, 'CommandDatas': [{'_id': 22, 'EventData': {'_id': 23}}]}],
        }}},
        'quest_data': {'ActiveQuests': [{'k': 100, 'v': {'QuestId': 100, 'DynamicData': {
            'Steps': [{'k': 101, 'v': {'Objectives': [{'k': 102, 'v': {
                '_id': 102, 'TimerStarted': True, 'TimerElapsedMs': 300, 'KilledEnemies': [9],
            }}]}}], 'FuncEntryEnabled': [3],
        }}}]},
    }
    normalized = schema.materialize_subpath('big_world_state', value)
    decoded = BSON.encode(normalized).decode()
    assert decoded['scene_object_states'][0]['v']['states'][0]['v'] == b'\x81\xff\x00'
    assert decoded['sg_drone_current']['save_data'] == b'\x92\x01\x02'
    assert decoded['sg_drone_current']['is_hard_mode'] is True
    assert decoded['album_photos'][0]['_id'] == 7
    assert isinstance(decoded['album_photos'][0]['create_time'], Int64)
    stage = decoded['sg_street']['CurStageData']
    assert stage['TaskDatas'][0]['_id'] == 9
    assert stage['OperatingData']['CustomerDatas'][0]['CommandDatas'][0]['EventData']['_id'] == 23
    objective = decoded['quest_data']['ActiveQuests'][0]['v']['DynamicData']['Steps'][0]['v']['Objectives'][0]['v']
    assert objective['_id'] == 102 and objective['TimerStarted'] is True
    assert objective['TimerElapsedMs'] == 300 and objective['KilledEnemies'] == [9]


def test_purchase_and_decompose_receipts_preserve_current_shapes():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    state = {
        'purchase_daily_passes': [{'k': 100, 'v': {'EndDay': Int64(20020), 'StartDay': Int64(20000), 'LastClaimDay': Int64(-1), 'RewardIndexList': [1, 2]}}],
        'pending_recharge': {'Key': 'pay:7', 'Order': 'local:42:1', 'Count': 60},
        'recharge_sequence': Int64(1),
        'pending_partner_decompose': {'ClaimKey': 'partner:42:1', 'PartnerIds': [7], 'RewardGoodsList': [{'_id': 3, 'TemplateId': 60, 'Count': 5}]},
    }
    normalized = schema.sanitize_document(state, fill_defaults=False)
    assert normalized == state
    assert BSON.encode(normalized).decode() == state
    update = schema.materialize_update_fields({'player_data.Name': 'name'})
    assert update == {'player_data.Name': 'name'}


def test_stage_edit_does_not_reset_boss_period(monkeypatch):
    document = {'_id': 'stage', 'boss_single_activity_no': 2950, 'stages': [],
                'experiment_star_claims': [{'k': 1, 'v': [2, 3]}]}
    updates = []

    class Collection:
        async def find_one(self, *args, **kwargs):
            return copy.deepcopy(document)

        async def update_one(self, query, update):
            updates.append(update)
            return SimpleNamespace(modified_count=1)

    collection = Collection()

    class Client:
        def __getitem__(self, name):
            return self if name == 'test' else collection

        def close(self):
            pass

    monkeypatch.setattr(player_stages_service, 'create_mongo_client', lambda _: Client())
    monkeypatch.setattr(player_stages_service, 'get_stage_entries_map', lambda: {1: {'Name': 'stage'}})
    service = PlayerStagesService(SimpleNamespace(mongo_db='test'), DatabaseSchemaRuntime())
    asyncio.run(service.add_stages(42, [1]))
    assert set(updates[0]) == {'$push'} and set(updates[0]['$push']) == {'stages'}
    asyncio.run(service.clear_stages(42))
    assert updates[1] == {'$set': {'stages': []}}


@pytest.mark.parametrize('money,selections', [(0, []), (2**40 + 60, [101, 102, 101])])
def test_accumulated_pay_and_pending_choice_survive_bson(money, selections):
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    state = {
        'accumulated_pay_money': Int64(money),
        'accumulated_pay_reward_ids': [1, 3],
        'accumulated_extra_pay_reward_ids': [2],
        'pending_item_use': {'ClaimKey': 'item-use:42:1', 'ItemId': 7, 'Count': 3, 'RecycleTime': 0,
                             'SelectRewardIds': selections,
                             'Goods': [{'_id': 101, 'TemplateId': 60, 'Count': 3, 'Params': []}]},
    }
    normalized = schema.sanitize_document(state, fill_defaults=False)
    assert normalized == state
    decoded = BSON.encode(normalized).decode()
    assert decoded == state
    assert isinstance(decoded['accumulated_pay_money'], Int64)
    legacy = dict(state['pending_item_use'])
    del legacy['SelectRewardIds']
    assert schema.materialize_subpath('pending_item_use', legacy)['SelectRewardIds'] == []


def test_profile_and_rainbow_edits_only_update_requested_fields(monkeypatch):
    runtime = DatabaseSchemaRuntime()
    writes = []
    players = {'_id': 'player', 'player_data': {'Name': 'original'},
               **_everyday_sample(), **_small_rewards_sample(),
               'boss_inshot': {'characters': [{'character_id': 1011002, 'selected_talents': [7, 0, 9]}]},
               'version47_concert_preheating': {'activity_id': 1, 'completed_stage_ids': [101, 109]}}
    inventory = {'_id': 'inventory', 'items': [{'_id': 5, 'Count': Int64(60)}],
                 'spent_totals': {'5': Int64(2**40)}}
    original_players = copy.deepcopy(players)
    original_inventory = copy.deepcopy(inventory)

    class Collection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, *args):
            return copy.deepcopy(inventory if self.name == 'inventory' else players)

        async def update_one(self, query, update):
            writes.append((self.name, update))
            for path, value in update['$set'].items():
                target = inventory if self.name == 'inventory' else players
                segments = path.split('.')
                for segment in segments[:-1]:
                    target = target[0] if segment == '$' else target[segment]
                target[segments[-1]] = value
            return SimpleNamespace(matched_count=1)

    class Client:
        def __getitem__(self, name):
            return self if name == 'test' else Collection(name)

        def close(self):
            pass

    monkeypatch.setattr(player_profile_service, 'create_mongo_client', lambda _: Client())
    service = PlayerProfileService(SimpleNamespace(mongo_db='test'), SimpleNamespace(), runtime)
    monkeypatch.setattr(service, 'get_player_profile', AsyncMock(return_value=None))
    asyncio.run(service.update_player_profile(42, UpdatePlayerProfilePayload(name='updated', rainbow_card=120)))
    assert writes == [('players', {'$set': {'player_data.Name': 'updated'}}),
                      ('inventory', {'$set': {'items.$.Count': Int64(120)}})]
    original_players['player_data']['Name'] = 'updated'
    original_inventory['items'][0]['Count'] = Int64(120)
    assert players == original_players
    assert inventory == original_inventory


def test_cerberus_defaults_and_team_slots():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    assert schema.build_default('cerberus_game') == {
        'activity_id': 0, 'pass_story_points': [], 'stages': [], 'chapter_teams': [],
        'fight': None, 'fight_receipts': [],
    }
    for path in ('cerberus_game.stages.0.team_info', 'cerberus_game.chapter_teams.0.team_info'):
        assert schema.build_default(path) == {
            'CharacterIdList': [0, 0, 0], 'RobotIdList': [0, 0, 0], 'CaptainPos': 1, 'FirstFightPos': 1,
        }
    assert schema.materialize_subpath('cerberus_game.fight', None) is None


def _cerberus_sample(settled):
    team = {'CharacterIdList': [1011002, 0, 0], 'RobotIdList': [0, 12, 13],
            'CaptainPos': 2, 'FirstFightPos': 3}
    return {
        'activity_id': 2, 'pass_story_points': [11, 12],
        'stages': [{'stage_id': 90001, 'passed': True, 'star_mark': 7,
                    'got_star_reward_ids': [21, 22], 'stage_params': [2, 1], 'team_info': team}],
        'chapter_teams': [{'chapter_id': 1, 'team_info': copy.deepcopy(team)}],
        'fight': {'fight_id': 12345, 'stage_id': 90001, 'pre_fight': b'\x81\xff\x00',
                  'result': b'\x92\x01\x02' if settled else None,
                  'stage_data': b'\x80' if settled else None,
                  'is_first_clear': True, 'reward_ids': [21, 22]},
        'fight_receipts': [{'k': 12344, 'v': {'stage_id': 90002,
                            'result_hash': bytes(range(32)), 'response': b'\x81\x00\xff'}}],
    }


@pytest.mark.parametrize('settled', [False, True])
def test_cerberus_progress_and_recovery_binary_survive_bson(settled):
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    state = _cerberus_sample(settled)
    normalized = schema.materialize_subpath('cerberus_game', state)
    assert normalized == state
    decoded = BSON.encode(normalized).decode()
    assert decoded == state
    assert decoded['fight']['pre_fight'] == b'\x81\xff\x00'
    assert decoded['fight_receipts'][0]['v']['result_hash'] == bytes(range(32))
    assert schema.allows_update_path('cerberus_game.fight_receipts.0.v.response')
    assert schema.allows_update_path('cerberus_game.stages.$[stage].team_info.CaptainPos')


def test_maintainer_action_defaults():
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    assert schema.build_default('maintainer_action') == {
        'config_id': 0, 'week': 0, 'day': 0, 'seed': 0, 'draws': 0, 'player_node_id': 0,
        'reverse': False, 'triggered': True, 'landing': 0, 'cards': [], 'fight_win_count': 0,
        'box_count': 0, 'used_action_count': 0, 'extra_action_count': 0, 'has_warehouse_node': False,
        'warehouse_finish_count': 0, 'start_bonus_claimed': False, 'nodes': [], 'records': [], 'last_event': None,
    }
    assert schema.build_default('maintainer_action.nodes.0.value') is None
    assert schema.materialize_subpath('maintainer_action.last_event', None) is None


def _maintainer_sample(seed, value):
    return {
        'config_id': 1, 'week': Int64(2000), 'day': Int64(20001), 'seed': Int64(seed),
        'draws': 83, 'player_node_id': 3, 'reverse': True, 'triggered': False, 'landing': 7,
        'cards': [3, 1, 3], 'fight_win_count': 2, 'box_count': 1, 'used_action_count': 4,
        'extra_action_count': 2, 'has_warehouse_node': True, 'warehouse_finish_count': 1,
        'start_bonus_claimed': True,
        'nodes': [{'node_id': 3, 'node_type': 3, 'event_id': 3, 'value': value, 'revealed': False}],
        'records': [{'time': Int64(2**40), 'event_id': 1, 'values': [3, 1, 3]}],
        'last_event': {'landing': 6, 'node_id': 2, 'node_type': 3, 'event_id': 3, 'value': value},
    }


@pytest.mark.parametrize('seed,value', [(-(2**63), None), (2**63 - 1, '{ "RewardId": 7, "label": "补给" }')])
def test_maintainer_action_seed_and_receipts_survive_bson(seed, value):
    schema = DatabaseSchemaRuntime().get_collection_schema('players')
    state = _maintainer_sample(seed, value)
    normalized = schema.materialize_subpath('maintainer_action', state)
    assert normalized == state
    decoded = BSON.encode(normalized).decode()
    assert decoded == state
    for field in ('week', 'day', 'seed'):
        assert isinstance(decoded[field], Int64)
    assert isinstance(decoded['records'][0]['time'], Int64)
    assert decoded['nodes'][0]['value'] == value
    assert decoded['last_event']['value'] == value
    assert schema.allows_update_path('maintainer_action.nodes.$[node].value')


@pytest.mark.parametrize('language', ['CN', 'EN'])
def test_max_weapon_documents_keep_real_resonance_and_harmonization(language):
    service = PlayerCharactersService(SimpleNamespace(), DatabaseSchemaRuntime())
    token = resource_language.set(language)
    try:
        weapons = [template['weapon'] for template in get_character_max_template_map().values()]
        assert weapons
        for weapon in weapons:
            document = service._build_equip_document([], weapon)
            decoded = BSON.encode(document).decode()
            assert len(decoded['ResonanceInfo']) == len(weapon['ResonanceInfo'])
            for actual, expected in zip(decoded['ResonanceInfo'], weapon['ResonanceInfo']):
                assert {field: actual[field] for field in expected} == expected
            assert decoded['CharacterId'] == weapon['CharacterId']
            for field, value in weapon['WeaponOverrunData'].items():
                assert decoded['WeaponOverrunData'][field] == value
    finally:
        resource_language.reset(token)


def _read_persisted_classes(server):
    """Extract actual C# auto-properties/BSON attributes; ignore protocol-only attributes.

    The reduced types compile in memory on .NET Framework. Defaults are supplied
    by GM materialization so they can be verified against the original source.
    """
    files = list((server / 'AscNet.Common/Database/BigWorld').glob('*.cs')) + [
        server / 'AscNet.Common/Database/Inventory.cs',
        server / 'AscNet.Common/Database/Player.Archive.cs',
        server / 'AscNet.Common/Database/Player.FavorMemory.cs',
        server / 'AscNet.Common/Database/Player.SmallRewards.cs',
        server / 'AscNet.Common/Database/Player.ChatSocial.cs',
        server / 'AscNet.Common/Database/Player.CollectionMisc.cs',
        server / 'AscNet.Common/Database/Player.FunctionalEntrance.cs',
        server / 'AscNet.Common/Database/Player.MiscPlayer.cs',
        server / 'AscNet.Common/Database/Player.Photograph.cs',
        server / 'AscNet.Common/Database/Player.Profile.cs',
        server / 'AscNet.Common/Database/Player.PurchaseExtras.cs',
        server / 'AscNet.Common/Database/Player.ShopRefresh.cs',
        server / 'AscNet.Common/Database/Player.Social.cs',
        server / 'AscNet.Common/MsgPack/ProfileSocial.cs',
        server / 'AscNet.Common/Database/Player.Purchases.cs',
        server / 'AscNet.Common/Database/Player.ItemUse.cs',
        server / 'AscNet.Common/Database/Player.PartnerArchive.cs',
        server / 'AscNet.Common/Database/Player.CerberusGame.cs',
        server / 'AscNet.Common/Database/Player.CerberusGame.Combat.cs',
        server / 'AscNet.Common/Database/Player.MaintainerAction.cs',
        server / 'AscNet.Common/MsgPack/CerberusGame.cs',
        server / 'AscNet.Common/MsgPack/BigWorld/SkyGarden.cs',
        server / 'AscNet.Common/MsgPack/BigWorld/SgStreet.cs',
        server / 'AscNet.Common/MsgPack/Theatre5.cs',
        server / 'AscNet.Common/MsgPack/Types.cs',
    ]
    classes = {}
    pattern = re.compile(r'(?P<attrs>(?:\[[^\n]+?\]\s*)*)public\s+(?P<type>[\w.<>?, \[\]]+)\s+(?P<name>\w+)\s*\{\s*get;\s*set;\s*\}')
    for file in files:
        text = file.read_text(encoding='utf-8-sig')
        # Match property bodies with a single brace pair; also handle the new
        # one-line profile DTO. Multiline classes end at their own indentation.
        for match in re.finditer(r'(?m)^(?P<indent> *)public (?:sealed |partial )*class (?P<name>\w+)[^\n{]*\s*\{', text):
            end = re.search(r'(?m)^' + re.escape(match['indent']) + r'\}', text[match.end():])
            if text[match.end():].split('\n', 1)[0].strip():
                end = re.search(r'\} *\}', text[match.end():])
                if end:
                    body = text[match.end():match.end() + end.start() + 1]
                    classes.setdefault(match['name'], []).extend(pattern.finditer(body))
                continue
            if not end:
                continue
            body = text[match.end():match.end() + end.start()]
            properties = list(pattern.finditer(body))
            classes.setdefault(match['name'], []).extend(properties)
    return classes


def test_latest_schema_against_actual_server_types_and_mongodb_driver():
    server = Path(os.environ.get('INFINITELOOP_TEST_PATH', str(Path(__file__).resolve().parents[2].parent / 'InfiniteLoop')))
    driver = Path(os.environ.get('MONGODB_BSON_TEST_DLL', str(Path.home() / '.nuget/packages/mongodb.bson/2.21.0/lib/net472/MongoDB.Bson.dll')))
    powershell = shutil.which('powershell')
    if not powershell or not driver.is_file() or not (server / 'AscNet.Common/Database/BigWorld').is_dir():
        pytest.skip('Requires InfiniteLoop source, Windows PowerShell and MongoDB.Bson 2.21.0')
    classes = _read_persisted_classes(server)
    spent_totals = next(prop for prop in classes['Inventory'] if prop['name'] == 'SpentTotals')
    assert spent_totals['type'].strip() == 'Dictionary<string, long>'
    assert 'BsonElement("spent_totals")' in spent_totals['attrs']
    runtime = DatabaseSchemaRuntime()
    schema = runtime.get_collection_schema('players')
    roots = {
        'big_world_state': 'BigWorldPlayerState', 'purchase_daily_passes': 'Dictionary<uint, PlayerPurchaseDailyPass>',
        'pending_purchase': 'PlayerPendingPurchase', 'pending_recharge': 'PlayerPendingRecharge',
        'pending_partner_decompose': 'PartnerDecomposePendingOperation',
        'partner_decompose_completions': 'List<PartnerDecomposeCompletion>',
        'pending_item_use': 'ItemUsePendingOperation',
        'accumulated_pay_money': 'long',
        'accumulated_pay_reward_ids': 'List<int>',
        'accumulated_extra_pay_reward_ids': 'List<int>',
        'cerberus_game': 'CerberusGameState',
        'maintainer_action': 'MaintainerActionState',
        'archive_unlocks': 'List<ArchiveUnlockRecord>',
        'archive_equipment': 'List<ArchiveEquipmentRecord>',
        'archive_evaluations': 'List<ArchiveEvaluationRecord>',
        'social': 'SocialPlayerState',
        'chat_social': 'ChatSocialState',
        'profile': 'PlayerProfileState',
        'random_background': 'RandomBackgroundState',
        'auto_fight_records': 'List<AutoFightRecordState>',
        'movie_options': 'List<MovieOptionsState>',
        'total_pay_money': 'long',
        'first_pay_reward_ids': 'List<int>',
        'purchase_combo_buy_times': 'Dictionary<uint, int>',
        'pending_purchase_combo': 'PlayerPendingCombo',
        'shop_manual_refresh_times': 'Dictionary<uint, int>',
        'shop_manual_refresh_periods': 'Dictionary<uint, long>',
        'functional_entrance_red_points': 'Dictionary<int, int>',
        'received_favorite_mail_ids': 'List<int>',
        'weekly_task_activeness_progress': 'List<int>',
        'extra_chapter_treasures': 'List<int>',
        'short_story_treasures': 'List<int>',
        'experiment_star_claims': 'Dictionary<int, List<int>>',
        'partners': 'List<PartnerData>',
        'birthday_single_story_ids': 'List<int>',
        'stage_memory_claims': 'List<StageMemoryClaimState>',
        'board_effect_last_trigger': 'long',
        'version_gift': 'VersionGiftState',
        'accumulate_expend_shop': 'AccumulateExpendShopState',
        'spent_totals': 'Dictionary<string, long>',
    }
    primitives = {'int', 'uint', 'long', 'float', 'double', 'bool', 'string', 'byte', 'object', 'Int32', 'UInt32', 'Int64', 'UInt64', 'Boolean', 'String', 'Single', 'Double', 'Byte', 'List', 'Dictionary', 'HashSet', 'dynamic'}
    emitted = set()
    declarations = []

    def build(type_name, node):
        nullable = type_name.endswith('?')
        plain = type_name.rstrip('?').replace('AscNet.Common.MsgPack.', '')
        if plain == 'byte[]':
            assert node['type'] == 'binary'
            return None if nullable else Binary(b'')
        if plain in primitives:
            value = node.get('default')
            if value is None and 'default' not in node and plain in {'string', 'String'}:
                value = ''
            if value is None and not nullable and plain not in {'string', 'String', 'object', 'dynamic'}:
                value = False if plain in {'bool', 'Boolean'} else 0
            if value is not None and plain in {'long', 'Int64', 'UInt64'}:
                return Int64(value)
            if value is not None and plain in {'float', 'double', 'Single', 'Double'}:
                return float(value)
            return value
        if plain.startswith(('List<', 'HashSet<')):
            inner = plain[plain.index('<') + 1:-1].strip()
            value = build(inner, node['schema'])
            return [value]
        if plain.startswith('Dictionary<'):
            inner = plain[len('Dictionary<'):-1]
            key, value_type = inner.split(',', 1)
            if node['type'] == 'object':
                inner_type = value_type.strip()
                if inner_type in {'Theatre5DlcVector2', 'Theatre5DlcVector3'}:
                    axes = ('X', 'Y') if inner_type.endswith('2') else ('X', 'Y', 'Z')
                    vector = {'type': 'object', 'schema': {
                        axis: {'type': 'number', 'default': 0} for axis in axes
                    }}
                    return {'sample': build(inner_type, vector)}
                return {'sample': build(inner_type, {'type': 'number', 'default': False if inner_type == 'bool' else 0})}
            assert node['type'] == 'array', plain
            return [{'k': 'sample' if key.strip() == 'string' else 1, 'v': build(value_type.strip(), node['schema']['v'])}]
        assert plain in classes, plain
        properties = classes[plain]
        fields = node.get('schema', node)
        bson_names = set()
        sample = {}
        lines = []
        for prop in properties:
            attrs = prop['attrs']
            if 'BsonIgnore]' in attrs:
                continue
            member_type = prop['type'].strip().replace('AscNet.Common.MsgPack.', '')
            name = prop['name']
            element = re.search(r'BsonElement\("([^"]+)"\)', attrs)
            bson_name = '_id' if name == 'Id' else element[1] if element else name
            assert bson_name in fields, f'{plain}.{name} missing BSON field {bson_name}'
            bson_names.add(bson_name)
            sample[bson_name] = build(member_type, fields[bson_name])
            bson_attrs = re.findall(r'Bson(?:Element\("[^"]+"\)|DictionaryOptions\(DictionaryRepresentation\.ArrayOfDocuments\)|IgnoreIfNull|Id)', attrs)
            rendered_attrs = ''.join('[' + attr + ']' for attr in bson_attrs)
            compiler_type = member_type
            if compiler_type.endswith('?') and compiler_type[:-1] not in {'int', 'uint', 'long', 'float', 'double', 'bool'}:
                compiler_type = compiler_type[:-1]
            lines.append(f'{rendered_attrs} public {compiler_type} {name} {{ get; set; }}')
        assert set(fields) == bson_names, f'{plain} extra fields: {set(fields) - bson_names}'
        if plain not in emitted:
            emitted.add(plain)
            declarations.append(f'public class {plain} {{ ' + '\n'.join(lines) + ' }')
        return sample

    characters_schema = runtime.get_collection_schema('characters')

    def root_schema(name):
        if name == 'partners':
            return characters_schema
        if name == 'experiment_star_claims':
            return runtime.get_collection_schema('stages')
        if name == 'spent_totals':
            return runtime.get_collection_schema('inventory')
        return schema

    payload = {name: build(type_name, root_schema(name).resolve(name)) for name, type_name in roots.items()}
    payload.update(_small_rewards_sample())
    payload['spent_totals'] = {'5': Int64(2**40 + 60), '6': Int64(0)}
    for name, value in _everyday_sample().items():
        if isinstance(value, dict):
            payload[name].update(value)
        else:
            payload[name] = value
    payload['accumulated_pay_money'] = Int64(2**40 + 60)
    payload['accumulated_pay_reward_ids'] = [1, 3]
    payload['accumulated_extra_pay_reward_ids'] = [2]
    payload['pending_item_use']['SelectRewardIds'] = [101, 102, 101]
    payload['cerberus_game'] = _cerberus_sample(settled=True)
    payload['maintainer_action'] = _maintainer_sample(-(2**63), '{ "RewardId": 7 }')
    # Verify actual new-feature writes, not only synthetic schema defaults:
    # every language-local add/max template and representative detail edits.
    equips = PlayerEquipsService(SimpleNamespace(), runtime)
    characters = PlayerCharactersService(SimpleNamespace(), runtime)
    partner_rows = []
    for language in ('CN', 'EN'):
        token = resource_language.set(language)
        try:
            for partner_id in get_partner_entries_map():
                partner_rows.append(equips._build_partner_document(partner_id, len(partner_rows) + 1))
                target = build_partner_max_save_template(partner_id)
                if target is not None:
                    characters._apply_max_partner_template(partner_rows, 1011002, {'partner': target})
            added = equips._build_partner_document(16010000, len(partner_rows) + 1)
            added = equips._edit_partner(added, 'main-skill', {'skill_id': 1022})
            added = equips._edit_partner(added, 'skill-level', {'skill_id': 1022, 'value': 2})
            partner_rows.append(added)
        finally:
            resource_language.reset(token)
    payload['partners'] = partner_rows
    # Compare both the server's exact property graph and the driver's strict
    # deserialization of a populated GM document, including all nested Id fields.
    normalized = {name: root_schema(name).materialize_subpath(name, value) for name, value in payload.items()}
    declarations.append('public class LatestDocument {' + ''.join(
        f'[BsonElement("{name}")] public {type_name} Field{index} {{ get; set; }}'
        if not type_name.startswith('Dictionary<') or root_schema(name).resolve(name)['type'] == 'object' else
        f'[BsonElement("{name}")][BsonDictionaryOptions(DictionaryRepresentation.ArrayOfDocuments)] public {type_name} Field{index} {{ get; set; }}'
        for index, (name, type_name) in enumerate(roots.items())
    ) + '}')
    code = 'using System; using System.Collections.Generic; using MongoDB.Bson; using MongoDB.Bson.Serialization; using MongoDB.Bson.Serialization.Attributes; using MongoDB.Bson.Serialization.Options;\n'
    code += '\n'.join(declarations)
    code += '''
public static class SchemaBsonVerification {
    private static bool Equal(BsonValue left, BsonValue right) {
        if (left.IsBsonDocument && right.IsBsonDocument) {
            var a = left.AsBsonDocument; var b = right.AsBsonDocument;
            if (a.ElementCount != b.ElementCount) return false;
            foreach (var field in a) {
                BsonValue value;
                if (!b.TryGetValue(field.Name, out value) || !Equal(field.Value, value)) return false;
            }
            return true;
        }
        if (left.IsBsonArray && right.IsBsonArray) {
            var a = left.AsBsonArray; var b = right.AsBsonArray;
            if (a.Count != b.Count) return false;
            for (int i = 0; i < a.Count; i++) if (!Equal(a[i], b[i])) return false;
            return true;
        }
        // C# uint serializes as Int64; Python emits small non-negative IDs as
        // Int32. Both are accepted by the driver's uint serializer.
        if (left.IsNumeric && right.IsNumeric) return left.ToDouble() == right.ToDouble();
        return left.Equals(right);
    }
    public static void Verify(string json) {
        var source = BsonDocument.Parse(json);
        var value = BsonSerializer.Deserialize<LatestDocument>(source);
        var result = value.ToBsonDocument();
        if (!Equal(source, result)) throw new Exception("BSON fields or values changed during server round-trip: " + result.ToJson());
    }
}
'''
    result = subprocess.run([
        powershell, '-NoProfile', '-NonInteractive', '-File', str(Path(__file__).with_name('verify_schema_bson.ps1')),
        '-DriverPath', str(driver),
    ], input=json_util.dumps({'Source': code, 'Payload': json_util.dumps(normalized)}), capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
