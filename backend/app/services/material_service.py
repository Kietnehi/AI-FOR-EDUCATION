import asyncio
import mimetypes
import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.chunking.semantic_chunker import SemanticChunker
from app.ai.chunking.text_chunker import TextChunker
from app.ai.embeddings.openai_embedder import OpenAIEmbedder
from app.ai.ingestion.text_cleaner import TextCleaner
from app.ai.parsing.file_parser import FileParser
from app.ai.parsing.ocr_space_parser import OCRSpaceParser
from app.ai.vector_store.chroma_store import ChromaVectorStore
from app.core.config import settings
from app.core.logging import logger
from app.repositories.chat_repository import ChatRepository
from app.repositories.game_repository import GameRepository
from app.repositories.generated_content_repository import GeneratedContentRepository
from app.repositories.job_repository import JobRepository
from app.repositories.material_repository import MaterialRepository
<<<<<<< HEAD
=======
from app.repositories.user_repository import UserRepository
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
from app.services.groq_speech_service import GroqSpeechToTextService
from app.services.material_guardrail_service import MaterialGuardrailService
from app.services.speech_service import SpeechToTextService
from app.services.storage import storage_service
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now

_SHARED_EMBEDDER = OpenAIEmbedder()
_FIXED_CHUNKER = TextChunker(chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
_SEMANTIC_CHUNKER = SemanticChunker(embedder=_SHARED_EMBEDDER)
_SHARED_VECTOR_STORE = ChromaVectorStore()
_SHARED_GUARDRAIL = MaterialGuardrailService()
_SUPPORTED_TEXT_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
_SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
_SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".m4a",
    ".webm",
    ".ogg",
    ".opus",
    ".aac",
    ".flac",
    ".mpga",
    ".mpeg",
    ".mp4",
}
_SUPPORTED_UPLOAD_EXTENSIONS = (
    _SUPPORTED_TEXT_EXTENSIONS | _SUPPORTED_IMAGE_EXTENSIONS | _SUPPORTED_AUDIO_EXTENSIONS
)
_LOCAL_WHISPER_MODELS = {
    "local-base": "base",
    "local-small": "small",
}
_GROQ_WHISPER_MODELS = {"whisper-large-v3", "whisper-large-v3-turbo"}


def _allowed_extensions_message() -> str:
    ordered = [
        ".pdf",
        ".docx",
        ".txt",
        ".md",
        ".png",
        ".jpg",
        ".jpeg",
        ".webp",
        ".bmp",
        ".mp3",
        ".wav",
        ".m4a",
        ".webm",
        ".ogg",
        ".opus",
        ".aac",
        ".flac",
        ".mpga",
        ".mpeg",
        ".mp4",
    ]
    return f"Unsupported file type. Allowed: {', '.join(ordered)}"


class MaterialService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.material_repo = MaterialRepository(db)
        self.job_repo = JobRepository(db)
        self.chat_repo = ChatRepository(db)
        self.game_repo = GameRepository(db)
        self.generated_repo = GeneratedContentRepository(db)
        self.user_repo = UserRepository(db)
        self.fixed_chunker = _FIXED_CHUNKER
        self.semantic_chunker = _SEMANTIC_CHUNKER
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

    @staticmethod
    def _resolve_upload_extension(file: UploadFile) -> str:
        extension = Path(file.filename or "").suffix.lower()
        if extension in _SUPPORTED_UPLOAD_EXTENSIONS:
            return extension

        content_type = (file.content_type or "").split(";")[0].strip().lower()
        guessed_extension = mimetypes.guess_extension(content_type) if content_type else None
        if guessed_extension == ".oga":
            guessed_extension = ".ogg"
        if guessed_extension and guessed_extension.lower() in _SUPPORTED_UPLOAD_EXTENSIONS:
            return guessed_extension.lower()

        raise HTTPException(status_code=400, detail=_allowed_extensions_message())

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

    async def _transcribe_audio_file(
        self,
        file_path: Path,
        stt_model: str,
        language: str | None,
    ) -> str:
        local_whisper_model = _LOCAL_WHISPER_MODELS.get(stt_model)
        if local_whisper_model:
            service = SpeechToTextService(local_whisper_model)
            transcript = await asyncio.to_thread(
                service.transcribe_file,
                str(file_path),
                language,
            )
            return transcript.strip()

        if stt_model in _GROQ_WHISPER_MODELS:
            if not settings.groq_api_key:
                raise HTTPException(status_code=500, detail="Missing Groq API key")
            groq_service = GroqSpeechToTextService(
                api_key=settings.groq_api_key,
                base_url=settings.groq_base_url,
            )
            transcript = await asyncio.to_thread(
                groq_service.transcribe_file,
                str(file_path),
                stt_model,
                language,
            )
            return transcript.strip()

        raise HTTPException(
            status_code=400,
            detail="Unsupported stt_model. Allowed: local-base, local-small, whisper-large-v3, whisper-large-v3-turbo",
        )

    async def _extract_raw_text_from_file(
        self,
        file_path: Path,
        extension: str,
        metadata: dict | None = None,
    ) -> str:
        metadata = metadata or {}
        if extension in _SUPPORTED_IMAGE_EXTENSIONS:
            ocr_result = await self._parse_image_ocr(file_path)
            return ocr_result["text"]

        if extension in _SUPPORTED_AUDIO_EXTENSIONS:
            stt_model = str(metadata.get("stt_model") or "local-base")
            language_value = metadata.get("whisper_language")
            language = str(language_value).strip() if language_value else None
            transcript = await self._transcribe_audio_file(file_path, stt_model, language)
            if not transcript:
                raise HTTPException(status_code=422, detail="No speech detected")
            return transcript

        return await asyncio.to_thread(FileParser.parse, str(file_path))

    async def _parse_image_ocr(self, file_path: Path) -> dict:
        if not settings.ocr_space_api_key:
            raise HTTPException(
                status_code=400,
                detail="OCR for image files is not configured. Please set OCR_SPACE_API_KEY.",
            )
        try:
            return await asyncio.to_thread(OCRSpaceParser.parse_image, str(file_path))
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Image OCR failed: {exc}",
            ) from exc

    async def preview_image_ocr_upload(self, file: UploadFile) -> dict:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in _SUPPORTED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="Only image files are allowed: .png, .jpg, .jpeg, .webp, .bmp",
            )

        file_name = f"ocr-preview-{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        await self._persist_upload_file(file, destination)

        try:
            ocr_result = await self._parse_image_ocr(destination)
            return {
                "text": ocr_result.get("text", ""),
                "words": ocr_result.get("words", []),
            }
        finally:
            if destination.exists():
                destination.unlink()

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
        extension = self._resolve_upload_extension(file)

        file_name = f"{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        await self._persist_upload_file(file, destination)

        try:
            raw_text = await self._extract_raw_text_from_file(destination, extension, metadata)
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
        source_type = (
            "image"
            if extension in _SUPPORTED_IMAGE_EXTENSIONS
            else "audio"
            if extension in _SUPPORTED_AUDIO_EXTENSIONS
            else extension.replace(".", "")
        )
        doc = {
            "user_id": user_id,
            "title": metadata.get("title") or Path(file.filename or "material").stem,
            "description": metadata.get("description"),
            "subject": metadata.get("subject"),
            "education_level": metadata.get("education_level"),
            "source_type": source_type,
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
        extension = self._resolve_upload_extension(file)

        file_name = f"guardrail-{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        await self._persist_upload_file(file, destination)

        try:
            raw_text = await self._extract_raw_text_from_file(destination, extension, metadata)
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
        
        material["shared_details"] = await self._resolve_shared_details(material.get("shared_with", []))
        return material

<<<<<<< HEAD
    async def list_materials(self, user_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        return await self.material_repo.list_for_user(user_id=user_id, skip=skip, limit=limit)
=======
    async def _resolve_shared_details(self, shared_with_ids: list[str]) -> list[dict]:
        if not shared_with_ids:
            return []
        
        details = []
        for user_id in shared_with_ids:
            try:
                user = await self.user_repo.find_by_id(user_id)
                if user:
                    details.append(user)
            except Exception:
                continue
        return details

    async def list_materials(self, user_id: str, skip: int, limit: int) -> tuple[list[dict], int]:
        items, total = await self.material_repo.list_for_user(user_id=user_id, skip=skip, limit=limit)
        for item in items:
            item["shared_details"] = await self._resolve_shared_details(item.get("shared_with", []))
        return items, total
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66

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
<<<<<<< HEAD
=======
        
        updated["shared_details"] = await self._resolve_shared_details(updated.get("shared_with", []))
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
        return updated

    async def process_material(
        self,
        material_id: str,
        force_reprocess: bool = False,
        user_id: str | None = None,
<<<<<<< HEAD
=======
        chunking_strategy: str = "fixed",
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
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
            
            chunker = self.semantic_chunker if chunking_strategy == "semantic" else self.fixed_chunker
            chunks = chunker.split(cleaned)
            
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
<<<<<<< HEAD
=======
        chunking_strategy: str = "fixed",
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
    ) -> None:
        task = asyncio.create_task(
            self.process_material(
                material_id,
                force_reprocess=force_reprocess,
                user_id=user_id,
<<<<<<< HEAD
=======
                chunking_strategy=chunking_strategy,
>>>>>>> a78aa0fd5a16184ec5ef421650b3c03395164c66
            )
        )
        task.add_done_callback(self._consume_background_exception)

    @staticmethod
    def _consume_background_exception(task: asyncio.Task) -> None:
        try:
            task.result()
        except Exception:
            # process_material already logs and updates job/material status.
            return

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

        # 1. Delete source file from MinIO/R2 or local
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
                        logger.info("Requested deletion from MinIO/R2: %s", object_name)
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

    async def share_material(self, material_id: str, owner_id: str, target_email: str) -> dict:
        material = await self.get_material(material_id, user_id=owner_id)
        if material.get("user_id") != owner_id:
            raise HTTPException(status_code=403, detail="Only material owner can share it")

        target_user = await self.user_repo.find_by_email(target_email)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

        target_user_id = str(target_user.get("id"))
        if target_user_id == owner_id:
            raise HTTPException(status_code=400, detail="Cannot share with yourself")

        shared_with = material.get("shared_with", [])
        if target_user_id in shared_with:
            return material

        shared_with.append(target_user_id)
        updated = await self.material_repo.update(
            parse_object_id(material_id),
            {"shared_with": shared_with, "updated_at": utc_now()},
        )
        if updated:
            updated["shared_details"] = await self._resolve_shared_details(updated.get("shared_with", []))
        return updated or material

    async def unshare_material(self, material_id: str, owner_id: str, target_email: str) -> dict:
        material = await self.get_material(material_id, user_id=owner_id)
        if material.get("user_id") != owner_id:
            raise HTTPException(status_code=403, detail="Only material owner can unshare it")

        target_user = await self.user_repo.find_by_email(target_email)
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")

        target_user_id = str(target_user.get("id"))
        shared_with = material.get("shared_with", [])
        if target_user_id not in shared_with:
            return material

        shared_with.remove(target_user_id)
        updated = await self.material_repo.update(
            parse_object_id(material_id),
            {"shared_with": shared_with, "updated_at": utc_now()},
        )
        if updated:
            updated["shared_details"] = await self._resolve_shared_details(updated.get("shared_with", []))
        return updated or material
