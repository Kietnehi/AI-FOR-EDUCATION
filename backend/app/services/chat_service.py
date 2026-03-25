from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.chatbot.orchestrator import ChatbotOrchestrator
from app.ai.generation.llm_client import LLMClient
from app.core.config import settings
from app.repositories.chat_repository import ChatRepository
from app.services.material_service import MaterialService
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now


class ChatService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.chat_repo = ChatRepository(db)
        self.material_service = MaterialService(db)
        self.orchestrator = ChatbotOrchestrator()
        self.llm_client = LLMClient()

    async def create_session(
        self, material_id: str, user_id: str, session_title: str | None
    ) -> dict:
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

    async def add_user_message_and_answer(
        self, session_id: str, message: str, images: list[str] | None = None
    ) -> dict:
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

        # Keep recent exchanges as memory so multi-turn questions preserve context.
        all_messages = await self.chat_repo.list_messages(session_id)
        memory_messages = all_messages[-settings.chat_memory_turns :]

        result = self.orchestrator.answer(
            session["material_id"],
            message,
            conversation_history=memory_messages,
            images=images,
        )

        # Lấy metadata về model đã dùng
        llm_metadata = {
            "model_used": self.orchestrator.llm.last_model_used,
            "fallback_applied": self.orchestrator.llm.fallback_used,
        }

        assistant_msg = await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "assistant",
                "message": result["answer"],
                "citations": result["citations"],
                "created_at": utc_now(),
                **llm_metadata,
            }
        )

        await self.chat_repo.update_session(
            parse_object_id(session_id), {"updated_at": utc_now()}
        )
        return assistant_msg

    async def answer_mascot_no_rag(
        self,
        message: str,
        session_id: str | None = None,
        images: list[str] | None = None,
    ) -> dict:
        mascot_session: dict | None = None
        if session_id:
            try:
                mascot_session = await self.chat_repo.get_mascot_session(
                    parse_object_id(session_id)
                )
            except HTTPException:
                mascot_session = None

        if not mascot_session:
            now = utc_now()
            mascot_session = await self.chat_repo.create_mascot_session(
                {
                    "user_id": "demo-user",
                    "session_title": "Mascot chat",
                    "created_at": now,
                    "updated_at": now,
                }
            )

        mascot_session_id = mascot_session["id"]
        await self.chat_repo.create_mascot_message(
            {
                "session_id": mascot_session_id,
                "role": "user",
                "message": message,
                "created_at": utc_now(),
            }
        )

        all_messages = await self.chat_repo.list_mascot_messages(mascot_session_id)
        memory_messages = all_messages[-settings.mascot_memory_turns :]
        memory_lines: list[str] = []
        for item in memory_messages:
            role = "Người dùng" if item.get("role") == "user" else "Trợ lý"
            content = str(item.get("message", "")).strip()
            if content:
                memory_lines.append(f"{role}: {content[:400]}")
        memory_text = "\n".join(memory_lines)

        system_prompt = (
            "Bạn là mascot trợ lý học tập thân thiện. "
            "Trả lời ngắn gọn, dễ hiểu, BẮT BUỘC bằng tiếng Việt có dấu đầy đủ và tự nhiên. "
            "Không cần truy xuất tài liệu và không đưa ra citation."
        )
        fallback = "Mình đang gặp lỗi tạm thời. Bạn thử lại sau ít giây nhé."
        user_prompt = message
        if memory_text:
            user_prompt = f"Lịch sử hội thoại gần đây:\n{memory_text}\n\nTin nhắn hiện tại: {message}"

        answer = self.llm_client.text_response_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            fallback=fallback,
            model=settings.mascot_chat_model,
            images=images,
        )

        # Lấy metadata (mascot không dùng fallback, nhưng vẫn lấy model_used)
        llm_metadata = {
            "model_used": self.llm_client.last_model_used,
            "fallback_applied": False,  # mascot luôn dùng OpenAI trực tiếp
        }

        await self.chat_repo.create_mascot_message(
            {
                "session_id": mascot_session_id,
                "role": "assistant",
                "message": answer,
                "created_at": utc_now(),
                **llm_metadata,
            }
        )
        await self.chat_repo.update_mascot_session(
            parse_object_id(mascot_session_id),
            {"updated_at": utc_now()},
        )
        return {
            "message": answer,
            "model": settings.mascot_chat_model,
            "session_id": mascot_session_id,
            **llm_metadata,
        }
