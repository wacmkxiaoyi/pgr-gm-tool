"""AscNet Launcher's persisted local build and runtime conventions."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


def default_launcher_path() -> str:
    base = os.environ.get('LOCALAPPDATA')
    return str(Path(base) / 'AscNetLauncher' / 'local') if base else ''


@dataclass(frozen=True)
class LauncherBuild:
    root: Path
    server_directory: Path
    resource_directory: Path
    dotnet: Path
    mongod: Path
    sdk_port: int
    game_port: int
    mongo_port: int

    @property
    def server_dll(self) -> Path:
        return self.server_directory / 'AscNet.dll'

    @property
    def config_path(self) -> Path:
        return self.resource_directory / 'Configs' / 'config.json'

    @property
    def origin(self) -> str:
        return f'http://127.0.0.1:{self.sdk_port}'

    @property
    def server_command(self) -> list[str]:
        return [str(self.dotnet), str(self.server_dll), '--urls', self.origin]

    @property
    def mongo_command(self) -> list[str]:
        return [str(self.mongod), '--bind_ip', '127.0.0.1', '--dbpath',
                str(self.root / 'data' / 'mongo'), '--port', str(self.mongo_port)]

    def validate_config(self, config: dict) -> None:
        if not isinstance(config, dict):
            raise ValueError('Launcher configuration must be a JSON object')
        for name, port in (('GameServer', self.game_port), ('Database', self.mongo_port)):
            value = config.get(name, {})
            if not isinstance(value, dict) or value.get('Host') != '127.0.0.1' or value.get('Port') != port:
                raise ValueError(f'Launcher {name}.Host/Port must match build-state.json (127.0.0.1:{port})')
        if config.get('Database', {}).get('Name') != 'asc_net':
            raise ValueError('Launcher Database.Name must be asc_net')


def load_launcher_build(path: str) -> LauncherBuild | None:
    if not path:
        return None
    root = Path(path).expanduser().resolve()
    state = root / 'build-state.json'
    if not state.is_file():
        return None
    try:
        data = json.loads(state.read_text(encoding='utf-8-sig'))
        if data['schemaVersion'] != 1:
            raise ValueError('unsupported schemaVersion')
        ports = [data[key] for key in ('sdkPort', 'gamePort', 'mongoPort')]
        if any(type(port) is not int or not 1 <= port <= 65535 for port in ports) or len(set(ports)) != 3:
            raise ValueError('ports must be distinct integers between 1 and 65535')
        directories = []
        for key in ('serverDirectory', 'resourceDirectory'):
            directory = Path(data[key])
            if not directory.is_absolute() or not directory.is_dir() or not directory.resolve().is_relative_to(root):
                raise ValueError(f'{key} must be an existing absolute directory beneath {root}')
            directories.append(directory.resolve())
        executables = []
        for key in ('dotnet', 'mongod'):
            executable = Path(data[key])
            if not executable.is_absolute() or not executable.is_file():
                raise ValueError(f'{key} must be an existing absolute executable')
            executables.append(executable.resolve())
        build = LauncherBuild(root, *directories, *executables, *ports)
        if not build.server_dll.is_file():
            raise ValueError('serverDirectory does not contain AscNet.dll')
        config = json.loads(build.config_path.read_text(encoding='utf-8-sig'))
        build.validate_config(config)
        return build
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ValueError(f'Invalid Launcher build at {state}: {error}') from error
