from __future__ import annotations

from fastapi import Cookie, FastAPI
from fastapi.responses import FileResponse, RedirectResponse

from backend.app.config import Settings
from backend.app.services import init_app
from backend.app.services.auth import get_session


settings = Settings()
app = FastAPI(title=settings.app_name)
init_app(app, settings)

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


