from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.api.dependencies import get_database, get_current_user
from app.schemas.auth import AuthUser
from app.schemas.community import (
    ThreadCreate, ThreadResponse, CommentCreate, CommentResponse, AskAIRequest, ThreadUpdate
)
from app.services.community_service import CommunityService

router = APIRouter()


@router.get("/community/threads", response_model=list[ThreadResponse])
async def list_threads(
    skip: int = 0,
    limit: int = 20,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    items, _ = await service.list_threads(skip, limit)
    return [ThreadResponse(**item) for item in items]


@router.post("/community/threads", response_model=ThreadResponse)
async def create_thread(
    payload: ThreadCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    thread = await service.create_thread(user.id, payload)
    return ThreadResponse(**thread)


@router.get("/community/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    thread = await service.get_thread(thread_id)
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    return ThreadResponse(**thread)


@router.patch("/community/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    payload: ThreadUpdate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    try:
        thread = await service.update_thread(thread_id, user.id, payload)
        return ThreadResponse(**thread)
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.get("/community/threads/{thread_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    thread_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    comments = await service.list_comments(thread_id)
    return [CommentResponse(**c) for c in comments]


@router.post("/community/threads/{thread_id}/comments", response_model=CommentResponse)
async def add_comment(
    thread_id: str,
    payload: CommentCreate,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    comment = await service.add_comment(thread_id, user.id, payload)
    return CommentResponse(**comment)


@router.post("/community/threads/{thread_id}/ask-ai", response_model=CommentResponse)
async def ask_ai(
    thread_id: str,
    payload: AskAIRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    try:
        comment = await service.ask_ai(thread_id, user.id, payload.question, payload.reply_to_comment_id)
        return CommentResponse(**comment)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/community/threads/{thread_id}/like")
async def like_thread(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    return await service.like_thread(thread_id, user.id)


@router.post("/community/comments/{comment_id}/like")
async def like_comment(
    comment_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    return await service.like_comment(comment_id, user.id)


@router.delete("/community/comments/{comment_id}")
async def delete_comment(
    comment_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    service = CommunityService(db)
    try:
        success = await service.delete_comment(comment_id, user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Comment not found")
        return {"message": "Comment deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=403, detail=str(e))
