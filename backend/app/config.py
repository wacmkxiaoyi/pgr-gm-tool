from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from backend.app.constant import SERVER_VERSION


def _to_bool(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _to_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _deep_merge(defaults: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
    merged = dict(defaults)
    for key, default_value in defaults.items():
        if key not in values:
            continue
        value = values[key]
        if isinstance(default_value, dict) and isinstance(value, dict):
            merged[key] = _deep_merge(default_value, value)
        else:
            merged[key] = value
    return merged


def _server_config_defaults() -> dict[str, Any]:
    return {
        "VerboseLevel": "Debug",
        "EnableGMCommand": False,
        "SkipGuideStage": False,
        "PreloadAllTables": True,
        "TablePreloadMaxDegreeOfParallelism": 4,
        "SDKServer": {
            "Host": "127.0.0.1",
            "HttpPort": 80,
            "HttpsPort": 443,
            "Https": {
                "Enabled": False,
                "CertPemPath": "",
                "KeyPemPath": "",
            },
        },
        "GameServer": {
            "RegionName": "Wacmk.Pgr.Server",
            "Host": "127.0.0.1",
            "Port": 2335,
        },
        "Database": {
            "Host": "127.0.0.1",
            "Port": 27017,
            "Name": "asc_net",
            "Username": "",
            "Password": "",
            "AuthDatabase": "admin",
        },
        "AutoSave": {
            "IntervalSeconds": 300,
        },
    }


def _path_is_executable(path: Path) -> bool:
    return path.exists() and path.is_file() and os.access(path, os.X_OK)


def _load_server_config(path: str | None) -> dict[str, Any] | None:
    if not path:
        return None

    config_path = Path(path)
    try:
        raw_config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, ValueError):
        return None

    if not isinstance(raw_config, dict):
        return None

    return _deep_merge(_server_config_defaults(), raw_config)


def _build_mongo_uri(
    host: str,
    port: int,
    db_name: str,
    username: str,
    password: str,
    auth_source: str,
    tls: bool,
) -> str:
    credentials = ""
    if username:
        credentials = quote_plus(username)
        if password:
            credentials = f"{credentials}:{quote_plus(password)}"
        credentials = f"{credentials}@"

    query: list[str] = []
    if auth_source:
        query.append(f"authSource={quote_plus(auth_source)}")
    if tls:
        query.append("tls=true")

    query_string = f"?{'&'.join(query)}" if query else ""
    return f"mongodb://{credentials}{host}:{port}/{db_name}{query_string}"


class Settings:
    BASE_DIR = Path(__file__).resolve().parents[2]
    FRONTEND_DIR = BASE_DIR / "frontend"
    SRC_DIR = FRONTEND_DIR / "src"
    ASSETS_DIR = FRONTEND_DIR / "assets"

    def __init__(self) -> None:
        self.app_name = os.getenv("APP_NAME", "WACMK PGR Management")
        self.app_env = os.getenv("APP_ENV", "development")
        self.app_host = os.getenv("APP_HOST", "0.0.0.0")
        self.app_port = _to_int(os.getenv("APP_PORT"), 8000)
        self.is_dev = _to_bool(os.getenv("IS_DEV"), False)

        self.server_version = SERVER_VERSION
        self.server_path = os.getenv("SERVER_PATH", "/root/wacmk-pgr-server")
        self.server_binary_file = os.getenv("SERVER_BINARY_FILE", "Wacmk.Pgr.Server")
        self.server_runtime_log_path = os.getenv("SERVER_RUNTIME_LOG_PATH", "/tmp/rpg-server.log").strip() or "/tmp/rpg-server.log"
        self.server_controls_visible = _path_is_executable(Path(self.server_path) / self.server_binary_file)
        self.server_config_path = Path(self.server_path) / "Configs" / "config.json"

        self.healthy_check_interval = max(1, _to_int(os.getenv("HEALTHY_CHECK_INTERVAL"), 60))
        self.admin_username = os.getenv("ADMIN_USERNAME", "").strip()
        self.admin_password = os.getenv("ADMIN_PASSWORD", "").strip()

        self.reload_server_runtime_config()

    def _apply_server_runtime_config(self, server_config: dict[str, Any] | None) -> None:
        if server_config is not None:
            sdk_server = server_config["SDKServer"]
            https_config = sdk_server["Https"]
            game_server = server_config["GameServer"]
            database = server_config["Database"]

            self.sdk_server_scheme = "https" if https_config["Enabled"] else "http"
            self.sdk_server_host = str(sdk_server["Host"]).strip()
            self.sdk_server_port = _to_int(
                sdk_server["HttpsPort"] if https_config["Enabled"] else sdk_server["HttpPort"],
                443 if https_config["Enabled"] else 80,
            )
            self.game_server_host = str(game_server["Host"]).strip()
            self.game_server_port = _to_int(game_server["Port"], 2335)

            self.mongo_uri = ""
            self.mongo_host = str(database["Host"]).strip()
            self.mongo_port = _to_int(database["Port"], 27017)
            self.mongo_db = str(database["Name"]).strip()
            self.mongo_username = str(database["Username"]).strip()
            self.mongo_password = str(database["Password"]).strip()
            self.mongo_auth_source = str(database["AuthDatabase"]).strip()
            self.mongo_tls = False
            return

        self.sdk_server_scheme = os.getenv("SDK_SERVER_SCHEME", "http").strip().lower() or "http"
        self.sdk_server_host = os.getenv("SDK_SERVER_HOST", "127.0.0.1").strip()
        self.sdk_server_port = _to_int(os.getenv("SDK_SERVER_PORT"), 80)
        self.game_server_host = os.getenv("GAME_SERVER_HOST", "127.0.0.1").strip()
        self.game_server_port = _to_int(os.getenv("GAME_SERVER_PORT"), 2335)

        self.mongo_uri = os.getenv("MONGO_URI", "").strip()
        self.mongo_host = os.getenv("MONGO_HOST", "localhost")
        self.mongo_port = _to_int(os.getenv("MONGO_PORT"), 27017)
        self.mongo_db = os.getenv("MONGO_DB", "asc_net")
        self.mongo_username = os.getenv("MONGO_USERNAME", "").strip()
        self.mongo_password = os.getenv("MONGO_PASSWORD", "").strip()
        self.mongo_auth_source = os.getenv("MONGO_AUTH_SOURCE", "admin")
        self.mongo_tls = _to_bool(os.getenv("MONGO_TLS"), False)

    def reload_server_runtime_config(self) -> None:
        self.server_controls_visible = _path_is_executable(Path(self.server_path) / self.server_binary_file)
        self.server_config_path = Path(self.server_path) / "Configs" / "config.json"
        server_config = _load_server_config(str(self.server_config_path))
        self._apply_server_runtime_config(server_config)

    def read_server_config_text(self) -> str:
        return self.server_config_path.read_text(encoding="utf-8")

    def build_mongo_uri(self) -> str:
        if self.mongo_uri:
            return self.mongo_uri

        return _build_mongo_uri(
            self.mongo_host,
            self.mongo_port,
            self.mongo_db,
            self.mongo_username,
            self.mongo_password,
            self.mongo_auth_source,
            self.mongo_tls,
        )

    def as_dict(self) -> dict[str, Any]:
        return {
            "app_name": self.app_name,
            "app_env": self.app_env,
            "app_host": self.app_host,
            "app_port": self.app_port,
            "is_dev": self.is_dev,
            "server_version": self.server_version,
            "server_runtime_log_path": self.server_runtime_log_path,
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
            "admin_username": self.admin_username,
        }
