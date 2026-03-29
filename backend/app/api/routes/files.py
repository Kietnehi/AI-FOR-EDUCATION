from fastapi import APIRouter
from fastapi.responses import FileResponse, StreamingResponse

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
async def preview_temp_file(session_id: str, file_type: str, file_name: str) -> FileResponse:
    """
    Preview temp file from NotebookLM generation session.
    file_type should be either 'videos' or 'infographics'
    """
    file_path = FileService.resolve_temp_file_path(session_id, file_type, file_name)
    return FileResponse(path=file_path, filename=file_path.name)
