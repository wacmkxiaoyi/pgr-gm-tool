from __future__ import annotations

import asyncio
import socket
import ssl
import time
import urllib.error
import urllib.request
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal

from app.core.config import settings


HealthState = Literal["healthy", "unhealthy", "unknown"]


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


HEALTH_TARGETS: dict[str, HealthTarget] = {
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
}

HEALTH_CHECK_SNAPSHOT: dict[str, Any] = {
    "checked_at": None,
    "interval_seconds": settings.healthy_check_interval,
    "sections": [],
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_http_url(target: HealthTarget) -> str:
    return f"{settings.sdk_server_scheme}://{target.host}:{target.port}"


async def _check_http_target(target: HealthTarget) -> HealthCheckRecord:
    url = _build_http_url(target)
    start = time.perf_counter()

    def _request() -> tuple[int | None, str]:
        request = urllib.request.Request(url, method="GET")
        context = ssl.create_default_context() if settings.sdk_server_scheme == "https" else None
        try:
            with urllib.request.urlopen(request, timeout=8, context=context) as response:
                return response.status, "HTTP 请求正常"
        except urllib.error.HTTPError as error:
            return error.code, "HTTP 请求返回错误状态"

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


async def run_health_check_once() -> None:
    sdk_record, game_record = await asyncio.gather(
        _check_http_target(HEALTH_TARGETS["sdk"]),
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


def get_health_snapshot() -> dict[str, Any]:
    sections = HEALTH_CHECK_SNAPSHOT["sections"] or _build_sections()
    return {
        "checked_at": HEALTH_CHECK_SNAPSHOT["checked_at"],
        "server_version": settings.server_version,
        "interval_seconds": HEALTH_CHECK_SNAPSHOT["interval_seconds"],
        "sections": sections,
    }


async def health_check_loop() -> None:
    await run_health_check_once()
    while True:
        await asyncio.sleep(settings.healthy_check_interval)
        await run_health_check_once()
