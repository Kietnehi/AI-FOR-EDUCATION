from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.file_service import FileService

router = APIRouter()


@router.get("/files/{file_path:path}/download")
async def download_file(file_path: str) -> FileResponse:
    file_path_resolved = FileService.resolve_file_path(file_path)
    return FileResponse(path=file_path_resolved, filename=file_path_resolved.name)
