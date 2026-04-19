import asyncio
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.repositories.base import serialize_document


class CommunityRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.thread_collection = db.community_threads
        self.comment_collection = db.thread_comments

    async def create_thread(self, payload: dict) -> dict:
        payload.setdefault("likes_count", 0)
        payload.setdefault("liked_by_user_ids", [])
        payload.setdefault("comment_count", 0)
        result = await self.thread_collection.insert_one(payload)
        return serialize_document({"_id": result.inserted_id, **payload}) or {}

    async def get_thread_by_id(self, thread_id: str) -> dict | None:
        try:
            thread = await self.thread_collection.find_one({"_id": ObjectId(thread_id)})
            if thread:
                comment_count = await self.comment_collection.count_documents({"thread_id": thread_id})
                thread["comment_count"] = comment_count
                thread.setdefault("liked_by_user_ids", [])
                thread["likes_count"] = len(thread["liked_by_user_ids"])
            return serialize_document(thread)
        except Exception:
            return None

    async def list_threads(self, skip: int = 0, limit: int = 20) -> tuple[list[dict], int]:
        cursor = self.thread_collection.find().sort("created_at", -1).skip(skip).limit(limit)
        docs = await cursor.to_list(length=limit)
        
        for doc in docs:
            doc["comment_count"] = await self.comment_collection.count_documents({"thread_id": str(doc["_id"])})
            doc.setdefault("liked_by_user_ids", [])
            doc["likes_count"] = len(doc["liked_by_user_ids"])
            
        total = await self.thread_collection.count_documents({})
        items = [serialize_document(doc) for doc in docs]
        return [item for item in items if item], total

    async def add_comment(self, payload: dict) -> dict:
        payload.setdefault("likes_count", 0)
        payload.setdefault("liked_by_user_ids", [])
        result = await self.comment_collection.insert_one(payload)
        
        await self.thread_collection.update_one(
            {"_id": ObjectId(payload["thread_id"])},
            {"$inc": {"comment_count": 1}}
        )
        
        return serialize_document({"_id": result.inserted_id, **payload}) or {}

    async def get_comment_by_id(self, comment_id: str) -> dict | None:
        try:
            doc = await self.comment_collection.find_one({"_id": ObjectId(comment_id)})
            return serialize_document(doc)
        except:
            return None

    async def delete_comment(self, comment_id: str) -> bool:
        # Xóa comment này và tất cả các comment trả lời cho nó
        # (Ở đây ta xóa 1 cấp cho đơn giản, hoặc đệ quy nếu cần)
        try:
            # Tìm thread_id để cập nhật counter
            comment = await self.comment_collection.find_one({"_id": ObjectId(comment_id)})
            if not comment:
                return False
            
            thread_id = comment.get("thread_id")
            
            # Xóa các comment con trước
            children = await self.comment_collection.find({"reply_to_comment_id": comment_id}).to_list(length=1000)
            child_ids = [c["_id"] for c in children]
            
            await self.comment_collection.delete_many({"reply_to_comment_id": comment_id})
            
            # Xóa comment chính
            await self.comment_collection.delete_one({"_id": ObjectId(comment_id)})
            
            # Cập nhật số lượng comment trong thread (giảm đi 1 + số con)
            deleted_count = 1 + len(child_ids)
            await self.thread_collection.update_one(
                {"_id": ObjectId(thread_id)},
                {"$inc": {"comment_count": -deleted_count}}
            )
            
            return True
        except:
            return False

    async def list_comments(self, thread_id: str) -> list[dict]:
        cursor = self.comment_collection.find({"thread_id": thread_id}).sort("created_at", 1)
        docs = await cursor.to_list(length=1000)
        for doc in docs:
            doc.setdefault("liked_by_user_ids", [])
            doc["likes_count"] = len(doc["liked_by_user_ids"])
        items = [serialize_document(doc) for doc in docs]
        return [item for item in items if item]

    async def toggle_like_thread(self, thread_id: str, user_id: str) -> dict:
        thread = await self.thread_collection.find_one({"_id": ObjectId(thread_id)})
        if not thread:
            return {"likes_count": 0, "liked_by_user_ids": []}
            
        liked_by = thread.get("liked_by_user_ids", [])
        if user_id in liked_by:
            res = await self.thread_collection.find_one_and_update(
                {"_id": ObjectId(thread_id)},
                {"$pull": {"liked_by_user_ids": user_id}},
                return_document=True
            )
        else:
            res = await self.thread_collection.find_one_and_update(
                {"_id": ObjectId(thread_id)},
                {"$addToSet": {"liked_by_user_ids": user_id}},
                return_document=True
            )
        
        updated_liked_by = res.get("liked_by_user_ids", [])
        return {
            "likes_count": len(updated_liked_by),
            "liked_by_user_ids": updated_liked_by
        }

    async def toggle_like_comment(self, comment_id: str, user_id: str) -> dict:
        comment = await self.comment_collection.find_one({"_id": ObjectId(comment_id)})
        if not comment:
            return {"likes_count": 0, "liked_by_user_ids": []}
            
        liked_by = comment.get("liked_by_user_ids", [])
        if user_id in liked_by:
            res = await self.comment_collection.find_one_and_update(
                {"_id": ObjectId(comment_id)},
                {"$pull": {"liked_by_user_ids": user_id}},
                return_document=True
            )
        else:
            res = await self.comment_collection.find_one_and_update(
                {"_id": ObjectId(comment_id)},
                {"$addToSet": {"liked_by_user_ids": user_id}},
                return_document=True
            )
        
        updated_liked_by = res.get("liked_by_user_ids", [])
        return {
            "likes_count": len(updated_liked_by),
            "liked_by_user_ids": updated_liked_by
        }

    async def update_thread(self, thread_id: str, update_data: dict) -> dict | None:
        try:
            res = await self.thread_collection.find_one_and_update(
                {"_id": ObjectId(thread_id)},
                {"$set": update_data},
                return_document=True
            )
            return serialize_document(res) if res else None
        except:
            return None
