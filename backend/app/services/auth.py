from __future__ import annotations

import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel

from app.core.config import settings
from app.db.mongo import get_database


SESSION_COOKIE_NAME = "login_session_token"
SESSION_TTL_HOURS = 12
SESSION_STORE: dict[str, "Session"] = {}


class Account(BaseModel):
    uid: int
    username: str
    password: str
    token: str | None = None


class Session(BaseModel):
    token: str
    expires_at: datetime
    account: Account


def _read_local_data(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {"accounts": []}

    with path.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        return {"accounts": []}

    return payload


def _load_accounts_from_local() -> list[Account]:
    payload = _read_local_data(settings.local_data_path)
    accounts = payload.get("accounts", [])
    if not isinstance(accounts, list):
        return []
    return [Account.model_validate(account) for account in accounts if isinstance(account, dict)]


async def _load_accounts_from_mongo() -> list[Account]:
    collection = get_database().get_collection("accounts")
    documents = await collection.find({}, {"uid": 1, "username": 1, "password": 1, "token": 1, "_id": 0}).to_list(length=None)
    return [Account.model_validate(document) for document in documents if isinstance(document, dict)]


async def find_account(username: str) -> Account | None:
    if settings.is_dev:
        for account in _load_accounts_from_local():
            if account.username == username:
                return account
        return None

    for account in await _load_accounts_from_mongo():
        if account.username == username:
            return account
    return None


async def verify_credentials(username: str, password: str) -> Account | None:
    account = await find_account(username)
    if account is None or account.password != password:
        return None
    return account


def create_session(account: Account) -> Session:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_TTL_HOURS)
    session = Session(token=token, expires_at=expires_at, account=account)
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
