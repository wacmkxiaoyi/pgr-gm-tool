"""Start/stop the local backend using AscNet Launcher's runtime contract."""
from __future__ import annotations

import contextlib
import json
import os
from pathlib import Path
import socket
import subprocess
import threading
import time
import urllib.request

import psutil

from backend.app.launcher import LauncherBuild


def matching_servers(build: LauncherBuild) -> list[psutil.Process]:
    result = []
    for process in psutil.process_iter(['pid', 'exe', 'cmdline']):
        with contextlib.suppress(psutil.Error, OSError, ValueError):
            if process.pid == os.getpid():
                continue
            exe = process.info.get('exe')
            args = process.info.get('cmdline') or []
            if exe and Path(exe).resolve() == build.dotnet.resolve() and any(
                Path(arg).is_absolute() and Path(arg).resolve() == build.server_dll.resolve() for arg in args[1:]
            ):
                result.append(process)
    return result


def _tcp_ready(port: int) -> bool:
    try:
        with socket.create_connection(('127.0.0.1', port), timeout=0.25):
            return True
    except OSError:
        return False


class LauncherRuntime:
    def __init__(self, build: LauncherBuild):
        self.build = build
        self.server = None
        self.mongo = None
        self.lock = threading.Lock()
        self.cancel = threading.Event()

    def _wait(self, child, ready, label: str) -> None:
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            if self.cancel.is_set():
                raise RuntimeError('Launcher backend start cancelled')
            if child.poll() is not None:
                raise RuntimeError(f'{label} exited with code {child.returncode}')
            if ready():
                return
            time.sleep(0.15)
        raise RuntimeError(f'Timed out waiting for {label}')

    def _server_ready(self) -> bool:
        if not _tcp_ready(self.build.game_port):
            return False
        try:
            opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
            with opener.open(self.build.origin + '/api/launcher/status', timeout=2) as response:
                length = response.headers.get('Content-Length')
                if length is not None and not 0 <= int(length) <= 65536:
                    return False
                body = response.read(65537)
                if len(body) > 65536 or (length is not None and len(body) != int(length)):
                    return False
                value = json.loads(body)
                return isinstance(value, dict) and value.get('schemaVersion') == 1
        except (OSError, ValueError):
            return False

    def _matching_mongo(self) -> bool:
        for process in psutil.process_iter(['exe', 'cmdline']):
            with contextlib.suppress(psutil.Error, OSError, ValueError, IndexError):
                args = process.info.get('cmdline') or []
                exe = process.info.get('exe')
                if not exe or Path(exe).resolve() != self.build.mongod.resolve():
                    continue
                if '--port' not in args or '--dbpath' not in args:
                    continue
                port = args[args.index('--port') + 1]
                dbpath = Path(args[args.index('--dbpath') + 1]).resolve()
                if port == str(self.build.mongo_port) and dbpath == (self.build.root / 'data' / 'mongo').resolve():
                    return True
        return False

    def start(self) -> None:
        with self.lock:
            if matching_servers(self.build):
                return
            # Reserve all ports before spawning, as the launcher does. An exact
            # existing MongoDB instance may be reused, but is never owned by GM.
            reuse_mongo = self._matching_mongo()
            reserved = []
            try:
                ports = [self.build.sdk_port, self.build.game_port]
                if not reuse_mongo:
                    ports.append(self.build.mongo_port)
                for port in ports:
                    listener = socket.socket()
                    reserved.append(listener)
                    if os.name == 'nt':
                        listener.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
                    listener.bind(('127.0.0.1', port))
                    listener.listen()
            finally:
                for listener in reserved:
                    listener.close()
            logs = self.build.root / 'logs'
            logs.mkdir(parents=True, exist_ok=True)
            flags = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
            try:
                if not reuse_mongo:
                    (self.build.root / 'data' / 'mongo').mkdir(parents=True, exist_ok=True)
                    with (logs / 'mongod.log').open('a', encoding='utf-8') as log:
                        self.mongo = subprocess.Popen(self.build.mongo_command, stdout=log, stderr=subprocess.STDOUT,
                                                      stdin=subprocess.DEVNULL, **flags)
                    self._wait(self.mongo, lambda: _tcp_ready(self.build.mongo_port), 'MongoDB')
                elif not _tcp_ready(self.build.mongo_port):
                    raise RuntimeError('Existing Launcher MongoDB is not ready')
                env = dict(os.environ, ASCNET_GATE_FALLBACK_USERNAME='', ASCNET_PUBLIC_HTTP_ORIGIN=self.build.origin,
                           ASCNET_GAME_BIND_ADDRESS='127.0.0.1', ASCNET_MANAGED_STDIN='1')
                with (logs / 'server.log').open('a', encoding='utf-8') as log:
                    self.server = subprocess.Popen(self.build.server_command, cwd=str(self.build.resource_directory),
                                                   env=env, stdin=subprocess.PIPE, stdout=log,
                                                   stderr=subprocess.STDOUT, **flags)
                self._wait(self.server, self._server_ready, 'AscNet')
            except Exception:
                self._stop_owned()
                raise

    @staticmethod
    def _wait_or_kill(child) -> None:
        try:
            child.wait(timeout=15)
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait(timeout=5)

    def _stop_owned(self) -> None:
        if self.server is not None:
            if self.server.poll() is None:
                with contextlib.suppress(OSError):
                    self.server.stdin.write(b'shutdown\n')
                    self.server.stdin.flush()
                self._wait_or_kill(self.server)
            if self.server.stdin:
                self.server.stdin.close()
            self.server = None
        if self.mongo is not None:
            if self.mongo.poll() is None:
                try:
                    subprocess.run([str(self.build.dotnet), str(self.build.server_dll), '--shutdown-local-mongo',
                                    str(self.build.mongo_port)], cwd=str(self.build.server_directory),
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=15, check=False)
                except (OSError, subprocess.TimeoutExpired):
                    self.mongo.terminate()
                self._wait_or_kill(self.mongo)
            self.mongo = None

    def stop(self, *, include_external: bool = False) -> None:
        self.cancel.set()
        with self.lock:
            self._stop_owned()
            if include_external:
                processes = matching_servers(self.build)
                for process in processes:
                    with contextlib.suppress(psutil.Error):
                        process.terminate()
                _, alive = psutil.wait_procs(processes, timeout=5)
                for process in alive:
                    with contextlib.suppress(psutil.Error):
                        process.kill()
