from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.file_service import FileService

router = APIRouter()


@router.get("/files/{file_path:path}/download")
async def download_file(file_path: str) -> FileResponse:
    file_path_resolved = FileService.resolve_file_path(file_path)
    return FileResponse(path=file_path_resolved, filename=file_path_resolved.name)


@router.get("/files/notebooklm/temp/{session_id}/{file_type}/{file_name}/preview")
async def preview_temp_file(session_id: str, file_type: str, file_name: str) -> FileResponse:
    """
    Preview temp file from NotebookLM generation session.
    file_type should be either 'videos' or 'infographics'
    """
    file_path = FileService.resolve_temp_file_path(session_id, file_type, file_name)
    return FileResponse(path=file_path, filename=file_path.name)
