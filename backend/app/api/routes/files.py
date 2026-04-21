from hashlib import sha256
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
import mimetypes
from urllib.parse import unquote
import re

<<<<<<< HEAD
from fastapi import APIRouter, Depends, HTTPException
=======
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile, Request
import uuid
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
from fastapi.responses import FileResponse, StreamingResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from app.api.dependencies import get_current_user, get_database
from app.core.config import settings
from app.schemas.auth import AuthUser
from app.services.file_service import FileService
from app.services.storage import storage_service
from app.core.logging import logger

router = APIRouter()


def _remote_cache_dir() -> Path:
    cache_dir = Path(settings.generated_dir) / ".proxy-cache"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir


async def _resolve_remote_file(file_path: str) -> tuple[Path, str]:
    storage_type = storage_service.detect_storage_type(file_path)
    object_name = storage_service.extract_object_name(file_path)
    if not object_name:
        raise RuntimeError(f"Cannot resolve object name from path: {file_path}")

    filename = Path(object_name).name or "download.bin"
    cache_key = sha256(f"{storage_type}:{object_name}".encode("utf-8")).hexdigest()
    cached_path = _remote_cache_dir() / f"{cache_key}_{filename}"

    if not cached_path.exists():
        await storage_service.download_file(
            object_name,
            str(cached_path),
            storage_type=storage_type,
        )

    return cached_path, filename


@router.get("/files/{file_path:path}/download")
async def download_file(
    file_path: str,
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    Download a file from either local storage or MinIO/R2.
    
    file_path can be:
    - Local: filename.ext or podcasts/filename.mp3
    - MinIO/R2: Full URL or object path
    """
    file_path = unquote(file_path)

    # Check if file_path is a MinIO/R2 URL or object path
    if (
        file_path.startswith("http")
        or file_path.startswith(settings.minio_bucket)
        or (settings.r2_bucket and file_path.startswith(settings.r2_bucket))
    ):
        # It's a MinIO/R2 URL - download from storage service
        try:
            cached_path, filename = await _resolve_remote_file(file_path)
            media_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            return FileResponse(
                path=cached_path,
                filename=filename,
                media_type=media_type,
                headers={
                    "Cache-Control": "public, max-age=3600",
                },
            )
        except Exception as e:
            logger.warning("Failed to download from remote storage: %s", e)
            # Try fallback to local if object_name looks like a filename
            try:
                file_path_resolved = FileService.resolve_file_path(file_path.split("/")[-1])
                return FileResponse(
                    path=file_path_resolved,
                    filename=file_path_resolved.name,
                    headers={"Cache-Control": "public, max-age=3600"}
                )
            except Exception:
                raise e
    
    # Local file storage
    file_path_resolved = FileService.resolve_file_path(file_path)
    return FileResponse(
        path=file_path_resolved,
        filename=file_path_resolved.name,
        headers={"Cache-Control": "public, max-age=3600"} # Cache for 1 hour
    )


@router.get("/files/{file_path:path}/preview")
async def preview_file(file_path: str):
    file_path = unquote(file_path)
    media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    if (
        file_path.startswith("http")
        or file_path.startswith(settings.minio_bucket)
        or (settings.r2_bucket and file_path.startswith(settings.r2_bucket))
    ):
        try:
            cached_path, _ = await _resolve_remote_file(file_path)
            return FileResponse(
                path=cached_path,
                media_type=media_type,
                headers={"Cache-Control": "public, max-age=3600"},
            ) 
        except Exception as e:
            logger.warning("Failed to preview from remote storage: %s", e)
            # Try fallback to local
            try:
                file_path_resolved = FileService.resolve_file_path(file_path.split("/")[-1])
                return FileResponse(
                    path=file_path_resolved,
                    media_type=media_type,
                    headers={"Cache-Control": "public, max-age=3600"},
                )
            except Exception:
                raise e

    file_path_resolved = FileService.resolve_file_path(file_path)
    return FileResponse(
        path=file_path_resolved,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
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
<<<<<<< HEAD
=======
@router.post("/files/upload")
async def upload_general_file(
    request: Request,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_database),
):
    """
    General file upload to object storage (R2/MinIO) or local fallback.
    Used for thumbnails, avatars, etc.
    """
    logger.info(f"Upload request received. Cookies: {request.cookies}")
    extension = Path(file.filename).suffix or ".bin"
    unique_filename = f"{uuid.uuid4()}{extension}"
    object_name = f"uploads/general/{unique_filename}"
    
    try:
        # Use storage service to upload
        file_url = await storage_service.upload_file_obj(
            file.file,
            object_name,
            content_type=file.content_type
        )
        return {"file_url": file_url, "filename": unique_filename}
    except Exception as e:
        logger.error(f"Failed to upload file: {e}")
        # Fallback to local storage if remote fails and local is configured as fallback
        # For simplicity in this env, we assume remote should work if configured.
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
