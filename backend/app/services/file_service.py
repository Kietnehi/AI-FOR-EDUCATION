from pathlib import Path

from bson import ObjectId
from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings
from app.repositories.file_asset_repository import FileAssetRepository
from app.utils.time import utc_now


class FileService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.repo = FileAssetRepository(db)

    async def create_asset(
        self,
        owner_type: str,
        owner_id: str,
        asset_type: str,
        file_name: str,
        file_path: str,
    ) -> dict:
        payload = {
            "owner_type": owner_type,
            "owner_id": owner_id,
            "asset_type": asset_type,
            "file_name": file_name,
            "file_path": file_path,
            "public_url": f"/api/files/{file_name}",
            "created_at": utc_now(),
            "updated_at": utc_now(),
        }
        return await self.repo.create(payload)

    async def get_asset(self, file_id: str) -> dict:
        asset = await self.repo.get_by_id(ObjectId(file_id))
        if not asset:
            raise HTTPException(status_code=404, detail="File asset not found")
        return asset

    @staticmethod
    def resolve_file_path(file_name: str) -> Path:
        candidates = [
            Path(settings.upload_dir) / file_name,
            Path(settings.generated_dir) / file_name,
        ]
        for path in candidates:
            if path.exists():
                return path
        raise HTTPException(status_code=404, detail="File not found on storage")
