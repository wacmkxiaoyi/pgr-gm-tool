from __future__ import annotations

import json
import uuid

from fastapi import Cookie, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.responses import FileResponse, RedirectResponse

from backend.app.apis.schemas import ApiErrorResponse
from backend.app.config import Settings
from backend.app.services import init_app
from backend.app.services.auth import get_session
from backend.app.services.api_errors import AppError, convert_http_exception, get_error_message, normalize_locale

server_version = 2.3
settings = Settings(server_version)
app = FastAPI(title=settings.app_name)
init_app(app, settings)


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


