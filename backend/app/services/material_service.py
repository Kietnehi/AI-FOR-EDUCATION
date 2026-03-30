import asyncio
import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.chunking.text_chunker import TextChunker
from app.ai.embeddings.openai_embedder import OpenAIEmbedder
from app.ai.ingestion.text_cleaner import TextCleaner
from app.ai.parsing.file_parser import FileParser
from app.ai.vector_store.chroma_store import ChromaVectorStore
from app.core.config import settings
from app.core.logging import logger
from app.repositories.chat_repository import ChatRepository
from app.repositories.game_repository import GameRepository
from app.repositories.generated_content_repository import GeneratedContentRepository
from app.repositories.job_repository import JobRepository
from app.repositories.material_repository import MaterialRepository
from app.services.material_guardrail_service import MaterialGuardrailService
from app.services.storage import storage_service
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now

_SHARED_CHUNKER = TextChunker(
    chunk_size=settings.chunk_size, overlap=settings.chunk_overlap
)
_SHARED_EMBEDDER = OpenAIEmbedder()
_SHARED_VECTOR_STORE = ChromaVectorStore()
_SHARED_GUARDRAIL = MaterialGuardrailService()


class MaterialService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.material_repo = MaterialRepository(db)
        self.job_repo = JobRepository(db)
        self.chat_repo = ChatRepository(db)
        self.game_repo = GameRepository(db)
        self.generated_repo = GeneratedContentRepository(db)
        self.chunker = _SHARED_CHUNKER
        self.embedder = _SHARED_EMBEDDER
        self.vector_store = _SHARED_VECTOR_STORE
        self.guardrail = _SHARED_GUARDRAIL

    @staticmethod
    async def _persist_upload_file(file: UploadFile, destination: Path) -> None:
        destination.parent.mkdir(parents=True, exist_ok=True)
        await file.seek(0)

        def _copy_file() -> None:
            with destination.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        await asyncio.to_thread(_copy_file)

    async def create_material(self, payload: dict) -> dict:
        decision = self.guardrail.assert_allowed(
            raw_text=payload.get("raw_text", ""),
            title=payload.get("title"),
            subject=payload.get("subject"),
            description=payload.get("description"),
            source_name=payload.get("title"),
        )
        now = utc_now()
        doc = {
            **payload,
            "file_name": None,
            "file_url": None,
            "cleaned_text": TextCleaner.clean(payload.get("raw_text", "")),
            "processing_status": "uploaded",
            "guardrail_status": "approved",
            "guardrail_category": decision.category,
            "guardrail_reason": decision.reason,
            "guardrail_checked_at": now,
            "created_at": now,
            "updated_at": now,
        }
        return await self.material_repo.create(doc)

    async def check_material_guardrail(self, payload: dict) -> dict:
        decision = self.guardrail.evaluate(
            raw_text=payload.get("raw_text", ""),
            title=payload.get("title"),
            subject=payload.get("subject"),
            description=payload.get("description"),
            source_name=payload.get("title"),
        )
        return {
            "is_academic": decision.is_academic,
            "category": decision.category,
            "message": decision.reason,
        }

    async def upload_material(
        self, user_id: str, file: UploadFile, metadata: dict
    ) -> dict:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in {".pdf", ".docx", ".txt", ".md"}:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        file_name = f"{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        await self._persist_upload_file(file, destination)

        try:
            raw_text = await asyncio.to_thread(FileParser.parse, str(destination))
            decision = self.guardrail.assert_allowed(
                raw_text=raw_text,
                title=metadata.get("title") or Path(file.filename or "material").stem,
                subject=metadata.get("subject"),
                description=metadata.get("description"),
                source_name=file.filename,
            )
        except Exception:
            if destination.exists():
                destination.unlink()
            raise

        file_url, storage_type = await storage_service.persist_file(
            file_path=str(destination),
            local_relative_path=file_name,
            object_name=f"uploads/{file_name}",
            content_type=file.content_type or "application/octet-stream",
            preferred_storage_type=storage_service.default_storage_type(),
        )

        now = utc_now()
        doc = {
            "user_id": user_id,
            "title": metadata.get("title") or Path(file.filename or "material").stem,
            "description": metadata.get("description"),
            "subject": metadata.get("subject"),
            "education_level": metadata.get("education_level"),
            "source_type": extension.replace(".", ""),
            "file_name": file.filename,
            "file_url": file_url,
            "storage_type": storage_type,
            "raw_text": raw_text,
            "cleaned_text": TextCleaner.clean(raw_text),
            "tags": metadata.get("tags", []),
            "processing_status": "uploaded",
            "guardrail_status": "approved",
            "guardrail_category": decision.category,
            "guardrail_reason": decision.reason,
            "guardrail_checked_at": now,
            "created_at": now,
            "updated_at": now,
        }
        return await self.material_repo.create(doc)

    async def check_upload_guardrail(self, file: UploadFile, metadata: dict) -> dict:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in {".pdf", ".docx", ".txt", ".md"}:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        file_name = f"guardrail-{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        await self._persist_upload_file(file, destination)

        try:
            raw_text = await asyncio.to_thread(FileParser.parse, str(destination))
            decision = self.guardrail.evaluate(
                raw_text=raw_text,
                title=metadata.get("title") or Path(file.filename or "material").stem,
                subject=metadata.get("subject"),
                description=metadata.get("description"),
                source_name=file.filename,
            )
        finally:
            if destination.exists():
                destination.unlink()

        return {
            "is_academic": decision.is_academic,
            "category": decision.category,
            "message": decision.reason,
        }

    async def get_material(self, material_id: str, user_id: str | None = None) -> dict:
        material_object_id = parse_object_id(material_id)
        if user_id:
            material = await self.material_repo.get_by_id_for_user(material_object_id, user_id)
        else:
            material = await self.material_repo.get_by_id(material_object_id)
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        return material

    async def list_materials(self, user_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        return await self.material_repo.list_for_user(user_id=user_id, skip=skip, limit=limit)

    async def update_material(
        self,
        material_id: str,
        user_id: str,
        update_fields: dict,
    ) -> dict:
        if not update_fields:
            return await self.get_material(material_id, user_id=user_id)

        material = await self.get_material(material_id, user_id=user_id)

        allowed_fields = {"title", "description", "subject", "education_level", "tags"}
        sanitized_updates = {
            key: value for key, value in update_fields.items() if key in allowed_fields
        }

        if not sanitized_updates:
            return material

        sanitized_updates["updated_at"] = utc_now()
        updated = await self.material_repo.update(
            parse_object_id(material_id),
            sanitized_updates,
        )
        if not updated:
            raise HTTPException(status_code=404, detail="Material not found")
        return updated

    async def process_material(
        self,
        material_id: str,
        force_reprocess: bool = False,
        user_id: str | None = None,
    ) -> None:
        material_object_id = parse_object_id(material_id)
        job_id = uuid.uuid4().hex
        await self.job_repo.create(
            {
                "job_id": job_id,
                "job_type": "material_process",
                "material_id": material_id,
                "status": "started",
                "created_at": utc_now(),
            }
        )

        try:
            material = await self.get_material(material_id, user_id=user_id)
            await self._ensure_guardrail_approved(material_id, material)
            if material["processing_status"] == "processed" and not force_reprocess:
                await self.job_repo.update_status(
                    job_id, "skipped", {"reason": "already processed"}
                )
                return

            await self.material_repo.update(
                material_object_id,
                {"processing_status": "processing", "updated_at": utc_now()},
            )

            cleaned = TextCleaner.clean(material.get("raw_text", ""))
            chunks = self.chunker.split(cleaned)
            texts = [chunk.chunk_text for chunk in chunks]
            embeddings = await asyncio.to_thread(self.embedder.embed_texts, texts)

            chunk_ids = [f"{material_id}:{chunk.chunk_index}" for chunk in chunks]
            metadatas = [
                {"material_id": material_id, "chunk_index": chunk.chunk_index}
                for chunk in chunks
            ]

            await asyncio.to_thread(self.vector_store.delete_material_chunks, material_id)
            await asyncio.to_thread(
                self.vector_store.upsert_chunks,
                material_id=material_id,
                chunk_ids=chunk_ids,
                texts=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )

            chunk_created_at = utc_now()
            mongo_chunks = [
                {
                    "material_id": material_id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_text": chunk.chunk_text,
                    "metadata": {"length": len(chunk.chunk_text)},
                    "chroma_id": chunk_ids[idx],
                    "created_at": chunk_created_at,
                }
                for idx, chunk in enumerate(chunks)
            ]
            await self.material_repo.replace_chunks(material_id, mongo_chunks)

            completed_at = utc_now()
            await self.material_repo.update(
                material_object_id,
                {
                    "cleaned_text": cleaned,
                    "processing_status": "processed",
                    "updated_at": completed_at,
                },
            )
            await self.job_repo.update_status(
                job_id, "completed", {"chunk_count": len(chunks)}
            )
            logger.info(
                "Processed material %s with %s chunks", material_id, len(chunks)
            )
        except Exception as exc:  # noqa: BLE001
            await self.material_repo.update(
                material_object_id,
                {"processing_status": "failed", "updated_at": utc_now()},
            )
            await self.job_repo.update_status(job_id, "failed", {"error": str(exc)})
            logger.exception("Failed processing material %s", material_id)
            raise

    async def enqueue_process(
        self,
        material_id: str,
        force_reprocess: bool = False,
        user_id: str | None = None,
    ) -> None:
        asyncio.create_task(
            self.process_material(
                material_id,
                force_reprocess=force_reprocess,
                user_id=user_id,
            )
        )

    async def _ensure_guardrail_approved(
        self, material_id: str, material: dict
    ) -> None:
        if material.get("guardrail_status") == "approved":
            return

        decision = self.guardrail.assert_allowed(
            raw_text=material.get("raw_text", ""),
            title=material.get("title"),
            subject=material.get("subject"),
            description=material.get("description"),
            source_name=material.get("file_name") or material.get("title"),
        )
        await self.material_repo.update(
            parse_object_id(material_id),
            {
                "guardrail_status": "approved",
                "guardrail_category": decision.category,
                "guardrail_reason": decision.reason,
                "guardrail_checked_at": utc_now(),
                "updated_at": utc_now(),
            },
        )

    async def delete_material(self, material_id: str, user_id: str | None = None) -> bool:
        material = await self.get_material(material_id, user_id=user_id)

        # 1. Delete Source File from MinIO/S3 or Local
        if material.get("file_url"):
            try:
                file_url = material["file_url"]

                relative_path = storage_service.extract_local_relative_path(file_url)
                if relative_path:
                    local_path = Path(settings.upload_dir) / relative_path
                    if local_path.exists():
                        local_path.unlink()
                        logger.info("Deleted source file from local storage: %s", local_path)

                if storage_service.is_remote_file_url(file_url):
                    object_name = storage_service.extract_object_name(file_url)
                    if object_name:
                        await storage_service.delete_file(object_name)
                        logger.info("Requested deletion from MinIO/S3: %s", object_name)
            except Exception as e:
                logger.warning(
                    "Soft failure deleting source file for material %s: %s", material_id, e
                )

        # 2. Delete Generated Content Files
        try:
            generated_items = await self.generated_repo.list_by_material_id(material_id)
            for item in generated_items:
                if item.get("file_url"):
                    file_url = item["file_url"]

                    relative_path = storage_service.extract_local_relative_path(file_url)
                    if relative_path:
                        local_gen_path = Path(settings.generated_dir) / relative_path
                        if local_gen_path.exists():
                            local_gen_path.unlink()

                    if storage_service.is_remote_file_url(file_url):
                        object_name = storage_service.extract_object_name(file_url)
                        if object_name:
                            await storage_service.delete_file(object_name)
        except Exception as e:
            logger.warning(
                "Soft failure deleting generated files for material %s: %s", material_id, e
            )

        # 3. Delete from Vector Store (ChromaDB)
        try:
            await asyncio.to_thread(self.vector_store.delete_material_chunks, material_id)
        except Exception as e:
            logger.warning(
                "Failed to delete vector embeddings for material %s: %s", material_id, e
            )

        # 4. Delete from MongoDB Collections
        await self.material_repo.delete(parse_object_id(material_id))
        await self.chat_repo.delete_by_material_id(material_id)
        await self.generated_repo.delete_by_material_id(material_id)
        await self.game_repo.delete_by_material_id(material_id)
        await self.job_repo.delete_many({"material_id": material_id})

        return True
