from __future__ import annotations

import asyncio
from pathlib import Path

from fastapi import Cookie, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.core.config import settings
from app.services.health_check import health_check_loop
from app.services.auth import get_session


BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend"
ASSETS_DIR = FRONTEND_DIR / "assets"


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")

    app.include_router(router)

    @app.on_event("startup")
    async def _startup_health_checks() -> None:
        app.state.health_check_task = asyncio.create_task(health_check_loop())

    @app.on_event("shutdown")
    async def _shutdown_health_checks() -> None:
        task = getattr(app.state, "health_check_task", None)
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    return app


app = create_app()


@app.get("/", response_model=None)
async def root(login_session_token: str | None = Cookie(default=None)) -> FileResponse | RedirectResponse:
    if get_session(login_session_token) is None:
        return RedirectResponse(url="/login", status_code=302)
    return FileResponse(FRONTEND_DIR / "dashboard.html")


@app.get("/login", response_model=None)
async def login_page(login_session_token: str | None = Cookie(default=None)) -> FileResponse | RedirectResponse:
    if get_session(login_session_token) is not None:
        return RedirectResponse(url="/", status_code=302)
    return FileResponse(FRONTEND_DIR / "index.html")
