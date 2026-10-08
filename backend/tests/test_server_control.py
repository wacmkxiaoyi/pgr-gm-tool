from __future__ import annotations

import asyncio
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


def test_log_stream_survives_rotation_gap(tmp_path, monkeypatch):
    path = tmp_path / 'server.log'
    path.write_text('old output\n', encoding='utf-8')
    controller = server_control.ServerController(_settings(server_runtime_log_path=str(path)))
    monkeypatch.setattr(controller, 'is_process_running', lambda: True)
    monkeypatch.setattr(server_control, 'LOG_POLL_INTERVAL_SECONDS', 0.01)

    class Request:
        async def is_disconnected(self):
            return False

    async def check():
        stream = controller.stream_logs(Request())
        await anext(stream)  # retry
        assert 'old output' in await anext(stream)
        path.replace(path.with_suffix('.previous.log'))

        async def replace_log():
            await asyncio.sleep(0.04)
            path.write_text('new output\n', encoding='utf-8')

        task = asyncio.create_task(replace_log())
        try:
            event = await asyncio.wait_for(anext(stream), timeout=2)
            assert 'log-reset' in event and 'new output' in event
            with path.open('a', encoding='utf-8') as file:
                file.write('more output\n')
            event = await asyncio.wait_for(anext(stream), timeout=2)
            assert 'log-append' in event and 'more output' in event
        finally:
            await task
            await stream.aclose()

    asyncio.run(check())


def test_log_stream_reports_permanently_deleted_file(tmp_path, monkeypatch):
    path = tmp_path / 'server.log'
    path.write_text('output\n', encoding='utf-8')
    controller = server_control.ServerController(_settings(server_runtime_log_path=str(path)))
    monkeypatch.setattr(controller, 'is_process_running', lambda: True)
    monkeypatch.setattr(server_control, 'LOG_ROTATION_GRACE_SECONDS', 0.02)
    monkeypatch.setattr(server_control, 'LOG_POLL_INTERVAL_SECONDS', 0.01)

    class Request:
        async def is_disconnected(self):
            return False

    async def check():
        stream = controller.stream_logs(Request())
        await anext(stream)
        await anext(stream)
        path.unlink()
        event = await asyncio.wait_for(anext(stream), timeout=2)
        assert 'log-error' in event and 'server.log_file_deleted' in event
        assert 'log-end' in await anext(stream)
        await stream.aclose()

    asyncio.run(check())
