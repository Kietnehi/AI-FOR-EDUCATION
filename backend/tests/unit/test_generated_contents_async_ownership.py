from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.routes.generated_contents import (
    get_generation_task_status,
    queue_generate_minigame,
)
from app.schemas.auth import AuthUser
from app.schemas.generated_content import GenerateMinigameRequest


@pytest.mark.asyncio
async def test_queue_generate_minigame_registers_task_with_owner(monkeypatch) -> None:
    fake_db = object()
    user = AuthUser(id="owner-1", email="owner@example.com")
    payload = GenerateMinigameRequest(game_type="quiz_mixed", difficulty="easy")

    class FakeMaterialService:
        def __init__(self, _db):
            pass

        async def get_material(self, material_id: str, user_id: str):
            assert material_id == "material-1"
            assert user_id == user.id
            return {"id": material_id}

    registered: list[tuple[str, str, str, str]] = []

    class FakeGenerationService:
        def __init__(self, _db):
            pass

        async def register_generation_task(
            self, task_id: str, material_id: str, user_id: str, task_type: str
        ) -> None:
            registered.append((task_id, material_id, user_id, task_type))

    class FakeTask:
        id = "task-123"

    class FakeGenerateTask:
        @staticmethod
        def delay(*_args, **_kwargs):
            return FakeTask()

    monkeypatch.setattr("app.api.routes.generated_contents.MaterialService", FakeMaterialService)
    monkeypatch.setattr("app.api.routes.generated_contents.GenerationService", FakeGenerationService)
    monkeypatch.setattr("app.api.routes.generated_contents.generate_minigame_task", FakeGenerateTask)

    response = await queue_generate_minigame(
        material_id="material-1",
        payload=payload,
        user=user,
        db=fake_db,
    )

    assert response.task_id == "task-123"
    assert response.status == "queued"
    assert registered == [("task-123", "material-1", "owner-1", "minigame")]


@pytest.mark.asyncio
async def test_get_generation_task_status_returns_service_payload(monkeypatch) -> None:
    fake_db = object()
    user = AuthUser(id="owner-1", email="owner@example.com")

    class FakeGenerationService:
        def __init__(self, _db):
            pass

        async def get_generation_task_status(self, task_id: str, user_id: str, _celery_app):
            assert task_id == "task-123"
            assert user_id == "owner-1"
            return {
                "task_id": task_id,
                "status": "processing",
                "celery_state": "STARTED",
                "progress": 55,
            }

    monkeypatch.setattr("app.api.routes.generated_contents.GenerationService", FakeGenerationService)

    response = await get_generation_task_status(
        task_id="task-123",
        user=user,
        db=fake_db,
    )

    assert response.task_id == "task-123"
    assert response.status == "processing"
    assert response.celery_state == "STARTED"
    assert response.progress == 55


@pytest.mark.asyncio
async def test_get_generation_task_status_blocks_non_owner(monkeypatch) -> None:
    fake_db = object()
    user = AuthUser(id="other-user", email="other@example.com")

    class FakeGenerationService:
        def __init__(self, _db):
            pass

        async def get_generation_task_status(self, *_args, **_kwargs):
            raise HTTPException(status_code=404, detail="Task not found")

    monkeypatch.setattr("app.api.routes.generated_contents.GenerationService", FakeGenerationService)

    with pytest.raises(HTTPException) as exc_info:
        await get_generation_task_status(
            task_id="task-123",
            user=user,
            db=fake_db,
        )

    assert exc_info.value.status_code == 404
