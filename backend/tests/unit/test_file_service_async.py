from __future__ import annotations

from datetime import datetime, timezone

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.services.file_service import FileService


class StubRepo:
    def __init__(self) -> None:
        self.created_payload: dict | None = None
        self.asset: dict | None = None
        self.last_file_id: ObjectId | None = None

    async def create(self, payload: dict) -> dict:
        self.created_payload = payload
        return {"id": "asset-1", **payload}

    async def get_by_id(self, file_id: ObjectId) -> dict | None:
        self.last_file_id = file_id
        return self.asset


class StubDatabase:
    file_assets = object()


@pytest.mark.asyncio
async def test_create_asset_builds_expected_payload(monkeypatch) -> None:
    service = FileService(db=StubDatabase())
    repo = StubRepo()
    now = datetime(2026, 3, 28, tzinfo=timezone.utc)
    service.repo = repo
    monkeypatch.setattr("app.services.file_service.utc_now", lambda: now)

    asset = await service.create_asset(
        owner_type="material",
        owner_id="mat-1",
        asset_type="slides",
        file_name="deck.pptx",
        file_path="/tmp/deck.pptx",
    )

    assert asset["id"] == "asset-1"
    assert repo.created_payload == {
        "owner_type": "material",
        "owner_id": "mat-1",
        "asset_type": "slides",
        "file_name": "deck.pptx",
        "file_path": "/tmp/deck.pptx",
        "public_url": "/api/files/deck.pptx",
        "created_at": now,
        "updated_at": now,
    }


@pytest.mark.asyncio
async def test_get_asset_returns_repository_result() -> None:
    service = FileService(db=StubDatabase())
    repo = StubRepo()
    repo.asset = {"id": "asset-1", "file_name": "deck.pptx"}
    service.repo = repo
    file_id = str(ObjectId())

    asset = await service.get_asset(file_id)

    assert asset == {"id": "asset-1", "file_name": "deck.pptx"}
    assert str(repo.last_file_id) == file_id


@pytest.mark.asyncio
async def test_get_asset_raises_for_missing_asset() -> None:
    service = FileService(db=StubDatabase())
    repo = StubRepo()
    service.repo = repo

    with pytest.raises(HTTPException) as exc_info:
        await service.get_asset(str(ObjectId()))

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "File asset not found"
