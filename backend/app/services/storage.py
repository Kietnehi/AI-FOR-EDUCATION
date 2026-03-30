from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO
from urllib.parse import urlparse

import boto3
from botocore.config import Config

from app.core.config import settings


StorageType = str


class StorageService:
    """Storage abstraction supporting local, MinIO, and AWS S3."""

    def __init__(self) -> None:
        # Compatibility flag used by existing startup code.
        self.enabled = settings.use_object_storage
        # settings.use_object_storage is used mainly to decide for NEW uploads
        self.upload_enabled = settings.use_object_storage
        self.use_s3 = settings.use_s3
        self.minio_endpoint = (settings.minio_endpoint or "").rstrip("/")
        self.minio_bucket = settings.minio_bucket
        self.s3_bucket = settings.aws_s3_bucket
        self.s3_region = settings.aws_region
        self.bucket_name = self.s3_bucket if self.use_s3 else self.minio_bucket

        self.minio_client = None
        self.s3_client = None

        # Always try to initialize clients if credentials exist,
        # so we can still manage existing remote files even if upload is disabled.
        if self.minio_endpoint and self.minio_bucket:
            try:
                self.minio_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.minio_root_user,
                    aws_secret_access_key=settings.minio_root_password,
                    endpoint_url=settings.minio_endpoint,
                    config=Config(signature_version="s3v4"),
                )
            except Exception:
                pass

        if self.s3_bucket:
            try:
                self.s3_client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.aws_access_key_id or None,
                    aws_secret_access_key=settings.aws_secret_access_key or None,
                    region_name=settings.aws_region,
                    config=Config(signature_version="s3v4"),
                )
            except Exception:
                pass

    def ensure_bucket_exists(self) -> None:
        for storage_type in ("minio", "s3"):
            client = self._get_client(storage_type)
            bucket_name = self._get_bucket_name(storage_type)
            if client is None or not bucket_name:
                continue
            try:
                client.head_bucket(Bucket=bucket_name)
            except Exception:
                try:
                    client.create_bucket(Bucket=bucket_name)
                except Exception:
                    pass

    def default_storage_type(self) -> str:
        if not self.upload_enabled:
            return "local"
        return "s3" if self.use_s3 else "minio"

    def current_storage_type(self) -> str:
        return self.default_storage_type()

    def resolve_target_storage_type(
        self,
        preferred_storage_type: str | None = None,
        file_url: str | None = None,
    ) -> str:
        normalized = (preferred_storage_type or "").strip().lower()
        if normalized not in {"local", "minio", "s3"}:
            normalized = self.detect_storage_type(file_url)
        if normalized not in {"local", "minio", "s3"}:
            normalized = self.default_storage_type()

        if normalized == "local":
            return "local"

        if not self.upload_enabled:
            return "local"

        if normalized == "s3":
            if self.use_s3 and self.is_storage_available("s3"):
                return "s3"
            return "local"

        if normalized == "minio":
            if not self.use_s3 and self.is_storage_available("minio"):
                return "minio"
            return "local"

        return "local"

    def is_storage_available(self, storage_type: str) -> bool:
        normalized = (storage_type or "").strip().lower()
        if normalized == "local":
            return True
        if normalized == "minio":
            return self.minio_client is not None and bool(self.minio_bucket)
        if normalized == "s3":
            return self.s3_client is not None and bool(self.s3_bucket)
        return False

    def _get_client(self, storage_type: str):
        normalized = (storage_type or "").strip().lower()
        if normalized == "minio":
            return self.minio_client
        if normalized == "s3":
            return self.s3_client
        return None

    def _get_bucket_name(self, storage_type: str) -> str | None:
        normalized = (storage_type or "").strip().lower()
        if normalized == "minio":
            return self.minio_bucket
        if normalized == "s3":
            return self.s3_bucket
        return None

    def _build_object_url(self, object_name: str, storage_type: str | None = None) -> str:
        normalized = self.resolve_target_storage_type(storage_type)
        if normalized == "s3":
            return f"https://{self.s3_bucket}.s3.{self.s3_region}.amazonaws.com/{object_name}"
        if normalized == "minio":
            return f"{self.minio_endpoint}/{self.minio_bucket}/{object_name}"
        raise RuntimeError("Local storage does not have an object URL")

    async def upload_file(
        self,
        file_path: str,
        object_name: str,
        content_type: str | None = None,
        storage_type: str | None = None,
    ) -> str:
        target_storage = self.resolve_target_storage_type(storage_type)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            raise RuntimeError(f"Storage '{target_storage}' is not available for object upload")

        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type
            
        client.upload_file(file_path, bucket_name, object_name, ExtraArgs=extra_args)
        return self._build_object_url(object_name, target_storage)

    async def upload_file_obj(
        self,
        file_obj: BinaryIO,
        object_name: str,
        content_type: str | None = None,
        storage_type: str | None = None,
    ) -> str:
        target_storage = self.resolve_target_storage_type(storage_type)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            raise RuntimeError(f"Storage '{target_storage}' is not available for object upload")

        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type
            
        client.upload_fileobj(file_obj, bucket_name, object_name, ExtraArgs=extra_args)
        return self._build_object_url(object_name, target_storage)

    async def download_file_obj(
        self, 
        object_name: str, 
        storage_type: str | None = None,
        file_url: str | None = None
    ) -> bytes:
        # Auto-resolve storage type from URL if provided
        target_storage = self.resolve_target_storage_type(storage_type, file_url)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            raise RuntimeError(f"Storage '{target_storage}' is not available for object download")

        buffer = io.BytesIO()
        client.download_fileobj(bucket_name, object_name, buffer)
        return buffer.getvalue()

    async def download_file(
        self, 
        object_name: str, 
        output_path: str, 
        storage_type: str | None = None,
        file_url: str | None = None
    ) -> str:
        target_storage = self.resolve_target_storage_type(storage_type, file_url)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            raise RuntimeError(f"Storage '{target_storage}' is not available for object download")

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        client.download_file(bucket_name, object_name, output_path)
        return output_path

    async def delete_file(
        self, 
        object_name: str, 
        storage_type: str | None = None,
        file_url: str | None = None
    ) -> bool:
        target_storage = self.resolve_target_storage_type(storage_type, file_url)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            return False

        try:
            client.delete_object(Bucket=bucket_name, Key=object_name)
            return True
        except Exception:
            return False

    def get_presigned_url(
        self,
        object_name: str,
        expiration: int | None = None,
        storage_type: str | None = None,
        file_url: str | None = None,
    ) -> str:
        target_storage = self.resolve_target_storage_type(storage_type, file_url)
        client = self._get_client(target_storage)
        bucket_name = self._get_bucket_name(target_storage)
        
        if target_storage == "local" or client is None or not bucket_name:
            raise RuntimeError(f"Storage '{target_storage}' is not available for presigned URLs")

        return client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket_name, "Key": object_name},
            ExpiresIn=expiration or settings.storage_presigned_expiration_seconds,
        )

    async def persist_file(
        self,
        file_path: str,
        local_relative_path: str,
        object_name: str,
        content_type: str | None = None,
        preferred_storage_type: str | None = None,
        source_file_url: str | None = None,
    ) -> tuple[str, str]:
        target_storage = self.resolve_target_storage_type(
            preferred_storage_type=preferred_storage_type,
            file_url=source_file_url,
        )
        if target_storage == "local":
            return self.build_local_file_url(local_relative_path), "local"

        try:
            file_url = await self.upload_file(
                file_path=file_path,
                object_name=object_name,
                content_type=content_type,
                storage_type=target_storage,
            )
            return file_url, target_storage
        except Exception:
            return self.build_local_file_url(local_relative_path), "local"

    def detect_storage_type(self, file_url: str | None) -> str:
        if not file_url:
            return "unknown"

        normalized = (file_url or "").strip().lower()
        if not normalized:
            return "unknown"

        if normalized.startswith("/api/files/"):
            return "local"
        if ".amazonaws.com/" in normalized or normalized.startswith("s3://"):
            return "s3"
        if self.minio_endpoint and normalized.startswith(self.minio_endpoint.lower()):
            return "minio"
        
        # Check bucket names in URL
        if self.s3_bucket and f"/{self.s3_bucket.lower()}/" in normalized:
            return "s3"
        if self.minio_bucket and f"/{self.minio_bucket.lower()}/" in normalized:
            return "minio"
            
        # If absolute URL but no match, assume it was one of our remote storages
        if normalized.startswith("http"):
            return "s3" if self.use_s3 else "minio"

        return "local"

    @staticmethod
    def storage_label(storage_type: str | None) -> str:
        mapping = {
            "local": "Local",
            "minio": "MinIO",
            "s3": "S3",
            "none": "Không có file",
            "unknown": "Không rõ",
        }
        return mapping.get((storage_type or "").lower(), "Không rõ")

    @staticmethod
    def build_local_file_url(file_path: str) -> str:
        normalized = file_path.strip().strip("/")
        return f"/api/files/{normalized}/download"

    @staticmethod
    def extract_local_relative_path(file_url: str) -> str | None:
        normalized = (file_url or "").strip()
        if not normalized:
            return None

        parsed = urlparse(normalized)
        path = (parsed.path or normalized).strip("/")
        if not path:
            return None

        if path.startswith("api/files/") and path.endswith("/download"):
            relative_path = path.split("api/files/", 1)[1].rsplit("/download", 1)[0]
            return relative_path.strip("/") or None

        if not parsed.scheme and not normalized.startswith("http"):
            return path.strip("/") or None

        return None

    @staticmethod
    def is_remote_file_url(file_url: str) -> bool:
        return (file_url or "").startswith("http://") or (file_url or "").startswith("https://")

    def extract_object_name(self, file_url: str) -> str | None:
        normalized = (file_url or "").strip()
        if not normalized:
            return None

        parsed = urlparse(normalized)
        path = (parsed.path or normalized).strip("/")
        if not path:
            return None

        for bucket_name in filter(None, [self.minio_bucket, self.s3_bucket]):
            bucket_prefix = f"{bucket_name}/"
            if path.startswith(bucket_prefix):
                path = path[len(bucket_prefix):]
                break

        if "/uploads/" in path:
            return "uploads/" + path.split("/uploads/", 1)[1].strip("/")

        if "/generated/" in path:
            return "generated/" + path.split("/generated/", 1)[1].strip("/")

        if path.startswith("uploads/") or path.startswith("generated/"):
            return path

        if path.startswith("api/files/") and path.endswith("/download"):
            relative_path = path.split("api/files/", 1)[1].rsplit("/download", 1)[0].strip("/")
            if relative_path.startswith("notebooklm/videos/"):
                return "generated/notebooklm/videos/" + relative_path.split("notebooklm/videos/", 1)[1]
            if relative_path.startswith("notebooklm/infographics/"):
                return "generated/notebooklm/infographics/" + relative_path.split("notebooklm/infographics/", 1)[1]
            if relative_path.startswith("podcasts/"):
                return "generated/podcasts/" + relative_path.split("podcasts/", 1)[1]
            if relative_path.startswith("slides/"):
                return "generated/slides/" + relative_path.split("slides/", 1)[1]
            if relative_path.startswith("extracted/"):
                return "generated/slide-images/" + relative_path.split("extracted/", 1)[1]
            return None

        return path


storage_service = StorageService()
