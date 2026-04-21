import asyncio
from datetime import datetime
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.community_repository import CommunityRepository
from app.repositories.material_repository import MaterialRepository
from app.repositories.user_repository import UserRepository
from app.schemas.community import ThreadCreate, CommentCreate, ThreadUpdate
from app.ai.retrieval.retriever import Retriever
from app.ai.generation.llm_client import LLMClient
from app.services.material_service import MaterialService
from app.utils.time import vietnam_now


class CommunityService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.repository = CommunityRepository(db)
        self.material_repo = MaterialRepository(db)
        self.material_service = MaterialService(db)
        self.user_repo = UserRepository(db)
        self.retriever = Retriever()
        self.llm_client = LLMClient()

    async def _get_user_info(self, user_id: str):
        try:
            if user_id == "AI":
                return "AI Assistant", "/logo.png"
            user = await self.user_repo.find_by_id(user_id)
            if user:
                name = user.get("full_name") or user.get("name") or user.get("email", "Người dùng")
                avatar = user.get("picture") or user.get("avatar_url")
                return name, avatar
        except:
            pass
        return "Người dùng", None

    async def _hydrate_thread(self, thread: dict) -> dict:
        if not thread: return thread
        # 1. Hydrate User Info
        name, avatar = await self._get_user_info(thread.get("creator_id"))
        thread["creator_name"] = name
        thread["creator_avatar"] = avatar
        
        # 2. Fetch Thumbnail (Prioritize custom_thumbnail from user)
        material_ids = thread.get("material_ids", [])
        stored_thumbnail = thread.get("thumbnail_url")
        
        if stored_thumbnail:
            # Nếu người dùng đã tự upload ảnh bìa
            thread["thumbnail_url"] = stored_thumbnail
            thread["first_material_type"] = "custom"
        else:
            # Fallback: Tự động trích xuất từ file đầu tiên
            thread["thumbnail_url"] = None
            thread["first_material_type"] = None
            if material_ids:
                try:
                    first_material = await self.material_service.get_material(material_ids[0])
                    if first_material:
                        thread["first_material_type"] = first_material.get("source_type")
                        if first_material.get("source_type") == "image":
                            thread["thumbnail_url"] = first_material.get("file_url")
                except:
                    pass
                
        return thread

    async def _hydrate_comment(self, comment: dict) -> dict:
        if not comment: return comment
        name, avatar = await self._get_user_info(comment.get("user_id"))
        comment["user_name"] = name
        comment["user_avatar"] = avatar
        return comment

    async def create_thread(self, user_id: str, payload: ThreadCreate) -> dict:
        thread_data = payload.model_dump()
        material_ids = thread_data.get("material_ids", [])
        for m_id in material_ids:
            try:
                material = await self.material_service.get_material(m_id)
                if material.get("processing_status") == "uploaded":
                    await self.material_service.enqueue_process(m_id)
            except: pass

        user_name, user_avatar = await self._get_user_info(user_id)
        thread_data.update({
            "creator_id": user_id,
            "creator_name": user_name,
            "creator_avatar": user_avatar,
            "likes_count": 0,
            "liked_by_user_ids": [],
            "comment_count": 0,
            "created_at": vietnam_now(),
            "updated_at": vietnam_now()
        })
        return await self.repository.create_thread(thread_data)

    async def list_threads(self, skip: int, limit: int) -> tuple[list[dict], int]:
        items, total = await self.repository.list_threads(skip, limit)
        hydrated_items = await asyncio.gather(*[self._hydrate_thread(item) for item in items])
        return list(hydrated_items), total

    async def get_thread(self, thread_id: str) -> dict | None:
        thread = await self.repository.get_thread_by_id(thread_id)
        return await self._hydrate_thread(thread)

    async def add_comment(self, thread_id: str, user_id: str, payload: CommentCreate) -> dict:
        user_name, user_avatar = await self._get_user_info(user_id)
        comment_data = payload.model_dump()
        comment_data.update({
            "thread_id": thread_id,
            "user_id": user_id,
            "user_name": user_name,
            "user_avatar": user_avatar,
            "is_ai_response": False,
            "likes_count": 0,
            "liked_by_user_ids": [],
            "created_at": vietnam_now()
        })
        return await self.repository.add_comment(comment_data)

    async def list_comments(self, thread_id: str) -> list[dict]:
        comments = await self.repository.list_comments(thread_id)
        hydrated_comments = await asyncio.gather(*[self._hydrate_comment(c) for c in comments])
        return list(hydrated_comments)

    async def ask_ai(self, thread_id: str, user_id: str, question: str, reply_to_comment_id: str | None = None) -> dict:
        thread = await self.repository.get_thread_by_id(thread_id)
        if not thread:
            raise Exception("Thread not found")
        
        material_ids = thread.get("material_ids", [])
        context_chunks = await asyncio.to_thread(
            self.retriever.retrieve, 
            material_id=material_ids, 
            query=question
        )
        context_text = "\n\n".join([c["chunk_text"] for c in context_chunks[:5]])
        
        discussion_context = ""
        if reply_to_comment_id:
            parent_comment = await self.repository.comment_collection.find_one({"_id": ObjectId(reply_to_comment_id)})
            if parent_comment:
                context_parts = []
                gp_id = parent_comment.get('reply_to_comment_id')
                if gp_id:
                    grandparent = await self.repository.comment_collection.find_one({"_id": ObjectId(gp_id)})
                    if grandparent:
                        context_parts.append(f"- {grandparent.get('user_name') or 'Người dùng trước'}: \"{grandparent.get('content')}\"")
                context_parts.append(f"- {parent_comment.get('user_name') or 'Bạn'}: \"{parent_comment.get('content')}\"")
                discussion_context = "\n[DIỄN BIẾN THẢO LUẬN TRƯỚC ĐÓ]:\n" + "\n".join(context_parts) + "\n"

        system_prompt = (
            "Bạn là trợ lý AI thông minh trong cộng đồng học tập AI Learning Studio.\n"
            "Nhiệm vụ: Giải đáp thắc mắc dựa trên tài liệu đính kèm VÀ diễn biến cuộc thảo luận.\n"
            "Quy tắc:\n"
            "- Hãy đọc kỹ 'DIỄN BIẾN THẢO LUẬN' để hiểu tại sao người dùng đặt câu hỏi này.\n"
            "- Nếu người dùng đang tranh luận với người khác, hãy đóng vai trò người cố vấn khách quan dựa trên tài liệu.\n"
            "- Sử dụng Markdown chuyên nghiệp.\n"
            "- Trả lời tập trung, không lan man."
        )
        
        user_prompt = f"Câu hỏi/Yêu cầu: {question}\n{discussion_context}\n\n[KIẾN THỨC TỪ TÀI LIỆU]:\n{context_text}"
        
        ai_message = await asyncio.to_thread(
            self.llm_client.text_response,
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            fallback="Xin lỗi, tôi gặp chút trục trặc khi phân tích cuộc hội thoại này."
        )
        
        ai_comment_data = {
            "thread_id": thread_id,
            "user_id": "AI",
            "user_name": "AI Assistant",
            "user_avatar": "/logo.png",
            "content": ai_message,
            "is_ai_response": True,
            "reply_to_comment_id": reply_to_comment_id,
            "likes_count": 0,
            "liked_by_user_ids": [],
            "created_at": vietnam_now()
        }
        return await self.repository.add_comment(ai_comment_data)

    async def like_thread(self, thread_id: str, user_id: str) -> dict:
        return await self.repository.toggle_like_thread(thread_id, user_id)

    async def like_comment(self, comment_id: str, user_id: str) -> dict:
        return await self.repository.toggle_like_comment(comment_id, user_id)

    async def delete_comment(self, comment_id: str, user_id: str) -> bool:
        comment = await self.repository.get_comment_by_id(comment_id)
        if not comment:
            return False
        if comment.get("user_id") != user_id:
            raise Exception("Bạn không có quyền xóa bình luận này.")
        return await self.repository.delete_comment(comment_id)

    async def update_thread(self, thread_id: str, user_id: str, payload: ThreadUpdate) -> dict:
        thread = await self.repository.get_thread_by_id(thread_id)
        if not thread:
            raise Exception("Thread not found")
        
        if thread.get("creator_id") != user_id:
            raise Exception("Bạn không có quyền chỉnh sửa chủ đề này.")
            
        update_data = payload.model_dump(exclude_none=True)
        update_data["updated_at"] = vietnam_now()
        
        updated_thread = await self.repository.update_thread(thread_id, update_data)
        return await self._hydrate_thread(updated_thread) or {}
