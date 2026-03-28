from __future__ import annotations

import asyncio
from fastapi import FastAPI

from app.core import logging as app_logging
from app.main import app, health_check, lifespan


def test_configure_logging_uses_expected_settings(monkeypatch) -> None:
    captured: dict = {}

    def fake_basic_config(**kwargs):
        captured.update(kwargs)

    monkeypatch.setattr(app_logging.logging, "basicConfig", fake_basic_config)

    app_logging.configure_logging()

    assert captured["level"] == app_logging.settings.log_level
    assert captured["format"] == "%(asctime)s | %(levelname)s | %(name)s | %(message)s"
    assert len(captured["handlers"]) == 2


async def test_health_check_returns_ok_status() -> None:
    assert await health_check() == {"status": "ok"}


class FakeLoop:
    def __init__(self) -> None:
        self.executor = None

    def set_default_executor(self, executor) -> None:
        self.executor = executor


async def test_lifespan_runs_startup_and_shutdown_hooks(monkeypatch) -> None:
    events: list[str] = []
    fake_loop = FakeLoop()

    monkeypatch.setattr("app.main.asyncio.get_running_loop", lambda: fake_loop)
    monkeypatch.setattr(
        "app.main.configure_logging", lambda: events.append("configure_logging")
    )

    async def fake_connect_mongo() -> None:
        events.append("connect_mongo")

    async def fake_ensure_indexes() -> None:
        events.append("ensure_indexes")

    async def fake_close_mongo() -> None:
        events.append("close_mongo")

    monkeypatch.setattr("app.main.connect_mongo", fake_connect_mongo)
    monkeypatch.setattr("app.main.ensure_indexes", fake_ensure_indexes)
    monkeypatch.setattr("app.main.close_mongo", fake_close_mongo)
    monkeypatch.setattr("app.main.logger.info", lambda message: events.append(message))

    async with lifespan(FastAPI()):
        events.append("inside")

    assert fake_loop.executor is not None
    assert events == [
        "configure_logging",
        "connect_mongo",
        "ensure_indexes",
        "Application startup complete",
        "inside",
        "close_mongo",
        "Application shutdown complete",
    ]


async def test_lifespan_handles_cancelled_error(monkeypatch) -> None:
    events: list[str] = []
    fake_loop = FakeLoop()

    monkeypatch.setattr("app.main.asyncio.get_running_loop", lambda: fake_loop)
    monkeypatch.setattr("app.main.configure_logging", lambda: None)
    monkeypatch.setattr(
        "app.main.connect_mongo", lambda: _async_noop(events, "connect")
    )
    monkeypatch.setattr(
        "app.main.ensure_indexes", lambda: _async_noop(events, "indexes")
    )
    monkeypatch.setattr("app.main.close_mongo", lambda: _async_noop(events, "close"))
    monkeypatch.setattr("app.main.logger.info", lambda message: events.append(message))

    manager = lifespan(FastAPI())
    await manager.__aenter__()
    suppressed = await manager.__aexit__(
        asyncio.CancelledError, asyncio.CancelledError(), None
    )

    assert suppressed is True
    assert "Application lifespan cancelled during shutdown" in events
    assert events[-1] == "Application shutdown complete"


async def _async_noop(events: list[str], name: str) -> None:
    events.append(name)


def test_main_app_registers_health_and_api_routes() -> None:
    paths = {route.path for route in app.routes}

    assert "/health" in paths
    assert "/api/materials" in paths
