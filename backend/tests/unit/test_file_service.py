from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import HTTPException

from app.services import file_service


def test_resolve_file_path_checks_known_storage_locations(
    monkeypatch, tmp_path: Path
) -> None:
    uploads_dir = tmp_path / "uploads"
    generated_dir = tmp_path / "generated"
    podcasts_dir = generated_dir / "podcasts"
    uploads_dir.mkdir(parents=True)
    generated_dir.mkdir(parents=True)
    podcasts_dir.mkdir(parents=True)

    upload_file = uploads_dir / "lesson.pdf"
    upload_file.write_text("pdf")
    podcast_file = podcasts_dir / "episode.mp3"
    podcast_file.write_text("audio")

    monkeypatch.setattr(
        file_service, "_FILE_RESOLUTION_BASE_DIRS", (uploads_dir, generated_dir)
    )
    monkeypatch.setattr(file_service, "_PODCASTS_DIR", podcasts_dir)

    assert file_service.FileService.resolve_file_path("lesson.pdf") == upload_file
    assert file_service.FileService.resolve_file_path("episode.mp3") == podcast_file


def test_resolve_file_path_raises_for_missing_files(
    monkeypatch, tmp_path: Path
) -> None:
    empty_dir = tmp_path / "empty"
    empty_dir.mkdir()
    monkeypatch.setattr(file_service, "_FILE_RESOLUTION_BASE_DIRS", (empty_dir,))
    monkeypatch.setattr(file_service, "_PODCASTS_DIR", empty_dir / "podcasts")

    with pytest.raises(HTTPException) as exc_info:
        file_service.FileService.resolve_file_path("missing.txt")

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "File not found on storage"


def test_resolve_temp_file_path_uses_generated_temp_directory(
    monkeypatch, tmp_path: Path
) -> None:
    generated_dir = tmp_path / "generated"
    target_file = (
        generated_dir / "notebooklm" / "temp" / "session-1" / "videos" / "preview.mp4"
    )
    target_file.parent.mkdir(parents=True)
    target_file.write_text("video")

    monkeypatch.setattr(file_service.settings, "generated_dir", str(generated_dir))

    resolved = file_service.FileService.resolve_temp_file_path(
        "session-1", "videos", "preview.mp4"
    )

    assert resolved == target_file


def test_resolve_temp_file_path_raises_when_file_is_missing(
    monkeypatch, tmp_path: Path
) -> None:
    generated_dir = tmp_path / "generated"
    generated_dir.mkdir()
    monkeypatch.setattr(file_service.settings, "generated_dir", str(generated_dir))

    with pytest.raises(HTTPException) as exc_info:
        file_service.FileService.resolve_temp_file_path(
            "missing-session", "videos", "preview.mp4"
        )

    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Temp file not found or session expired"
