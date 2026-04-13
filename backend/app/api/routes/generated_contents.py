from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase
from celery.result import AsyncResult

from app.api.dependencies import get_current_user, get_database
from app.schemas.auth import AuthUser
from app.schemas.generated_content import (
    GenerateMinigameRequest,
    GenerateNotebookLMMediaRequest,
    GeneratePodcastRequest,
    GenerateSlidesRequest,
    GenerateNotebookLMMediaResponse,
    NotebookLMArtifactConfirmationResponse,
    GeneratedContentResponse,
    NotebookLMConfirmationResponse,
    ConfirmNotebookLMDownloadResponse,
    GenerationTaskQueuedResponse,
    GenerationTaskStatusResponse,
)
from app.repositories.generated_content_repository import GeneratedContentRepository
from app.services.generation_service import GenerationService
from app.services.material_service import MaterialService
from app.services.personalization_service import PersonalizationService
from app.services.notebooklm_service import NotebookLMService
from app.services.storage import storage_service
from app.utils.time import utc_now
from app.tasks import (
    celery_app,
    generate_minigame_task,
    generate_podcast_task,
    generate_slides_task,
)

router = APIRouter()


@router.post("/materials/{material_id}/generate/slides", response_model=GeneratedContentResponse)
async def generate_slides(
    material_id: str,
    payload: GenerateSlidesRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_slides(
        material_id,
        tone=payload.tone,
        max_slides=payload.max_slides,
        skip_refine=payload.skip_refine,
        user_id=user.id,
        force_regenerate=payload.force_regenerate,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="generation_requested",
        resource_type="material",
        resource_id=material_id,
        metadata={
            "content_type": "slides",
            "tone": payload.tone,
            "max_slides": payload.max_slides,
            "force_regenerate": payload.force_regenerate,
            "generated_content_id": result.get("id"),
        },
    )
    if not result.get("storage_type"):
        result["storage_type"] = storage_service.detect_storage_type(result.get("file_url"))
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/podcast", response_model=GeneratedContentResponse)
async def generate_podcast(
    material_id: str,
    payload: GeneratePodcastRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_podcast(
        material_id,
        style=payload.style,
        target_duration_minutes=payload.target_duration_minutes,
        user_id=user.id,
        force_regenerate=payload.force_regenerate,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="generation_requested",
        resource_type="material",
        resource_id=material_id,
        metadata={
            "content_type": "podcast",
            "style": payload.style,
            "target_duration_minutes": payload.target_duration_minutes,
            "force_regenerate": payload.force_regenerate,
            "generated_content_id": result.get("id"),
        },
    )
    if not result.get("storage_type"):
        result["storage_type"] = storage_service.detect_storage_type(result.get("file_url"))
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/minigame", response_model=GeneratedContentResponse)
async def generate_minigame(
    material_id: str,
    payload: GenerateMinigameRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_minigame(
        material_id, 
        game_type=payload.game_type,
        difficulty=payload.difficulty,
        user_id=user.id,
        force_regenerate=payload.force_regenerate,
    )
    personalization_service = PersonalizationService(db)
    await personalization_service.track_event(
        user_id=user.id,
        event_type="generation_requested",
        resource_type="material",
        resource_id=material_id,
        metadata={
            "content_type": "minigame",
            "game_type": payload.game_type,
            "difficulty": payload.difficulty,
            "force_regenerate": payload.force_regenerate,
            "generated_content_id": result.get("id"),
        },
    )
    if not result.get("storage_type"):
        result["storage_type"] = storage_service.detect_storage_type(result.get("file_url"))
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/slides/async", response_model=GenerationTaskQueuedResponse)
async def queue_generate_slides(
    material_id: str,
    payload: GenerateSlidesRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GenerationTaskQueuedResponse:
    material_service = MaterialService(db)
    await material_service.get_material(material_id, user_id=user.id)
    task = generate_slides_task.delay(
        material_id,
        payload.tone,
        payload.max_slides,
        payload.skip_refine,
    )
    return GenerationTaskQueuedResponse(
        task_id=task.id,
        message="Slide generation task queued",
    )


@router.post("/materials/{material_id}/generate/podcast/async", response_model=GenerationTaskQueuedResponse)
async def queue_generate_podcast(
    material_id: str,
    payload: GeneratePodcastRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GenerationTaskQueuedResponse:
    material_service = MaterialService(db)
    await material_service.get_material(material_id, user_id=user.id)
    task = generate_podcast_task.delay(
        material_id,
        payload.style,
        payload.target_duration_minutes,
    )
    return GenerationTaskQueuedResponse(
        task_id=task.id,
        message="Podcast generation task queued",
    )


@router.post("/materials/{material_id}/generate/minigame/async", response_model=GenerationTaskQueuedResponse)
async def queue_generate_minigame(
    material_id: str,
    payload: GenerateMinigameRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GenerationTaskQueuedResponse:
    material_service = MaterialService(db)
    await material_service.get_material(material_id, user_id=user.id)
    task = generate_minigame_task.delay(material_id, payload.game_type, payload.difficulty)
    return GenerationTaskQueuedResponse(
        task_id=task.id,
        message="Minigame generation task queued",
    )


@router.get("/tasks/{task_id}/status", response_model=GenerationTaskStatusResponse)
async def get_generation_task_status(
    task_id: str,
    user: AuthUser = Depends(get_current_user),
) -> GenerationTaskStatusResponse:
    task = AsyncResult(task_id, app=celery_app)
    info = task.info if isinstance(task.info, dict) else {}

    state = task.state.upper()
    if state == "PENDING":
        return GenerationTaskStatusResponse(
            task_id=task_id,
            status="pending",
            celery_state=state,
            progress=0,
        )

    if state in {"STARTED", "RETRY"}:
        return GenerationTaskStatusResponse(
            task_id=task_id,
            status="processing",
            celery_state=state,
            progress=info.get("progress") if isinstance(info.get("progress"), int) else None,
        )

    if state == "SUCCESS":
        result_payload = task.result if isinstance(task.result, dict) else {"value": task.result}
        return GenerationTaskStatusResponse(
            task_id=task_id,
            status="completed",
            celery_state=state,
            progress=100,
            result=result_payload,
        )

    error_detail = str(task.info) if task.info else "Task failed"
    return GenerationTaskStatusResponse(
        task_id=task_id,
        status="failed",
        celery_state=state,
        error=error_detail,
    )


@router.get("/materials/{material_id}/generated-contents", response_model=list[GeneratedContentResponse])
async def list_material_generated_contents(
    material_id: str,
    content_type: str | None = None,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> list[GeneratedContentResponse]:
    service = GenerationService(db)
    items = await service.list_generated_contents(
        material_id, content_type=content_type, user_id=user.id
    )
    for item in items:
        if not item.get("storage_type"):
            item["storage_type"] = storage_service.detect_storage_type(item.get("file_url"))
    return [GeneratedContentResponse(**item) for item in items]


@router.get("/generated-contents/{content_id}", response_model=GeneratedContentResponse)
async def get_generated_content(
    content_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.get_generated_content(content_id, user_id=user.id)
    if not result.get("storage_type"):
        result["storage_type"] = storage_service.detect_storage_type(result.get("file_url"))
    return GeneratedContentResponse(**result)


@router.delete("/generated-contents/{content_id}")
async def delete_generated_content(
    content_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> dict:
    service = GenerationService(db)
    deleted = await service.delete_generated_content(content_id, user_id=user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Generated content not found")
    return {"message": "Generated content deleted successfully"}


@router.post("/notebooklm/generate-media")
async def generate_notebooklm_media(
    payload: GenerateNotebookLMMediaRequest,
    user: AuthUser = Depends(get_current_user),
):
    """
    Two-step endpoint for NotebookLM media generation from custom prompt:
    
    Step 1: Send request with confirm=false (default) to get confirmation prompt
    Step 2: Review the message and send request with confirm=true to start generation
    
    Video/infographic generation has 3 phases:
    1) Confirm start upload
    2) Confirm start artifact creation after upload
    3) Confirm download after render complete
    """
    if not payload.prompt:
        raise HTTPException(status_code=400, detail="prompt is required for this endpoint")

    # Step 1: If not confirmed, return confirmation prompt
    if not payload.confirm:
        return NotebookLMConfirmationResponse(
            material_id=None,
            prompt=payload.prompt,
            message="Sẵn sàng tạo video và infographics từ prompt này. Tác vụ này có thể mất 5-10 phút hoặc lâu hơn. Bạn có chắc chắn muốn tiếp tục? Gửi lại request với confirm=true để xác nhận.",
            estimated_duration_seconds=600,
        )

    # Step 2: If confirmed, run upload phase and wait for artifact confirmation
    service = NotebookLMService()
    try:
        result = await service.generate_media(prompt=payload.prompt)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result.get("status") == "awaiting_artifact_confirmation":
        return NotebookLMArtifactConfirmationResponse(**result)
    return GenerateNotebookLMMediaResponse(**result)


@router.post("/materials/{material_id}/generate/notebooklm-media")
async def generate_notebooklm_media_from_material(
    material_id: str,
    payload: GenerateNotebookLMMediaRequest,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Two-step endpoint for NotebookLM media generation with existence check.
    """
    # Check for existing media first
    if not payload.force_regenerate:
        service = GenerationService(db)
        existing_videos = await service.list_generated_contents(material_id, content_type="video", user_id=user.id)
        existing_infos = await service.list_generated_contents(material_id, content_type="infographic", user_id=user.id)
        
        if existing_videos or existing_infos:
            return {
                "status": "saved",
                "session_id": "existing",
                "material_id": material_id,
                "videos": [item for item in existing_videos],
                "infographics": [item for item in existing_infos],
                "message": "Đã tìm thấy nội dung đã tạo trước đó."
            }

    material_service = MaterialService(db)
    material = await material_service.get_material(material_id, user_id=user.id)

    material_title = (material.get("title") or "Học liệu").strip()
    prompt = f"{material_title}"
    if payload.guidance:
        prompt = f"{prompt} | Yêu cầu thêm: {payload.guidance.strip()}"

    # Step 1: If not confirmed, return confirmation prompt
    if not payload.confirm:
        return NotebookLMConfirmationResponse(
            material_id=material_id,
            prompt=prompt,
            message="Sẵn sàng tạo video và infographics từ học liệu này. Tác vụ này có thể mất 5-10 phút hoặc lâu hơn. Bạn có chắc chắn muốn tiếp tục? Gửi lại request với confirm=true để xác nhận.",
            estimated_duration_seconds=600,
        )

    # Step 2: If confirmed, run upload phase and wait for artifact confirmation
    notebook_service = NotebookLMService()
    try:
        result = await notebook_service.generate_media_for_material(
            material=material,
            guidance=payload.guidance,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if result.get("status") == "awaiting_artifact_confirmation":
        return NotebookLMArtifactConfirmationResponse(**result)
    return GenerateNotebookLMMediaResponse(**result)


@router.post("/notebooklm/sessions/{session_id}/confirm-artifacts", response_model=GenerateNotebookLMMediaResponse)
async def confirm_notebooklm_artifacts(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Confirm upload has completed and trigger NotebookLM to create video + infographic.
    """
    service = NotebookLMService()
    try:
        result = await service.confirm_artifact_generation(session_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return GenerateNotebookLMMediaResponse(**result)


@router.post("/notebooklm/sessions/{session_id}/confirm", response_model=ConfirmNotebookLMDownloadResponse)
async def confirm_notebooklm_download(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Confirm download and save to generated_contents collection.
    """
    service = NotebookLMService()
    session_data = service.get_session_data(session_id)
    material_id = session_data.get("material_id") if session_data else None

    try:
        result = await service.confirm_download(session_id)
        
        # Persist to database if linked to a material
        if material_id:
            gen_repo = GeneratedContentRepository(db)
            now = utc_now()
            
            # Save videos
            for v in result.get("videos", []):
                version = await gen_repo.get_next_version(material_id, "video")
                await gen_repo.create({
                    "user_id": user.id,
                    "material_id": material_id,
                    "content_type": "video",
                    "version": version,
                    "file_url": v["file_url"],
                    "storage_type": v.get("storage_type"),
                    "generation_status": "generated",
                    "created_at": now,
                    "updated_at": now
                })
                
            # Save infographics
            for info in result.get("infographics", []):
                version = await gen_repo.get_next_version(material_id, "infographic")
                await gen_repo.create({
                    "user_id": user.id,
                    "material_id": material_id,
                    "content_type": "infographic",
                    "version": version,
                    "file_url": info["file_url"],
                    "storage_type": info.get("storage_type"),
                    "generation_status": "generated",
                    "created_at": now,
                    "updated_at": now
                })

        return ConfirmNotebookLMDownloadResponse(**result)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.delete("/notebooklm/sessions/{session_id}")
async def cancel_notebooklm_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    """
    Cancel and delete temp session files.
    Use this if you don't want to save the generated media.
    """
    service = NotebookLMService()
    result = await service.cancel_session(session_id)
    return result
