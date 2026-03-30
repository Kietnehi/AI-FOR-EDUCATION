from fastapi import APIRouter
from fastapi.responses import FileResponse, StreamingResponse
import mimetypes

from app.core.config import settings
from app.services.file_service import FileService
from app.services.storage import storage_service

router = APIRouter()


@router.get("/files/{file_path:path}/download")
async def download_file(file_path: str):
    """
    Download a file from either local storage or MinIO/S3.
    
    file_path can be:
    - Local: filename.ext or podcasts/filename.mp3
    - MinIO/S3: Full URL or object path
    """
    # Check if file_path is a MinIO/S3 URL or object path
    if file_path.startswith("http") or file_path.startswith(settings.minio_bucket):
        # It's a MinIO/S3 URL - download from storage service
        try:
            object_name = storage_service.extract_object_name(file_path)
            if not object_name:
                raise RuntimeError(f"Cannot resolve object name from path: {file_path}")
            
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


@router.get("/files/{file_path:path}/preview")
async def preview_file(file_path: str):
    media_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"

    if file_path.startswith("http") or file_path.startswith(settings.minio_bucket):
        object_name = storage_service.extract_object_name(file_path)
        if not object_name:
            raise RuntimeError(f"Cannot resolve object name from path: {file_path}")
        file_bytes = await storage_service.download_file_obj(object_name)
        return StreamingResponse(
            iter([file_bytes]),
            media_type=media_type,
            headers={"Cache-Control": "public, max-age=3600"},
        )

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
