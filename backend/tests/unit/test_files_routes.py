from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.api.routes.files import download_file, preview_temp_file


@pytest.mark.asyncio
async def test_download_file_returns_response_with_cache_headers(
    monkeypatch, tmp_path: Path
) -> None:
    target_file = tmp_path / "lesson.pdf"
    target_file.write_text("content")
    monkeypatch.setattr(
        "app.api.routes.files.FileService.resolve_file_path",
        lambda _: target_file,
    )

    response = await download_file("lesson.pdf")

    assert Path(response.path) == target_file
    assert response.filename == "lesson.pdf"
    assert response.headers["cache-control"] == "public, max-age=3600"


@pytest.mark.asyncio
async def test_download_file_propagates_resolution_errors(monkeypatch) -> None:
    def raise_not_found(_: str):
        raise HTTPException(status_code=404, detail="File not found on storage")

    monkeypatch.setattr(
        "app.api.routes.files.FileService.resolve_file_path", raise_not_found
    )

    with pytest.raises(HTTPException) as exc_info:
        await download_file("missing.pdf")

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_preview_temp_file_returns_response(monkeypatch, tmp_path: Path) -> None:
    target_file = tmp_path / "preview.mp4"
    target_file.write_text("video")
    monkeypatch.setattr(
        "app.api.routes.files.FileService.resolve_temp_file_path",
        lambda *_: target_file,
    )

    response = await preview_temp_file("session-1", "videos", "preview.mp4")

    assert Path(response.path) == target_file
    assert response.filename == "preview.mp4"


@pytest.mark.asyncio
async def test_preview_temp_file_propagates_resolution_errors(monkeypatch) -> None:
    def raise_not_found(*_args):
        raise HTTPException(
            status_code=404, detail="Temp file not found or session expired"
        )

    monkeypatch.setattr(
        "app.api.routes.files.FileService.resolve_temp_file_path", raise_not_found
    )

    with pytest.raises(HTTPException) as exc_info:
        await preview_temp_file("missing-session", "videos", "preview.mp4")

    assert exc_info.value.status_code == 404
