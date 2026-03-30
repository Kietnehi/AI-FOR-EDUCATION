from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO
from urllib.parse import urlparse

import boto3
from botocore.config import Config

from app.core.config import settings


class StorageService:
    """S3-compatible storage abstraction for MinIO (dev) and AWS S3 (prod)."""

    def __init__(self) -> None:
        self.enabled = settings.use_object_storage
        self.use_s3 = settings.use_s3
        self.endpoint_url = None if self.use_s3 else settings.minio_endpoint
        self.bucket_name = settings.aws_s3_bucket if self.use_s3 else settings.minio_bucket
        self.client = None

        if not self.enabled:
            return

        if self.use_s3:
            self.client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id or None,
                aws_secret_access_key=settings.aws_secret_access_key or None,
                region_name=settings.aws_region,
                config=Config(signature_version="s3v4"),
            )
        else:
            self.client = boto3.client(
                "s3",
                aws_access_key_id=settings.minio_root_user,
                aws_secret_access_key=settings.minio_root_password,
                endpoint_url=settings.minio_endpoint,
                config=Config(signature_version="s3v4"),
            )

    def ensure_bucket_exists(self) -> None:
        if not self.enabled or self.client is None:
            return
        try:
            self.client.head_bucket(Bucket=self.bucket_name)
        except Exception:
            self.client.create_bucket(Bucket=self.bucket_name)

    async def upload_file(
        self,
        file_path: str,
        object_name: str,
        content_type: str | None = None,
    ) -> str:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type
        if extra_args:
            self.client.upload_file(
                file_path,
                self.bucket_name,
                object_name,
                ExtraArgs=extra_args,
            )
        else:
            self.client.upload_file(file_path, self.bucket_name, object_name)
        return self._build_object_url(object_name)

    async def upload_file_obj(
        self,
        file_obj: BinaryIO,
        object_name: str,
        content_type: str | None = None,
    ) -> str:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        extra_args: dict[str, str] = {}
        if content_type:
            extra_args["ContentType"] = content_type
        if extra_args:
            self.client.upload_fileobj(
                file_obj,
                self.bucket_name,
                object_name,
                ExtraArgs=extra_args,
            )
        else:
            self.client.upload_fileobj(file_obj, self.bucket_name, object_name)
        return self._build_object_url(object_name)

    async def download_file_obj(self, object_name: str) -> bytes:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        buffer = io.BytesIO()
        self.client.download_fileobj(self.bucket_name, object_name, buffer)
        return buffer.getvalue()

    async def download_file(self, object_name: str, output_path: str) -> str:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self.client.download_file(self.bucket_name, object_name, output_path)
        return output_path

    async def delete_file(self, object_name: str) -> bool:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        self.client.delete_object(Bucket=self.bucket_name, Key=object_name)
        return True

    def get_presigned_url(self, object_name: str, expiration: int | None = None) -> str:
        if not self.enabled or self.client is None:
            raise RuntimeError("Object storage is disabled")
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": object_name},
            ExpiresIn=expiration or settings.storage_presigned_expiration_seconds,
        )

    def _build_object_url(self, object_name: str) -> str:
        if self.use_s3:
            return f"https://{self.bucket_name}.s3.{settings.aws_region}.amazonaws.com/{object_name}"
        return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"

    def current_storage_type(self) -> str:
        if not self.enabled:
            return "local"
        return "s3" if self.use_s3 else "minio"

    def detect_storage_type(self, file_url: str | None) -> str:
        if not file_url:
            return self.current_storage_type()

        normalized = (file_url or "").strip().lower()
        if not normalized:
            return self.current_storage_type()

        if normalized.startswith("/api/files/"):
            return "local"
        if ".amazonaws.com/" in normalized or normalized.startswith("s3://"):
            return "s3"
        if settings.minio_endpoint and settings.minio_endpoint.lower() in normalized:
            return "minio"
        if self.bucket_name and f"/{self.bucket_name.lower()}/" in normalized:
            return "s3" if self.use_s3 else "minio"
        return self.current_storage_type()

    @staticmethod
    def storage_label(storage_type: str | None) -> str:
        mapping = {
            "local": "Local",
            "minio": "MinIO",
            "s3": "S3",
            "none": "Không có file",
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

        bucket_prefix = f"{self.bucket_name}/" if self.bucket_name else ""
        if bucket_prefix and path.startswith(bucket_prefix):
            path = path[len(bucket_prefix):]

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
            return None

        return path


storage_service = StorageService()
