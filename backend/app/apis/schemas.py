from __future__ import annotations

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    token: str | None = None
    expires_at: str | None = None


class SessionResponse(BaseModel):
    authenticated: bool


class SelectAccountRequest(BaseModel):
    uid: int


class SelectedAccountResponse(BaseModel):
    selected_uid: int | None = None


class ResetAccountPasswordRequest(BaseModel):
    uid: int
    password: str = Field(min_length=6)


class ResetAccountPasswordResponse(BaseModel):
    uid: int
    updated: bool


class HealthStatusResponse(BaseModel):
    checked_at: str | None = None
    server_version: str | None = None
    interval_seconds: int
    sections: list[dict[str, object]]
    controls: dict[str, object]


class DatabaseHealthStatusResponse(BaseModel):
    checked_at: str | None = None
    interval_seconds: int
    sections: list[dict[str, object]]


class ServerConfigResponse(BaseModel):
    path: str
    text: str
    editable: bool


class SaveServerConfigRequest(BaseModel):
    text: str
