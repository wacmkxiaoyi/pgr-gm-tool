from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_name: str = os.getenv("APP_NAME", "WACMK PGR Management")
    app_env: str = os.getenv("APP_ENV", "development")
    app_host: str = os.getenv("APP_HOST", "0.0.0.0")
    app_port: int = int(os.getenv("APP_PORT", "8000"))
    is_dev: bool = _to_bool(os.getenv("IS_DEV"), False)

    server_version: str | None = os.getenv("SERVER_VERSION")

    healthy_check_interval: int = max(1, int(os.getenv("HEALTHY_CHECK_INTERVAL", "60")))
    sdk_server_scheme: str = os.getenv("SDK_SERVER_SCHEME", "http").strip().lower() or "http"
    sdk_server_host: str = os.getenv("SDK_SERVER_HOST", "127.0.0.1").strip()
    sdk_server_port: int = int(os.getenv("SDK_SERVER_PORT", "80"))
    game_server_host: str = os.getenv("GAME_SERVER_HOST", "127.0.0.1").strip()
    game_server_port: int = int(os.getenv("GAME_SERVER_PORT", "2335"))

    mongo_uri: str = os.getenv("MONGO_URI", "").strip()
    mongo_host: str = os.getenv("MONGO_HOST", "localhost")
    mongo_port: int = int(os.getenv("MONGO_PORT", "27017"))
    mongo_db: str = os.getenv("MONGO_DB", "admin_system")
    mongo_username: str = os.getenv("MONGO_USERNAME", "").strip()
    mongo_password: str = os.getenv("MONGO_PASSWORD", "").strip()
    mongo_auth_source: str = os.getenv("MONGO_AUTH_SOURCE", "admin")
    mongo_tls: bool = _to_bool(os.getenv("MONGO_TLS"), False)
    local_data_path: Path = Path(os.getenv("LOCAL_DATA_PATH", str(Path(__file__).resolve().parents[3] / "local_data.json")))

    def build_mongo_uri(self) -> str:
        if self.mongo_uri:
            return self.mongo_uri

        credentials = ""
        if self.mongo_username:
            credentials = quote_plus(self.mongo_username)
            if self.mongo_password:
                credentials = f"{credentials}:{quote_plus(self.mongo_password)}"
            credentials = f"{credentials}@"

        query: list[str] = []
        if self.mongo_auth_source:
            query.append(f"authSource={quote_plus(self.mongo_auth_source)}")
        if self.mongo_tls:
            query.append("tls=true")

        query_string = f"?{'&'.join(query)}" if query else ""
        return f"mongodb://{credentials}{self.mongo_host}:{self.mongo_port}/{self.mongo_db}{query_string}"

    def as_dict(self) -> dict[str, Any]:
        return {
            "app_name": self.app_name,
            "app_env": self.app_env,
            "app_host": self.app_host,
            "app_port": self.app_port,
            "is_dev": self.is_dev,
            "server_version": self.server_version,
            "healthy_check_interval": self.healthy_check_interval,
            "sdk_server_scheme": self.sdk_server_scheme,
            "sdk_server_host": self.sdk_server_host,
            "sdk_server_port": self.sdk_server_port,
            "game_server_host": self.game_server_host,
            "game_server_port": self.game_server_port,
            "mongo_db": self.mongo_db,
            "mongo_host": self.mongo_host,
            "mongo_port": self.mongo_port,
            "mongo_tls": self.mongo_tls,
        }


settings = Settings()
