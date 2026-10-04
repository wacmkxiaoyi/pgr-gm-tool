import asyncio
import base64
import copy
import os
from pathlib import Path
import shutil
import subprocess
from types import SimpleNamespace

import pytest
from bson import BSON, json_util

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_characters_service, player_profile_service
from backend.app.services.player.player_characters_service import PlayerCharactersService
from backend.app.services.player.player_profile_service import PlayerProfileService


class Collection:
    def __init__(self, document):
        self.document = copy.deepcopy(document)
        self.updates = []

    async def find_one(self, *args, **kwargs):
        return copy.deepcopy(self.document)

    async def update_one(self, query, update, **kwargs):
        self.updates.append(update)
        self.document.update(copy.deepcopy(update['$set']))
        return SimpleNamespace(matched_count=1, modified_count=1)


class Client:
    def __init__(self, collections):
        self.collections = collections

    def __getitem__(self, name):
        return self if name == 'test' else self.collections[name]

    def close(self):
        pass


@pytest.fixture
def unlock_services(monkeypatch):
    players = Collection({'unlocked_medals': [], 'unlocked_chat_boards': []})
    characters = Collection({'nameplates': [], 'chat_emojis': [], 'score_titles': []})
    client = Client({'players': players, 'characters': characters})
    monkeypatch.setattr(player_profile_service, 'create_mongo_client', lambda _: client)
    monkeypatch.setattr(player_characters_service, 'create_mongo_client', lambda _: client)
    monkeypatch.setattr(player_profile_service.time, 'time', lambda: 1_700_000_000)
    monkeypatch.setattr(player_characters_service, 'get_nameplate_entires_map', lambda: {1001: {}})
    monkeypatch.setattr(player_characters_service, 'get_emoji_entires_map', lambda: {1002: {}})
    monkeypatch.setattr(player_characters_service, 'get_score_title_entires_map', lambda: {1003: {'MaxQuality': 5}})
    monkeypatch.setattr(player_profile_service, 'get_medal_keep_time_map', lambda: {1004: 3600})
    runtime = DatabaseSchemaRuntime()
    settings = SimpleNamespace(mongo_db='test')
    profile_service = PlayerProfileService(settings, None, runtime)

    async def get_profile(_uid):
        return None

    profile_service.get_player_profile = get_profile
    character_service = PlayerCharactersService(settings, runtime)
    return profile_service, character_service, players, characters


def write_unlocks(services):
    profile, character, players, characters = services
    asyncio.run(profile.select_medal(42, 1004))
    asyncio.run(profile.select_chat_board(42, 25000001))
    asyncio.run(character.select_nameplate(42, 1001))
    asyncio.run(character.unlock_chat_emojis(42, [1002]))
    asyncio.run(character.unlock_score_titles(42, [1003]))
    return {
        **{key: players.document[key] for key in ('unlocked_medals', 'unlocked_chat_boards')},
        **{key: characters.document[key] for key in ('nameplates', 'chat_emojis', 'score_titles')},
    }


def test_unlock_writes_and_repeat_reads_use_only_current_bson_ids(unlock_services):
    payload = write_unlocks(unlock_services)
    for entries in payload.values():
        assert len(entries) == 1
        assert entries[0]['_id'] > 0
        assert 'id' not in entries[0] and 'Id' not in entries[0]
    assert payload['unlocked_medals'][0] == {'_id': 1004, 'time': 1_700_000_000, 'keep_time': 3600}
    assert payload['unlocked_chat_boards'][0] == {'_id': 25000001, 'get_time': 1_700_000_000, 'end_time': 0}
    profile, character, players, characters = unlock_services
    assert asyncio.run(character.get_nameplate_state(42)) == (1001, [1001])
    assert asyncio.run(character.get_locked_chat_emojis(42)) == {}
    assert asyncio.run(character.get_locked_score_titles(42)) == {}
    assert write_unlocks(unlock_services) == payload
    assert BSON.encode(payload).decode() == payload


def test_unlock_schema_has_no_old_id_paths_or_defaults():
    runtime = DatabaseSchemaRuntime()
    for collection, paths in {
        'players': ['unlocked_medals', 'unlocked_chat_boards'],
        'characters': ['nameplates', 'chat_emojis', 'score_titles'],
    }.items():
        schema = runtime.get_collection_schema(collection)
        for path in paths:
            assert schema.allows_update_path(f'{path}.0._id')
            assert not schema.allows_update_path(f'{path}.0.id')
            assert not schema.allows_update_path(f'{path}.0.Id')
    assert runtime.get_collection_schema('players').build_default('unlocked_chat_boards') == [
        {'_id': 25000001, 'get_time': 0, 'end_time': 0},
    ]
    schema = runtime.get_collection_schema('players')
    for path in (
        'sign_in_states.0', 'life_tree_data.UnlockCharacterData.0.v',
        'vote_alarm_data.0', 'fuben_main_line2_data.MainDatas.0',
        'fuben_main_line2_data.ChapterDatas.0', 'bfrt.teams.0', 'bfrt.groups.0',
        'course.stages.0', 'pending_item_use.Goods.0', 'passport.passport_infos.0',
        'pending_purchase', 'lotto.infos.0',
    ):
        assert schema.allows_update_path(f'{path}._id'), path
        assert not schema.allows_update_path(f'{path}.id'), path
        assert not schema.allows_update_path(f'{path}.Id'), path


def test_player_profile_reads_current_medal_and_board_ids(unlock_services, monkeypatch):
    _, _, players, _ = unlock_services
    players.document = {
        'player_data': {'_id': 42, 'CurrMedalId': 1004, 'CurrentChatBoardId': 25000001},
        'unlocked_medals': [{'_id': 1004, 'time': 1_700_000_000, 'keep_time': 3600}],
        'unlocked_chat_boards': [{'_id': 25000001, 'get_time': 1_700_000_000, 'end_time': 0}],
    }
    monkeypatch.setattr(player_profile_service, 'get_medal_entires_map', lambda: {1004: {}})
    monkeypatch.setattr(player_profile_service, 'get_chat_board_entires_map', lambda: {25000001: {}})

    async def quantities(_uid):
        return {}

    service = PlayerProfileService(
        SimpleNamespace(mongo_db='test'), SimpleNamespace(get_inventory_quantities=quantities), DatabaseSchemaRuntime(),
    )
    record = asyncio.run(service.get_player_profile(42))
    assert record.current_medal_id == 1004
    assert record.unlock_medals == [1004]
    assert record.current_chat_board_id == 25000001
    assert record.unlock_chat_boards == [25000001]


def test_actual_mongodb_driver_strictly_deserializes_gm_unlock_writes(unlock_services):
    powershell = shutil.which('powershell')
    configured_driver = os.environ.get('MONGODB_BSON_TEST_DLL')
    driver = Path(configured_driver) if configured_driver else (
        Path.home() / '.nuget/packages/mongodb.bson/2.21.0/lib/net472/MongoDB.Bson.dll'
    )
    if not powershell or not driver.is_file():
        pytest.skip('Requires Windows PowerShell and MongoDB.Bson 2.21.0 (MONGODB_BSON_TEST_DLL)')
    payload = base64.b64encode(json_util.dumps(write_unlocks(unlock_services)).encode('utf-8')).decode('ascii')
    result = subprocess.run([
        powershell, '-NoProfile', '-NonInteractive',
        '-File', str(Path(__file__).with_name('verify_unlock_bson.ps1')),
        '-DriverPath', str(driver), '-Payload', payload,
    ], capture_output=True, text=True, timeout=60)
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'strict MongoDB.Bson deserialization' in result.stdout
