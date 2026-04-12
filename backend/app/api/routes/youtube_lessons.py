from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_current_user, get_database
from app.repositories.youtube_lesson_history_repository import YouTubeLessonHistoryRepository
from app.schemas.auth import AuthUser
from app.schemas.youtube_lesson import (
    YouTubeLessonHistoryDetail,
    YouTubeLessonHistoryListResponse,
    YouTubeLessonRequest,
    YouTubeLessonResponse,
    YouTubeTranscriptTranslateRequest,
    YouTubeTranscriptTranslateResponse,
    YouTubeSearchRequest,
    YouTubeSearchResponse,
)
from app.services.youtube_lesson_service import YouTubeLessonService
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now

router = APIRouter(prefix="/youtube-lessons")


@router.post("/search", response_model=YouTubeSearchResponse)
async def search_youtube_videos(
    payload: YouTubeSearchRequest,
    user: AuthUser = Depends(get_current_user),
) -> YouTubeSearchResponse:
    service = YouTubeLessonService()
    try:
        items = service.search_videos(payload.query, payload.limit)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể tìm video YouTube: {exc}") from exc

    return YouTubeSearchResponse(items=items)


@router.post("/interactive", response_model=YouTubeLessonResponse)
async def generate_interactive_youtube_lesson(
    payload: YouTubeLessonRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> YouTubeLessonResponse:
    service = YouTubeLessonService()
    history_repo = YouTubeLessonHistoryRepository(db)

    video_id = payload.video_id or (service.extract_video_id(payload.youtube_url or "") if payload.youtube_url else None)
    video_meta = None

    if not video_id:
        query_text = (payload.query or "").strip()
        if not query_text:
            raise HTTPException(
                status_code=400,
                detail="Cần cung cấp youtube_url, video_id hoặc query để phân tích",
            )
        try:
            candidates = service.search_videos(query_text, limit=1)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Không thể tìm video YouTube: {exc}") from exc

        if not candidates:
            raise HTTPException(status_code=404, detail="Không tìm thấy video phù hợp từ từ khóa")

        video_meta = candidates[0]
        video_id = video_meta["video_id"]

    try:
        if video_meta is None:
            video_meta = service.get_video_meta(video_id)
        transcript = service.get_transcript(video_id, stt_model=payload.stt_model)
        lesson = service.build_interactive_lesson(
            transcript,
            title=video_meta.get("title") or "YouTube Lesson",
            max_checkpoints=payload.max_checkpoints,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể tạo bài học tương tác: {exc}") from exc

    now = utc_now()
    await history_repo.upsert_by_user_and_video(
        user_id=user.id,
        video_id=video_meta.get("video_id", ""),
        payload={
            "video": video_meta,
            "transcript": transcript,
            "lesson": lesson,
        },
        created_at=now,
        updated_at=now,
    )

    return YouTubeLessonResponse(
        video=video_meta,
        transcript=transcript,
        lesson=lesson,
    )


@router.get("/history", response_model=YouTubeLessonHistoryListResponse)
async def list_youtube_lesson_history(
    skip: int = 0,
    limit: int = 20,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> YouTubeLessonHistoryListResponse:
    repo = YouTubeLessonHistoryRepository(db)
    items, total = await repo.list_for_user(user.id, skip=skip, limit=limit)
    summaries = [
        {
            "id": item["id"],
            "video": item["video"],
            "created_at": item["created_at"],
            "updated_at": item["updated_at"],
        }
        for item in items
    ]
    return YouTubeLessonHistoryListResponse(items=summaries, total=total)


@router.get("/history/{history_id}", response_model=YouTubeLessonHistoryDetail)
async def get_youtube_lesson_history_detail(
    history_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> YouTubeLessonHistoryDetail:
    repo = YouTubeLessonHistoryRepository(db)
    doc = await repo.get_for_user(parse_object_id(history_id), user.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch sử bài học")
    return YouTubeLessonHistoryDetail(**doc)


@router.delete("/history/{history_id}")
async def delete_youtube_lesson_history(
    history_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    repo = YouTubeLessonHistoryRepository(db)
    deleted = await repo.delete_for_user(parse_object_id(history_id), user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Không tìm thấy lịch sử bài học")
    return {"message": "Đã xóa lịch sử bài học"}


@router.post("/translate-transcript", response_model=YouTubeTranscriptTranslateResponse)
async def translate_youtube_transcript(
    payload: YouTubeTranscriptTranslateRequest,
    user: AuthUser = Depends(get_current_user),
) -> YouTubeTranscriptTranslateResponse:
    service = YouTubeLessonService()
    transcript = [item.model_dump() for item in payload.transcript]
    try:
        translated = service.translate_transcript(
            transcript,
            target_language=payload.target_language,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Không thể dịch transcript: {exc}") from exc

    return YouTubeTranscriptTranslateResponse(
        transcript=translated,
        target_language=payload.target_language,
    )
