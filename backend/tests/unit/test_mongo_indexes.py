from __future__ import annotations

import pytest

from app.db.mongo import ensure_indexes


class FakeCollection:
    def __init__(self, name: str) -> None:
        self.name = name
        self.models = None

    async def create_indexes(self, models):
        self.models = models
        return [f"{self.name}_idx"]


class FakeDB:
    def __init__(self) -> None:
        self.users = FakeCollection("users")
        self.learning_materials = FakeCollection("learning_materials")
        self.material_chunks = FakeCollection("material_chunks")
        self.generated_contents = FakeCollection("generated_contents")
        self.chatbot_sessions = FakeCollection("chatbot_sessions")
        self.chatbot_messages = FakeCollection("chatbot_messages")
        self.mascot_chat_sessions = FakeCollection("mascot_chat_sessions")
        self.mascot_chat_messages = FakeCollection("mascot_chat_messages")
        self.game_attempts = FakeCollection("game_attempts")
        self.processing_jobs = FakeCollection("processing_jobs")
        self.file_assets = FakeCollection("file_assets")
        self.audio_assets = FakeCollection("audio_assets")
        self.slide_assets = FakeCollection("slide_assets")
        self.analytics_events = FakeCollection("analytics_events")


@pytest.mark.asyncio
async def test_ensure_indexes_adds_unique_job_id_index(monkeypatch) -> None:
    fake_db = FakeDB()
    monkeypatch.setattr("app.db.mongo.get_db", lambda: fake_db)

    await ensure_indexes()

    assert fake_db.processing_jobs.models is not None
    job_models = [model.document for model in fake_db.processing_jobs.models]

    unique_job_id_models = [
        doc
        for doc in job_models
        if doc.get("key") == {"job_id": 1} and doc.get("unique") is True
    ]
    assert len(unique_job_id_models) == 1
