from fastapi import APIRouter, Depends, HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.dependencies import get_database
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
)
from app.services.generation_service import GenerationService
from app.services.material_service import MaterialService
from app.services.notebooklm_service import NotebookLMService

router = APIRouter()


@router.post("/materials/{material_id}/generate/slides", response_model=GeneratedContentResponse)
async def generate_slides(
    material_id: str,
    payload: GenerateSlidesRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_slides(material_id, tone=payload.tone, max_slides=payload.max_slides)
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/podcast", response_model=GeneratedContentResponse)
async def generate_podcast(
    material_id: str,
    payload: GeneratePodcastRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_podcast(
        material_id,
        style=payload.style,
        target_duration_minutes=payload.target_duration_minutes,
    )
    return GeneratedContentResponse(**result)


@router.post("/materials/{material_id}/generate/minigame", response_model=GeneratedContentResponse)
async def generate_minigame(
    material_id: str,
    payload: GenerateMinigameRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.generate_minigame(material_id, game_type=payload.game_type)
    return GeneratedContentResponse(**result)


@router.get("/generated-contents/{content_id}", response_model=GeneratedContentResponse)
async def get_generated_content(
    content_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
) -> GeneratedContentResponse:
    service = GenerationService(db)
    result = await service.get_generated_content(content_id)
    return GeneratedContentResponse(**result)


@router.post("/notebooklm/generate-media")
async def generate_notebooklm_media(
    payload: GenerateNotebookLMMediaRequest,
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
    result = await service.generate_media(prompt=payload.prompt)
    if result.get("status") == "awaiting_artifact_confirmation":
        return NotebookLMArtifactConfirmationResponse(**result)
    return GenerateNotebookLMMediaResponse(**result)


@router.post("/materials/{material_id}/generate/notebooklm-media")
async def generate_notebooklm_media_from_material(
    material_id: str,
    payload: GenerateNotebookLMMediaRequest,
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Two-step endpoint for NotebookLM media generation:

    Step 1: Send request with confirm=false (default) to get confirmation prompt
    Step 2: Review the message and send request with confirm=true to start generation

    Video/infographic generation has 3 phases:
    1) Confirm start upload
    2) Confirm start artifact creation after upload
    3) Confirm download after render complete
    """
    material_service = MaterialService(db)
    material = await material_service.get_material(material_id)

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
    result = await notebook_service.generate_media_for_material(
        material=material,
        guidance=payload.guidance,
    )
    if result.get("status") == "awaiting_artifact_confirmation":
        return NotebookLMArtifactConfirmationResponse(**result)
    return GenerateNotebookLMMediaResponse(**result)


@router.post("/notebooklm/sessions/{session_id}/confirm-artifacts", response_model=GenerateNotebookLMMediaResponse)
async def confirm_notebooklm_artifacts(
    session_id: str,
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
):
    """
    Confirm and move files from temp storage to permanent storage.
    This is the final step after previewing generated media.
    """
    service = NotebookLMService()
    try:
        result = await service.confirm_download(session_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return ConfirmNotebookLMDownloadResponse(**result)


@router.delete("/notebooklm/sessions/{session_id}")
async def cancel_notebooklm_session(
    session_id: str,
):
    """
    Cancel and delete temp session files.
    Use this if you don't want to save the generated media.
    """
    service = NotebookLMService()
    result = await service.cancel_session(session_id)
    return result
