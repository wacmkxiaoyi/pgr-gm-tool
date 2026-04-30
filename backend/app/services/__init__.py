import asyncio

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.apis import router
from backend.app.services.health_check import health_check_loop


def init_app(app, settings):
    app.state.settings = settings
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    if settings.ASSETS_DIR.exists():
        app.mount("/assets", StaticFiles(directory=settings.ASSETS_DIR), name="assets")

    app.include_router(router)

    @app.on_event("startup")
    async def _startup_health_checks() -> None:
        app.state.health_check_task = asyncio.create_task(health_check_loop(settings))

    @app.on_event("shutdown")
    async def _shutdown_health_checks() -> None:
        task = getattr(app.state, "health_check_task", None)
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
