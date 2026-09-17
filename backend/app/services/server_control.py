from __future__ import annotations

import asyncio
import contextlib
import json
import os
import socket
import ssl
import subprocess
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime, timezone
from io import TextIOWrapper
from pathlib import Path
from typing import Any, AsyncIterator, Literal

from fastapi import Request

import psutil

from backend.app.config import Settings


StartupState = Literal["idle", "starting", "running", "start_failed"]
HealthState = Literal["healthy", "unhealthy", "unknown"]

STARTUP_PROCESS_APPEAR_TIMEOUT_SECONDS = 15
STARTUP_PROCESS_POLL_INTERVAL_SECONDS = 1
LOG_POLL_INTERVAL_SECONDS = 0.2
LOG_KEEPALIVE_INTERVAL_SECONDS = 1
LOG_SNAPSHOT_MAX_BYTES = 64 * 1024
LOG_RETRY_INTERVAL_MS = 3000
WINDOWS_EXECUTABLE_SUFFIXES = {'.exe'}


def _is_windows() -> bool:
    return os.name == 'nt'


def _is_supported_server_binary(path: Path) -> bool:
    if not path.exists() or not path.is_file():
        return False

    if _is_windows():
        return path.suffix.casefold() in WINDOWS_EXECUTABLE_SUFFIXES

    return os.access(path, os.X_OK)


def _build_popen_kwargs() -> dict[str, object]:
    if _is_windows():
        return {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP}

    return {'start_new_session': True}


def _safe_resolve(path: Path) -> Path:
    try:
        return path.resolve(strict=False)
    except OSError:
        return path


def _ui_text_token(key: str, details: dict[str, object] | None = None) -> str:
    payload: dict[str, object] = {'key': key}
    if details:
        payload['details'] = details
    return json.dumps(payload, ensure_ascii=False)


@dataclass(frozen=True)
class HealthCheckRecord:
    checked_at: str
    state: HealthState
    message: str
    latency_ms: int | None = None
    status_code: int | None = None


@dataclass
class HealthTarget:
    key: str
    title: str
    target_type: str
    url: str
    host: str
    port: int
    history: deque[HealthCheckRecord] = field(default_factory=lambda: deque(maxlen=20))
    latest: HealthCheckRecord | None = None


HEALTH_TARGETS: dict[str, HealthTarget] = {}

HEALTH_CHECK_SNAPSHOT: dict[str, Any] = {
    "checked_at": None,
    "interval_seconds": None,
    "sections": [],
}


def is_health_snapshot_healthy(snapshot: dict[str, Any] | None) -> bool:
    sections = snapshot.get("sections", []) if isinstance(snapshot, dict) else []
    services = [
        service
        for section in sections
        if isinstance(section, dict)
        for service in section.get("services", [])
        if isinstance(service, dict)
    ]

    if not services:
        return False

    return all((service.get("latest") or {}).get("state") == "healthy" for service in services)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_http_url(settings: Settings, target: HealthTarget) -> str:
    return f"{settings.sdk_server_scheme}://{target.host}:{target.port}"


async def _check_http_target(settings: Settings, target: HealthTarget) -> HealthCheckRecord:
    url = _build_http_url(settings, target)
    start = time.perf_counter()

    def _request() -> tuple[int | None, str]:
        request = urllib.request.Request(url, method="GET")
        context = ssl.create_default_context() if settings.sdk_server_scheme == "https" else None
        try:
            with urllib.request.urlopen(request, timeout=8, context=context) as response:
                return response.status, "HTTP 请求正常"
        except urllib.error.HTTPError as error:
            return error.code, "HTTP 请求正常"

    try:
        status_code, message = await asyncio.to_thread(_request)
        healthy = status_code is not None and status_code < 500
        state: HealthState = "healthy" if healthy else "unhealthy"
        final_message = message if healthy else f"HTTP 状态码 {status_code}"
    except Exception as error:  # noqa: BLE001
        status_code = None
        state = "unhealthy"
        final_message = f"HTTP 请求失败: {error}"

    latency_ms = int((time.perf_counter() - start) * 1000)
    return HealthCheckRecord(
        checked_at=_now_iso(),
        state=state,
        message=final_message,
        latency_ms=latency_ms,
        status_code=status_code,
    )


async def _check_tcp_target(target: HealthTarget) -> HealthCheckRecord:
    start = time.perf_counter()

    def _connect() -> bool:
        with socket.create_connection((target.host, target.port), timeout=5):
            return True

    try:
        connected = await asyncio.to_thread(_connect)
        state: HealthState = "healthy" if connected else "unhealthy"
        message = "TCP 连接正常" if connected else "TCP 连接失败"
    except Exception as error:  # noqa: BLE001
        state = "unhealthy"
        message = f"TCP 连接失败: {error}"

    latency_ms = int((time.perf_counter() - start) * 1000)
    return HealthCheckRecord(
        checked_at=_now_iso(),
        state=state,
        message=message,
        latency_ms=latency_ms,
    )


def init_health_targets(settings: Settings) -> None:
    HEALTH_TARGETS.clear()
    HEALTH_TARGETS.update({
        "sdk": HealthTarget(
            key="sdk",
            title="SDK 服务器状态",
            target_type="http",
            url=f"{settings.sdk_server_scheme}://{settings.sdk_server_host}:{settings.sdk_server_port}",
            host=settings.sdk_server_host,
            port=settings.sdk_server_port,
        ),
        "game": HealthTarget(
            key="game",
            title="游戏服务器状态",
            target_type="tcp",
            url=f"tcp://{settings.game_server_host}:{settings.game_server_port}",
            host=settings.game_server_host,
            port=settings.game_server_port,
        ),
    })
    HEALTH_CHECK_SNAPSHOT["checked_at"] = None
    HEALTH_CHECK_SNAPSHOT["interval_seconds"] = settings.healthy_check_interval
    HEALTH_CHECK_SNAPSHOT["sections"] = _build_sections()


def reload_health_targets(settings: Settings) -> None:
    init_health_targets(settings)


async def run_health_check_once(settings: Settings) -> None:
    if not HEALTH_TARGETS:
        init_health_targets(settings)

    sdk_record, game_record = await asyncio.gather(
        _check_http_target(settings, HEALTH_TARGETS["sdk"]),
        _check_tcp_target(HEALTH_TARGETS["game"]),
    )

    for key, record in (("sdk", sdk_record), ("game", game_record)):
        target = HEALTH_TARGETS[key]
        target.latest = record
        target.history.appendleft(record)

    HEALTH_CHECK_SNAPSHOT["checked_at"] = _now_iso()
    HEALTH_CHECK_SNAPSHOT["interval_seconds"] = settings.healthy_check_interval
    HEALTH_CHECK_SNAPSHOT["sections"] = _build_sections()


def _build_sections() -> list[dict[str, Any]]:
    return [
        {
            "key": "sdk",
            "title": "SDK 服务器状态",
            "services": [_serialize_target(HEALTH_TARGETS["sdk"])],
        },
        {
            "key": "game",
            "title": "游戏服务器状态",
            "services": [_serialize_target(HEALTH_TARGETS["game"])],
        },
    ]


def _serialize_target(target: HealthTarget) -> dict[str, Any]:
    latest = target.latest
    return {
        "key": target.key,
        "title": target.title,
        "target_type": target.target_type,
        "url": target.url,
        "host": target.host,
        "port": target.port,
        "latest": None if latest is None else {
            "checked_at": latest.checked_at,
            "state": latest.state,
            "message": latest.message,
            "latency_ms": latest.latency_ms,
            "status_code": latest.status_code,
        },
        "history": [
            {
                "checked_at": item.checked_at,
                "state": item.state,
                "message": item.message,
                "latency_ms": item.latency_ms,
                "status_code": item.status_code,
            }
            for item in list(target.history)
        ],
    }


def get_health_snapshot(settings: Settings) -> dict[str, Any]:
    if not HEALTH_TARGETS:
        init_health_targets(settings)

    sections = HEALTH_CHECK_SNAPSHOT["sections"] or _build_sections()
    return {
        "checked_at": HEALTH_CHECK_SNAPSHOT["checked_at"],
        "server_version": settings.server_version,
        "interval_seconds": HEALTH_CHECK_SNAPSHOT["interval_seconds"],
        "sections": sections,
    }


async def health_check_loop(settings: Settings) -> None:
    await run_health_check_once(settings)
    while True:
        await asyncio.sleep(settings.healthy_check_interval)
        await run_health_check_once(settings)


@dataclass
class ServerControlSnapshot:
    visible: bool
    start_label_key: str
    start_disabled: bool
    stop_disabled: bool
    log_disabled: bool
    startup_state: StartupState
    startup_error: str | None
    suspend_polling_control: bool


class ServerController:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._lock = asyncio.Lock()
        self._startup_state: StartupState = "idle"
        self._startup_error: str | None = None
        self._start_task: asyncio.Task[None] | None = None
        self._runtime_log_handle: TextIOWrapper | None = None

    @property
    def server_binary_path(self) -> Path:
        return Path(self._settings.server_path) / self._settings.server_binary_file

    @property
    def process_name(self) -> str:
        return Path(self._settings.server_binary_file).name

    @property
    def runtime_log_path(self) -> Path:
        return Path(self._settings.server_runtime_log_path)

    def controls_visible(self) -> bool:
        path = self.server_binary_path
        return _is_supported_server_binary(path)

    def executable_exists(self) -> bool:
        path = self.server_binary_path
        return path.exists() and path.is_file()

    def log_file_exists(self) -> bool:
        path = self.runtime_log_path
        return path.exists() and path.is_file()

    def is_process_running(self) -> bool:
        return any(True for _ in self.iter_matching_processes())

    def iter_matching_processes(self) -> list[psutil.Process]:
        current_pid = os.getpid()
        target_name = self.process_name.casefold()
        target_path = _safe_resolve(self.server_binary_path)
        matched_processes: list[psutil.Process] = []
        for process in psutil.process_iter(["pid", "name", "exe"]):
            with contextlib.suppress(psutil.Error, OSError, ValueError):
                if process.pid == current_pid:
                    continue

                exe_path = process.info.get("exe")
                if isinstance(exe_path, str) and exe_path:
                    process_binary_path = _safe_resolve(Path(exe_path))
                    if process_binary_path == target_path:
                        matched_processes.append(process)
                        continue

                process_name = (process.info.get("name") or "").casefold()
                if process_name == target_name:
                    matched_processes.append(process)

        return matched_processes

    async def request_start(self) -> ServerControlSnapshot:
        async with self._lock:
            if not self.controls_visible():
                self._startup_state = "idle"
                self._startup_error = _ui_text_token('server.binary_missing')
                return self.get_snapshot(all_healthy=False)

            if self.is_process_running():
                if self._startup_state != "starting":
                    self._startup_state = "running"
                self._startup_error = None
                return self.get_snapshot(all_healthy=False)

            if self._start_task is not None and not self._start_task.done():
                return self.get_snapshot(all_healthy=False)

            self._startup_state = "starting"
            self._startup_error = None
            self._start_task = asyncio.create_task(self._start_and_watch())
            return self.get_snapshot(all_healthy=False)

    async def request_stop(self) -> ServerControlSnapshot:
        async with self._lock:
            start_task = self._start_task
            self._start_task = None
            if start_task is not None and not start_task.done():
                start_task.cancel()

            await asyncio.to_thread(self._stop_processes)
            self._close_runtime_log_handle()
            self._startup_state = "idle"
            self._startup_error = None
            return self.get_snapshot(all_healthy=False)

    async def _start_and_watch(self) -> None:
        try:
            await asyncio.to_thread(self._launch_process)
        except Exception as error:  # noqa: BLE001
            async with self._lock:
                self._startup_state = "start_failed"
                self._startup_error = _ui_text_token('server.start_command_failed', {'reason': str(error)})
            return

        deadline = asyncio.get_running_loop().time() + STARTUP_PROCESS_APPEAR_TIMEOUT_SECONDS

        while True:
            if self.is_process_running():
                async with self._lock:
                    if self._startup_state == "starting":
                        self._startup_error = None
                return

            if asyncio.get_running_loop().time() >= deadline:
                async with self._lock:
                    self._startup_state = "start_failed"
                    self._startup_error = _ui_text_token('server.start_process_not_detected')
                return

            await asyncio.sleep(STARTUP_PROCESS_POLL_INTERVAL_SECONDS)

    def _launch_process(self) -> None:
        binary_path = self.server_binary_path
        runtime_log_handle = self._prepare_runtime_log_file()
        subprocess.Popen(  # noqa: S603
            [str(binary_path)],
            cwd=str(binary_path.parent),
            stdout=runtime_log_handle,
            stderr=subprocess.STDOUT,
            stdin=subprocess.DEVNULL,
            **_build_popen_kwargs(),
        )

    def _prepare_runtime_log_file(self) -> TextIOWrapper:
        self._close_runtime_log_handle()
        log_path = self.runtime_log_path
        log_path.parent.mkdir(parents=True, exist_ok=True)
        runtime_log_handle = log_path.open("w", encoding="utf-8", buffering=1)
        self._runtime_log_handle = runtime_log_handle
        return runtime_log_handle

    def _close_runtime_log_handle(self) -> None:
        if self._runtime_log_handle is None:
            return

        with contextlib.suppress(OSError):
            self._runtime_log_handle.close()
        self._runtime_log_handle = None

    def _stop_processes(self) -> None:
        matched_processes = self.iter_matching_processes()
        if not matched_processes:
            return

        for process in matched_processes:
            with contextlib.suppress(psutil.Error):
                process.terminate()

        gone, alive = psutil.wait_procs(matched_processes, timeout=5)
        if not alive:
            return

        for process in alive:
            with contextlib.suppress(psutil.Error):
                process.kill()

        psutil.wait_procs(alive, timeout=5)

    def can_view_logs(self, all_healthy: bool) -> bool:
        snapshot = self.get_snapshot(all_healthy=all_healthy)
        return snapshot.visible and snapshot.startup_state in {"starting", "running"}

    def _encode_sse_event(self, event: str, payload: dict[str, object]) -> str:
        data = json.dumps(payload, ensure_ascii=False)
        return f"event: {event}\ndata: {data}\n\n"

    def _read_log_tail_bytes(self, max_bytes: int = LOG_SNAPSHOT_MAX_BYTES) -> tuple[str, int, tuple[int, int]]:
        log_path = self.runtime_log_path
        file_stat = log_path.stat()
        with log_path.open("rb") as file:
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            read_size = min(file_size, max_bytes)
            file.seek(file_size - read_size)
            payload = file.read(read_size)

        text = payload.decode("utf-8", errors="replace")
        if file_size > read_size:
            newline_index = text.find("\n")
            if newline_index != -1:
                text = text[newline_index + 1 :]
        return text, file_size, (file_stat.st_dev, file_stat.st_ino)

    def _read_log_bytes_from_offset(self, offset: int) -> tuple[str, int, tuple[int, int]]:
        log_path = self.runtime_log_path
        file_stat = log_path.stat()
        with log_path.open("rb") as file:
            file.seek(0, os.SEEK_END)
            file_size = file.tell()
            if file_size < offset:
                offset = 0

            file.seek(offset)
            payload = file.read()

        return payload.decode("utf-8", errors="replace"), file_size, (file_stat.st_dev, file_stat.st_ino)

    async def stream_logs(self, request: Request) -> AsyncIterator[str]:
        yield f"retry: {LOG_RETRY_INTERVAL_MS}\n\n"

        if not self.log_file_exists():
            yield self._encode_sse_event("log-error", {"code": "server.log_file_missing", "details": {"path": str(self.runtime_log_path)}})
            yield self._encode_sse_event("log-end", {"code": "server.log_stream_ended"})
            return

        try:
            snapshot_text, offset, file_identity = await asyncio.to_thread(self._read_log_tail_bytes)
        except OSError as error:
            yield self._encode_sse_event("log-error", {"code": "server.log_file_read_failed", "details": {"reason": str(error)}})
            yield self._encode_sse_event("log-end", {"code": "server.log_stream_ended"})
            return

        yield self._encode_sse_event("log-snapshot", {"text": snapshot_text})
        last_keepalive = asyncio.get_running_loop().time()

        while True:
            if await request.is_disconnected():
                return

            if not self.is_process_running():
                yield self._encode_sse_event("log-end", {"code": "server.log_stream_stopped"})
                return

            if not self.log_file_exists():
                yield self._encode_sse_event("log-error", {"code": "server.log_file_deleted"})
                yield self._encode_sse_event("log-end", {"code": "server.log_stream_ended"})
                return

            try:
                chunk, next_offset, next_file_identity = await asyncio.to_thread(self._read_log_bytes_from_offset, offset)
            except OSError as error:
                yield self._encode_sse_event("log-error", {"code": "server.log_file_read_failed", "details": {"reason": str(error)}})
                yield self._encode_sse_event("log-end", {"code": "server.log_stream_ended"})
                return

            if next_offset < offset or next_file_identity != file_identity:
                try:
                    snapshot_text, offset, file_identity = await asyncio.to_thread(self._read_log_tail_bytes)
                except OSError as error:
                    yield self._encode_sse_event("log-error", {"code": "server.log_file_read_failed", "details": {"reason": str(error)}})
                    yield self._encode_sse_event("log-end", {"code": "server.log_stream_ended"})
                    return

                yield self._encode_sse_event("log-reset", {"text": snapshot_text})
                last_keepalive = asyncio.get_running_loop().time()
                await asyncio.sleep(LOG_POLL_INTERVAL_SECONDS)
                continue

            if chunk:
                offset = next_offset
                file_identity = next_file_identity
                yield self._encode_sse_event("log-append", {"text": chunk})
                last_keepalive = asyncio.get_running_loop().time()
            elif asyncio.get_running_loop().time() - last_keepalive >= LOG_KEEPALIVE_INTERVAL_SECONDS:
                yield ": keep-alive\n\n"
                last_keepalive = asyncio.get_running_loop().time()

            await asyncio.sleep(LOG_POLL_INTERVAL_SECONDS)

    def get_snapshot(self, all_healthy: bool) -> ServerControlSnapshot:
        visible = self.controls_visible()
        process_running = self.is_process_running() if visible else False

        startup_state = self._startup_state
        startup_error = self._startup_error

        if not visible:
            startup_state = "idle"
        elif process_running and all_healthy:
            startup_state = "running"
            startup_error = None
            self._startup_state = "running"
            self._startup_error = None
        elif process_running:
            startup_state = "starting"
            self._startup_state = "starting"
            self._startup_error = None
        elif startup_state == "running":
            startup_state = "idle"
            startup_error = None
            self._startup_state = "idle"
            self._startup_error = None

        if startup_state == "starting":
            return ServerControlSnapshot(
                visible=visible,
                start_label_key="runtime.serverStarting",
                start_disabled=True,
                stop_disabled=False,
                log_disabled=False,
                startup_state=startup_state,
                startup_error=startup_error,
                suspend_polling_control=True,
            )

        if startup_state == "running":
            return ServerControlSnapshot(
                visible=visible,
                start_label_key="runtime.serverStart",
                start_disabled=True,
                stop_disabled=False,
                log_disabled=False,
                startup_state=startup_state,
                startup_error=None,
                suspend_polling_control=False,
            )

        start_error = startup_error if startup_state == "start_failed" else None
        return ServerControlSnapshot(
            visible=visible,
            start_label_key="runtime.serverStart",
            start_disabled=not visible,
            stop_disabled=True,
            log_disabled=True,
            startup_state=startup_state,
            startup_error=start_error,
            suspend_polling_control=False,
        )

    async def shutdown(self) -> None:
        task = self._start_task
        if task is not None:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

        self._close_runtime_log_handle()


def get_server_control_snapshot(settings: Settings, controller: ServerController, all_healthy: bool) -> dict[str, object]:
    snapshot = controller.get_snapshot(all_healthy=all_healthy)
    return {
        "visible": snapshot.visible,
        "start_label_key": snapshot.start_label_key,
        "start_disabled": snapshot.start_disabled,
        "stop_disabled": snapshot.stop_disabled,
        "log_disabled": snapshot.log_disabled,
        "startup_state": snapshot.startup_state,
        "startup_error": snapshot.startup_error,
        "suspend_polling_control": snapshot.suspend_polling_control,
        "server_path": settings.server_path,
        "server_binary_file": settings.server_binary_file,
        "runtime_log_path": settings.server_runtime_log_path,
    }
