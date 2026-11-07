from __future__ import annotations

from unittest.mock import AsyncMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.apis import router
from backend.app.config import Settings
from backend.app.services import database_control


@pytest.mark.parametrize("state", ["healthy", "unhealthy"])
def test_manual_refresh_checks_database_and_updates_cached_status(monkeypatch, state) -> None:
    settings = Settings({"ENABLE_SERVER_MANAGEMENT": "false"})
    monkeypatch.setattr(database_control, "DATABASE_HEALTH_TARGETS", {})
    monkeypatch.setattr(database_control, "DATABASE_HEALTH_SNAPSHOT", {
        "checked_at": None,
        "interval_seconds": None,
        "sections": [],
    })
    check = AsyncMock(return_value=database_control.DatabaseHealthCheckRecord(
        checked_at="2026-11-07T00:00:00+00:00",
        state=state,
        message="Database connection checked",
        latency_ms=12,
    ))
    monkeypatch.setattr(database_control, "_check_mongodb_target", check)
    app = FastAPI()
    app.state.settings = settings
    app.include_router(router)
    client = TestClient(app)

    initial = client.get("/api/database-status")
    assert initial.status_code == 200
    assert initial.json()["sections"][0]["services"][0]["latest"] is None
    check.assert_not_awaited()

    response = client.post("/api/database-status/refresh")

    assert response.status_code == 200
    check.assert_awaited_once()
    payload = response.json()
    assert payload["checked_at"] is not None
    assert payload["interval_seconds"] == settings.healthy_check_interval
    service = payload["sections"][0]["services"][0]
    assert service["latest"]["state"] == state
    assert service["latest"]["latency_ms"] == 12
    assert service["history"] == [service["latest"]]
    assert client.get("/api/database-status").json() == payload
    check.assert_awaited_once()
