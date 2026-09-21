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


def test_get_cleared_stage_ids_requires_explicit_passed_true(monkeypatch) -> None:
    service = object.__new__(PlayerStagesService)

    async def load_stage_document(_uid: int):
        return {
            'stages': [
                {'v': {'StageId': 1003, 'Passed': True}},
                {'v': {'StageId': 1001, 'Passed': True}},
                {'v': {'StageId': 1002, 'Passed': False}},
                {'v': {'StageId': 1004}},
                {'v': {'StageId': 1003, 'Passed': True}},
                {'v': {'StageId': 'invalid', 'Passed': True}},
                {'v': {'Passed': True}},
                {'v': {'StageId': 1005, 'Passed': 1}},
                {},
            ],
        }

    monkeypatch.setattr(service, '_load_stage_document', load_stage_document)

    assert asyncio.run(service.get_cleared_stage_ids(uid=42)) == [1001, 1003]


def test_add_stages_persists_complete_raw_completion_record(monkeypatch) -> None:
    collection = _FakeCollection()
    client = _FakeClient(collection)
    service = object.__new__(PlayerStagesService)
    service._settings = SimpleNamespace(mongo_db='test')

    monkeypatch.setattr(player_stages_service, 'create_mongo_client', lambda _settings: client)
    monkeypatch.setattr(player_stages_service, 'get_stage_entries_map', lambda: {1001: {}})
    monkeypatch.setattr(player_stages_service.time, 'time', lambda: 1_700_000_000)

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
                        'PassTimesToday': 0,
                        'PassTimesTotal': 1,
                        'BuyCount': 0,
                        'Score': 0,
                        'LastPassTime': 1_700_000_000,
                        'RefreshTime': 1_700_000_000,
                        'CreateTime': 1_700_000_000,
                        'BestRecordTime': 0,
                        'LastRecordTime': 0,
                        'BestCardIds': [1021001],
                        'LastCardIds': [1021001],
                        'Achievement': 0,
                    },
                }],
            },
        },
    }
    assert client.closed
