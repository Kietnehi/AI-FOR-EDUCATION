from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.services.file_service import FileService

router = APIRouter()


@router.get("/files/{file_name}/download")
async def download_file(file_name: str) -> FileResponse:
    file_path = FileService.resolve_file_path(file_name)
    return FileResponse(path=file_path, filename=file_path.name)
