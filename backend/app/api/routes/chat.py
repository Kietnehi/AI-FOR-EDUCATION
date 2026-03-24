from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionDetailResponse,
    ChatSessionResponse,
    CreateChatSessionRequest,
)
from app.services.chat_service import ChatService

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
