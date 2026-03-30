from hashlib import sha256
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse
import mimetypes
from urllib.parse import unquote

from app.core.config import settings
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
async def download_file(file_path: str):
    """
    Download a file from either local storage or MinIO/S3.
    
    file_path can be:
    - Local: filename.ext or podcasts/filename.mp3
    - MinIO/S3: Full URL or object path
    """
    file_path = unquote(file_path)

    # Check if file_path is a MinIO/S3 URL or object path
    if file_path.startswith("http") or file_path.startswith(settings.minio_bucket):
        # It's a MinIO/S3 URL - download from storage service
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

    if file_path.startswith("http") or file_path.startswith(settings.minio_bucket):
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
async def preview_temp_file(session_id: str, file_type: str, file_name: str) -> FileResponse:
    """
    Preview temp file from NotebookLM generation session.
    file_type should be either 'videos' or 'infographics'
    """
    file_path = FileService.resolve_temp_file_path(session_id, file_type, file_name)
    return FileResponse(path=file_path, filename=file_path.name)
