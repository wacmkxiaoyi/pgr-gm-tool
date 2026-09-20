from backend.app.services.player.player_characters import get_character_default_fashion_id_map, get_character_equip_type_map, get_character_fashions_map, get_exhibition_fashion_id_map
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
