import asyncio
from types import SimpleNamespace

from backend.app.services.player import player_stages_service
from backend.app.services.player.player_stages_service import PlayerStagesService


class _FakeCollection:
    def __init__(self) -> None:
        self.update_filter = None
        self.update = None

    async def find_one(self, query, projection):
        return {'_id': 'stage-document', 'stages': []}

    async def update_one(self, query, update):
        self.update_filter = query
        self.update = update
        return SimpleNamespace(modified_count=1)


class _FakeClient:
    def __init__(self, collection: _FakeCollection) -> None:
        self._collection = collection
        self.closed = False

    def __getitem__(self, _database_name):
        return self if _database_name == 'test' else self._collection

    def close(self) -> None:
        self.closed = True

def test_add_stages_persists_skipped_battle_completion_fields(monkeypatch) -> None:
    collection = _FakeCollection()
    client = _FakeClient(collection)
    service = object.__new__(PlayerStagesService)
    service._settings = SimpleNamespace(mongo_db='test')

    monkeypatch.setattr(player_stages_service, 'create_mongo_client', lambda _settings: client)
    monkeypatch.setattr(player_stages_service, 'get_stage_entries_map', lambda: {1001: {}})

    result = asyncio.run(service.add_stages(uid=42, stage_ids=[1001]))

    assert result.added_count == 1
    assert collection.update_filter == {'_id': 'stage-document'}
    assert collection.update == {
        '$push': {
            'stages': {
                '$each': [{
                    'k': 1001,
                    'v': {
                        'StageId': 1001,
                        'StarsMark': 7,
                        'Passed': True,
                        'PassTimesTotal': 1,
                    },
                }],
            },
        },
    }
    assert client.closed
