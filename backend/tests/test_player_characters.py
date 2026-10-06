import asyncio
from types import SimpleNamespace

from backend.app.services.player.player_characters import get_character_default_fashion_id_map, get_character_equip_type_map, get_character_fashions_map, get_exhibition_fashion_id_map
from backend.app.services.player import player_characters_service
from backend.app.services.player.player_characters_service import PlayerCharactersService, _get_best_weapon_fashion_id
from backend.app.services.player.equips import get_equip_type_weapon_fashion_ids_map, get_weapon_fashion_id_entries_map
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime


def test_exhibition_fashion_map_resolves_reward_chain() -> None:
    fashions = get_exhibition_fashion_id_map()

    assert fashions[(1011002, 2)] == frozenset({6110102})
    assert fashions[(1011002, 3)] == frozenset({6110103})
    assert (1011002, 4) not in fashions


def test_default_fashion_map_uses_character_table_assignment() -> None:
    assert get_character_default_fashion_id_map()[1011002] == 6110101


def test_character_fashion_catalog_includes_all_head_variants() -> None:
    generic = next(fashion for fashion in get_character_fashions_map()[1011002] if fashion["Id"] == 6110101)

    assert generic["BigHeadIcon"]
    assert generic["BigHeadIconFashion"]
    assert generic["BigHeadIconLiberation"]


def test_best_weapon_fashion_prefers_quality_then_id() -> None:
    fashion_ids_map = get_equip_type_weapon_fashion_ids_map()
    entries_map = get_weapon_fashion_id_entries_map()

    assert all(
        _get_best_weapon_fashion_id(equip_type) == max(
            fashion_ids,
            key=lambda fashion_id: (entries_map[fashion_id]["Quality"], fashion_id),
        )
        for equip_type, fashion_ids in fashion_ids_map.items()
        if fashion_ids
    )


def test_max_weapon_fashion_unlocks_all_type_entries_and_applies_best() -> None:
    fashion_ids_map = get_equip_type_weapon_fashion_ids_map()
    character_id, equip_type = next(
        (character_id, equip_type)
        for character_id, equip_type in get_character_equip_type_map().items()
        if fashion_ids_map.get(equip_type)
    )
    service = object.__new__(PlayerCharactersService)
    service._build_weapon_fashion_document = lambda fashion_id, owner_id: {
        "_id": fashion_id,
        "ExpireTime": 0,
        "UseCharacterList": [owner_id],
    }
    existing = [{"_id": fashion_ids_map[equip_type][0], "ExpireTime": 0, "UseCharacterList": [999]}]

    weapon_fashions = service._apply_best_weapon_fashion(existing, character_id)
    use_character_ids_by_fashion = {
        entry["_id"]: set(entry["UseCharacterList"])
        for entry in weapon_fashions
    }
    best_fashion_id = _get_best_weapon_fashion_id(equip_type)

    assert set(fashion_ids_map[equip_type]).issubset(use_character_ids_by_fashion)
    assert use_character_ids_by_fashion[best_fashion_id] >= {character_id}
    assert all(
        character_id not in character_ids
        for fashion_id, character_ids in use_character_ids_by_fashion.items()
        if fashion_id != best_fashion_id
    )
    assert use_character_ids_by_fashion[fashion_ids_map[equip_type][0]] >= {999}


class _WeaponFashionCollection:
    def __init__(self, document) -> None:
        self.document = document
        self.projection = None
        self.update = None

    async def find_one(self, _query, projection):
        self.projection = projection
        return self.document

    async def update_one(self, _query, update):
        self.update = update
        return SimpleNamespace(matched_count=1)


class _WeaponFashionClient:
    def __init__(self, collection) -> None:
        self.collection = collection
        self._database_selected = False

    def __getitem__(self, _name):
        if not self._database_selected:
            self._database_selected = True
            return self
        return self.collection

    def close(self) -> None:
        pass


def test_update_weapon_fashion_preserves_unrelated_fashions(monkeypatch) -> None:
    collection = _WeaponFashionCollection({
        'characters': [{'_id': 1011002}],
        'weaponFashions': [
            {'_id': 7001, 'UseCharacterList': [1011002]},
            {'_id': 7002, 'UseCharacterList': [9999999]},
        ],
    })
    service = object.__new__(PlayerCharactersService)
    service._settings = SimpleNamespace(mongo_db='test')
    service._sanitize_characters_document = lambda document: document
    service._sanitize_character_list = lambda characters: characters
    service._sanitize_weapon_fashions = lambda fashions: fashions
    service._build_weapon_fashion_document = lambda fashion_id, character_id: {
        '_id': fashion_id,
        'UseCharacterList': [character_id],
    }

    monkeypatch.setattr(player_characters_service, 'create_mongo_client', lambda _settings: _WeaponFashionClient(collection))
    monkeypatch.setattr(player_characters_service, 'get_character_equip_type_map', lambda: {1011002: 1})
    monkeypatch.setattr(player_characters_service, 'get_equip_type_weapon_fashion_ids_map', lambda: {1: [7001, 7003]})

    result = asyncio.run(service.update_character_weapon_fashion(42, 1011002, 7003))

    assert result.CurrentWeaponFashionId == 7003
    assert collection.projection == {'characters': 1, 'weaponFashions': 1}
    assert collection.update == {
        '$set': {
            'weaponFashions': [
                {'_id': 7001, 'UseCharacterList': []},
                {'_id': 7002, 'UseCharacterList': [9999999]},
                {'_id': 7003, 'UseCharacterList': [1011002]},
            ],
        },
    }


def test_character_extra_info_ignores_expired_weapon_fashions(monkeypatch) -> None:
    now = 1_700_000_000
    collection = _WeaponFashionCollection({
        'characters': [{'_id': 1011002}],
        'fashions': [],
        'equips': [],
        'partners': [{'_id': 7, 'TemplateId': 16010000, 'CharacterId': 1011002,
                      'Quality': 4, 'StarSchedule': 162, 'BreakThrough': 3, 'Level': 30}],
        'weaponFashions': [
            {'_id': 7001, 'ExpireTime': 0, 'UseCharacterList': []},
            {'_id': 7002, 'ExpireTime': now + 1, 'UseCharacterList': [1011002]},
            {'_id': 7003, 'ExpireTime': now, 'UseCharacterList': [1011002]},
        ],
    })
    service = object.__new__(PlayerCharactersService)
    service._settings = SimpleNamespace(mongo_db='test')
    service._sanitize_characters_document = lambda document: document
    service._sanitize_character_list = lambda characters: characters
    service._sanitize_fashions = lambda fashions: fashions
    service._sanitize_equips = lambda equips: equips
    service._sanitize_weapon_fashions = lambda fashions: fashions

    monkeypatch.setattr(player_characters_service, 'create_mongo_client', lambda _settings: _WeaponFashionClient(collection))
    monkeypatch.setattr(player_characters_service.time, 'time', lambda: now)
    monkeypatch.setattr(player_characters_service, 'get_character_Intro_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_fashions_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_levelup_template_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_max_liberate_level_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_quality_bound_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_equip_type_map', lambda: {1011002: 1})
    monkeypatch.setattr(player_characters_service, 'get_equip_type_weapon_fashion_ids_map', lambda: {1: [7001, 7002, 7003]})
    monkeypatch.setattr(player_characters_service, 'get_weapon_fashion_id_entries_map', lambda: {
        fashion_id: {'Quality': 1, 'BigIcon': '', 'Name': '', 'Description': ''}
        for fashion_id in (7001, 7002, 7003)
    })
    monkeypatch.setattr(player_characters_service, 'get_equip_descriptions_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_equip_site_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_skill_ids_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_skill_entries_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_enhance_skill_ids_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_enhance_skill_entries_map', lambda: {})
    monkeypatch.setattr(player_characters_service, 'get_character_default_fashion_id_map', lambda: {})

    result = asyncio.run(service.get_character_extra_info(42, 1011002))

    assert result.CurrentWeaponFashionId == 7002
    assert result.Partner.record_id == 7
    assert result.Partner.CharacterId == 1011002
    assert result.Partner.Star == 4 and result.Partner.EnhancementLevel == 80
    assert {fashion.Id: fashion.IsLock for fashion in result.WeaponFashions} == {
        7001: False,
        7002: False,
        7003: True,
    }
