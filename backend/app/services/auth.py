from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel

from backend.app.config import Settings


SESSION_COOKIE_NAME = "login_session_token"
SESSION_TTL_HOURS = 12
SESSION_STORE: dict[str, "Session"] = {}


class Session(BaseModel):
    token: str
    expires_at: datetime


def create_session(username: str, password: str, settings: Settings) -> Session | None:
    if not settings.admin_username or not settings.admin_password:
        return None

    if username != settings.admin_username or password != settings.admin_password:
        return None

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
    session = Session(token=token, expires_at=expires_at)
    SESSION_STORE[token] = session
    return session


def get_session(token: str | None) -> Session | None:
    if not token:
        return None

    session = SESSION_STORE.get(token)
    if session is None:
        return None

    if session.expires_at <= datetime.now(timezone.utc):
        SESSION_STORE.pop(token, None)
        return None

    return session


def delete_session(token: str | None) -> None:
    if token:
        SESSION_STORE.pop(token, None)
