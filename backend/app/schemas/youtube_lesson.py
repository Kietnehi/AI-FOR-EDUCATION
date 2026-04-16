from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class YouTubeVideoItem(BaseModel):
    video_id: str
    title: str
    channel: str | None = None
    duration_seconds: int | None = None
    thumbnail: str | None = None
    url: str


class YouTubeSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=200)
    limit: int = Field(default=6, ge=1, le=12)


class YouTubeSearchResponse(BaseModel):
    items: list[YouTubeVideoItem]


class YouTubeLessonRequest(BaseModel):
    youtube_url: str | None = None
    video_id: str | None = None
    query: str | None = None
    manual_transcript: str | None = None
    max_checkpoints: int = Field(default=5, ge=3, le=10)
    stt_model: Literal[
        "local-base",
        "local-small",
        "whisper-large-v3",
        "whisper-large-v3-turbo",
    ] = "local-base"


class TranscriptSegment(BaseModel):
    text: str
    start: float
    duration: float
    timestamp: str


class InteractiveCheckpoint(BaseModel):
    start_seconds: float
    timestamp: str
    title: str
    key_point: str
    question: str
    choices: list[str]
    correct_answer_index: int
    explanation: str


class ChapterItem(BaseModel):
    timestamp: str
    title: str


class KeyNoteItem(BaseModel):
    time: str
    note: str


class InteractiveLessonPayload(BaseModel):
    summary: str
    key_takeaways: list[str]
    chapters: list[ChapterItem] = Field(default_factory=list)
    key_notes: list[KeyNoteItem] = Field(default_factory=list)
    checkpoints: list[InteractiveCheckpoint]


class YouTubeLessonResponse(BaseModel):
    video: YouTubeVideoItem
    transcript: list[TranscriptSegment]
    lesson: InteractiveLessonPayload
    translations: dict[str, list[TranscriptSegment]] | None = Field(default_factory=dict)


class YouTubeLessonHistorySummary(BaseModel):
    id: str
    video: YouTubeVideoItem
    created_at: datetime
    updated_at: datetime


class YouTubeLessonHistoryDetail(BaseModel):
    id: str
    video: YouTubeVideoItem
    transcript: list[TranscriptSegment]
    lesson: InteractiveLessonPayload
    translations: dict[str, list[TranscriptSegment]] | None = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class YouTubeLessonHistoryListResponse(BaseModel):
    items: list[YouTubeLessonHistorySummary]
    total: int


class YouTubeTranscriptTranslateRequest(BaseModel):
    video_id: str | None = None
    transcript: list[TranscriptSegment]
    target_language: str = Field(..., min_length=2, max_length=20)


class YouTubeTranscriptTranslateResponse(BaseModel):
    transcript: list[TranscriptSegment]
    target_language: str
