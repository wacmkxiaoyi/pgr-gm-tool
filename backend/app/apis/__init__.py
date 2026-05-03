from __future__ import annotations

import json
import re

from fastapi import APIRouter, Cookie, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from backend.app.apis.schemas import (
    AppInfoResponse,
    DatabaseHealthStatusResponse,
    HealthStatusResponse,
    LoginRequest,
    LoginResponse,
    PlayerProfileResponse,
    ResetAccountPasswordRequest,
    ResetAccountPasswordResponse,
    SelectAccountRequest,
    SaveServerConfigRequest,
    SelectedAccountResponse,
    SessionResponse,
    ServerConfigResponse,
    UpdateSelectedPlayerProfileRequest,
)
from backend.app.db.models import AccountListResponse, UpdatePlayerProfilePayload
from backend.app.services.player_portrait import (
    get_player_portrait_frame_name_map,
    get_player_portrait_frame_url_map,
    get_player_portrait_name_map,
    get_player_portrait_url_map,
)
from backend.app.services.database_control import (
    get_database_health_snapshot,
    is_database_snapshot_healthy,
    reload_database_health_targets,
    run_database_health_check_once,
)
from backend.app.services.server_control import (
    get_health_snapshot,
    get_server_control_snapshot,
    is_health_snapshot_healthy,
    reload_health_targets,
    run_health_check_once,
)
from backend.app.services.auth import SESSION_COOKIE_NAME, create_session, delete_session, get_session

router = APIRouter(prefix="/api")

PLAYER_NAME_PATTERN = r"^[\u4e00-\u9fa5A-Za-z0-9 _-]+$"


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/app-info", response_model=AppInfoResponse)
async def app_info(request: Request) -> AppInfoResponse:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    return AppInfoResponse.model_validate({
        "name": settings.app_name,
        "environment": settings.app_env,
        "mongo_db": settings.mongo_db,
        "mongo_configured": bool(settings.mongo_uri or settings.mongo_host),
        "server_controls_visible": controller.controls_visible(),
        "player_portrait_url_map": get_player_portrait_url_map(),
        "player_portrait_frame_url_map": get_player_portrait_frame_url_map(),
        "player_portrait_name_map": get_player_portrait_name_map(),
        "player_portrait_frame_name_map": get_player_portrait_frame_name_map(),
    })


@router.get("/server-status", response_model=HealthStatusResponse)
async def server_status(request: Request) -> HealthStatusResponse:
    settings = request.app.state.settings
    health_snapshot = get_health_snapshot(settings)
    controls = get_server_control_snapshot(
        settings,
        request.app.state.pgr_server_controller,
        all_healthy=is_health_snapshot_healthy(health_snapshot),
    )
    return HealthStatusResponse.model_validate({
        **health_snapshot,
        "controls": controls,
    })


@router.get("/database-status", response_model=DatabaseHealthStatusResponse)
async def database_status(request: Request) -> DatabaseHealthStatusResponse:
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    return DatabaseHealthStatusResponse.model_validate(snapshot)


@router.get("/database-accounts", response_model=AccountListResponse)
async def database_accounts(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=25),
) -> AccountListResponse:
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise HTTPException(status_code=409, detail="数据库服务未处于正常状态，暂时无法访问账号管理。")

    controller = request.app.state.database_controller
    return await controller.list_accounts(page=page, page_size=page_size)


def _get_active_session(login_session_token: str | None) -> object:
    session = get_session(login_session_token)
    if session is None:
        raise HTTPException(status_code=401, detail="当前会话未登录或已失效。")
    return session


@router.get("/database-accounts/selection", response_model=SelectedAccountResponse)
async def get_database_account_selection(
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> SelectedAccountResponse:
    active_session = _get_active_session(login_session_token)
    selected_uid = getattr(active_session, "selected_account_uid", None)

    if selected_uid is None:
        return SelectedAccountResponse(selected_uid=None)

    controller = request.app.state.database_controller
    if not await controller.account_exists(selected_uid):
        active_session.selected_account_uid = None
        return SelectedAccountResponse(selected_uid=None)

    return SelectedAccountResponse(selected_uid=selected_uid)


@router.put("/database-accounts/selection", response_model=SelectedAccountResponse)
async def set_database_account_selection(
    request: Request,
    payload: SelectAccountRequest,
    login_session_token: str | None = Cookie(default=None),
) -> SelectedAccountResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise HTTPException(status_code=409, detail="数据库服务未处于正常状态，暂时无法选定账户。")

    controller = request.app.state.database_controller
    if not await controller.account_exists(payload.uid):
        raise HTTPException(status_code=404, detail="未找到对应 UID 的账户。")

    active_session.selected_account_uid = payload.uid
    return SelectedAccountResponse(selected_uid=payload.uid)


@router.delete("/database-accounts/selection", response_model=SelectedAccountResponse)
async def clear_database_account_selection(
    login_session_token: str | None = Cookie(default=None),
) -> SelectedAccountResponse:
    active_session = _get_active_session(login_session_token)
    active_session.selected_account_uid = None
    return SelectedAccountResponse(selected_uid=None)


@router.put("/database-accounts/password", response_model=ResetAccountPasswordResponse)
async def reset_database_account_password(
    request: Request,
    payload: ResetAccountPasswordRequest,
    login_session_token: str | None = Cookie(default=None),
) -> ResetAccountPasswordResponse:
    _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise HTTPException(status_code=409, detail="数据库服务未处于正常状态，暂时无法重置密码。")

    if len(payload.password) < 6:
        raise HTTPException(status_code=422, detail="新密码长度必须大于等于 6 位。")

    controller = request.app.state.database_controller
    updated = await controller.update_account_password(payload.uid, payload.password)
    if not updated:
        raise HTTPException(status_code=404, detail="未找到对应 UID 的账户。")

    return ResetAccountPasswordResponse(uid=payload.uid, updated=True)


@router.get("/database-players/selected", response_model=PlayerProfileResponse)
async def get_selected_database_player_profile(
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> PlayerProfileResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise HTTPException(status_code=409, detail="数据库服务未处于正常状态，暂时无法查看玩家信息。")

    selected_uid = getattr(active_session, "selected_account_uid", None)
    if selected_uid is None:
        raise HTTPException(status_code=409, detail="请先在账号管理中选定一个用户。")

    controller = request.app.state.database_controller
    if not await controller.account_exists(selected_uid):
        active_session.selected_account_uid = None
        raise HTTPException(status_code=404, detail="当前选定用户已不存在，请重新选择。")

    profile = await controller.get_player_profile(selected_uid)
    if profile is None:
        raise HTTPException(status_code=404, detail="未找到对应 UID 的玩家信息。")

    return PlayerProfileResponse(**profile.model_dump())


@router.put("/database-players/selected", response_model=PlayerProfileResponse)
async def update_selected_database_player_profile(
    request: Request,
    payload: UpdateSelectedPlayerProfileRequest,
    login_session_token: str | None = Cookie(default=None),
) -> PlayerProfileResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise HTTPException(status_code=409, detail="数据库服务未处于正常状态，暂时无法修改玩家信息。")

    selected_uid = getattr(active_session, "selected_account_uid", None)
    if selected_uid is None:
        raise HTTPException(status_code=409, detail="请先在账号管理中选定一个用户。")

    controller = request.app.state.database_controller
    if not await controller.account_exists(selected_uid):
        active_session.selected_account_uid = None
        raise HTTPException(status_code=404, detail="当前选定用户已不存在，请重新选择。")

    field_name = str(payload.field or "").strip().lower()
    if field_name not in {"name", "gender", "level", "likes", "head_portrait_id", "head_frame_id"}:
        raise HTTPException(status_code=422, detail="当前字段不允许修改。")

    if field_name == "name":
        normalized_value = str(payload.value).strip()
        if not normalized_value:
            raise HTTPException(status_code=422, detail="昵称不能为空。")
        if not re.match(PLAYER_NAME_PATTERN, normalized_value):
            raise HTTPException(status_code=422, detail="昵称仅允许中文、英文、数字、空格、下划线和短横线。")
        update_payload = UpdatePlayerProfilePayload(name=normalized_value)
    elif field_name == "gender":
        try:
            normalized_gender = int(payload.value)
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="性别仅允许为男或女。") from error

        if normalized_gender not in {0, 1}:
            raise HTTPException(status_code=422, detail="性别仅允许为男或女。")

        update_payload = UpdatePlayerProfilePayload(gender=normalized_gender)
    elif field_name in {"level", "likes"}:
        try:
            normalized_number = int(payload.value)
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="请输入有效的整数。") from error

        if normalized_number < 0:
            raise HTTPException(status_code=422, detail="数值不能小于 0。")

        update_payload = UpdatePlayerProfilePayload(**{field_name: normalized_number})
    elif field_name == "head_portrait_id":
        try:
            normalized_portrait_id = int(payload.value)
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="请输入有效的头像 ID。") from error

        if normalized_portrait_id < 0:
            raise HTTPException(status_code=422, detail="头像 ID 不能小于 0。")

        portrait_map = get_player_portrait_url_map()
        if normalized_portrait_id != 0 and normalized_portrait_id not in portrait_map:
            raise HTTPException(status_code=404, detail="未找到对应头像资源。")

        update_payload = UpdatePlayerProfilePayload(head_portrait_id=normalized_portrait_id)
    elif field_name == "head_frame_id":
        try:
            normalized_frame_id = int(payload.value)
        except (TypeError, ValueError) as error:
            raise HTTPException(status_code=422, detail="请输入有效的头像框 ID。") from error

        if normalized_frame_id < 0:
            raise HTTPException(status_code=422, detail="头像框 ID 不能小于 0。")

        frame_map = get_player_portrait_frame_url_map()
        if normalized_frame_id != 0 and normalized_frame_id not in frame_map:
            raise HTTPException(status_code=404, detail="未找到对应头像框资源。")

        update_payload = UpdatePlayerProfilePayload(head_frame_id=normalized_frame_id)
    else:
        raise HTTPException(status_code=422, detail="当前字段不允许修改。")

    profile = await controller.update_player_profile(selected_uid, update_payload)
    if profile is None:
        raise HTTPException(status_code=404, detail="未找到对应 UID 的玩家信息。")

    return PlayerProfileResponse(**profile.model_dump())


@router.post("/server-control/start")
async def start_server(request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    health_snapshot = get_health_snapshot(settings)
    await controller.request_start()
    controls = get_server_control_snapshot(
        settings,
        controller,
        all_healthy=is_health_snapshot_healthy(health_snapshot),
    )
    return {
        "controls": controls,
        "accepted": controls["startup_state"] == "starting" and controls["startup_error"] is None,
    }


@router.post("/server-control/stop")
async def stop_server(request: Request) -> dict[str, object]:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    await controller.request_stop()
    controls = get_server_control_snapshot(
        settings,
        controller,
        all_healthy=False,
    )
    return {
        "controls": controls,
        "accepted": not controls["start_disabled"],
    }


@router.get("/server-control/logs")
async def stream_server_logs(request: Request) -> StreamingResponse:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    health_snapshot = get_health_snapshot(settings)
    all_healthy = is_health_snapshot_healthy(health_snapshot)
    if not controller.can_view_logs(all_healthy=all_healthy):
        raise HTTPException(status_code=409, detail="服务器未处于可查看日志状态。")

    return StreamingResponse(
        controller.stream_logs(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/server-control/config", response_model=ServerConfigResponse)
async def get_server_config(request: Request) -> ServerConfigResponse:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    health_snapshot = get_health_snapshot(settings)
    controls = get_server_control_snapshot(
        settings,
        controller,
        all_healthy=is_health_snapshot_healthy(health_snapshot),
    )

    if not controls["visible"]:
        raise HTTPException(status_code=404, detail="未找到可用的服务器配置。")

    if controls["start_disabled"]:
        raise HTTPException(status_code=409, detail="服务器启动时不允许修改配置。")

    try:
        config_text = settings.read_server_config_text()
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail=f"未找到配置文件: {settings.server_config_path}") from error
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"读取配置文件失败: {error}") from error

    return ServerConfigResponse(
        path=str(settings.server_config_path),
        text=config_text,
        editable=True,
    )


@router.put("/server-control/config", response_model=ServerConfigResponse)
async def save_server_config(request: Request, payload: SaveServerConfigRequest) -> ServerConfigResponse:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    health_snapshot = get_health_snapshot(settings)
    controls = get_server_control_snapshot(
        settings,
        controller,
        all_healthy=is_health_snapshot_healthy(health_snapshot),
    )

    if not controls["visible"]:
        raise HTTPException(status_code=404, detail="未找到可用的服务器配置。")

    if controls["start_disabled"]:
        raise HTTPException(status_code=409, detail="服务器启动时不允许修改配置。")

    try:
        parsed = json.loads(payload.text)
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=422, detail=f"JSON 格式无效: {error.msg} (第 {error.lineno} 行, 第 {error.colno} 列)") from error

    if not isinstance(parsed, dict):
        raise HTTPException(status_code=422, detail="配置文件顶层必须是 JSON 对象。")

    try:
        settings.server_config_path.parent.mkdir(parents=True, exist_ok=True)
        settings.server_config_path.write_text(payload.text, encoding="utf-8")
        settings.reload_server_runtime_config()
        reload_health_targets(settings)
        reload_database_health_targets(settings)
        await run_health_check_once(settings)
        await run_database_health_check_once(settings)
        refreshed_text = settings.read_server_config_text()
    except OSError as error:
        raise HTTPException(status_code=500, detail=f"保存配置文件失败: {error}") from error

    return ServerConfigResponse(
        path=str(settings.server_config_path),
        text=refreshed_text,
        editable=True,
    )


@router.post("/login", response_model=LoginResponse)
async def login(request: Request, payload: LoginRequest, response: Response) -> LoginResponse:
    settings = request.app.state.settings
    session = create_session(payload.username, payload.password, settings)
    if session is None:
        raise HTTPException(status_code=401, detail="账号或密码错误")
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session.token,
        httponly=True,
        samesite="lax",
        expires=int(session.expires_at.timestamp()),
        path="/",
    )
    return LoginResponse(
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
    )


@router.post("/logout")
async def logout(response: Response, login_session_token: str | None = Cookie(default=None)) -> dict[str, str]:
    delete_session(login_session_token)
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")
    return {"status": "ok"}
