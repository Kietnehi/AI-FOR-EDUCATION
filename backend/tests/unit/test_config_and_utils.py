from __future__ import annotations

from pathlib import Path

import pytest
from bson import ObjectId
from fastapi import HTTPException

from app.core.config import Settings
from app.repositories.base import serialize_document
from app.utils.object_id import object_id_str, parse_object_id


def test_settings_promotes_legacy_gemini_key_and_creates_directories(
    tmp_path: Path,
) -> None:
    upload_dir = tmp_path / "uploads"
    generated_dir = tmp_path / "generated"
    chroma_dir = tmp_path / "chroma"
    docs_dir = tmp_path / "notebooklm" / "documents"
    profile_dir = tmp_path / "notebooklm" / "profile"

    settings = Settings(
        gemini_api_key="legacy-key",
        gemini_api_keys=[],
        upload_dir=str(upload_dir),
        generated_dir=str(generated_dir),
        chroma_persist_dir=str(chroma_dir),
        notebooklm_documents_dir=str(docs_dir),
        notebooklm_user_data_dir=str(profile_dir),
    )

    assert settings.gemini_api_keys == ["legacy-key"]
    assert settings.gemini_api_key == "legacy-key"
    assert upload_dir.exists()
    assert generated_dir.exists()
    assert chroma_dir.exists()
    assert docs_dir.exists()
    assert profile_dir.exists()


def test_parse_object_id_validates_input() -> None:
    value = str(ObjectId())

    parsed = parse_object_id(value)

    assert str(parsed) == value
    assert object_id_str(parsed) == value

    with pytest.raises(HTTPException) as exc_info:
        parse_object_id("invalid-id")

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Invalid ObjectId: invalid-id"


def test_serialize_document_converts_object_id_fields() -> None:
    document_id = ObjectId()

    serialized = serialize_document(
        {"_id": document_id, "owner_id": document_id, "name": "file"}
    )

    assert serialized == {
        "id": str(document_id),
        "owner_id": str(document_id),
        "name": "file",
    }
    assert serialize_document(None) is None
