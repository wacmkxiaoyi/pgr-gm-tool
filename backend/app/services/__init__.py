import asyncio

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.apis import router
from backend.app.services.database_control import DatabaseController, database_health_check_loop
from backend.app.services.server_control import ServerController, health_check_loop


def init_app(app, settings):
    app.state.settings = settings
    app.state.pgr_server_controller = ServerController(settings)
    app.state.database_controller = DatabaseController(settings)
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
