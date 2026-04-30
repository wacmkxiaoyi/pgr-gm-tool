from __future__ import annotations

import asyncio
import contextlib
import json
import os
import subprocess
from dataclasses import dataclass
from io import TextIOWrapper
from pathlib import Path
from typing import AsyncIterator, Literal

from fastapi import Request

import psutil

from backend.app.config import Settings


StartupState = Literal["idle", "starting", "running", "start_failed"]

STARTUP_PROCESS_APPEAR_TIMEOUT_SECONDS = 15
STARTUP_PROCESS_POLL_INTERVAL_SECONDS = 1
LOG_POLL_INTERVAL_SECONDS = 0.2
LOG_KEEPALIVE_INTERVAL_SECONDS = 1
LOG_SNAPSHOT_MAX_BYTES = 64 * 1024
LOG_RETRY_INTERVAL_MS = 3000


@dataclass
class ServerControlSnapshot:
    visible: bool
    start_label: str
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
        return path.exists() and path.is_file() and os.access(path, os.X_OK)

    def executable_exists(self) -> bool:
        path = self.server_binary_path
        return path.exists() and path.is_file()

    def log_file_exists(self) -> bool:
        path = self.runtime_log_path
        return path.exists() and path.is_file()

    def is_process_running(self) -> bool:
        return any(True for _ in self.iter_matching_processes())

    def iter_matching_processes(self) -> list[psutil.Process]:
        target_name = self.process_name.casefold()
        matched_processes: list[psutil.Process] = []
        for process in psutil.process_iter(["name", "exe", "cmdline"]):
            with contextlib.suppress(psutil.Error, OSError, ValueError):
                process_name = (process.info.get("name") or "").casefold()
                if process_name == target_name:
                    matched_processes.append(process)
                    continue

                exe_path = process.info.get("exe")
                if isinstance(exe_path, str) and Path(exe_path).name.casefold() == target_name:
                    matched_processes.append(process)
                    continue

                cmdline = process.info.get("cmdline") or []
                if any(Path(part).name.casefold() == target_name for part in cmdline if isinstance(part, str) and part):
                    matched_processes.append(process)

        return matched_processes

    async def request_start(self) -> ServerControlSnapshot:
        async with self._lock:
            if not self.controls_visible():
                self._startup_state = "idle"
                self._startup_error = "服务器启动文件不存在，无法执行启动操作。"
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
                self._startup_error = f"启动命令执行失败: {error}"
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
                    self._startup_error = "未检测到服务器进程，启动失败。"
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
            start_new_session=True,
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
            yield self._encode_sse_event("log-error", {"message": f"未找到运行时日志文件: {self.runtime_log_path}"})
            yield self._encode_sse_event("log-end", {"message": "日志流已结束。"})
            return

        try:
            snapshot_text, offset, file_identity = await asyncio.to_thread(self._read_log_tail_bytes)
        except OSError as error:
            yield self._encode_sse_event("log-error", {"message": f"读取日志文件失败: {error}"})
            yield self._encode_sse_event("log-end", {"message": "日志流已结束。"})
            return

        yield self._encode_sse_event("log-snapshot", {"text": snapshot_text})
        last_keepalive = asyncio.get_running_loop().time()

        while True:
            if await request.is_disconnected():
                return

            if not self.is_process_running():
                yield self._encode_sse_event("log-end", {"message": "服务器已停止，日志流已结束。"})
                return

            if not self.log_file_exists():
                yield self._encode_sse_event("log-error", {"message": "日志文件已不存在。"})
                yield self._encode_sse_event("log-end", {"message": "日志流已结束。"})
                return

            try:
                chunk, next_offset, next_file_identity = await asyncio.to_thread(self._read_log_bytes_from_offset, offset)
            except OSError as error:
                yield self._encode_sse_event("log-error", {"message": f"读取日志文件失败: {error}"})
                yield self._encode_sse_event("log-end", {"message": "日志流已结束。"})
                return

            if next_offset < offset or next_file_identity != file_identity:
                try:
                    snapshot_text, offset, file_identity = await asyncio.to_thread(self._read_log_tail_bytes)
                except OSError as error:
                    yield self._encode_sse_event("log-error", {"message": f"读取日志文件失败: {error}"})
                    yield self._encode_sse_event("log-end", {"message": "日志流已结束。"})
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
                start_label="启动中...",
                start_disabled=True,
                stop_disabled=True,
                log_disabled=False,
                startup_state=startup_state,
                startup_error=startup_error,
                suspend_polling_control=True,
            )

        if startup_state == "running":
            return ServerControlSnapshot(
                visible=visible,
                start_label="启动",
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
            start_label="启动",
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
        "start_label": snapshot.start_label,
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
