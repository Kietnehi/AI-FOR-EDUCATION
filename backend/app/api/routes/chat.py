import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
from app.core.config import settings
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    TranscriptionResponse,
)
from app.services.chat_service import ChatService
from app.services.groq_speech_service import GroqSpeechToTextService
from app.services.speech_service import SpeechToTextService

router = APIRouter()


@router.post("/chat/{material_id}/session", response_model=ChatSessionResponse)
async def create_session(
    material_id: str,
    payload: CreateChatSessionRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatSessionResponse:
    service = ChatService(db)
    session = await service.create_session(material_id, payload.user_id, payload.session_title)
    return ChatSessionResponse(**session)


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatSessionDetailResponse:
    service = ChatService(db)
    detail = await service.get_session_detail(session_id)
    return ChatSessionDetailResponse(
        session=ChatSessionResponse(**detail["session"]),
        messages=[ChatMessageResponse(**item) for item in detail["messages"]],
    )


@router.post("/chat/sessions/{session_id}/message", response_model=ChatMessageResponse)
async def send_message(
    session_id: str,
    payload: ChatMessageRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatMessageResponse:
    service = ChatService(db)
    assistant_message = await service.add_user_message_and_answer(session_id, payload.message)
    return ChatMessageResponse(**assistant_message)


@router.post("/chat/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    stt_model: str = Form(default="local-base"),
    language: str | None = Form(default=None),
) -> TranscriptionResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file")

    suffix = Path(file.filename).suffix or ".webm"
    temp_path = ""

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        whisper_language = language or settings.whisper_language
        if stt_model == "local-base":
            service = SpeechToTextService(settings.whisper_model)
            text = await asyncio.to_thread(service.transcribe_file, temp_path, whisper_language)
        elif stt_model in {"whisper-large-v3", "whisper-large-v3-turbo"}:
            if not settings.groq_api_key:
                raise HTTPException(status_code=500, detail="Missing Groq API key")
            groq_service = GroqSpeechToTextService(
                api_key=settings.groq_api_key,
                base_url=settings.groq_base_url,
            )
            text = await asyncio.to_thread(
                groq_service.transcribe_file,
                temp_path,
                stt_model,
                whisper_language,
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported stt_model")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except OSError:
                pass

    if not text:
        raise HTTPException(status_code=422, detail="No speech detected")

    return TranscriptionResponse(text=text)
