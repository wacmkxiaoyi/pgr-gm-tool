import asyncio
import copy
from types import SimpleNamespace

import pytest
from bson import BSON
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app import apis
from backend.app.services.api_errors import AppError
from backend.app.services.db_schema_runtime import DatabaseSchemaRuntime
from backend.app.services.player import player_items_service as module
from backend.app.services.player.player_items import get_item_weapon_fashion_map
from backend.app.utils.resource_language import resource_language


@pytest.mark.parametrize("language", ["CN", "EN"])
@pytest.mark.parametrize("existing", [None, 0, 1900000000])
def test_ticket_grants_unlock_permanently_and_preserve_other_state(monkeypatch, language, existing):
    token = resource_language.set(language)
    try:
        mapping = get_item_weapon_fashion_map()
        assert mapping
        item_id, fashion_id = next((key, value) for key, value in mapping.items() if key != value)
        original = {"_id": fashion_id, "ExpireTime": existing,
                    "UseCharacterList": [1011002], "future": {"keep": True}}
        state = {"weaponFashions": [] if existing is None else [copy.deepcopy(original)],
                 "characters": [{"_id": 1011002}], "future": True}
        writes = []

        class Collection:
            async def update_one(self, query, update):
                writes.append(update)
                rows = state["weaponFashions"]
                current = next((row for row in rows if row["_id"] == fashion_id), None)
                if "$set" in update:
                    if current is None:
                        return SimpleNamespace(matched_count=0, modified_count=0)
                    changed = current["ExpireTime"] != 0
                    current["ExpireTime"] = update["$set"]["weaponFashions.$.ExpireTime"]
                    return SimpleNamespace(matched_count=1, modified_count=int(changed))
                if current is not None:
                    return SimpleNamespace(matched_count=0, modified_count=0)
                rows.append(copy.deepcopy(update["$push"]["weaponFashions"]))
                return SimpleNamespace(matched_count=1, modified_count=1)

        class Client:
            def __getitem__(self, name):
                if name == "test":
                    return self
                assert name == "characters", "Tickets must not create inventory entries"
                return Collection()

            def close(self):
                pass

        monkeypatch.setattr(module, "create_mongo_client", lambda _: Client())
        service = module.PlayerItemsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
        result = asyncio.run(service.add_inventory_items(42, [{"item_id": item_id, "quantity": 3}]))
        assert result == {"added_count": 1, "created_count": int(existing is None),
                          "updated_count": int(existing not in (None, 0))}
        assert len(state["weaponFashions"]) == 1
        unlocked = state["weaponFashions"][0]
        assert unlocked["_id"] == fashion_id and unlocked["ExpireTime"] == 0
        if existing is not None:
            assert unlocked == {**original, "ExpireTime": 0}
        else:
            assert unlocked["UseCharacterList"] == []
        assert state["characters"] == [{"_id": 1011002}] and state["future"] is True
        assert asyncio.run(service.add_inventory_items(42, [{"item_id": item_id, "quantity": 1}])) == {
            "added_count": 1, "created_count": 0, "updated_count": 0,
        }
        for write in writes:
            assert BSON.encode(write).decode() == write
    finally:
        resource_language.reset(token)


def test_mixed_grant_routes_tickets_and_preserves_inventory_metadata(monkeypatch):
    monkeypatch.setattr(module, "get_item_weapon_fashion_map", lambda: {900: 123})
    writes = []

    class Collection:
        def __init__(self, name):
            self.name = name

        async def find_one(self, *args):
            assert self.name == "inventory"
            return {"_id": "bag", "items": [{"_id": 60, "Count": 5, "BuyTimes": 7}],
                    "spent_totals": {"60": 99}, "applied_reward_claims": ["keep"]}

        async def update_one(self, query, update, **kwargs):
            writes.append((self.name, update))
            return SimpleNamespace(matched_count=1, modified_count=1)

    class Client:
        def __getitem__(self, name):
            return self if name == "test" else Collection(name)

        def close(self):
            pass

    monkeypatch.setattr(module, "create_mongo_client", lambda _: Client())
    service = module.PlayerItemsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    assert asyncio.run(service.add_inventory_items(42, [
        {"item_id": 900, "quantity": 2}, {"item_id": 60, "quantity": 3},
    ])) == {"added_count": 2, "created_count": 0, "updated_count": 2}
    assert writes == [
        ("characters", {"$set": {"weaponFashions.$.ExpireTime": 0}}),
        ("inventory", {"$set": {"items.$[item_60].Count": 8}}),
    ]


def test_missing_character_document_does_not_claim_success(monkeypatch):
    monkeypatch.setattr(module, "get_item_weapon_fashion_map", lambda: {900: 123})

    class Client:
        def __getitem__(self, name):
            assert name in ("test", "characters")
            return self

        async def update_one(self, *args):
            return SimpleNamespace(matched_count=0, modified_count=0)

        def close(self):
            pass

    monkeypatch.setattr(module, "create_mongo_client", lambda _: Client())
    service = module.PlayerItemsService(SimpleNamespace(mongo_db="test"), DatabaseSchemaRuntime())
    with pytest.raises(RuntimeError, match="Character document missing"):
        asyncio.run(service.add_inventory_items(42, [{"item_id": 900, "quantity": 1}]))


@pytest.mark.parametrize("ticket,expected_status", [(True, 200), (False, 422)])
def test_ticket_api_ignores_legacy_bag_quantity_but_normal_items_keep_limit(monkeypatch, ticket, expected_status):
    calls = []

    class Service:
        async def get_inventory_quantities(self, uid):
            return {900: 99999}

        async def add_inventory_items(self, uid, items):
            calls.append((uid, items))
            return {"added_count": 1, "created_count": 1, "updated_count": 0}

    async def selected_uid(*args):
        return 42

    monkeypatch.setattr(apis, "_get_active_session", lambda _: object())
    monkeypatch.setattr(apis, "_get_selected_uid_or_error", selected_uid)
    monkeypatch.setattr(apis, "get_database_health_snapshot", lambda _: object())
    monkeypatch.setattr(apis, "is_database_snapshot_healthy", lambda _: True)
    monkeypatch.setattr(apis, "get_item_name_map", lambda: {900: "Test item"})
    monkeypatch.setattr(apis, "get_item_weapon_fashion_map", lambda: {900: 123} if ticket else {})
    app = FastAPI()
    app.state.settings = SimpleNamespace()
    app.state.player_items_service = Service()
    app.include_router(apis.router)
    with TestClient(app) as client:
        if ticket:
            response = client.post("/api/database-items/selected", json={"items": [{"item_id": 900, "quantity": 1}]})
            assert response.status_code == expected_status, response.text
        else:
            with pytest.raises(AppError) as error:
                client.post("/api/database-items/selected", json={"items": [{"item_id": 900, "quantity": 1}]})
            assert error.value.status_code == expected_status
            assert error.value.code == "item.add_total_above_max"
    assert calls == ([(42, [{"item_id": 900, "quantity": 1}])] if ticket else [])
