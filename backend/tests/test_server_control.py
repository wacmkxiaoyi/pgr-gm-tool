from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from backend.app.services import server_control


def _settings(**overrides: object) -> SimpleNamespace:
    values = {
        'server_path': 'C:/pgr-server',
        'server_binary_file': 'Wacmk.Pgr.Server.exe',
        'server_runtime_log_path': 'C:/logs/rpg-server.log',
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_supported_server_binary_requires_exe_on_windows(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(server_control.os, 'name', 'nt')
    exe_path = tmp_path / 'Wacmk.Pgr.Server.exe'
    exe_path.write_text('', encoding='utf-8')
    non_exe_path = tmp_path / 'Wacmk.Pgr.Server'
    non_exe_path.write_text('', encoding='utf-8')

    assert server_control._is_supported_server_binary(exe_path) is True
    assert server_control._is_supported_server_binary(non_exe_path) is False


def test_supported_server_binary_uses_executable_bit_on_non_windows(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(server_control.os, 'name', 'posix')
    binary_path = tmp_path / 'Wacmk.Pgr.Server'
    binary_path.write_text('', encoding='utf-8')
    monkeypatch.setattr(server_control.os, 'access', lambda path, mode: path == binary_path and mode == server_control.os.X_OK)

    assert server_control._is_supported_server_binary(binary_path) is True


def test_build_popen_kwargs_uses_windows_creation_flags(monkeypatch) -> None:
    monkeypatch.setattr(server_control.os, 'name', 'nt')

    assert server_control._build_popen_kwargs() == {
        'creationflags': server_control.subprocess.CREATE_NEW_PROCESS_GROUP,
    }


def test_build_popen_kwargs_uses_start_new_session_on_non_windows(monkeypatch) -> None:
    monkeypatch.setattr(server_control.os, 'name', 'posix')

    assert server_control._build_popen_kwargs() == {'start_new_session': True}


def test_controls_visible_requires_supported_binary(monkeypatch) -> None:
    controller = server_control.ServerController(_settings())
    monkeypatch.setattr(server_control, '_is_supported_server_binary', lambda path: path == Path('C:/pgr-server/Wacmk.Pgr.Server.exe'))

    assert controller.controls_visible() is True


class _FakeProcess:
    def __init__(self, pid: int, name: str = '', exe: str | None = None) -> None:
        self.pid = pid
        self.info = {
            'pid': pid,
            'name': name,
            'exe': exe,
        }


def test_iter_matching_processes_skips_current_backend_process(monkeypatch) -> None:
    controller = server_control.ServerController(_settings())
    current_pid = 4321
    monkeypatch.setattr(server_control.os, 'getpid', lambda: current_pid)
    monkeypatch.setattr(server_control.psutil, 'process_iter', lambda fields: [
        _FakeProcess(current_pid, name='python.exe', exe='C:/Python/python.exe'),
    ])

    assert controller.iter_matching_processes() == []


def test_iter_matching_processes_matches_exact_binary_path(monkeypatch) -> None:
    controller = server_control.ServerController(_settings())
    monkeypatch.setattr(server_control.os, 'getpid', lambda: 1)
    monkeypatch.setattr(server_control.psutil, 'process_iter', lambda fields: [
        _FakeProcess(10, name='other.exe', exe='C:/pgr-server/Wacmk.Pgr.Server.exe'),
    ])

    matched = controller.iter_matching_processes()

    assert [process.pid for process in matched] == [10]


def test_iter_matching_processes_does_not_match_same_name_different_path_when_exe_known(monkeypatch) -> None:
    controller = server_control.ServerController(_settings(server_path='C:/expected'))
    monkeypatch.setattr(server_control.os, 'getpid', lambda: 1)
    monkeypatch.setattr(server_control.psutil, 'process_iter', lambda fields: [
        _FakeProcess(10, name='Wacmk.Pgr.Server.exe', exe='C:/other/Wacmk.Pgr.Server.exe'),
    ])

    assert controller.iter_matching_processes() == []


def test_iter_matching_processes_falls_back_to_process_name_when_exe_missing(monkeypatch) -> None:
    controller = server_control.ServerController(_settings())
    monkeypatch.setattr(server_control.os, 'getpid', lambda: 1)
    monkeypatch.setattr(server_control.psutil, 'process_iter', lambda fields: [
        _FakeProcess(10, name='Wacmk.Pgr.Server.exe', exe=None),
    ])

    matched = controller.iter_matching_processes()

    assert [process.pid for process in matched] == [10]


def test_iter_matching_processes_does_not_use_cmdline_like_cli_argument_matching(monkeypatch) -> None:
    controller = server_control.ServerController(_settings())
    monkeypatch.setattr(server_control.os, 'getpid', lambda: 1)
    monkeypatch.setattr(server_control.psutil, 'process_iter', lambda fields: [
        _FakeProcess(10, name='python.exe', exe='C:/Python/python.exe'),
    ])

    assert controller.iter_matching_processes() == []
