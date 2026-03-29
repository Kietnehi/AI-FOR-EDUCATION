from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO

import boto3
from botocore.config import Config

from app.core.config import settings


class StorageService:
    """S3-compatible storage abstraction for MinIO (dev) and AWS S3 (prod)."""

    def __init__(self) -> None:
        self.use_s3 = settings.use_s3
        self.endpoint_url = None if self.use_s3 else settings.minio_endpoint
        self.bucket_name = settings.aws_s3_bucket if self.use_s3 else settings.minio_bucket

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
        buffer = io.BytesIO()
        self.client.download_fileobj(self.bucket_name, object_name, buffer)
        return buffer.getvalue()

    async def download_file(self, object_name: str, output_path: str) -> str:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        self.client.download_file(self.bucket_name, object_name, output_path)
        return output_path

    async def delete_file(self, object_name: str) -> bool:
        self.client.delete_object(Bucket=self.bucket_name, Key=object_name)
        return True

    def get_presigned_url(self, object_name: str, expiration: int | None = None) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": object_name},
            ExpiresIn=expiration or settings.storage_presigned_expiration_seconds,
        )

    def _build_object_url(self, object_name: str) -> str:
        if self.use_s3:
            return f"https://{self.bucket_name}.s3.{settings.aws_region}.amazonaws.com/{object_name}"
        return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"


storage_service = StorageService()
