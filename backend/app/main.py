from __future__ import annotations

import argparse

from fastapi import FastAPI
from backend.app.config import configure_settings
from backend.app.services import init_app

def _parse_cli_args() -> dict[str, object]:
    parser = argparse.ArgumentParser()
    parser.add_argument("--APP_NAME", default=None)
    parser.add_argument("--APP_HOST", default=None)
    parser.add_argument("--APP_PORT", type=int, default=None)
    parser.add_argument("--ENABLE_SERVER_MANAGEMENT", default=None)
    parser.add_argument("--GAME_VERSION", default=None)
    parser.add_argument("--SERVER_PATH", default=None)
    parser.add_argument("--SERVER_BINARY_FILE", default=None)
    parser.add_argument("--SERVER_RUNTIME_LOG_PATH", default=None)
    parser.add_argument("--HEALTHY_CHECK_INTERVAL", type=int, default=None)
    parser.add_argument("--ADMIN_USERNAME", default=None)
    parser.add_argument("--ADMIN_PASSWORD", default=None)
    parser.add_argument("--SDK_SERVER_SCHEME", default=None)
    parser.add_argument("--SDK_SERVER_HOST", default=None)
    parser.add_argument("--SDK_SERVER_PORT", type=int, default=None)
    parser.add_argument("--GAME_SERVER_HOST", default=None)
    parser.add_argument("--GAME_SERVER_PORT", type=int, default=None)
    parser.add_argument("--MONGO_URI", default=None)
    parser.add_argument("--MONGO_HOST", default=None)
    parser.add_argument("--MONGO_PORT", type=int, default=None)
    parser.add_argument("--MONGO_DB", default=None)
    parser.add_argument("--MONGO_USERNAME", default=None)
    parser.add_argument("--MONGO_PASSWORD", default=None)
    parser.add_argument("--MONGO_AUTH_SOURCE", default=None)
    parser.add_argument("--MONGO_TLS", default=None)
    parser.add_argument("--MAX_CHARACTER_USE_FIX_MEMORY_RESONANCE", default=None)
    args, _ = parser.parse_known_args()
    return {k: v for k, v in vars(args).items() if v is not None}

_cli_args = _parse_cli_args() if __name__ == '__main__' else {}
settings = configure_settings(cli_args=_cli_args if _cli_args else None)
app = FastAPI(title=settings.app_name)
init_app(app, settings)

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host=settings.app_host, port=settings.app_port)
