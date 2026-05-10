from __future__ import annotations

import json
import re
from typing import Literal

from fastapi import APIRouter, Cookie, Query, Request, Response
from fastapi.responses import StreamingResponse

from backend.app.apis.schemas import (
    AddMemoryResponse,
    AddWeaponRequest,
    AddWeaponResponse,
    AddInventoryItemsRequest,
    AddInventoryItemsResponse,
    AppInfoResponse,
    CharacterManagementListResponse,
    ClearInventoryItemsRequest,
    ClearInventoryItemsResponse,
    ClearWeaponsRequest,
    ClearWeaponsResponse,
    MemoryExtraInfoResponse,
    MemoryListResponse,
    DatabaseHealthStatusResponse,
    DeleteAccountResponse,
    DeleteWeaponResonanceResponse,
    DeleteWeaponResponse,
    DeleteInventoryItemResponse,
    HealthStatusResponse,
    InventoryListResponse,
    LoginRequest,
    LoginResponse,
    PlayerProfileResponse,
    ResetAccountPasswordRequest,
    ResetAccountPasswordResponse,
    SelectAccountRequest,
    SaveServerConfigRequest,
    SelectedAccountResponse,
    SetCharacterSupportResponse,
    SessionResponse,
    ServerConfigResponse,
    UpdateInventoryItemRequest,
    UpdateInventoryItemResponse,
    UpdateSelectedPlayerProfileRequest,
    UpdateWeaponOverrunRequest,
    UpdateWeaponRequest,
    UpdateWeaponResonanceRequest,
    UpdateWeaponResonanceResponse,
    WeaponExtraInfoResponse,
    UpdateWeaponResponse,
    WeaponListResponse,
)
from backend.app.db.models import AccountListResponse, SetCharacterSupportResponse as SetCharacterSupportDomainResponse, UpdatePlayerProfilePayload
from backend.app.services.player.equips import (
    get_equip_icon_url_map,
    get_equip_name_map,
    get_equip_resonance_map,
    get_equip_site_map,
    get_equip_star_map,
)
from backend.app.services.player.equips.weapon import (
    get_weapon_overrun_suit_entries_map,
    get_weapon_skill_entries_map,
    get_weapon_skill_pool_entries_map,
    get_weapon_type_name_map,
)
from backend.app.services.player.characters import (
    get_attrib_pool_entries_map,
    get_character_grade_name_map,
    get_character_skill_pool_entries_map,
)
from backend.app.services.player.player_items import get_item_name_map
from backend.app.services.player.player_profile import (
    get_character_head_icon_url_map,
    get_character_log_name_map,
    get_player_background_name_map,
    get_player_background_url_map,
    get_player_level_allowed_exp_max,
    get_player_level_max,
    get_player_level_max_exp,
    get_player_level_max_exp_map,
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
from backend.app.services.api_errors import raise_http_error

router = APIRouter(prefix="/api")

PLAYER_NAME_PATTERN = r"^[\u4e00-\u9fa5A-Za-z0-9 _-]+$"
PLAYER_PROFILE_INVENTORY_FIELDS = {"exp", "money", "serum", "black_card", "rainbow_card"}
PLAYER_PROFILE_INT32_FIELDS = {"likes", "money", "serum", "black_card", "rainbow_card"}
PLAYER_PROFILE_INT32_MAX = 2147483647
PLAYER_PROFILE_MUTABLE_FIELDS = {"name", "gender", "level", "likes", "exp", "money", "serum", "black_card", "rainbow_card", "head_portrait_id", "head_frame_id", "use_background_id"}
WEAPON_MUTABLE_FIELDS = {"breakthrough", "level", "exp"}


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/app-info", response_model=AppInfoResponse, response_model_exclude_none=True)
async def app_info(request: Request) -> AppInfoResponse:
    settings = request.app.state.settings
    controller = request.app.state.pgr_server_controller
    player_equips_service = request.app.state.player_equips_service
    supports_weapon_overrun = player_equips_service.supports_weapon_overrun_data()
    return AppInfoResponse.model_validate({
        "name": settings.app_name,
        "environment": settings.app_env,
        "mongo_db": settings.mongo_db,
        "mongo_configured": bool(settings.mongo_uri or settings.mongo_host),
        "server_controls_visible": controller.controls_visible(),
        "player_level_max": get_player_level_max(),
        "player_level_max_exp_map": get_player_level_max_exp_map(),
        "player_portrait_url_map": get_player_portrait_url_map(),
        "player_portrait_frame_url_map": get_player_portrait_frame_url_map(),
        "player_portrait_name_map": get_player_portrait_name_map(),
        "player_portrait_frame_name_map": get_player_portrait_frame_name_map(),
        "player_background_url_map": get_player_background_url_map(),
        "player_background_name_map": get_player_background_name_map(),
        "item_name_map": get_item_name_map(),
        "equip_name_map": get_equip_name_map(),
        "weapon_type_name_map": get_weapon_type_name_map(),
        "equip_star_map": get_equip_star_map(),
        "equip_site_map": get_equip_site_map(),
        "equip_icon_url_map": get_equip_icon_url_map(),
        "character_log_name_map": get_character_log_name_map(),
        "character_head_icon_url_map": get_character_head_icon_url_map(),
        "weapon_skill_entries_map": get_weapon_skill_entries_map(),
        "weapon_overrun_suit_entries_map": get_weapon_overrun_suit_entries_map() if supports_weapon_overrun else None,
        "weapon_skill_pool_entries_map": get_weapon_skill_pool_entries_map(),
        "attrib_pool_entries_map": get_attrib_pool_entries_map(),
        "character_skill_pool_entries_map": get_character_skill_pool_entries_map(),
        "character_grade_name_map": get_character_grade_name_map(),
        "equip_resonance_map": get_equip_resonance_map(),
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
    page_size: int = Query(default=10, ge=1, le=10),
    sort_by: str = Query(default="uid"),
    sort_order: str = Query(default="asc"),
    keyword: str = Query(default=""),
) -> AccountListResponse:
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_accounts_access")

    accounts_service = request.app.state.database_accounts_service
    return await accounts_service.list_accounts(page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order, keyword=keyword.strip())


def _get_active_session(login_session_token: str | None) -> object:
    session = get_session(login_session_token)
    if session is None:
        raise_http_error(401, "auth.session_invalid")
    return session


async def _get_selected_uid_or_error(request: Request, active_session: object) -> int:
    selected_uid = getattr(active_session, "selected_account_uid", None)
    if selected_uid is None:
        raise_http_error(409, "account.selection_required")

    accounts_service = request.app.state.database_accounts_service
    if not await accounts_service.account_exists(selected_uid):
        active_session.selected_account_uid = None
        raise_http_error(404, "account.selected_account_missing", {"uid": selected_uid})

    return selected_uid


@router.get("/database-accounts/selection", response_model=SelectedAccountResponse)
async def get_database_account_selection(
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> SelectedAccountResponse:
    active_session = _get_active_session(login_session_token)
    selected_uid = getattr(active_session, "selected_account_uid", None)

    if selected_uid is None:
        return SelectedAccountResponse(selected_uid=None)

    accounts_service = request.app.state.database_accounts_service
    if not await accounts_service.account_exists(selected_uid):
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
        raise_http_error(409, "database.unhealthy_account_selection")

    accounts_service = request.app.state.database_accounts_service
    if not await accounts_service.account_exists(payload.uid):
        raise_http_error(404, "account.not_found", {"uid": payload.uid})

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
        raise_http_error(409, "database.unhealthy_password_reset")

    if len(payload.password) < 6:
        raise_http_error(422, "account.password_too_short", {"field": "password", "min_length": 6})

    accounts_service = request.app.state.database_accounts_service
    updated = await accounts_service.update_account_password(payload.uid, payload.password)
    if not updated:
        raise_http_error(404, "account.not_found", {"uid": payload.uid})

    return ResetAccountPasswordResponse(uid=payload.uid, updated=True)


@router.delete("/database-accounts/{uid}", response_model=DeleteAccountResponse)
async def delete_database_account(
    request: Request,
    uid: int,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteAccountResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_account_delete")

    accounts_service = request.app.state.database_accounts_service
    deleted = await accounts_service.delete_account(uid)
    if not deleted:
        raise_http_error(404, "account.not_found", {"uid": uid})

    if getattr(active_session, "selected_account_uid", None) == uid:
        active_session.selected_account_uid = None

    return DeleteAccountResponse(uid=uid, deleted=True)


@router.get("/database-players/selected", response_model=PlayerProfileResponse)
async def get_selected_database_player_profile(
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> PlayerProfileResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    profile_service = request.app.state.player_profile_service
    profile = await profile_service.get_player_profile(selected_uid)
    if profile is None:
        raise_http_error(404, "player.not_found", {"uid": selected_uid})

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
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    profile_service = request.app.state.player_profile_service

    field_name = str(payload.field or "").strip().lower()
    if field_name not in PLAYER_PROFILE_MUTABLE_FIELDS:
        raise_http_error(422, "player.field_not_editable", {"field": field_name})

    if not profile_service.allows_player_profile_field_update(field_name):
        raise_http_error(422, "player.field_not_editable", {"field": field_name})

    player_level_max = get_player_level_max()

    if field_name == "name":
        normalized_value = str(payload.value).strip()
        if not normalized_value:
            raise_http_error(422, "player.name_required", {"field": field_name})
        if not re.match(PLAYER_NAME_PATTERN, normalized_value):
            raise_http_error(422, "player.name_invalid", {"field": field_name})
        update_payload = UpdatePlayerProfilePayload(name=normalized_value)
    elif field_name == "gender":
        try:
            normalized_gender = int(payload.value)
        except (TypeError, ValueError):
            raise_http_error(422, "player.gender_invalid", {"field": field_name})

        if normalized_gender not in {1, 2}:
            raise_http_error(422, "player.gender_invalid", {"field": field_name})

        update_payload = UpdatePlayerProfilePayload(gender=normalized_gender)
    elif field_name in {"level", "likes"} | PLAYER_PROFILE_INVENTORY_FIELDS:
        try:
            normalized_number = int(payload.value)
        except (TypeError, ValueError):
            raise_http_error(422, "player.integer_invalid", {"field": field_name})

        if normalized_number < 0:
            raise_http_error(422, "player.value_below_zero", {"field": field_name, "min": 0})

        if field_name == "level" and normalized_number > player_level_max:
            raise_http_error(422, "player.level_above_max", {"field": field_name, "max": player_level_max})

        if field_name in PLAYER_PROFILE_INT32_FIELDS and normalized_number > PLAYER_PROFILE_INT32_MAX:
            raise_http_error(422, "player.value_above_int32_max", {
                "field": field_name,
                "max": PLAYER_PROFILE_INT32_MAX,
            })

        if field_name == "exp":
            current_profile = await profile_service.get_player_profile(selected_uid)
            if current_profile is None:
                raise_http_error(404, "player.not_found", {"uid": selected_uid})

            current_level = current_profile.level
            if current_level is None:
                raise_http_error(422, "player.level_missing", {"field": "level"})

            allowed_exp_max = get_player_level_allowed_exp_max(current_level)
            if allowed_exp_max is None:
                raise_http_error(422, "player.level_not_defined", {"field": "level", "level": current_level})

            if normalized_number > allowed_exp_max:
                raise_http_error(422, "player.exp_above_max", {
                    "field": field_name,
                    "level": current_level,
                    "max": allowed_exp_max,
                })

        if field_name == "level":
            current_profile = await profile_service.get_player_profile(selected_uid)
            if current_profile is None:
                raise_http_error(404, "player.not_found", {"uid": selected_uid})

            update_data: dict[str, int] = {field_name: normalized_number}
            current_exp = current_profile.exp
            if current_exp < 0:
                current_exp = 0

            if get_player_level_max_exp(normalized_number) is None:
                raise_http_error(422, "player.level_not_defined", {"field": field_name, "level": normalized_number})

            allowed_exp_max = get_player_level_allowed_exp_max(normalized_number)
            if allowed_exp_max is None:
                raise_http_error(422, "player.level_not_defined", {"field": field_name, "level": normalized_number})

            if current_exp > allowed_exp_max:
                update_data["exp"] = allowed_exp_max

            update_payload = UpdatePlayerProfilePayload(**update_data)
        else:
            update_payload = UpdatePlayerProfilePayload(**{field_name: normalized_number})
    elif field_name == "head_portrait_id":
        try:
            normalized_portrait_id = int(payload.value)
        except (TypeError, ValueError):
            raise_http_error(422, "player.portrait_id_invalid", {"field": field_name})

        if normalized_portrait_id < 0:
            raise_http_error(422, "player.portrait_id_below_zero", {"field": field_name, "min": 0})

        portrait_map = get_player_portrait_url_map()
        if normalized_portrait_id != 0 and normalized_portrait_id not in portrait_map:
            raise_http_error(404, "player.portrait_not_found", {"field": field_name, "id": normalized_portrait_id})

        update_payload = UpdatePlayerProfilePayload(head_portrait_id=normalized_portrait_id)
    elif field_name == "head_frame_id":
        try:
            normalized_frame_id = int(payload.value)
        except (TypeError, ValueError):
            raise_http_error(422, "player.frame_id_invalid", {"field": field_name})

        if normalized_frame_id < 0:
            raise_http_error(422, "player.frame_id_below_zero", {"field": field_name, "min": 0})

        frame_map = get_player_portrait_frame_url_map()
        if normalized_frame_id != 0 and normalized_frame_id not in frame_map:
            raise_http_error(404, "player.frame_not_found", {"field": field_name, "id": normalized_frame_id})

        update_payload = UpdatePlayerProfilePayload(head_frame_id=normalized_frame_id)
    elif field_name == "use_background_id":
        try:
            normalized_background_id = int(payload.value)
        except (TypeError, ValueError):
            raise_http_error(422, "player.background_id_invalid", {"field": field_name})

        if normalized_background_id < 0:
            raise_http_error(422, "player.background_id_below_zero", {"field": field_name, "min": 0})

        background_map = get_player_background_url_map()
        if normalized_background_id != 0 and normalized_background_id not in background_map:
            raise_http_error(404, "player.background_not_found", {"field": field_name, "id": normalized_background_id})

        update_payload = UpdatePlayerProfilePayload(use_background_id=normalized_background_id)
    else:
        raise_http_error(422, "player.field_not_editable", {"field": field_name})

    profile = await profile_service.update_player_profile(selected_uid, update_payload)
    if profile is None:
        raise_http_error(404, "player.not_found", {"uid": selected_uid})

    return PlayerProfileResponse(**profile.model_dump())


@router.get("/database-items/selected", response_model=InventoryListResponse)
async def get_selected_database_items(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    keyword: str | None = Query(default=None),
    sort_by: Literal["item_id", "name", "quantity"] = Query(default="item_id"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    login_session_token: str | None = Cookie(default=None),
) -> InventoryListResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    items_service = request.app.state.player_items_service

    return await items_service.list_inventory_items(
        selected_uid,
        page=page,
        page_size=page_size,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )


@router.post("/database-items/selected", response_model=AddInventoryItemsResponse)
async def add_selected_database_items(
    request: Request,
    payload: AddInventoryItemsRequest,
    login_session_token: str | None = Cookie(default=None),
) -> AddInventoryItemsResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_item_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    items_service = request.app.state.player_items_service

    requested_items = payload.items if isinstance(payload.items, list) else []
    if not requested_items:
        raise_http_error(422, "item.add_empty")

    item_name_map = get_item_name_map()
    merged_items: dict[int, int] = {}
    current_quantities = await items_service.get_inventory_quantities(selected_uid)

    for item in requested_items:
        item_id = int(item.item_id)
        quantity = int(item.quantity)

        if 1 <= item_id <= 18:
            raise_http_error(422, "item.add_protected", {"item_id": item_id})

        if item_id not in item_name_map:
            raise_http_error(422, "item.add_item_not_found", {"item_id": item_id})

        if quantity < 1:
            raise_http_error(422, "item.add_quantity_below_min", {"item_id": item_id})

        if quantity > 99999:
            raise_http_error(422, "item.add_quantity_above_max", {"item_id": item_id})

        merged_items[item_id] = merged_items.get(item_id, 0) + quantity
        if merged_items[item_id] > 99999:
            raise_http_error(422, "item.add_quantity_above_max", {"item_id": item_id})

        if current_quantities.get(item_id, 0) + merged_items[item_id] > 99999:
            raise_http_error(422, "item.add_total_above_max", {"item_id": item_id})

    result = await items_service.add_inventory_items(
        selected_uid,
        [{"item_id": item_id, "quantity": quantity} for item_id, quantity in merged_items.items()],
    )
    return AddInventoryItemsResponse(**result)


@router.get("/database-weapons/selected", response_model=WeaponListResponse, response_model_exclude_none=True)
async def get_selected_database_weapons(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    keyword: str | None = Query(default=None),
    sort_by: Literal["name", "character", "type", "star", "enhancement"] = Query(default="character"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    login_session_token: str | None = Cookie(default=None),
) -> WeaponListResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    weapons = await equips_service.list_character_weapons(
        selected_uid,
        page=page,
        page_size=page_size,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return weapons


@router.get("/database-characters/selected", response_model=CharacterManagementListResponse, response_model_exclude_none=True)
async def get_selected_database_characters(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    keyword: str | None = Query(default=None),
    sort_by: Literal["sequence", "name", "quality", "level", "grade", "awaken_level"] = Query(default="sequence"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    login_session_token: str | None = Cookie(default=None),
) -> CharacterManagementListResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    characters_service = request.app.state.player_characters_service
    characters = await characters_service.list_characters(
        selected_uid,
        page=page,
        page_size=page_size,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return CharacterManagementListResponse.model_validate(characters.model_dump(by_alias=True))


@router.put("/database-characters/selected/{record_id}/support", response_model=SetCharacterSupportResponse)
async def set_selected_database_character_support(
    record_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> SetCharacterSupportResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    characters_service = request.app.state.player_characters_service
    updated = await characters_service.set_character_support(selected_uid, record_id)
    if not updated:
        raise_http_error(404, "character.not_found", {"record_id": record_id})

    result = SetCharacterSupportDomainResponse(record_id=record_id, updated=True)
    return SetCharacterSupportResponse.model_validate(result.model_dump())


@router.get("/database-memories/selected", response_model=MemoryListResponse, response_model_exclude_none=True)
async def get_selected_database_memories(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=10),
    keyword: str | None = Query(default=None),
    sort_by: Literal["name", "character", "position", "star", "enhancement"] = Query(default="character"),
    sort_order: Literal["asc", "desc"] = Query(default="asc"),
    login_session_token: str | None = Cookie(default=None),
) -> MemoryListResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    memories = await equips_service.list_character_memories(
        selected_uid,
        page=page,
        page_size=page_size,
        keyword=keyword,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return MemoryListResponse.model_validate(memories.model_dump())


@router.post("/database-weapons/selected", response_model=AddWeaponResponse)
async def add_selected_database_weapon(
    request: Request,
    payload: AddWeaponRequest,
    login_session_token: str | None = Cookie(default=None),
) -> AddWeaponResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        result = await equips_service.add_weapons(selected_uid, payload.template_ids)
    except ValueError as error:
        if str(error) == "equips.template_invalid":
            raise_http_error(422, "equips.add_template_invalid", {"template_ids": payload.template_ids})
        if str(error) == "equips.equips_missing":
            raise_http_error(404, "equips.equips_missing", {"uid": selected_uid})
        if str(error) == "equips.add_failed":
            raise_http_error(500, "equips.add_failed", {"template_ids": payload.template_ids})
        raise

    return result


@router.post("/database-memories/selected", response_model=AddMemoryResponse)
async def add_selected_database_memory(
    request: Request,
    payload: AddWeaponRequest,
    login_session_token: str | None = Cookie(default=None),
) -> AddMemoryResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        result = await equips_service.add_memories(selected_uid, payload.template_ids)
    except ValueError as error:
        if str(error) == "equips.template_invalid":
            raise_http_error(422, "equips.add_template_invalid", {"template_ids": payload.template_ids})
        if str(error) == "equips.equips_missing":
            raise_http_error(404, "equips.equips_missing", {"uid": selected_uid})
        if str(error) == "equips.add_failed":
            raise_http_error(500, "equips.add_failed", {"template_ids": payload.template_ids})
        raise

    return AddMemoryResponse.model_validate(result.model_dump())


@router.api_route("/database-weapons/selected", methods=["DELETE"], response_model=ClearWeaponsResponse)
async def clear_selected_database_weapons(
    request: Request,
    payload: ClearWeaponsRequest,
    login_session_token: str | None = Cookie(default=None),
) -> ClearWeaponsResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    keyword = str(payload.keyword or "").strip()

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    result = await equips_service.clear_unequipped_weapons_by_keyword(selected_uid, keyword)
    return ClearWeaponsResponse(keyword=keyword, deleted_count=result.deleted_count)


@router.api_route("/database-memories/selected", methods=["DELETE"], response_model=ClearWeaponsResponse)
async def clear_selected_database_memories(
    request: Request,
    payload: ClearWeaponsRequest,
    login_session_token: str | None = Cookie(default=None),
) -> ClearWeaponsResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    keyword = str(payload.keyword or "").strip()

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    result = await equips_service.clear_unequipped_memories_by_keyword(selected_uid, keyword)
    return ClearWeaponsResponse(keyword=keyword, deleted_count=result.deleted_count)


@router.delete("/database-weapons/selected/{record_id}", response_model=DeleteWeaponResponse)
async def delete_selected_database_weapon(
    record_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteWeaponResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        deleted = await equips_service.delete_unequipped_weapon(selected_uid, record_id)
    except ValueError as error:
        if str(error) == "equips.equipped_delete_forbidden":
            raise_http_error(409, "equips.delete_equipped_forbidden", {"record_id": record_id})
        raise

    if not deleted:
        raise_http_error(404, "equips.not_found", {"record_id": record_id})

    return DeleteWeaponResponse(_id=record_id, deleted=True)


@router.delete("/database-memories/selected/{record_id}", response_model=DeleteWeaponResponse)
async def delete_selected_database_memory(
    record_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteWeaponResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        deleted = await equips_service.delete_unequipped_memory(selected_uid, record_id)
    except ValueError as error:
        if str(error) == "equips.equipped_delete_forbidden":
            raise_http_error(409, "equips.delete_equipped_forbidden", {"record_id": record_id})
        raise

    if not deleted:
        raise_http_error(404, "equips.not_found", {"record_id": record_id})

    return DeleteWeaponResponse(_id=record_id, deleted=True)


@router.put("/database-weapons/selected/{record_id}", response_model=UpdateWeaponResponse)
async def update_selected_database_weapon(
    record_id: int,
    payload: UpdateWeaponRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> UpdateWeaponResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        updated_weapon = await equips_service.update_weapon(selected_uid, record_id, payload)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.breakthrough_out_of_range":
            raise_http_error(422, "equips.breakthrough_invalid", {"record_id": record_id})
        if error_message == "equips.invalid_field":
            raise_http_error(422, "equips.invalid_field", {"record_id": record_id})
        if error_message == "equips.level_below_min":
            raise_http_error(422, "equips.level_below_min", {"record_id": record_id})
        if error_message == "equips.level_above_limit":
            raise_http_error(422, "equips.level_above_limit", {"record_id": record_id})
        if error_message == "equips.exp_below_min":
            raise_http_error(422, "equips.exp_below_min", {"record_id": record_id})
        if error_message == "equips.exp_above_limit":
            raise_http_error(422, "equips.exp_above_limit", {"record_id": record_id})
        if error_message == "equips.update_failed":
            raise_http_error(500, "equips.update_failed", {"record_id": record_id})
        raise

    return updated_weapon


@router.put("/database-memories/selected/{record_id}", response_model=UpdateWeaponResponse)
async def update_selected_database_memory(
    record_id: int,
    payload: UpdateWeaponRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> UpdateWeaponResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        updated_memory = await equips_service.update_memory(selected_uid, record_id, payload)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.breakthrough_out_of_range":
            raise_http_error(422, "equips.breakthrough_invalid", {"record_id": record_id})
        if error_message == "equips.invalid_field":
            raise_http_error(422, "equips.invalid_field", {"record_id": record_id})
        if error_message == "equips.level_below_min":
            raise_http_error(422, "equips.level_below_min", {"record_id": record_id})
        if error_message == "equips.level_above_limit":
            raise_http_error(422, "equips.level_above_limit", {"record_id": record_id})
        if error_message == "equips.exp_below_min":
            raise_http_error(422, "equips.exp_below_min", {"record_id": record_id})
        if error_message == "equips.exp_above_limit":
            raise_http_error(422, "equips.exp_above_limit", {"record_id": record_id})
        if error_message == "equips.update_failed":
            raise_http_error(500, "equips.update_failed", {"record_id": record_id})
        raise

    return UpdateWeaponResponse.model_validate(updated_memory.model_dump())


@router.put("/database-weapons/selected/{record_id}/resonance", response_model=UpdateWeaponResonanceResponse)
async def update_selected_database_weapon_resonance(
    record_id: int,
    payload: UpdateWeaponResonanceRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> UpdateWeaponResonanceResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        result = await equips_service.set_weapon_resonance(selected_uid, record_id, payload)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.resonance_invalid":
            raise_http_error(422, "equips.resonance_invalid", {"record_id": record_id})
        raise

    return result


@router.put("/database-memories/selected/{record_id}/resonance", response_model=UpdateWeaponResonanceResponse)
async def update_selected_database_memory_resonance(
    record_id: int,
    payload: UpdateWeaponResonanceRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> UpdateWeaponResonanceResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        result = await equips_service.set_memory_resonance(selected_uid, record_id, payload)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.resonance_invalid":
            raise_http_error(422, "equips.resonance_invalid", {"record_id": record_id})
        raise

    return result


@router.put("/database-weapons/selected/{record_id}/overrun", response_model=WeaponExtraInfoResponse, response_model_exclude_none=True)
async def update_selected_database_weapon_overrun(
    record_id: int,
    payload: UpdateWeaponOverrunRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> WeaponExtraInfoResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        await equips_service.set_weapon_overrun(selected_uid, record_id, payload)
        extra_info = await equips_service.get_weapon_extra_info(selected_uid, record_id)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.overrun_not_supported":
            raise_http_error(422, "equips.invalid_field", {"record_id": record_id})
        if error_message == "equips.overrun_invalid":
            raise_http_error(422, "equips.invalid_field", {"record_id": record_id})
        if error_message == "equips.overrun_level_below_min":
            raise_http_error(422, "equips.overrun_level_below_min", {"record_id": record_id})
        if error_message == "equips.overrun_level_above_limit":
            raise_http_error(422, "equips.overrun_level_above_limit", {"record_id": record_id})
        if error_message == "equips.update_failed":
            raise_http_error(500, "equips.update_failed", {"record_id": record_id})
        raise

    return WeaponExtraInfoResponse.model_validate(extra_info.model_dump())


@router.delete("/database-weapons/selected/{record_id}/resonance/{slot}", response_model=DeleteWeaponResonanceResponse)
async def delete_selected_database_weapon_resonance(
    record_id: int,
    slot: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteWeaponResonanceResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        deleted = await equips_service.delete_weapon_resonance(selected_uid, record_id, slot)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        raise

    if not deleted:
        raise_http_error(404, "equips.resonance_not_found", {"record_id": record_id, "slot": slot})

    return DeleteWeaponResonanceResponse(Slot=slot, deleted=True)


@router.delete("/database-memories/selected/{record_id}/resonance/{slot}", response_model=DeleteWeaponResonanceResponse)
async def delete_selected_database_memory_resonance(
    record_id: int,
    slot: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteWeaponResonanceResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_update")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        deleted = await equips_service.delete_memory_resonance(selected_uid, record_id, slot)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        raise

    if not deleted:
        raise_http_error(404, "equips.resonance_not_found", {"record_id": record_id, "slot": slot})

    return DeleteWeaponResonanceResponse(Slot=slot, deleted=True)


@router.get("/database-weapons/selected/{record_id}/extra-info", response_model=WeaponExtraInfoResponse, response_model_exclude_none=True)
async def get_selected_database_weapon_extra_info(
    record_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> WeaponExtraInfoResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        extra_info = await equips_service.get_weapon_extra_info(selected_uid, record_id)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.resonance_invalid":
            raise_http_error(422, "equips.resonance_invalid", {"record_id": record_id})
        raise

    return WeaponExtraInfoResponse.model_validate(extra_info.model_dump())


@router.get("/database-memories/selected/{record_id}/extra-info", response_model=MemoryExtraInfoResponse, response_model_exclude_none=True)
async def get_selected_database_memory_extra_info(
    record_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> MemoryExtraInfoResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_player_view")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    equips_service = request.app.state.player_equips_service

    try:
        extra_info = await equips_service.get_memory_extra_info(selected_uid, record_id)
    except ValueError as error:
        error_message = str(error)
        if error_message == "equips.not_found":
            raise_http_error(404, "equips.not_found", {"record_id": record_id})
        if error_message == "equips.template_invalid":
            raise_http_error(422, "equips.template_invalid", {"record_id": record_id})
        if error_message == "equips.resonance_invalid":
            raise_http_error(422, "equips.resonance_invalid", {"record_id": record_id})
        raise

    return MemoryExtraInfoResponse.model_validate(extra_info.model_dump())


@router.delete("/database-items/selected/{item_id}", response_model=DeleteInventoryItemResponse)
async def delete_selected_database_item(
    item_id: int,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> DeleteInventoryItemResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_item_update")

    if 1 <= item_id <= 18:
        raise_http_error(409, "item.delete_protected", {"item_id": item_id})

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    items_service = request.app.state.player_items_service

    deleted = await items_service.delete_inventory_item(selected_uid, item_id)
    if not deleted:
        raise_http_error(404, "item.not_found", {"item_id": item_id})

    return DeleteInventoryItemResponse(item_id=item_id, deleted=True)


@router.put("/database-items/selected/{item_id}", response_model=UpdateInventoryItemResponse)
async def update_selected_database_item(
    item_id: int,
    payload: UpdateInventoryItemRequest,
    request: Request,
    login_session_token: str | None = Cookie(default=None),
) -> UpdateInventoryItemResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_item_update")

    if 1 <= item_id <= 18:
        raise_http_error(409, "item.update_protected", {"item_id": item_id})

    try:
        quantity = int(payload.quantity)
    except (TypeError, ValueError):
        raise_http_error(422, "item.quantity_invalid")

    if quantity < 1:
        raise_http_error(422, "item.quantity_below_min")

    if quantity > 99999:
        raise_http_error(422, "item.quantity_above_max")

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    items_service = request.app.state.player_items_service

    updated = await items_service.update_inventory_item_quantity(selected_uid, item_id, quantity)
    if not updated:
        raise_http_error(404, "item.not_found", {"item_id": item_id})

    return UpdateInventoryItemResponse(item_id=item_id, quantity=quantity, updated=True)


@router.api_route("/database-items/selected", methods=["DELETE"], response_model=ClearInventoryItemsResponse)
async def clear_selected_database_items(
    request: Request,
    payload: ClearInventoryItemsRequest,
    login_session_token: str | None = Cookie(default=None),
) -> ClearInventoryItemsResponse:
    active_session = _get_active_session(login_session_token)
    settings = request.app.state.settings
    snapshot = get_database_health_snapshot(settings)
    if not is_database_snapshot_healthy(snapshot):
        raise_http_error(409, "database.unhealthy_item_update")

    keyword = str(payload.keyword or "").strip()

    selected_uid = await _get_selected_uid_or_error(request, active_session)
    items_service = request.app.state.player_items_service

    deleted_count = await items_service.clear_inventory_items_by_keyword(selected_uid, keyword)
    return ClearInventoryItemsResponse(keyword=keyword, deleted_count=deleted_count)


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
        raise_http_error(409, "server.logs_unavailable")

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
        raise_http_error(404, "server.config_unavailable")

    if controls["start_disabled"]:
        raise_http_error(409, "server.config_readonly_while_running")

    try:
        config_text = settings.read_server_config_text()
    except FileNotFoundError as error:
        raise_http_error(404, "server.config_not_found", {"path": str(settings.server_config_path)})
    except OSError as error:
        raise_http_error(500, "server.config_read_failed", {"reason": str(error)})

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
        raise_http_error(404, "server.config_unavailable")

    if controls["start_disabled"]:
        raise_http_error(409, "server.config_readonly_while_running")

    try:
        parsed = json.loads(payload.text)
    except json.JSONDecodeError as error:
        raise_http_error(422, "server.config_invalid_json", {"reason": error.msg, "line": error.lineno, "column": error.colno})

    if not isinstance(parsed, dict):
        raise_http_error(422, "server.config_root_not_object")

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
        raise_http_error(500, "server.config_save_failed", {"reason": str(error)})

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
        raise_http_error(401, "auth.invalid_credentials")
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
