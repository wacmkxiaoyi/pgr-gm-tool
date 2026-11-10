import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import BSON

from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_characters as resources
from backend.app.services.player import player_characters_service as module
from backend.app.utils.resource_language import resource_language


class Collection:
    def __init__(self, document):
        self.document = document
        self.writes = []

    async def find_one(self, *args):
        return copy.deepcopy(self.document)

    async def update_one(self, query, update):
        self.writes.append(copy.deepcopy(update))
        self.document.update(copy.deepcopy(update['$set']))
        return SimpleNamespace(matched_count=1, modified_count=1)


@pytest.mark.parametrize('language', ['EN', 'CN'])
@pytest.mark.parametrize('operation', ['awaken', 'max', 'max_all'])
@pytest.mark.parametrize('selected', [False, True])
def test_super_writes_initialize_or_preserve_ball_without_changing_skills(monkeypatch, language, operation, selected):
    token = resource_language.set(language)
    try:
        character_id = 1011002
        balls = resources.get_liberate_ball_magic_ids()
        existing = [{'_id': balls[-1], 'Level': 1, 'future': {'keep': True}}] if selected else []
        chars = Collection({'characters': [{'_id': character_id, 'LiberateLv': 3,
                            'MagicList': existing, 'SkillList': [{'_id': 101201, 'Level': 7}]}],
                            'equips': [], 'fashions': [], 'weaponFashions': [], 'partners': []})
        protected = {'assign': {'chapters': [{'chapter_id': 2001, 'character_id': character_id}]},
                     'awareness': {'chapters': [{'chapter_id': 1, 'character_id': character_id}]},
                     'client_region': 'cn'}
        players = Collection({'gather_rewards': [], **copy.deepcopy(protected)})

        class Client:
            def __getitem__(self, name):
                return self if name == 'test' else chars if name == 'characters' else players

            def close(self):
                pass

        monkeypatch.setattr(module, 'create_mongo_client', lambda _: Client())
        template = resources.get_character_max_template_map()[character_id]
        monkeypatch.setattr(module, 'get_character_max_template_map', lambda: {character_id: template})
        service = module.PlayerCharactersService(SimpleNamespace(mongo_db='test'), DatabaseSchemaRuntime())
        for _ in range(2):
            if operation == 'awaken':
                asyncio.run(service.update_character_awaken(42, character_id, 5))
            elif operation == 'max':
                asyncio.run(service.max_character(42, character_id))
            else:
                asyncio.run(service.max_all_characters(42))
            saved = chars.document['characters'][0]
            assert saved['MagicList'] == (existing if selected else [{'_id': balls[0], 'Level': 1}])
            assert saved['LiberateLv'] == 5
            if operation == 'awaken':
                assert saved['SkillList'] == [{'_id': 101201, 'Level': 7}]
            assert {key: players.document[key] for key in protected} == protected
            assert set(players.writes[-1]['$set']) == {'gather_rewards'}
            assert BSON.encode(chars.writes[-1]).decode() == chars.writes[-1]
        # A GM downgrade removes configured ball effects, not unknown magic or metadata.
        future_magic = {'_id': 987654321, 'Level': 2, 'future': True}
        chars.document['characters'][0]['MagicList'].append(copy.deepcopy(future_magic))
        skills = copy.deepcopy(chars.document['characters'][0]['SkillList'])
        asyncio.run(service.update_character_awaken(42, character_id, 3))
        saved = chars.document['characters'][0]
        assert saved['MagicList'] == [future_magic]
        assert saved['SkillList'] == skills
        asyncio.run(service.update_character_awaken(42, character_id, 5))
        # Match the server: any nonempty MagicList is preserved on Super initialization.
        assert chars.document['characters'][0]['MagicList'] == [future_magic]
    finally:
        resource_language.reset(token)


def test_ball_initialization_uses_tables_and_preserves_unrelated_fields(monkeypatch):
    monkeypatch.setattr(resources, 'get_liberate_ball_magic_ids', lambda: [71, 72])
    monkeypatch.setattr(resources, 'get_character_ball_color_map', lambda: {10: 1, 20: 0})
    for character_id, level, expected in [(10, 5, [{'_id': 71, 'Level': 1}]),
                                         (10, 3, []), (20, 5, [])]:
        character = {'_id': character_id, 'LiberateLv': level, 'MagicList': [], 'future': True}
        resources.sync_character_liberate_ball_magic(character)
        assert character['MagicList'] == expected
        assert character['future'] is True
