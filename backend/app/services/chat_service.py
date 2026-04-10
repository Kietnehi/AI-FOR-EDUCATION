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
        title = session_title or "Cuộc trò chuyện mới"
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

    def _build_mascot_session_title(self, message: str) -> str:
        return self._build_session_title(message, "Cuộc trò chuyện mới")

    async def _build_rag_session_title(
        self, material_id: str, user_id: str, message: str
    ) -> str:
        question_title = self._build_session_title(message, "Cuộc trò chuyện mới")
        material_title = ""
        try:
            material = await self.material_service.get_material(
                material_id, user_id=user_id
            )
            material_title = " ".join(str(material.get("title", "")).strip().split())
        except Exception:
            material_title = ""

        if not material_title:
            return question_title

        return question_title

    async def get_session_detail(self, session_id: str, user_id: str) -> dict:
        session = await self.chat_repo.get_session_for_user(
            parse_object_id(session_id), user_id
        )
        if not session:
            raise HTTPException(status_code=404, detail="Kh?ng t?m th?y phi?n chat")
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
            raise HTTPException(status_code=404, detail="Kh?ng t?m th?y phi?n chat")
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

    async def stream_add_user_message_and_answer(
        self,
        session_id: str,
        message: str,
        images: list[str] | None = None,
        user_id: str | None = None,
        model: str | None = None,
        reasoning_enabled: bool = False,
        use_gemini_rotation: bool = True,
    ):
        import json
        from starlette.concurrency import iterate_in_threadpool
        if user_id:
            session = await self.chat_repo.get_session_for_user(
                parse_object_id(session_id), user_id
            )
        else:
            session = await self.chat_repo.get_session(parse_object_id(session_id))

        if not session:
            raise HTTPException(status_code=404, detail="Kh?ng t?m th?y phi?n chat")

        now = utc_now()
        existing_messages = await self.chat_repo.list_messages(session_id, limit=1)
        if not existing_messages:
            await self.chat_repo.update_session(
                parse_object_id(session_id),
                {
                    "session_title": await self._build_rag_session_title(
                        session["material_id"],
                        user_id or session["user_id"],
                        message,
                    ),
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

        memory_messages = await self.chat_repo.list_messages(
            session_id, limit=settings.chat_memory_turns
        )

        sync_gen = self.orchestrator.stream_answer(
            session["material_id"],
            message,
            conversation_history=memory_messages,
            images=images,
            model=model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )

        full_content = ""
        full_reasoning = ""
        citations = []

        async for chunk in iterate_in_threadpool(sync_gen):
            if "citations" in chunk:
                citations = chunk["citations"]
                yield json.dumps({"citations": citations}, ensure_ascii=False) + "\n"
                continue

            if "answer" in chunk and "content" not in chunk:
                full_content = chunk["answer"]
                yield json.dumps({"content": full_content}, ensure_ascii=False) + "\n"
                break

            c = chunk.get("content", "")
            r = chunk.get("reasoning", "")
            if c or r:
                full_content += c
                full_reasoning += r
                yield json.dumps({"content": c, "reasoning": r}, ensure_ascii=False) + "\n"

        reasoning_details = None
        if full_reasoning:
            reasoning_details = {"reasoning": full_reasoning}

        if not full_content.strip() and not full_reasoning.strip():
            full_content = "\u0044\u1eef li\u1ec7u hi\u1ec7n ch\u01b0a s\u1eb5n s\u00e0ng. B\u1ea1n th\u1eed l\u1ea1i sau nh\u00e9."

        await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "assistant",
                "message": full_content.strip(),
                "citations": citations,
                "created_at": utc_now(),
                "model_used": self.orchestrator.llm.last_model_used,
                "reasoning_details": reasoning_details,
            }
        )

        await self.chat_repo.update_session(
            parse_object_id(session_id), {"updated_at": utc_now()}
        )

        yield json.dumps(
            {
                "done": True,
                "model": self.orchestrator.llm.last_model_used,
            },
            ensure_ascii=False,
        ) + "\n"

    async def add_user_message_and_answer(
        self,
        session_id: str,
        message: str,
        images: list[str] | None = None,
        user_id: str | None = None,
        model: str | None = None,
        reasoning_enabled: bool = False,
        use_gemini_rotation: bool = True,
    ) -> dict:
        if user_id:
            session = await self.chat_repo.get_session_for_user(
                parse_object_id(session_id), user_id
            )
        else:
            session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Kh?ng t?m th?y phi?n chat")

        now = utc_now()
        existing_messages = await self.chat_repo.list_messages(session_id, limit=1)
        if not existing_messages:
            await self.chat_repo.update_session(
                parse_object_id(session_id),
                {
                    "session_title": await self._build_rag_session_title(
                        session["material_id"],
                        user_id or session["user_id"],
                        message,
                    ),
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

        memory_messages = await self.chat_repo.list_messages(
            session_id, limit=settings.chat_memory_turns
        )

        result = await asyncio.to_thread(
            self.orchestrator.answer,
            session["material_id"],
            message,
            conversation_history=memory_messages,
            images=images,
            model=model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )

        llm_metadata = {
            "model_used": self.orchestrator.llm.last_model_used,
            "fallback_applied": getattr(self.orchestrator.llm, "fallback_used", False),
        }
        if result.get("reasoning_details"):
            llm_metadata["reasoning_details"] = result["reasoning_details"]

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

    async def stream_answer_mascot_no_rag(
        self,
        message: str,
        user_id: str,
        session_id: str | None = None,
        images: list[str] | None = None,
        use_web_search: bool = False,
        use_google: bool = True,
        model: str | None = None,
        reasoning_enabled: bool = False,
        use_gemini_rotation: bool = True,
    ):
        import json
        from starlette.concurrency import iterate_in_threadpool

        mascot_session = None
        if session_id:
            try:
                mascot_session = await self.chat_repo.get_mascot_session_for_user(
                    parse_object_id(session_id), user_id
                )
            except Exception:
                pass

        if not mascot_session:
            now = utc_now()
            mascot_session = await self.chat_repo.create_mascot_session(
                {
                    "user_id": user_id,
                    "session_title": self._build_mascot_session_title(message),
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

        search_provider = None
        if use_web_search:
            try:
                search_result = await asyncio.to_thread(
                    self.orchestrator.web_search, message, use_google,
                )
                refine_messages, draft_answer = self._build_web_search_refine_messages(
                    message,
                    search_result,
                )
                selected_model = model or settings.web_search_refinement_model
                sync_gen = self.llm_client.stream_text_response_chat_openai(
                    messages=refine_messages,
                    model=selected_model,
                    reasoning_enabled=reasoning_enabled,
                    use_gemini_rotation=use_gemini_rotation,
                )

                final_answer = ""
                final_reasoning = ""
                async for chunk in iterate_in_threadpool(sync_gen):
                    c = chunk.get("content", "")
                    r = chunk.get("reasoning", "")
                    if c or r:
                        final_answer += c
                        final_reasoning += r
                        yield json.dumps({"content": c, "reasoning": r}, ensure_ascii=False) + "\n"

                if not final_answer.strip() and not final_reasoning.strip():
                    final_answer = draft_answer

                reasoning_details = None
                if final_reasoning:
                    reasoning_details = {"reasoning": final_reasoning}

                search_provider = search_result.get("search_provider")
                base_cites = search_result.get("sources", [])

                web_metadata = {
                    "model_used": self.llm_client.last_model_used or search_result.get("model"),
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
                            for s in base_cites
                        ],
                        "search_provider": search_provider,
                        "search_queries": search_result.get("search_queries", []),
                        "raw_text": str(search_result.get("raw_text") or search_result.get("answer") or ""),
                    },
                }

                await self.chat_repo.create_mascot_message(
                    {
                        "session_id": mascot_session_id,
                        "role": "assistant",
                        "message": final_answer,
                        "created_at": utc_now(),
                        "is_web_search": True,
                        "reasoning_details": reasoning_details,
                        **web_metadata,
                    }
                )

                yield json.dumps(
                    {
                        "session_id": mascot_session_id,
                        "done": True,
                        "model": self.llm_client.last_model_used or search_result.get("model"),
                        "search_provider": search_provider,
                    }
                ) + "\n"
                return
            except Exception:
                pass

        memory_messages = await self.chat_repo.list_mascot_messages(
            mascot_session_id, limit=settings.mascot_memory_turns
        )

        system_prompt = (
            "\u0042\u1ea1n l\u00e0 mascot tr\u1ee3 l\u00fd h\u1ecdc t\u1eadp th\u00e2n thi\u1ec7n. "
            "\u0054r\u1ea3 l\u1eddi ng\u1eafn g\u1ecdn, d\u1ec5 hi\u1ec3u, b\u1eb1ng ti\u1ebfng Vi\u1ec7t t\u1ef1 nhi\u00ean. "
            "\u004b\u0068\u00f4ng c\u1ea7n truy xu\u1ea5t t\u00e0i li\u1ec7u v\u00e0 kh\u00f4ng \u0111\u01b0a ra citation."
        )

        messages = [{"role": "system", "content": system_prompt}]
        for item in memory_messages:
            msg_role = "user" if item.get("role") == "user" else "assistant"
            msg_content = str(item.get("message", "")).strip()
            if not msg_content:
                continue
            msg = {"role": msg_role, "content": msg_content}
            if item.get("reasoning_details"):
                msg["reasoning_details"] = item["reasoning_details"]
            messages.append(msg)

        user_content = [{"type": "text", "text": message}]
        if images:
            for img in images:
                if img.startswith("data:"):
                    user_content.append({"type": "image_url", "image_url": {"url": img}})
                else:
                    user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
        messages.append({"role": "user", "content": user_content})

        sync_gen = self.llm_client.stream_chat_unified(
            messages,
            model,
            reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )

        full_content = ""
        full_reasoning = ""

        async for chunk in iterate_in_threadpool(sync_gen):
            c = chunk.get("content", "")
            r = chunk.get("reasoning", "")
            if c or r:
                full_content += c
                full_reasoning += r
                yield json.dumps({"content": c, "reasoning": r}) + "\n"

        reasoning_details = None
        if full_reasoning:
            reasoning_details = {"reasoning": full_reasoning}

        if not full_content.strip() and not full_reasoning.strip():
            full_content = "\u004d\u00ecnh \u0111ang g\u1eb7p l\u1ed7i t\u1ea1m th\u1eddi. B\u1ea1n th\u1eed l\u1ea1i sau \u00edt gi\u00e2y nh\u00e9."

        await self.chat_repo.create_mascot_message(
            {
                "session_id": mascot_session_id,
                "role": "assistant",
                "message": full_content.strip(),
                "created_at": utc_now(),
                "model_used": self.llm_client.last_model_used,
                "reasoning_details": reasoning_details,
            }
        )

        await self.chat_repo.update_mascot_session(
            parse_object_id(mascot_session_id),
            {"updated_at": utc_now()},
        )

        yield json.dumps(
            {
                "session_id": mascot_session_id,
                "done": True,
                "model": self.llm_client.last_model_used,
            }
        ) + "\n"

    async def answer_mascot_no_rag(
        self,
        message: str,
        user_id: str,
        session_id: str | None = None,
        images: list[str] | None = None,
        use_web_search: bool = False,
        use_google: bool = True,
        model: str | None = None,
        reasoning_enabled: bool = False,
        use_gemini_rotation: bool = True,
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
                    "session_title": self._build_mascot_session_title(message),
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
                    model,
                    use_gemini_rotation,
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
                    "model": refinement_model_used or search_result.get("model"),
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
        system_prompt = (
            "Bạn là mascot trợ lý học tập thân thiện. "
            "Trả lời ngắn gọn, dễ hiểu, BẮT BUỘC bằng tiếng Việt có dấu đầy đủ và tự nhiên. "
            "Không cần truy xuất tài liệu và không đưa ra citation."
        )
        fallback = "Mình đang gặp lỗi tạm thời. Bạn thử lại sau ít giây nhé."
        
        reasoning_details = None

        messages = [{"role": "system", "content": system_prompt}]
        for item in memory_messages:
            msg_role = "user" if item.get("role") == "user" else "assistant"
            msg_content = str(item.get("message", "")).strip()
            if not msg_content:
                continue
            msg = {"role": msg_role, "content": msg_content}
            if item.get("reasoning_details"):
                msg["reasoning_details"] = item["reasoning_details"]
            messages.append(msg)

        user_content = [{"type": "text", "text": message}]
        if images:
            for img in images:
                if img.startswith("data:"):
                    user_content.append({"type": "image_url", "image_url": {"url": img}})
                else:
                    user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img}"}})
        messages.append({"role": "user", "content": user_content})

        selected_model = model or settings.mascot_chat_model
        answer, reasoning_details = await asyncio.to_thread(
            self.llm_client.text_chat_unified,
            messages=messages,
            fallback=fallback,
            model=selected_model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )

        llm_metadata = {
            "model_used": self.llm_client.last_model_used,
            "fallback_applied": getattr(self.llm_client, "fallback_used", False),
        }
        if reasoning_details:
            llm_metadata["reasoning_details"] = reasoning_details

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
        model: str | None = None,
        use_gemini_rotation: bool = True,
        reasoning_enabled: bool = False,
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
                model,
                use_gemini_rotation,
                reasoning_enabled,
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

    async def stream_web_search_answer(
        self,
        session_id: str,
        query: str,
        use_google: bool = True,
        user_id: str | None = None,
        model: str | None = None,
        use_gemini_rotation: bool = True,
        reasoning_enabled: bool = False,
    ):
        import json
        from starlette.concurrency import iterate_in_threadpool

        if user_id:
            session = await self.chat_repo.get_session_for_user(
                parse_object_id(session_id), user_id
            )
        else:
            session = await self.chat_repo.get_session(parse_object_id(session_id))
        if not session:
            raise HTTPException(status_code=404, detail="Không tìm thấy phiên chat")

        now = utc_now()
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

        citations = [
            {
                "material_id": f"web_{cite['source']}",
                "chunk_id": f"source_{cite['index']}",
                "chunk_index": cite["index"],
                "snippet": cite["title"],
            }
            for cite in search_result.get("citations", [])
        ]
        yield json.dumps({"citations": citations}, ensure_ascii=False) + "\n"

        refine_messages, draft_answer = self._build_web_search_refine_messages(
            query,
            search_result,
        )
        selected_model = model or settings.web_search_refinement_model
        sync_gen = self.llm_client.stream_text_response_chat_openai(
            messages=refine_messages,
            model=selected_model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )

        full_content = ""
        full_reasoning = ""
        async for chunk in iterate_in_threadpool(sync_gen):
            c = chunk.get("content", "")
            r = chunk.get("reasoning", "")
            if c or r:
                full_content += c
                full_reasoning += r
                yield json.dumps({"content": c, "reasoning": r}, ensure_ascii=False) + "\n"

        if not full_content.strip() and not full_reasoning.strip():
            full_content = draft_answer

        reasoning_details = None
        if full_reasoning:
            reasoning_details = {"reasoning": full_reasoning}

        assistant_msg = await self.chat_repo.create_message(
            {
                "session_id": session_id,
                "role": "assistant",
                "message": full_content,
                "citations": citations,
                "created_at": utc_now(),
                "model_used": self.llm_client.last_model_used or search_result.get("model"),
                "fallback_applied": search_result.get("search_provider") != "google_search",
                "is_web_search": True,
                "reasoning_details": reasoning_details,
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
                    "refined_with_llm": bool(self.llm_client.last_model_used),
                    "search_model": search_result.get("model"),
                },
            }
        )

        await self.chat_repo.update_session(
            parse_object_id(session_id), {"updated_at": utc_now()}
        )

        yield json.dumps(
            {
                "done": True,
                "model": assistant_msg.get("model_used") or self.llm_client.last_model_used,
                "search_provider": search_result.get("search_provider"),
            },
            ensure_ascii=False,
        ) + "\n"

    def _build_web_search_refine_messages(
        self,
        query: str,
        search_result: dict,
    ) -> tuple[list[dict], str]:
        draft_answer = str(search_result.get("answer", "")).strip()
        if not draft_answer:
            return [
                {"role": "system", "content": "Bạn là trợ lý."},
                {"role": "user", "content": "Trả về chuỗi rỗng."},
            ], ""

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

        return (
            [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            draft_answer,
        )

    def _refine_web_search_answer(
        self,
        query: str,
        search_result: dict,
        model: str | None = None,
        use_gemini_rotation: bool = True,
        reasoning_enabled: bool = False,
    ) -> tuple[str, str | None]:
        """Biên tập lại câu trả lời web search bằng LLM, giữ nguyên toàn bộ thông tin."""
        refine_messages, draft_answer = self._build_web_search_refine_messages(
            query,
            search_result,
        )
        if not draft_answer:
            return "", None

        selected_model = model or settings.web_search_refinement_model

        refined, _ = self.llm_client.text_chat_unified(
            messages=refine_messages,
            fallback=draft_answer,
            model=selected_model,
            reasoning_enabled=reasoning_enabled,
            use_gemini_rotation=use_gemini_rotation,
        )
        return (refined or draft_answer).strip(), self.llm_client.last_model_used
