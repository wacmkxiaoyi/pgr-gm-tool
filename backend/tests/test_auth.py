from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from backend.app.config import Settings
from backend.app.services import auth, init_app


def _client(**credentials: str) -> TestClient:
    settings = Settings({"ENABLE_SERVER_MANAGEMENT": "false", **credentials})
    app = FastAPI()
    init_app(app, settings)
    return TestClient(app)


def test_authentication_requires_both_admin_credentials() -> None:
    assert Settings({"ADMIN_USERNAME": "admin", "ADMIN_PASSWORD": "password"}).authentication_enabled is True
    assert Settings({"ADMIN_USERNAME": "admin", "ADMIN_PASSWORD": ""}).authentication_enabled is False
    assert Settings({"ADMIN_USERNAME": "", "ADMIN_PASSWORD": "password"}).authentication_enabled is False


def test_disabled_authentication_returns_shared_anonymous_session() -> None:
    auth.configure_authentication(False)

    session = auth.get_session(None)

    assert session is auth.ANONYMOUS_SESSION
    assert session.selected_account_uid is None


def test_enabled_authentication_requires_valid_credentials() -> None:
    settings = Settings({"ADMIN_USERNAME": "admin", "ADMIN_PASSWORD": "password"})
    auth.configure_authentication(True)

    assert auth.create_session("admin", "wrong", settings) is None
    assert auth.create_session("admin", "password", settings) is not None

    auth.configure_authentication(False)


def test_disabled_authentication_bypasses_login_page_and_session_check() -> None:
    client = _client()

    assert client.get("/", follow_redirects=False).status_code == 200
    assert client.get("/login", follow_redirects=False).headers["location"] == "/"
    assert client.get("/api/session").json() == {"authenticated": True}


def test_enabled_authentication_redirects_unauthenticated_requests_to_login() -> None:
    client = _client(ADMIN_USERNAME="admin", ADMIN_PASSWORD="password")

    response = client.get("/", follow_redirects=False)

    assert response.status_code == 302
    assert response.headers["location"] == "/login"
    assert client.get("/api/session").json() == {"authenticated": False}
