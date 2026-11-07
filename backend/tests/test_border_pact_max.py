from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app import apis
from backend.app.db.models import MaxAllCharactersResponse, MaxCharacterResponse
from backend.app.services.player import player_characters as resources
from backend.app.utils.resource_language import resource_language


@pytest.mark.parametrize("language", ["CN", "EN"])
def test_border_pact_maps_include_variants_and_exclude_rank_passives(language):
    token = resource_language.set(language)
    try:
        types = resources.get_character_skill_type_map()
        bonuses = resources.get_character_border_pact_skill_bonus_map()
        # Original skills and selected replacement skills share the authored category.
        assert types[103518] == types[103528] == 6
        assert bonuses[1031005][103518] == bonuses[1031005][103528] == 1
        assert bonuses[1011002] == {
            101201: 1, 101206: 1, 101211: 1, 101216: 1,
            101217: 1, 101218: 1, 101221: 1, 101223: 1,
        }
        assert set(bonuses) == set(resources.get_character_skill_groups_map())
    finally:
        resource_language.reset(token)


@pytest.mark.parametrize("bulk", [False, True])
@pytest.mark.parametrize("body,expected", [(None, True), ({}, True),
                                           ({"consider_border_pact": True}, True),
                                           ({"consider_border_pact": False}, False)])
def test_max_api_forwards_border_pact_option(monkeypatch, bulk, body, expected):
    calls = []

    class Service:
        async def max_character(self, uid, record_id, *, consider_border_pact):
            calls.append((uid, record_id, consider_border_pact))
            return MaxCharacterResponse(record_id=record_id, CharacterId=record_id)

        async def max_all_characters(self, uid, *, consider_border_pact):
            calls.append((uid, None, consider_border_pact))
            return MaxAllCharactersResponse()

    async def selected_uid(*args):
        return 42

    monkeypatch.setattr(apis, "_get_active_session", lambda _: object())
    monkeypatch.setattr(apis, "_get_selected_uid_or_error", selected_uid)
    monkeypatch.setattr(apis, "get_database_health_snapshot", lambda _: object())
    monkeypatch.setattr(apis, "is_database_snapshot_healthy", lambda _: True)
    app = FastAPI()
    app.state.settings = SimpleNamespace()
    app.state.player_characters_service = Service()
    app.include_router(apis.router)
    path = "/api/database-characters/selected/" + ("" if bulk else "1031005/") + "max-all"
    with TestClient(app) as client:
        response = client.put(path, **({} if body is None else {"json": body}))
    assert response.status_code == 200, response.text
    assert calls == [(42, None if bulk else 1031005, expected)]
