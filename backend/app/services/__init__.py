import asyncio
import json
import uuid

from fastapi import Cookie, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse, RedirectResponse

from backend.app.apis.schemas import ApiErrorResponse

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.services.db_schema_runtime import init_database_schema_runtime
from backend.app.services.database_accounts import DatabaseAccountsService
from backend.app.services.database_control import database_health_check_loop
from backend.app.services.player.player_equips_service import PlayerEquipsService
from backend.app.services.player.player_characters_service import PlayerCharactersService
from backend.app.services.player.player_items_service import PlayerItemsService
from backend.app.services.player.player_profile_service import PlayerProfileService
from backend.app.services.player.player_stages_service import PlayerStagesService
from backend.app.services.server_control import ServerController, health_check_loop
from backend.app.services.auth import get_session
from backend.app.services.api_errors import AppError, convert_http_exception, get_error_message, normalize_locale

def _get_request_locale(request: Request) -> str:
    header = request.headers.get('accept-language', '')
    return normalize_locale(header)


def _build_error_response(request: Request, status_code: int, code: str, details: dict[str, object] | None = None, *, fallback_message: str | None = None) -> JSONResponse:
    locale = _get_request_locale(request)
    request_id = str(uuid.uuid4())
    payload = ApiErrorResponse(
        code=code,
        message=get_error_message(code, locale, fallback=fallback_message),
        details={**(details or {}), 'request_id': request_id},
    )
    return JSONResponse(
        status_code=status_code,
        content=payload.model_dump(),
        headers={'Content-Language': locale, 'X-Request-Id': request_id},
    )

def init_app(app, settings):
    from backend.app.apis import router, server_management_router

    app.state.settings = settings
    app.state.db_schema_runtime = init_database_schema_runtime()
    app.state.pgr_server_controller = ServerController(settings)
    app.state.database_accounts_service = DatabaseAccountsService(settings, app.state.db_schema_runtime)
    app.state.player_items_service = PlayerItemsService(settings, app.state.db_schema_runtime)
    app.state.player_profile_service = PlayerProfileService(settings, app.state.player_items_service, app.state.db_schema_runtime)
    app.state.player_characters_service = PlayerCharactersService(settings, app.state.db_schema_runtime)
    app.state.player_equips_service = PlayerEquipsService(settings, app.state.db_schema_runtime)
    app.state.player_stages_service = PlayerStagesService(settings, app.state.db_schema_runtime)
    app.state.stages_schema_available = app.state.db_schema_runtime.has_collection("stages")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.SRC_DIR.exists():
        app.mount("/src", StaticFiles(directory=settings.SRC_DIR), name="src")

    if settings.ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=settings.ASSETS_DIR), name="assets")

    app.include_router(router)
    if settings.enable_server_management:
        app.include_router(server_management_router)

    @app.on_event("startup")
    async def _startup_health_checks() -> None:
        if settings.enable_server_management:
            app.state.health_check_task = asyncio.create_task(health_check_loop(settings))
        app.state.database_health_check_task = asyncio.create_task(database_health_check_loop(settings))

    @app.on_event("shutdown")
    async def _shutdown_health_checks() -> None:
        task = getattr(app.state, "health_check_task", None)
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        database_task = getattr(app.state, "database_health_check_task", None)
        if database_task is not None:
            database_task.cancel()
            try:
                await database_task
            except asyncio.CancelledError:
                pass

        controller = getattr(app.state, "pgr_server_controller", None)
        if controller is not None:
            await controller.shutdown()

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, error: AppError) -> JSONResponse:
        return _build_error_response(request, error.status_code, error.code, error.details)


    @app.exception_handler(HTTPException)
    async def handle_http_error(request: Request, error: HTTPException) -> JSONResponse:
        code, details, message = convert_http_exception(error)
        return _build_error_response(request, error.status_code, code, details, fallback_message=message)


    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
        field_errors: list[dict[str, object]] = []
        for item in error.errors():
            location = item.get('loc') or []
            field = '.'.join(str(part) for part in location[1:]) if len(location) > 1 else str(location[0]) if location else 'request'
            entry: dict[str, object] = {
                'field': field,
                'reason': item.get('type') or 'invalid',
            }
            context = item.get('ctx')
            if isinstance(context, dict):
                entry.update(context)
            field_errors.append(entry)

        return _build_error_response(
            request,
            422,
            'request.validation_failed',
            {'fields': field_errors},
        )


    @app.exception_handler(json.JSONDecodeError)
    async def handle_json_decode_error(request: Request, error: json.JSONDecodeError) -> JSONResponse:
        return _build_error_response(
            request,
            400,
            'request.invalid_json',
            {'line': error.lineno, 'column': error.colno},
        )


    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, error: Exception) -> JSONResponse:
        return _build_error_response(request, 500, 'internal.server_error', {'type': type(error).__name__})


    @app.get("/", response_model=None)
    async def root(login_session_token: str | None = Cookie(default=None)) -> FileResponse | RedirectResponse:
        if get_session(login_session_token) is None:
            return RedirectResponse(url="/login", status_code=302)
        return FileResponse(settings.FRONTEND_DIR / "dashboard.html")


    @app.get("/login", response_model=None)
    async def login_page(login_session_token: str | None = Cookie(default=None)) -> FileResponse | RedirectResponse:
        if get_session(login_session_token) is not None:
            return RedirectResponse(url="/", status_code=302)
        return FileResponse(settings.FRONTEND_DIR / "index.html")
