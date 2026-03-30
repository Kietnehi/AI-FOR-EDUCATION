import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.api.dependencies import get_current_user, get_database
from app.core.config import settings
from app.schemas.auth import AuthUser
from app.services.file_service import FileService
from app.services.storage import storage_service

router = APIRouter()


@router.get("/files/{file_path:path}/download")
async def download_file(
    file_path: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Download a file from either local storage or MinIO/S3.
    
    file_path can be:
    - Local: filename.ext or podcasts/filename.mp3
    - MinIO/S3: Full URL or object path
    """
    await _ensure_file_access(db, user.id, file_path)

    # Check if file_path is a MinIO/S3 URL or object path
    if file_path.startswith("http") or file_path.startswith(settings.minio_bucket):
        # It's a MinIO/S3 URL - download from storage service
        try:
            # Extract object name from URL
            if "/uploads/" in file_path:
                object_name = "uploads/" + file_path.split("/uploads/")[-1].replace("/download", "")
            elif "/generated/" in file_path:
                object_name = "generated/" + file_path.split("/generated/")[-1].replace("/download", "")
            elif "/podcasts/" in file_path:
                object_name = "generated/podcasts/" + file_path.split("/podcasts/")[-1].replace("/download", "")
            else:
                object_name = file_path.split("/")[-1].replace("/download", "")
            
            # Download file from MinIO/S3
            file_bytes = await storage_service.download_file_obj(object_name)
            
            # Extract filename for response
            filename = object_name.split("/")[-1]
            
            return StreamingResponse(
                iter([file_bytes]),
                media_type="application/octet-stream",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Cache-Control": "public, max-age=3600",
                }
            )
        except Exception as e:
            logger = None
            try:
                from app.core.logging import logger
                logger.warning("Failed to download from MinIO: %s", e)
            except Exception:
                pass
            raise
    
    # Local file storage
    file_path_resolved = FileService.resolve_file_path(file_path)
    return FileResponse(
        path=file_path_resolved,
        filename=file_path_resolved.name,
        headers={"Cache-Control": "public, max-age=3600"} # Cache for 1 hour
    )


@router.get("/files/notebooklm/temp/{session_id}/{file_type}/{file_name}/preview")
async def preview_temp_file(
    session_id: str,
    file_type: str,
    file_name: str,
    user: AuthUser = Depends(get_current_user),
) -> FileResponse:
    """
    Preview temp file from NotebookLM generation session.
    file_type should be either 'videos' or 'infographics'
    """
    file_path = FileService.resolve_temp_file_path(session_id, file_type, file_name)
    return FileResponse(path=file_path, filename=file_path.name)


async def _ensure_file_access(db: AsyncIOMotorDatabase, user_id: str, file_path: str) -> None:
    normalized = file_path.replace("\\", "/")
    filename = normalized.split("/")[-1]
    escaped_file_path = re.escape(normalized)
    escaped_filename = re.escape(filename)

    material_match = await db.learning_materials.find_one(
        {
            "user_id": user_id,
            "$or": [
                {"file_name": filename},
                {"file_url": {"$regex": escaped_file_path}},
                {"file_url": {"$regex": escaped_filename}},
            ],
        },
        projection={"_id": 1},
    )
    if material_match:
        return

    generated_match = await db.generated_contents.find_one(
        {
            "$or": [
                {"file_url": {"$regex": escaped_file_path}},
                {"file_url": {"$regex": escaped_filename}},
            ],
        },
        projection={"_id": 1, "user_id": 1, "material_id": 1},
    )
    if generated_match:
        if generated_match.get("user_id") == user_id:
            return

        # Backward compatibility: older generated docs might not have user_id.
        legacy_material_id = generated_match.get("material_id")
        if legacy_material_id:
            material_id_query: str | ObjectId = legacy_material_id
            if ObjectId.is_valid(str(legacy_material_id)):
                material_id_query = ObjectId(str(legacy_material_id))
            material_owner = await db.learning_materials.find_one(
                {"_id": material_id_query, "user_id": user_id},
                projection={"_id": 1},
            )
            if material_owner:
                return

    raise HTTPException(status_code=404, detail="File not found")
