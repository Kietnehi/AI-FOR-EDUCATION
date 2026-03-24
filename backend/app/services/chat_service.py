from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.chatbot.orchestrator import ChatbotOrchestrator
from app.repositories.chat_repository import ChatRepository
from app.services.material_service import MaterialService
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now


class ChatService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.chat_repo = ChatRepository(db)
        self.material_service = MaterialService(db)
        self.orchestrator = ChatbotOrchestrator()

    async def create_session(self, material_id: str, user_id: str, session_title: str | None) -> dict:
        material = await self.material_service.get_material(material_id)
        title = session_title or f"Chat ve {material['title']}"
        now = utc_now()
        payload = {
            "user_id": user_id,
            "material_id": material_id,
            "session_title": title,
            "created_at": now,
            "updated_at": now,
        }
        return await self.chat_repo.create_session(payload)

    async def get_session_detail(self, session_id: str) -> dict:
        session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = await self.chat_repo.list_messages(session_id)
        return {"session": session, "messages": messages}

    async def add_user_message_and_answer(self, session_id: str, message: str) -> dict:
        session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        now = utc_now()
        await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "user",
                "message": message,
                "citations": [],
                "created_at": now,
            }
        )

        result = self.orchestrator.answer(session["material_id"], message)
        assistant_msg = await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "assistant",
                "message": result["answer"],
                "citations": result["citations"],
                "created_at": utc_now(),
            }
        )

        await self.chat_repo.update_session(parse_object_id(session_id), {"updated_at": utc_now()})
        return assistant_msg
