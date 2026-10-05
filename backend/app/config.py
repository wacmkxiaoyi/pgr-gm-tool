from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

from backend.app.launcher import default_launcher_path, load_launcher_build

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

    def __init__(self, cli_args: dict[str, Any] | None = None, *, discover_launcher: bool = True) -> None:
        self._cli_args = cli_args or {}

        self.app_name = self._resolve("APP_NAME", "Punishing Gray Raven Management")
        self.app_host = self._resolve("APP_HOST", "0.0.0.0")
        self.app_port = _to_int(self._resolve("APP_PORT"), 8000)

        self.enable_server_management = _to_bool(self._resolve("ENABLE_SERVER_MANAGEMENT"), False)
        self.server_path = self._resolve("SERVER_PATH", "/root/wacmk-pgr-server")
        self.server_binary_file = self._resolve("SERVER_BINARY_FILE", "Wacmk.Pgr.Server")
        self.server_runtime_log_path = (self._resolve("SERVER_RUNTIME_LOG_PATH") or "").strip() or "/tmp/rpg-server.log"
        self.server_controls_visible = _path_is_executable(Path(self.server_path) / self.server_binary_file)
        self.server_config_path = Path(self.server_path) / "Configs" / "config.json"

        self.ascnet_launcher_path = (self._resolve('ASCNET_LAUNCHER_PATH', default_launcher_path()) or '').strip()
        self.launcher_build = load_launcher_build(self.ascnet_launcher_path) if discover_launcher else None

        self.healthy_check_interval = max(1, _to_int(self._resolve("HEALTHY_CHECK_INTERVAL"), 60))
        self.admin_username = (self._resolve("ADMIN_USERNAME") or "").strip()
        self.admin_password = (self._resolve("ADMIN_PASSWORD") or "").strip()
        self.authentication_enabled = bool(self.admin_username and self.admin_password)
        self.max_character_use_fix_memory_resonance = _to_bool(
            self._resolve("MAX_CHARACTER_USE_FIX_MEMORY_RESONANCE"),
            True,
        )

        self.reload_server_runtime_config()

    def _resolve(self, key: str, env_default: Any = None) -> Any:
        if key in self._cli_args:
            return self._cli_args[key]
        return os.getenv(key, env_default)

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

        self.sdk_server_scheme = (self._resolve("SDK_SERVER_SCHEME") or "").strip().lower() or "http"
        self.sdk_server_host = (self._resolve("SDK_SERVER_HOST") or "").strip() or "127.0.0.1"
        self.sdk_server_port = _to_int(self._resolve("SDK_SERVER_PORT"), 80)
        self.game_server_host = (self._resolve("GAME_SERVER_HOST") or "").strip() or "127.0.0.1"
        self.game_server_port = _to_int(self._resolve("GAME_SERVER_PORT"), 2335)

        self.mongo_uri = (self._resolve("MONGO_URI") or "").strip()
        self.mongo_host = self._resolve("MONGO_HOST") or "localhost"
        self.mongo_port = _to_int(self._resolve("MONGO_PORT"), 27017)
        self.mongo_db = self._resolve("MONGO_DB") or "asc_net"
        self.mongo_username = (self._resolve("MONGO_USERNAME") or "").strip()
        self.mongo_password = (self._resolve("MONGO_PASSWORD") or "").strip()
        self.mongo_auth_source = self._resolve("MONGO_AUTH_SOURCE") or "admin"
        self.mongo_tls = _to_bool(self._resolve("MONGO_TLS"), False)

    def reload_server_runtime_config(self) -> None:
        if self.launcher_build is not None:
            build = self.launcher_build
            self.server_path = str(build.server_directory)
            self.server_binary_file = 'AscNet.dll'
            self.server_controls_visible = build.server_dll.is_file() and build.dotnet.is_file()
            self.server_config_path = build.config_path
            self.server_runtime_log_path = str(build.root / 'logs' / 'server.log')
            config = json.loads(build.config_path.read_text(encoding='utf-8-sig'))
            build.validate_config(config)
            self._apply_server_runtime_config(_deep_merge(_server_config_defaults(), config))
            self.sdk_server_scheme = 'http'
            self.sdk_server_host = self.game_server_host = self.mongo_host = '127.0.0.1'
            self.sdk_server_port = build.sdk_port
            self.game_server_port = build.game_port
            self.mongo_port = build.mongo_port
            return
        self.server_controls_visible = _path_is_executable(Path(self.server_path) / self.server_binary_file)
        self.server_config_path = Path(self.server_path) / "Configs" / "config.json"
        server_config = _load_server_config(str(self.server_config_path))
        self._apply_server_runtime_config(server_config)

    def read_server_config_text(self) -> str:
        return self.server_config_path.read_text(encoding="utf-8")

    def write_server_config_text(self, text: str) -> None:
        parsed = json.loads(text)
        if self.launcher_build is not None:
            self.launcher_build.validate_config(parsed)
        self.server_config_path.parent.mkdir(parents=True, exist_ok=True)
        self.server_config_path.write_text(text, encoding='utf-8')
        if self.launcher_build is not None:
            (self.launcher_build.root / 'config.json').write_text(text, encoding='utf-8')

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
            "app_host": self.app_host,
            "app_port": self.app_port,
            "ascnet_launcher_path": self.ascnet_launcher_path,
            "enable_server_management": self.enable_server_management,
            "server_runtime_log_path": self.server_runtime_log_path,
            "healthy_check_interval": self.healthy_check_interval,
            "authentication_enabled": self.authentication_enabled,
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
            "max_character_use_fix_memory_resonance": self.max_character_use_fix_memory_resonance,
        }


# CLI arguments are parsed by main before discovery, so an invalid default
# state must not prevent selecting another root (or disabling discovery).
settings = Settings(discover_launcher=False)


def configure_settings(cli_args: dict[str, Any] | None = None) -> Settings:
    global settings
    settings = Settings(cli_args=cli_args)
    return settings
