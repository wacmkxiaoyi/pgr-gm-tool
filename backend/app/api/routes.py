from __future__ import annotations

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.health_check import get_health_snapshot
from app.services.auth import SESSION_COOKIE_NAME, create_session, delete_session, get_session, verify_credentials

router = APIRouter(prefix="/api")


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    uid: int
    username: str
    token: str | None = None
    expires_at: str | None = None


class SessionResponse(BaseModel):
    authenticated: bool
    uid: int | None = None
    username: str | None = None


class HealthStatusResponse(BaseModel):
    checked_at: str | None = None
    server_version: str | None = None
    interval_seconds: int
    sections: list[dict[str, object]]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/app-info")
async def app_info() -> dict[str, object]:
    return {
        "name": settings.app_name,
        "environment": settings.app_env,
        "mongo_db": settings.mongo_db,
        "mongo_configured": bool(settings.mongo_uri or settings.mongo_host),
        "is_dev": settings.is_dev,
    }


@router.get("/server-status", response_model=HealthStatusResponse)
async def server_status() -> HealthStatusResponse:
    return HealthStatusResponse.model_validate(get_health_snapshot())


@router.post("/login", response_model=LoginResponse)
async def login(payload: LoginRequest, response: Response) -> LoginResponse:
    account = await verify_credentials(payload.username, payload.password)
    if account is None:
        raise HTTPException(status_code=401, detail="账号或密码错误")

    session = create_session(account)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.token,
        httponly=True,
        secure=not settings.is_dev,
        samesite="lax",
        expires=int(session.expires_at.timestamp()),
        path="/",
    )
    return LoginResponse(
        uid=account.uid,
        username=account.username,
        token=session.token,
        expires_at=session.expires_at.isoformat(),
    )


@router.get("/session", response_model=SessionResponse)
async def session(login_session_token: str | None = Cookie(default=None)) -> SessionResponse:
    active_session = get_session(login_session_token)
    if active_session is None:
        return SessionResponse(authenticated=False)

    return SessionResponse(
        authenticated=True,
        uid=active_session.account.uid,
        username=active_session.account.username,
    )


@router.post("/logout")
async def logout(response: Response, login_session_token: str | None = Cookie(default=None)) -> dict[str, str]:
    delete_session(login_session_token)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}
