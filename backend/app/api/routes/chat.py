import asyncio
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.core.config import settings
from app.schemas.chat import (
    ChatSessionListResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    DeleteChatSessionsResponse,
    MascotChatSessionListResponse,
    MascotChatSessionDetailResponse,
    MascotChatSessionResponse,
    MascotMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
    MascotChatRequest,
    MascotChatResponse,
    TextToSpeechRequest,
    TranscriptionResponse,
    WebSearchRequest,
    WebSearchResponse,
)
from app.services.chat_service import ChatService
from app.services.groq_speech_service import GroqSpeechToTextService
from app.services.personalization_service import PersonalizationService
from app.services.speech_service import SpeechToTextService
from app.services.tts_service import TextToSpeechService

router = APIRouter()
LOCAL_WHISPER_MODELS = {
    "local-base": "base",
    "local-small": "small",
}


@router.post("/chat/{material_id}/session", response_model=ChatSessionResponse)
async def create_session(
    material_id: str,
    payload: CreateChatSessionRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatSessionResponse:
    service = ChatService(db)
    session = await service.create_session(material_id, user.id, payload.session_title)
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="chat_session_created",
        resource_type="chat_session",
        resource_id=session.get("id"),
        metadata={"material_id": material_id},
    )
    return ChatSessionResponse(**session)


@router.get(
    "/chat/mascot/sessions",
    response_model=MascotChatSessionListResponse,
)
async def list_mascot_sessions(
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MascotChatSessionListResponse:
    service = ChatService(db)
    sessions = await service.list_mascot_sessions(user.id)
    return MascotChatSessionListResponse(
        sessions=[MascotChatSessionResponse(**item) for item in sessions]
    )


@router.get(
    "/chat/mascot/sessions/{session_id}",
    response_model=MascotChatSessionDetailResponse,
)
async def get_mascot_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MascotChatSessionDetailResponse:
    service = ChatService(db)
    detail = await service.get_mascot_session_detail(session_id, user_id=user.id)
    return MascotChatSessionDetailResponse(
        session=MascotChatSessionResponse(**detail["session"]),
        messages=[MascotMessageResponse(**item) for item in detail["messages"]],
    )


@router.get("/chat/{material_id}/sessions", response_model=ChatSessionListResponse)
async def list_sessions(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatSessionListResponse:
    service = ChatService(db)
    sessions = await service.list_sessions(material_id, user.id)
    return ChatSessionListResponse(
        sessions=[ChatSessionResponse(**item) for item in sessions]
    )


@router.get("/chat/sessions/{session_id}", response_model=ChatSessionDetailResponse)
async def get_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatSessionDetailResponse:
    service = ChatService(db)
    detail = await service.get_session_detail(session_id, user_id=user.id)
    return ChatSessionDetailResponse(
        session=ChatSessionResponse(**detail["session"]),
        messages=[ChatMessageResponse(**item) for item in detail["messages"]],
    )


@router.post("/chat/sessions/{session_id}/message", response_model=ChatMessageResponse)
async def send_message(
    session_id: str,
    payload: ChatMessageRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> ChatMessageResponse:
    service = ChatService(db)
    assistant_message = await service.add_user_message_and_answer(
        session_id,
        payload.message,
        payload.images,
        user_id=user.id,
        model=payload.model,
        reasoning_enabled=payload.reasoning_enabled,
        use_gemini_rotation=payload.use_gemini_rotation,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="chat_message_sent",
        resource_type="chat_session",
        resource_id=session_id,
        metadata={
            "message_length": len(payload.message.strip()),
            "image_count": len(payload.images or []),
            "model": payload.model,
            "reasoning_enabled": payload.reasoning_enabled,
        },
    )
    return ChatMessageResponse(**assistant_message)


@router.post("/chat/sessions/{session_id}/message/stream")
async def stream_message(
    session_id: str,
    payload: ChatMessageRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> StreamingResponse:
    service = ChatService(db)
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="chat_message_stream_requested",
        resource_type="chat_session",
        resource_id=session_id,
        metadata={
            "message_length": len(payload.message.strip()),
            "image_count": len(payload.images or []),
            "model": payload.model,
            "reasoning_enabled": payload.reasoning_enabled,
        },
    )
    generator = service.stream_add_user_message_and_answer(
        session_id,
        payload.message,
        payload.images,
        user_id=user.id,
        model=payload.model,
        reasoning_enabled=payload.reasoning_enabled,
        use_gemini_rotation=payload.use_gemini_rotation,
    )
    return StreamingResponse(
        generator, 
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )


@router.delete(
    "/chat/sessions/{session_id}",
    response_model=DeleteChatSessionsResponse,
)
async def delete_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DeleteChatSessionsResponse:
    service = ChatService(db)
    deleted = await service.delete_session(session_id, user.id)
    return DeleteChatSessionsResponse(deleted_count=1 if deleted else 0)


@router.post("/chat/mascot/message", response_model=MascotChatResponse)
async def send_mascot_message(
    payload: MascotChatRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> MascotChatResponse:
    service = ChatService(db)
    response = await service.answer_mascot_no_rag(
        payload.message,
        user.id,
        payload.session_id,
        payload.images,
        use_web_search=payload.use_web_search,
        use_google=payload.use_google,
        model=payload.model,
        reasoning_enabled=payload.reasoning_enabled,
        use_gemini_rotation=payload.use_gemini_rotation,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="mascot_message_sent",
        resource_type="mascot_session",
        resource_id=response.get("session_id"),
        metadata={
            "message_length": len(payload.message.strip()),
            "image_count": len(payload.images or []),
            "use_web_search": payload.use_web_search,
            "use_google": payload.use_google,
            "model": payload.model,
        },
    )
    return MascotChatResponse(**response)


@router.post("/chat/mascot/message/stream")
async def stream_mascot_message(
    payload: MascotChatRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> StreamingResponse:
    service = ChatService(db)
    generator = service.stream_answer_mascot_no_rag(
        payload.message,
        user.id,
        payload.session_id,
        payload.images,
        use_web_search=payload.use_web_search,
        use_google=payload.use_google,
        model=payload.model,
        reasoning_enabled=payload.reasoning_enabled,
        use_gemini_rotation=payload.use_gemini_rotation,
    )
    return StreamingResponse(
        generator, 
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"}
    )



@router.delete(
    "/chat/mascot/sessions",
    response_model=DeleteChatSessionsResponse,
)
async def delete_all_mascot_sessions(
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DeleteChatSessionsResponse:
    service = ChatService(db)
    deleted_count = await service.delete_all_mascot_sessions(user.id)
    return DeleteChatSessionsResponse(deleted_count=deleted_count)


@router.delete(
    "/chat/mascot/sessions/{session_id}",
    response_model=DeleteChatSessionsResponse,
)
async def delete_mascot_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DeleteChatSessionsResponse:
    service = ChatService(db)
    deleted = await service.delete_mascot_session(session_id, user.id)
    return DeleteChatSessionsResponse(deleted_count=1 if deleted else 0)


@router.delete(
    "/chat/{material_id}/sessions",
    response_model=DeleteChatSessionsResponse,
)
async def delete_sessions_by_material(
    material_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> DeleteChatSessionsResponse:
    service = ChatService(db)
    deleted_count = await service.delete_sessions_by_material(material_id, user.id)
    return DeleteChatSessionsResponse(deleted_count=deleted_count)


@router.post("/chat/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    stt_model: str = Form(default="local-base"),
    language: str | None = Form(default=None),
    user: AuthUser = Depends(get_current_user),
) -> TranscriptionResponse:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Missing audio file")

    suffix = Path(file.filename).suffix or ".webm"
    temp_path = ""

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        whisper_language = language.strip() if language else None
        local_whisper_model = LOCAL_WHISPER_MODELS.get(stt_model)
        if local_whisper_model:
            service = SpeechToTextService(local_whisper_model)
            text = await asyncio.to_thread(
                service.transcribe_file, temp_path, whisper_language
            )
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
        raise HTTPException(
            status_code=500, detail=f"Transcription failed: {exc}"
        ) from exc
    finally:
        if temp_path:
            try:
                Path(temp_path).unlink(missing_ok=True)
            except OSError:
                pass

    if not text:
        raise HTTPException(status_code=422, detail="No speech detected")

    return TranscriptionResponse(text=text)


@router.post("/chat/tts")
async def text_to_speech(
    payload: TextToSpeechRequest,
    user: AuthUser = Depends(get_current_user),
) -> Response:
    service = TextToSpeechService()
    try:
        audio_bytes = await asyncio.to_thread(
            service.synthesize, payload.text, payload.lang
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/chat/sessions/{session_id}/web-search", response_model=WebSearchResponse)
async def web_search(
    session_id: str,
    payload: WebSearchRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> WebSearchResponse:
    """
    Tìm kiếm trên web sử dụng Tìm kiếm Google (với grounding) hoặc Tavily (dự phòng)
    và trả về câu trả lời được định dạng với trích dẫn đầy đủ.

    - **session_id**: ID phiên chat
    - **query**: Câu hỏi tìm kiếm (ví dụ: "Giá vàng hôm nay 2026")
    - **use_google**: Nếu True, thử Tìm kiếm Google trước (yêu cầu hỗ trợ mô hình Gemini)
    """
    service = ChatService(db)
    result = await service.web_search_answer(
        session_id,
        payload.query,
        payload.use_google,
        user_id=user.id,
        model=payload.model,
        use_gemini_rotation=payload.use_gemini_rotation,
        reasoning_enabled=payload.reasoning_enabled,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="chat_web_search_used",
        resource_type="chat_session",
        resource_id=session_id,
        metadata={
            "query_length": len(payload.query.strip()),
            "use_google": payload.use_google,
            "model": payload.model,
        },
    )

    # Trích xuất kết quả tìm kiếm từ siêu dữ liệu tin nhắn
    search_results = result.get("search_results", {})
    sources = search_results.get("sources", [])
    citations = [
        {
            "index": src["index"],
            "title": src["title"],
            "url": src["uri"],
            "source": search_results.get("search_provider", "unknown"),
        }
        for src in sources
    ]

    return WebSearchResponse(
        answer=result["message"],
        raw_text=search_results.get("raw_text", result["message"]),
        sources=[
            {
                "index": src["index"],
                "title": src["title"],
                "uri": src["uri"],
                "snippet": src["snippet"],
            }
            for src in sources
        ],
        citations=citations,
        search_provider=search_results.get("search_provider", "unknown"),
        model=result.get("model_used", "unknown"),
        search_queries=search_results.get("search_queries", []),
    )


@router.post("/chat/sessions/{session_id}/web-search/stream")
async def stream_web_search(
    session_id: str,
    payload: WebSearchRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> StreamingResponse:
    service = ChatService(db)
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="chat_web_search_stream_requested",
        resource_type="chat_session",
        resource_id=session_id,
        metadata={
            "query_length": len(payload.query.strip()),
            "use_google": payload.use_google,
            "model": payload.model,
        },
    )
    generator = service.stream_web_search_answer(
        session_id=session_id,
        query=payload.query,
        use_google=payload.use_google,
        user_id=user.id,
        model=payload.model,
        use_gemini_rotation=payload.use_gemini_rotation,
        reasoning_enabled=payload.reasoning_enabled,
    )
    return StreamingResponse(
        generator,
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no", "Cache-Control": "no-cache"},
    )
