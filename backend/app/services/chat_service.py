import asyncio
import json

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
        material = await self.material_service.get_material(
            material_id, user_id=user_id
        )
        title = session_title or f"Chat về {material['title']}"
        now = utc_now()
        payload = {
            "user_id": user_id,
            "material_id": material_id,
            "session_title": title,
            "created_at": now,
            "updated_at": now,
        }
        return await self.chat_repo.create_session(payload)

    def _build_session_title(self, message: str, fallback: str) -> str:
        normalized = " ".join(str(message).strip().split())
        if not normalized:
            return fallback
        return normalized[:57] + "..." if len(normalized) > 60 else normalized

    async def get_session_detail(self, session_id: str, user_id: str) -> dict:
        session = await self.chat_repo.get_session_for_user(
            parse_object_id(session_id), user_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = await self.chat_repo.list_messages(session_id)
        return {"session": session, "messages": messages}

    async def list_sessions(self, material_id: str, user_id: str) -> list[dict]:
        return await self.chat_repo.list_sessions_for_user(user_id, material_id)

    async def delete_session(self, session_id: str, user_id: str) -> bool:
        return await self.chat_repo.delete_session_for_user(
            parse_object_id(session_id), user_id
        )

    async def delete_sessions_by_material(self, material_id: str, user_id: str) -> int:
        return await self.chat_repo.delete_sessions_for_user_by_material(
            user_id, material_id
        )

    async def get_mascot_session_detail(self, session_id: str, user_id: str) -> dict:
        session = await self.chat_repo.get_mascot_session_for_user(
            parse_object_id(session_id), user_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = await self.chat_repo.list_mascot_messages(session_id)
        return {"session": session, "messages": messages}

    async def list_mascot_sessions(self, user_id: str) -> list[dict]:
        return await self.chat_repo.list_mascot_sessions_for_user(user_id)

    async def delete_mascot_session(self, session_id: str, user_id: str) -> bool:
        return await self.chat_repo.delete_mascot_session_for_user(
            parse_object_id(session_id), user_id
        )

    async def delete_all_mascot_sessions(self, user_id: str) -> int:
        return await self.chat_repo.delete_all_mascot_sessions_for_user(user_id)

    async def add_user_message_and_answer(
        self,
        session_id: str,
        message: str,
        images: list[str] | None = None,
        user_id: str | None = None,
    ) -> dict:
        if user_id:
            session = await self.chat_repo.get_session_for_user(
                parse_object_id(session_id), user_id
            )
        else:
            session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        now = utc_now()
        existing_messages = await self.chat_repo.list_messages(session_id, limit=1)
        if not existing_messages:
            default_title = session.get("session_title") or "Đoạn chat mới"
            await self.chat_repo.update_session(
                parse_object_id(session_id),
                {
                    "session_title": self._build_session_title(message, default_title),
                    "updated_at": now,
                },
            )

        await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "user",
                "message": message,
                "images": images or [],
                "citations": [],
                "created_at": now,
            }
        )

        # Keep recent exchanges as memory so multi-turn questions preserve context.
        memory_messages = await self.chat_repo.list_messages(
            session_id, limit=settings.chat_memory_turns
        )

        # Run blocking retrieval + LLM call off the event loop.
        result = await asyncio.to_thread(
            self.orchestrator.answer,
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
        user_id: str,
        session_id: str | None = None,
        images: list[str] | None = None,
        use_web_search: bool = False,
        use_google: bool = True,
    ) -> dict:
        mascot_session: dict | None = None
        if session_id:
            try:
                mascot_session = await self.chat_repo.get_mascot_session_for_user(
                    parse_object_id(session_id), user_id
                )
            except HTTPException:
                mascot_session = None

        if not mascot_session:
            now = utc_now()
            mascot_session = await self.chat_repo.create_mascot_session(
                {
                    "user_id": user_id,
                    "session_title": self._build_session_title(
                        message, "Cuộc trò chuyện mới"
                    ),
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
                "images": images or [],
                "created_at": utc_now(),
            }
        )

        if use_web_search:
            try:
                search_result = await asyncio.to_thread(
                    self.orchestrator.web_search,
                    message,
                    use_google,
                )
                refined_answer, refinement_model_used = await asyncio.to_thread(
                    self._refine_web_search_answer,
                    message,
                    search_result,
                )
                final_answer = (
                    refined_answer or str(search_result.get("answer", "")).strip()
                )
                search_provider = search_result.get("search_provider")

                web_search_metadata = {
                    "model_used": refinement_model_used or search_result.get("model"),
                    "fallback_applied": search_provider != "google_search",
                    "is_web_search": True,
                    "search_results": {
                        "sources": [
                            {
                                "index": s.get("index"),
                                "title": s.get("title", ""),
                                "uri": s.get("uri", ""),
                                "snippet": s.get("snippet", ""),
                            }
                            for s in search_result.get("sources", [])
                        ],
                        "search_provider": search_provider,
                        "search_queries": search_result.get("search_queries", []),
                        "raw_text": str(
                            search_result.get("raw_text")
                            or search_result.get("answer")
                            or ""
                        ),
                    },
                }

                await self.chat_repo.create_mascot_message(
                    {
                        "session_id": mascot_session_id,
                        "role": "assistant",
                        "message": final_answer,
                        "created_at": utc_now(),
                        "is_web_search": True,
                        **web_search_metadata,
                    }
                )
                await self.chat_repo.update_mascot_session(
                    parse_object_id(mascot_session_id),
                    {"updated_at": utc_now()},
                )
                return {
                    "message": final_answer,
                    "model": settings.web_search_refinement_model,
                    "session_id": mascot_session_id,
                    "search_provider": search_provider,
                    **web_search_metadata,
                }
            except Exception:
                # Nếu web search lỗi, fallback về mascot chat thường để tránh mất trải nghiệm.
                pass

        memory_messages = await self.chat_repo.list_mascot_messages(
            mascot_session_id, limit=settings.mascot_memory_turns
        )
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

        answer = await asyncio.to_thread(
            self.llm_client.text_response_openai,
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
            "is_web_search": False,
            "search_provider": None,
            **llm_metadata,
        }

    async def web_search_answer(
        self,
        session_id: str,
        query: str,
        use_google: bool = True,
        user_id: str | None = None,
    ) -> dict:
        """
        Tìm kiếm web và trả về câu trả lời được định dạng với trích dẫn đầy đủ

        Args:
            session_id: ID phiên chat (dùng cho ngữ cảnh)
            query: Câu hỏi tìm kiếm
            use_google: Thử Tìm kiếm Google trước

        Returns:
            dict với kết quả tìm kiếm web và câu trả lời
        """
        if user_id:
            session = await self.chat_repo.get_session_for_user(
                parse_object_id(session_id), user_id
            )
        else:
            session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên chat")

        now = utc_now()

        # Lưu tin nhắn của người dùng
        await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "user",
                "message": query,
                "images": [],
                "citations": [],
                "created_at": now,
            }
        )

        # Chạy tìm kiếm web ngoài event loop (thao tác chặn)
        try:
            search_result = await asyncio.to_thread(
                self.orchestrator.web_search,
                query,
                use_google,
            )
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Tìm kiếm web thất bại: {str(e)}"
            )

        refined_answer = str(search_result.get("answer", "")).strip()
        refinement_model_used: str | None = None
        try:
            refined_answer, refinement_model_used = await asyncio.to_thread(
                self._refine_web_search_answer,
                query,
                search_result,
            )
        except Exception:
            # Nếu bước biên tập lỗi, vẫn trả kết quả web search gốc để không gián đoạn trải nghiệm.
            refined_answer = str(search_result.get("answer", "")).strip()
            refinement_model_used = None

        # Tạo tin nhắn trả lời với kết quả tìm kiếm
        assistant_msg = await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "assistant",
                "message": refined_answer,
                "citations": [
                    {
                        "material_id": f"web_{cite['source']}",
                        "chunk_id": f"source_{cite['index']}",
                        "chunk_index": cite["index"],
                        "snippet": cite["title"],
                    }
                    for cite in search_result.get("citations", [])
                ],
                "created_at": utc_now(),
                "model_used": refinement_model_used or search_result.get("model"),
                "fallback_applied": search_result.get("search_provider")
                != "google_search",
                "is_web_search": True,
                "search_results": {
                    "sources": [
                        {
                            "index": s["index"],
                            "title": s["title"],
                            "uri": s["uri"],
                            "snippet": s.get("snippet", ""),
                        }
                        for s in search_result.get("sources", [])
                    ],
                    "search_provider": search_result.get("search_provider"),
                    "search_queries": search_result.get("search_queries", []),
                    "raw_text": str(
                        search_result.get("raw_text")
                        or search_result.get("answer")
                        or ""
                    ),
                    "refined_with_llm": bool(refinement_model_used),
                    "search_model": search_result.get("model"),
                },
            }
        )

        await self.chat_repo.update_session(
            parse_object_id(session_id), {"updated_at": utc_now()}
        )

        return assistant_msg

    def _refine_web_search_answer(
        self,
        query: str,
        search_result: dict,
    ) -> tuple[str, str | None]:
        """Biên tập lại câu trả lời web search bằng LLM, giữ nguyên toàn bộ thông tin."""
        draft_answer = str(search_result.get("answer", "")).strip()
        if not draft_answer:
            return "", None

        # Đưa toàn bộ dữ liệu từ tool search vào prompt để LLM không bỏ sót thông tin.
        full_tool_output = json.dumps(
            search_result, ensure_ascii=False, default=str, indent=2
        )

        system_prompt = (
            "Bạn là biên tập viên tiếng Việt. "
            "Nhiệm vụ DUY NHẤT: chỉnh lại văn phong cho rõ ràng, mạch lạc, dễ đọc. "
            "BẮT BUỘC giữ nguyên toàn bộ thông tin thực tế có trong dữ liệu đầu vào, "
            "không được lược bỏ, không được tóm tắt, không được thêm mới dữ kiện. "
            "Giữ nguyên các mốc thời gian, số liệu, tên riêng, liên kết và ý nghĩa gốc."
        )

        user_prompt = (
            f"Câu hỏi người dùng: {query}\n\n"
            "Dưới đây là TOÀN BỘ output gốc từ tool search (không được bỏ sót bất kỳ phần nào khi biên tập):\n"
            f"{full_tool_output}\n\n"
            "Yêu cầu đầu ra:\n"
            "1) Chỉ biên tập văn phong tiếng Việt có dấu cho tự nhiên, mạch lạc.\n"
            "2) Không tóm tắt, không lược bỏ chi tiết, không thêm ý mới.\n"
            "3) Cố gắng giữ cấu trúc thông tin và thứ tự logic từ dữ liệu đầu vào.\n"
            "4) Trả về câu trả lời hoàn chỉnh cho người dùng từ chính dữ liệu trên."
        )

        refined = self.llm_client.text_response_openai(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            fallback=draft_answer,
            model=settings.web_search_refinement_model,
        )
        return (refined or draft_answer).strip(), self.llm_client.last_model_used
