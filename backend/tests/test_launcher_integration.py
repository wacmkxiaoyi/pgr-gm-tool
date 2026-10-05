import json
from pathlib import Path
import socket
from types import SimpleNamespace

import pytest

from backend.app.config import Settings
from backend.app.launcher import load_launcher_build
from backend.app.services import launcher_runtime
from backend.app.services.launcher_runtime import LauncherRuntime, matching_servers
from backend.app.services.server_control import ServerController


@pytest.fixture
def local_build(tmp_path, monkeypatch):
    root = tmp_path / 'AscNetLauncher' / 'local'
    server = root / 'build' / ('9' * 40) / 'server'
    (server / 'Configs').mkdir(parents=True)
    for name in ('AscNet.dll', 'dotnet.exe', 'mongod.exe'):
        (server / name).touch()
    config = {'GameServer': {'Host': '127.0.0.1', 'Port': 42002},
              'Database': {'Host': '127.0.0.1', 'Port': 42003, 'Name': 'asc_net'},
              'SDKServer': {'HttpPort': 80}}
    (server / 'Configs' / 'config.json').write_text(json.dumps(config), encoding='utf-8')
    (root / 'config.json').write_text(json.dumps(config), encoding='utf-8')
    state = {'schemaVersion': 1, 'serverDirectory': str(server), 'resourceDirectory': str(server),
             'dotnet': str(server / 'dotnet.exe'), 'mongod': str(server / 'mongod.exe'),
             'sdkPort': 42001, 'gamePort': 42002, 'mongoPort': 42003}
    (root / 'build-state.json').write_text(json.dumps(state), encoding='utf-8')
    monkeypatch.setenv('LOCALAPPDATA', str(tmp_path))
    monkeypatch.delenv('ASCNET_LAUNCHER_PATH', raising=False)
    monkeypatch.delenv('ENABLE_SERVER_MANAGEMENT', raising=False)
    return load_launcher_build(str(root))


def test_default_discovery_overrides_paths_ports_and_uri(local_build):
    settings = Settings({'SERVER_PATH': 'wrong', 'SERVER_BINARY_FILE': 'wrong.exe',
                         'SDK_SERVER_PORT': 1, 'GAME_SERVER_PORT': 2,
                         'MONGO_PORT': 3, 'MONGO_URI': 'mongodb://wrong:1/other'})
    assert settings.launcher_build == local_build
    assert settings.server_path == str(local_build.server_directory)
    assert settings.server_config_path == local_build.config_path
    assert settings.server_binary_file == 'AscNet.dll'
    assert not settings.enable_server_management
    assert (settings.sdk_server_port, settings.game_server_port, settings.mongo_port) == (42001, 42002, 42003)
    assert settings.sdk_server_scheme == 'http'
    assert '127.0.0.1:42003/asc_net' in settings.build_mongo_uri()
    assert ServerController(settings).controls_visible()


def test_disabled_controls_keep_auto_database_connection(local_build):
    settings = Settings({'ENABLE_SERVER_MANAGEMENT': 'false'})
    assert not settings.enable_server_management
    assert settings.mongo_port == local_build.mongo_port


@pytest.mark.parametrize('launcher_path', [None, ''])
def test_management_flag_respects_environment_and_cli(local_build, monkeypatch, launcher_path):
    options = {} if launcher_path is None else {'ASCNET_LAUNCHER_PATH': launcher_path}
    assert not Settings(options).enable_server_management
    monkeypatch.setenv('ENABLE_SERVER_MANAGEMENT', 'true')
    assert Settings(options).enable_server_management
    assert not Settings({**options, 'ENABLE_SERVER_MANAGEMENT': 'false'}).enable_server_management
    monkeypatch.setenv('ENABLE_SERVER_MANAGEMENT', 'false')
    assert Settings({**options, 'ENABLE_SERVER_MANAGEMENT': 'true'}).enable_server_management


def test_empty_path_disables_discovery_and_missing_state_falls_back(local_build, tmp_path):
    for value in ('', str(tmp_path / 'missing')):
        settings = Settings({'ASCNET_LAUNCHER_PATH': value, 'SERVER_PATH': str(tmp_path / 'other'),
                             'MONGO_PORT': 12345})
        assert settings.launcher_build is None
        assert settings.mongo_port == 12345


@pytest.mark.parametrize('change', [{'sdkPort': 42003}, {'mongoPort': 0}, {'schemaVersion': 2},
                                   {'serverDirectory': 'relative'}])
def test_present_invalid_state_reports_error(local_build, change):
    path = local_build.root / 'build-state.json'
    state = json.loads(path.read_text())
    state.update(change)
    path.write_text(json.dumps(state))
    with pytest.raises(ValueError, match='Invalid Launcher build'):
        Settings()


def test_config_save_updates_running_and_persistent_copies(local_build):
    settings = Settings()
    config = json.loads(settings.read_server_config_text())
    config['VerboseLevel'] = 'Information'
    text = json.dumps(config)
    settings.write_server_config_text(text)
    settings.reload_server_runtime_config()
    assert settings.read_server_config_text() == text
    assert (local_build.root / 'config.json').read_text() == text
    assert settings.sdk_server_port == local_build.sdk_port
    config['Database']['Port'] = 27017
    with pytest.raises(ValueError, match='must match'):
        settings.write_server_config_text(json.dumps(config))
    assert settings.read_server_config_text() == text


def test_exact_dotnet_and_dll_process_matching(local_build, monkeypatch):
    def process(pid, exe, dll):
        return SimpleNamespace(pid=pid, info={'exe': str(exe), 'cmdline': [str(exe), str(dll)]})
    processes = [process(1, local_build.dotnet, local_build.server_dll),
                 process(2, local_build.dotnet, local_build.server_directory / 'Other.dll'),
                 process(3, local_build.server_directory / 'other-dotnet.exe', local_build.server_dll)]
    monkeypatch.setattr(launcher_runtime.os, 'getpid', lambda: 999)
    monkeypatch.setattr(launcher_runtime.psutil, 'process_iter', lambda fields: processes)
    assert matching_servers(local_build) == [processes[0]]


class FakeStdin:
    def __init__(self, events):
        self.events = events

    def write(self, value):
        self.events.append(('stdin', value))

    def flush(self):
        pass

    def close(self):
        pass


class FakeChild:
    def __init__(self, label, events):
        self.label = label
        self.events = events
        self.stdin = FakeStdin(events)
        self.returncode = None

    def poll(self):
        return self.returncode

    def wait(self, timeout):
        self.events.append(('wait', self.label))
        self.returncode = 0


def test_startup_contract_and_owned_shutdown_order(local_build, monkeypatch):
    runtime = LauncherRuntime(local_build)
    events = []
    calls = []
    monkeypatch.setattr(launcher_runtime, 'matching_servers', lambda _: [])
    monkeypatch.setattr(runtime, '_matching_mongo', lambda: False)

    class Listener:
        def setsockopt(self, *args):
            pass

        def bind(self, address):
            pass

        def listen(self):
            pass

        def close(self):
            pass

    monkeypatch.setattr(launcher_runtime.socket, 'socket', Listener)

    def spawn(command, **kwargs):
        label = 'mongo' if command[0] == str(local_build.mongod) else 'server'
        events.append(('start', label))
        calls.append((command, kwargs))
        return FakeChild(label, events)

    monkeypatch.setattr(launcher_runtime.subprocess, 'Popen', spawn)
    monkeypatch.setattr(runtime, '_wait', lambda child, ready, label: events.append(('ready', label)))
    monkeypatch.setattr(launcher_runtime.subprocess, 'run', lambda command, **kwargs: events.append(('helper', command)))
    runtime.start()
    assert [entry[:2] for entry in events] == [('start', 'mongo'), ('ready', 'MongoDB'),
                                              ('start', 'server'), ('ready', 'AscNet')]
    assert calls[0][0] == local_build.mongo_command
    assert calls[1][0] == local_build.server_command
    assert calls[1][1]['cwd'] == str(local_build.resource_directory)
    env = calls[1][1]['env']
    assert env['ASCNET_MANAGED_STDIN'] == '1'
    assert env['ASCNET_PUBLIC_HTTP_ORIGIN'] == local_build.origin
    assert env['ASCNET_GAME_BIND_ADDRESS'] == '127.0.0.1'
    runtime.stop()
    assert events[4:6] == [('stdin', b'shutdown\n'), ('wait', 'server')]
    assert events[6][0] == 'helper' and events[6][1][-2:] == ['--shutdown-local-mongo', '42003']
    assert events[7] == ('wait', 'mongo')
    assert runtime.server is None and runtime.mongo is None


def test_occupied_port_prevents_any_launch(local_build, monkeypatch):
    listener = socket.socket()
    listener.bind(('127.0.0.1', 0))
    listener.listen()
    from dataclasses import replace
    runtime = LauncherRuntime(replace(local_build, sdk_port=listener.getsockname()[1]))
    monkeypatch.setattr(launcher_runtime, 'matching_servers', lambda _: [])
    monkeypatch.setattr(runtime, '_matching_mongo', lambda: False)
    monkeypatch.setattr(launcher_runtime.subprocess, 'Popen', lambda *args, **kwargs: pytest.fail('must not spawn'))
    try:
        with pytest.raises(OSError):
            runtime.start()
        assert runtime.mongo is None and runtime.server is None
    finally:
        listener.close()


def test_existing_launcher_server_is_reused_without_ownership(local_build, monkeypatch):
    runtime = LauncherRuntime(local_build)
    monkeypatch.setattr(launcher_runtime, 'matching_servers', lambda _: [object()])
    monkeypatch.setattr(launcher_runtime.subprocess, 'Popen', lambda *args, **kwargs: pytest.fail('must not spawn'))
    runtime.start()
    runtime.stop()
    assert runtime.server is None and runtime.mongo is None


def test_failure_after_mongo_start_cleans_owned_database(local_build, monkeypatch):
    runtime = LauncherRuntime(local_build)
    events = []
    monkeypatch.setattr(launcher_runtime, 'matching_servers', lambda _: [])
    monkeypatch.setattr(runtime, '_matching_mongo', lambda: False)
    monkeypatch.setattr(launcher_runtime.subprocess, 'Popen', lambda *args, **kwargs: FakeChild('mongo', events))
    monkeypatch.setattr(runtime, '_wait', lambda *args: (_ for _ in ()).throw(RuntimeError('not ready')))
    monkeypatch.setattr(launcher_runtime.subprocess, 'run', lambda *args, **kwargs: events.append('shutdown helper'))
    with pytest.raises(RuntimeError, match='not ready'):
        runtime.start()
    assert events == ['shutdown helper', ('wait', 'mongo')]
    assert runtime.mongo is None and runtime.server is None


def test_existing_mongo_is_not_stopped_on_server_start_failure(local_build, monkeypatch):
    runtime = LauncherRuntime(local_build)
    monkeypatch.setattr(launcher_runtime, 'matching_servers', lambda _: [])
    monkeypatch.setattr(runtime, '_matching_mongo', lambda: True)
    monkeypatch.setattr(launcher_runtime, '_tcp_ready', lambda _: True)
    monkeypatch.setattr(launcher_runtime.subprocess, 'Popen', lambda *args, **kwargs: (_ for _ in ()).throw(OSError('spawn failed')))
    monkeypatch.setattr(launcher_runtime.subprocess, 'run', lambda *args, **kwargs: pytest.fail('external MongoDB must remain running'))
    with pytest.raises(OSError, match='spawn failed'):
        runtime.start()
    assert runtime.mongo is None and runtime.server is None
