import asyncio
import copy
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from bson import BSON
from bson.int64 import Int64
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo import ReturnDocument

from backend.app.apis import router
from backend.app.apis import __dict__ as api_globals
from backend.app.config import Settings
from backend.app.db.models.player_dorm import AddFurnitureRequest
from backend.app.services.db_schema_runtime import init_database_schema_runtime
from backend.app.services.api_errors import AppError
from backend.app.services.player import player_dorm_service as module
from backend.app.utils.resource_language import ResourceLanguageMiddleware, resource_language


@pytest.fixture
def dorm_service(monkeypatch):
    items = [
        {"_id": 5, "config_id": 10, "dormitory_id": -1, "addition": 321, "attr_list": [100, 20, 300], "is_locked": True},
        {"_id": 2, "config_id": 20, "dormitory_id": 21001, "addition": 0, "attr_list": [9, 80, 70]},
        {"_id": 7, "config_id": 10, "dormitory_id": -1, "addition": 0, "attr_list": [60, 60, 60]},
    ]
    collection = SimpleNamespace(
        find_one=AsyncMock(return_value={"dorm": {"furniture": items}}),
        update_one=AsyncMock(return_value=SimpleNamespace(modified_count=1)),
        find_one_and_update=AsyncMock(return_value={"dorm": {"furniture": items}}),
    )
    client = SimpleNamespace(close=lambda: None)
    class Client:
        def __getitem__(self, key):
            return {"players": collection}
        close = client.close
    monkeypatch.setattr(module, "create_mongo_client", lambda settings: Client())
    monkeypatch.setattr(module, "get_furniture_entries_map", lambda: {
        10: {"Name": "Zulu chair", "Desc": "A soft seat", "TypeId": 1, "SuitId": 1},
        20: {"Name": "Alpha table", "Desc": "Wooden desk", "TypeId": 2, "SuitId": 2},
    })
    monkeypatch.setattr(module, "get_furniture_type_entires_map", lambda: {
        1: {"CategoryName": "Chair", "MajorType": 2},
        2: {"CategoryName": "Table", "MajorType": 2},
        3: {"CategoryName": "Floor", "MajorType": 1},
    })
    monkeypatch.setattr(module, "get_furniture_suit_name_map", lambda: {1: "Modern", 2: "Classic"})
    monkeypatch.setattr(module, "get_furniture_additional_attr_entries_map", lambda: {321: {"Introduce": "Bonus vitality"}})
    monkeypatch.setattr(module, "get_furniture_create_max_attr_map", lambda: {1: 200, 2: 201, 3: 202})
    monkeypatch.setattr(module, "get_furniture_template_count_map", lambda: {10: 3, 20: 2})
    monkeypatch.setattr(module, "get_base_furniture_list", lambda: [])
    service = module.PlayerDormService(Settings({}), init_database_schema_runtime())
    return service, collection


@pytest.mark.parametrize("sort_by,expected", [
    ("record_id", [2, 5, 7]), ("name", [2, 5, 7]), ("type", [5, 7, 2]),
    ("description", [5, 7, 2]), ("suit", [2, 5, 7]),
    ("beauty", [2, 7, 5]), ("comfort", [5, 7, 2]), ("utility", [7, 2, 5]),
])
def test_all_furniture_sort_columns(dorm_service, sort_by, expected):
    service, _ = dorm_service
    asc = asyncio.run(service.list_furniture(42, sort_by=sort_by))
    desc = asyncio.run(service.list_furniture(42, sort_by=sort_by, sort_order="desc"))
    assert [item.record_id for item in asc.items] == expected
    assert [item.record_id for item in desc.items] == expected[::-1]


@pytest.mark.parametrize("keyword,expected", [
    ("ALPHA", [2]), ("Chair", [5, 7]), ("soft", [5, 7]), ("Classic", [2]),
    ("100", [5]), ("80", [2]), ("300", [5]), ("vitality", [5]),
    ("None", [2, 7]), ("5", []),
])
def test_furniture_search_includes_display_columns_not_record_id(dorm_service, keyword, expected):
    service, _ = dorm_service
    result = asyncio.run(service.list_furniture(42, keyword=keyword))
    assert [item.record_id for item in result.items] == expected


def test_pagination_clamps_after_deletion_and_handles_missing_data(dorm_service):
    service, collection = dorm_service
    page = asyncio.run(service.list_furniture(42, page=99, page_size=2))
    assert (page.page, page.total_pages, page.total) == (2, 2, 3)
    assert [item.record_id for item in page.items] == [7]
    collection.find_one.return_value = {"dorm": {"furniture": [None, {}, {"_id": 1}, {"_id": 2, "config_id": 10}]}}
    result = asyncio.run(service.list_furniture(42))
    assert len(result.items) == 1
    assert result.items[0].beauty is None
    collection.find_one.return_value = None
    assert asyncio.run(service.list_furniture(42)).total == 0


def test_deletes_by_instance_id_and_clears_only_unused_atomically(dorm_service):
    service, collection = dorm_service
    assert asyncio.run(service.delete_furniture(42, 2))
    collection.find_one.assert_awaited_once_with(
        {"player_data._id": Int64(42), "dorm.furniture._id": 2},
        {"dorm.furniture": 1},
    )
    deletable = {"_id": 2, "$or": [{"config_id": {"$nin": []}}, {"dormitory_id": -1}]}
    collection.update_one.assert_awaited_once_with(
        {"player_data._id": Int64(42), "dorm.furniture": {"$elemMatch": deletable}},
        {"$pull": {"dorm.furniture": deletable}},
    )
    assert asyncio.run(service.clear_unused_furniture(42)) == 2
    collection.find_one_and_update.assert_awaited_once_with(
        {"player_data._id": Int64(42), "dorm.furniture.dormitory_id": -1},
        {"$pull": {"dorm.furniture": {"dormitory_id": -1}}},
        projection={"dorm.furniture": 1}, return_document=ReturnDocument.BEFORE,
    )
    collection.find_one_and_update.return_value = None
    assert asyncio.run(service.clear_unused_furniture(42)) == 0
    collection.update_one.return_value.modified_count = 0
    assert not asyncio.run(service.delete_furniture(42, 999))


@pytest.mark.parametrize("major_type,dormitory_id,protected", [
    (1, 21001, True), (1, -1, False), (2, 21001, False), (2, -1, False),
])
def test_furniture_delete_protection(dorm_service, monkeypatch, major_type, dormitory_id, protected):
    service, collection = dorm_service
    monkeypatch.setattr(module, "get_furniture_type_entires_map", lambda: {1: {"CategoryName": "Floor", "MajorType": major_type}})
    collection.find_one.return_value = {"dorm": {"furniture": [{"_id": 5, "config_id": 10, "dormitory_id": dormitory_id}]}}
    if protected:
        with pytest.raises(AppError) as error:
            asyncio.run(service.delete_furniture(42, 5))
        assert error.value.status_code == 409
        assert error.value.code == "furniture.in_use_delete_protected"
        collection.update_one.assert_not_awaited()
    else:
        assert asyncio.run(service.delete_furniture(42, 5))
        predicate = collection.update_one.call_args.args[1]["$pull"]["dorm.furniture"]
        assert predicate["$or"][0]["config_id"]["$nin"] == ([10] if major_type == 1 else [])
        assert predicate["$or"][1] == {"dormitory_id": -1}


def test_delete_rechecks_protection_when_furniture_is_placed_during_update(dorm_service, monkeypatch):
    service, collection = dorm_service
    monkeypatch.setattr(module, "get_furniture_type_entires_map", lambda: {1: {"CategoryName": "Floor", "MajorType": 1}})
    collection.find_one.side_effect = [
        {"dorm": {"furniture": [{"_id": 5, "config_id": 10, "dormitory_id": -1}]}},
        {"dorm": {"furniture": [{"_id": 5, "config_id": 10, "dormitory_id": 21001}]}},
    ]
    collection.update_one.return_value.modified_count = 0
    with pytest.raises(AppError) as error:
        asyncio.run(service.delete_furniture(42, 5))
    assert error.value.code == "furniture.in_use_delete_protected"
    query, update = collection.update_one.call_args.args
    assert query["dorm.furniture"]["$elemMatch"] == update["$pull"]["dorm.furniture"]
    assert update["$pull"]["dorm.furniture"]["$or"] == [
        {"config_id": {"$nin": [10]}}, {"dormitory_id": -1},
    ]


def test_dorm_schema_preserves_sample_fields_and_bson_types():
    schema = init_database_schema_runtime().get_collection_schema("players")
    dorm = {
        "rooms": [{"_id": 21001, "name": "Dormitory 1"}],
        "furniture": [{"_id": 7, "config_id": 8983146, "addition": 321, "dormitory_id": -1,
                       "attr_list": [999999, 999999, 999999], "base_attr_list": [20, 30, 40], "is_locked": False}],
        "layouts": [{"custom": {"preserved": True}}], "next_furniture_id": 8,
    }
    before = copy.deepcopy(dorm)
    materialized = schema.materialize_write(dorm, "dorm")
    decoded = BSON.encode(materialized).decode()
    assert decoded["furniture"][0]["_id"] == 7
    assert type(decoded["furniture"][0]["_id"]) is int
    assert decoded["furniture"][0]["attr_list"] == [999999] * 3
    assert decoded["layouts"] == dorm["layouts"]
    assert decoded["next_furniture_id"] == 8
    assert dorm == before


def test_add_furniture_preserves_existing_records_and_rotates_attributes(dorm_service, monkeypatch):
    service, collection = dorm_service
    entries = {index: {"TypeId": 1, "SuitId": 4} for index in range(10, 16)}
    monkeypatch.setattr(module, "get_furniture_entries_map", lambda: entries)
    monkeypatch.setattr(module, "get_furniture_additional_attr_entries_map", lambda: {index: {} for index in range(321, 326)})
    dorm = {"furniture": [{"_id": 90, "config_id": 10, "dormitory_id": 21001, "custom": "preserved"}],
            "furniture_unlocks": [10], "next_furniture_id": 8}
    collection.find_one.return_value = {"dorm": dorm}
    result = asyncio.run(service.add_furniture(42, AddFurnitureRequest(
        config_ids=[15, 10, 14, 13, 12, 11, 10], addition_ids=[324, 321, 325, 322, 323],
    )))
    assert result.added_count == 6
    query, update = collection.update_one.call_args.args
    rows = update["$push"]["dorm.furniture"]["$each"]
    assert [row["_id"] for row in rows] == list(range(91, 97))
    assert [row["config_id"] for row in rows] == list(range(10, 16))
    assert [row["addition"] for row in rows] == [324, 321, 325, 322, 323, 324]
    assert all(row["attr_list"] == [67, 67, 66] and row["base_attr_list"] == [3, 3, 3] for row in rows)
    assert all(row["dormitory_id"] == -1 and row["x"] == row["y"] == row["angle"] == 0 and not row["is_locked"] for row in rows)
    assert update["$addToSet"]["dorm.furniture_unlocks"]["$each"] == list(range(10, 16))
    assert update["$set"] == {"dorm.next_furniture_id": 97}
    assert query["dorm.furniture"] == dorm["furniture"]
    assert "dorm.rooms" not in query
    assert dorm["furniture"][0]["custom"] == "preserved"
    assert type(BSON.encode({"rows": rows}).decode()["rows"][0]["_id"]) is int


def test_custom_furniture_attributes_and_empty_additions(dorm_service):
    service, collection = dorm_service
    result = asyncio.run(service.add_furniture(42, AddFurnitureRequest(
        config_ids=[10], attr_mode="custom", attr_list=[0, 9999999, 5], addition_ids=[],
    )))
    assert result.added_count == 1
    query, update = collection.update_one.call_args.args
    row = update["$push"]["dorm.furniture"]["$each"][0]
    assert row["attr_list"] == [0, 9999999, 5]
    assert row["addition"] == 0
    assert query["dorm.next_furniture_id"] == {"$exists": False}


def test_add_by_templates_preserves_duplicates_and_accumulates_groups(dorm_service, monkeypatch):
    service, collection = dorm_service
    monkeypatch.setattr(module, "get_dorm_template_entries_map", lambda: {
        20: {"Name": "Empty", "FurnitureId": [10]},
        201: {"Name": "Cafe", "FurnitureId": [10, 10, 20]},
        202: {"Name": "Cabin", "FurnitureId": [10, 20, 20]},
    })
    result = asyncio.run(service.add_furniture(42, AddFurnitureRequest(template_ids=[202, 201, 201], addition_ids=[])))
    query, update = collection.update_one.call_args.args
    rows = update["$push"]["dorm.furniture"]["$each"]
    assert result.added_count == 6
    assert [row["config_id"] for row in rows] == [10, 10, 10, 20, 20, 20]
    assert all(row["dormitory_id"] == -1 for row in rows)
    assert update["$addToSet"]["dorm.furniture_unlocks"]["$each"] == [10, 20]
    assert "dorm.rooms" not in query
    with pytest.raises(AppError):
        asyncio.run(service.add_furniture(42, AddFurnitureRequest(template_ids=[999], addition_ids=[])))


def test_add_by_suits_adds_one_of_each_configuration(dorm_service):
    service, collection = dorm_service
    result = asyncio.run(service.add_furniture(42, AddFurnitureRequest(suit_ids=[1, 2, 1], addition_ids=[])))
    rows = collection.update_one.call_args.args[1]["$push"]["dorm.furniture"]["$each"]
    assert result.added_count == 2
    assert [row["config_id"] for row in rows] == [10, 20]
    with pytest.raises(AppError):
        asyncio.run(service.add_furniture(42, AddFurnitureRequest(suit_ids=[999], addition_ids=[])))


@pytest.mark.parametrize("room_count", [0, 1, 7])
def test_unlock_all_rebuilds_template_counts_and_fills_rooms_from_empty_template(dorm_service, monkeypatch, room_count):
    service, collection = dorm_service
    entries = {10: {"TypeId": 1, "SuitId": 4}, 20: {"TypeId": 2, "SuitId": 4},
               30: {"TypeId": 3, "SuitId": 4}, 11: {"TypeId": 1, "SuitId": 8},
               40: {"TypeId": 4, "SuitId": 4}}
    monkeypatch.setattr(module, "get_furniture_entries_map", lambda: entries)
    monkeypatch.setattr(module, "get_furniture_type_entires_map", lambda: {
        1: {"MajorType": 1}, 2: {"MajorType": 1}, 3: {"MajorType": 1}, 4: {"MajorType": 2},
    })
    monkeypatch.setattr(module, "get_furniture_create_max_attr_map", lambda: {1: 200, 2: 201, 3: 202, 4: 203})
    monkeypatch.setattr(module, "get_furniture_additional_attr_entries_map", lambda: {321: {}, 322: {}})
    # The empty template intentionally selects a non-SuitId=4 floor.
    monkeypatch.setattr(module, "get_base_furniture_list", lambda: [11, 20, 30])
    monkeypatch.setattr(module, "get_furniture_template_count_map", lambda: {10: 3, 20: 2, 40: 5, 999: 9})
    rooms = [{"_id": 21001 + index} for index in range(room_count)]
    if rooms:
        rooms.append(rooms[0].copy())
    dorm = {"rooms": rooms, "furniture": [{"_id": 99, "config_id": 999}],
            "furniture_unlocks": [999], "next_furniture_id": 200}
    collection.find_one.return_value = {"dorm": dorm}
    result = asyncio.run(service.add_furniture(42, AddFurnitureRequest(unlock_all=True)))
    query, update = collection.update_one.call_args.args
    assert set(update) == {"$set"}
    rows = update["$set"]["dorm.furniture"]
    assert result.added_count == 5 + max(4, room_count) + max(2, room_count) + max(1, room_count)
    initial_configs = [10, 10, 10, 11, 20, 20, 30, 40, 40, 40, 40, 40]
    assert [row["config_id"] for row in rows[:12]] == initial_configs
    assert [row["config_id"] for row in rows[12:]] == (
        [11] * max(0, room_count - 4) + [20] * max(0, room_count - 2) + [30] * max(0, room_count - 1)
    )
    assert all(row["config_id"] != 999 for row in rows)
    assert len({row["_id"] for row in rows}) == len(rows)
    assert update["$set"]["dorm.next_furniture_id"] == 200 + len(rows)
    assert update["$set"]["dorm.furniture_unlocks"] == sorted(entries)
    assert query["dorm.rooms"] == rooms
    for room in rooms:
        for type_id in (1, 2, 3):
            assert sum(row["dormitory_id"] == room["_id"] and entries[row["config_id"]]["TypeId"] == type_id for row in rows) == 1
    assert next(row for row in rows if row["config_id"] == 40)["dormitory_id"] == -1
    assert [row["addition"] for row in rows] == [321 if index % 2 == 0 else 322 for index in range(len(rows))]
    assert next(row for row in rows if row["config_id"] == 20)["attr_list"] == [67, 67, 67]
    assert next(row for row in rows if row["config_id"] == 30)["attr_list"] == [68, 67, 67]
    assert dorm["furniture_unlocks"] == [999]


def test_furniture_add_conflict_and_invalid_resources_do_not_overwrite(dorm_service, monkeypatch):
    service, collection = dorm_service
    for payload, code in [(AddFurnitureRequest(config_ids=[999], addition_ids=[]), "furniture.config_invalid"),
                          (AddFurnitureRequest(config_ids=[10], addition_ids=[999]), "furniture.addition_invalid")]:
        with pytest.raises(AppError) as error:
            asyncio.run(service.add_furniture(42, payload))
        assert error.value.code == code
    collection.update_one.assert_not_awaited()
    collection.update_one.return_value.modified_count = 0
    with pytest.raises(AppError) as error:
        asyncio.run(service.add_furniture(42, AddFurnitureRequest(config_ids=[10], addition_ids=[])))
    assert error.value.code == "furniture.conflict"
    collection.find_one.return_value = None
    with pytest.raises(AppError) as error:
        asyncio.run(service.add_furniture(42, AddFurnitureRequest(config_ids=[10], addition_ids=[])))
    assert error.value.code == "player.not_found"


def test_unlock_all_missing_default_fails_before_write(dorm_service, monkeypatch):
    service, collection = dorm_service
    collection.find_one.return_value = {"dorm": {"rooms": [{"_id": 1}, {"_id": 2}]}}
    monkeypatch.setattr(module, "get_furniture_entries_map", lambda: {10: {"TypeId": 3, "SuitId": 8}})
    monkeypatch.setattr(module, "get_furniture_template_count_map", lambda: {})
    with pytest.raises(AppError) as error:
        asyncio.run(service.add_furniture(42, AddFurnitureRequest(unlock_all=True, addition_ids=[])))
    assert error.value.code == "furniture.basic_config_missing"
    collection.update_one.assert_not_awaited()


def test_furniture_api_routes_and_validation(dorm_service, monkeypatch):
    service, collection = dorm_service
    monkeypatch.setitem(api_globals, "_get_active_session", lambda token: object())
    monkeypatch.setitem(api_globals, "_get_selected_uid_or_error", AsyncMock(return_value=42))
    monkeypatch.setitem(api_globals, "get_database_health_snapshot", lambda settings: {})
    monkeypatch.setitem(api_globals, "is_database_snapshot_healthy", lambda snapshot: True)
    app = FastAPI()
    app.state.settings = Settings({})
    app.state.player_dorm_service = service
    app.add_middleware(ResourceLanguageMiddleware)
    app.include_router(router)
    client = TestClient(app)
    response = client.get("/api/database-furnitures/selected?sort_by=beauty&keyword=100")
    assert response.status_code == 200
    assert response.json()["items"][0]["record_id"] == 5
    assert client.get("/api/database-furnitures/selected?sort_by=addition").status_code == 422
    assert client.get("/api/database-furnitures/selected?sort_by=actions").status_code == 422
    assert client.delete("/api/database-furnitures/selected/unused").json() == {"deleted_count": 2}
    assert client.delete("/api/database-furnitures/selected/2").json() == {"record_id": 2, "deleted": True}
    response = client.get("/api/database-furnitures/selected?keyword=无", headers={"Accept-Language": "zh-CN"})
    assert [row["record_id"] for row in response.json()["items"]] == [2, 7]
    assert resource_language.get() == "EN"
    response = client.post("/api/database-furnitures/selected", json={"config_ids": [10], "addition_ids": []})
    assert response.status_code == 200
    assert response.json() == {"added_count": 1, "unlock_all": False}
    for payload in [{}, {"config_ids": [10], "suit_ids": [1]},
                    {"unlock_all": True, "template_ids": [20]},
                    {"template_ids": [20], "suit_ids": [1]},
                    {"config_ids": [10], "attr_mode": "custom"},
                    {"config_ids": [10], "attr_list": [0, 0]},
                    {"config_ids": [10], "attr_mode": "custom", "attr_list": [0, 0, 10000000]},
                    {"config_ids": [10], "attr_mode": "custom", "attr_list": [-1, 0, 0]},
                    {"config_ids": [10], "attr_mode": "custom", "attr_list": [0.5, 0, 0]},
                    {"config_ids": [10], "attr_mode": "custom", "attr_list": [True, 0, 0]}]:
        assert client.post("/api/database-furnitures/selected", json=payload).status_code == 422
    monkeypatch.setattr(module, "get_furniture_type_entires_map", lambda: {2: {"CategoryName": "Floor", "MajorType": 1}})
    with pytest.raises(AppError) as error:
        client.delete("/api/database-furnitures/selected/2")
    assert error.value.status_code == 409
    assert error.value.code == "furniture.in_use_delete_protected"


def test_furniture_routes_require_healthy_database_and_selected_user(dorm_service, monkeypatch):
    service, collection = dorm_service
    selected_uid = AsyncMock(return_value=42)
    monkeypatch.setitem(api_globals, "_get_active_session", lambda token: object())
    monkeypatch.setitem(api_globals, "_get_selected_uid_or_error", selected_uid)
    monkeypatch.setitem(api_globals, "get_database_health_snapshot", lambda settings: {})
    monkeypatch.setitem(api_globals, "is_database_snapshot_healthy", lambda snapshot: False)
    app = FastAPI()
    app.state.settings = Settings({})
    app.state.player_dorm_service = service
    app.include_router(router)
    client = TestClient(app)
    for method, path in (
        ("get", "/api/database-furnitures/selected"),
        ("delete", "/api/database-furnitures/selected/unused"),
        ("delete", "/api/database-furnitures/selected/2"),
    ):
        with pytest.raises(AppError) as error:
            getattr(client, method)(path)
        assert error.value.status_code == 409
    selected_uid.assert_not_awaited()
    with pytest.raises(AppError) as error:
        client.post("/api/database-furnitures/selected", json={"config_ids": [10], "addition_ids": []})
    assert error.value.code == "database.unhealthy_player_update"
    collection.find_one.assert_not_awaited()
    collection.update_one.assert_not_awaited()
    collection.find_one_and_update.assert_not_awaited()
    monkeypatch.setitem(api_globals, "is_database_snapshot_healthy", lambda snapshot: True)
    selected_uid.side_effect = AppError(code="account.selection_required", status_code=409)
    with pytest.raises(AppError) as error:
        client.delete("/api/database-furnitures/selected/unused")
    assert error.value.code == "account.selection_required"
    collection.find_one_and_update.assert_not_awaited()
