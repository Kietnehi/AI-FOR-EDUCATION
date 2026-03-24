from pydantic import BaseModel


class FileAssetResponse(BaseModel):
    id: str
    owner_type: str
    owner_id: str
    asset_type: str
    file_name: str
    file_path: str
    public_url: str
