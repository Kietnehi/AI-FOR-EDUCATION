import asyncio
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
from app.repositories.job_repository import JobRepository
from app.repositories.material_repository import MaterialRepository
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now


class MaterialService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.material_repo = MaterialRepository(db)
        self.job_repo = JobRepository(db)
        self.chunker = TextChunker(chunk_size=settings.chunk_size, overlap=settings.chunk_overlap)
        self.embedder = OpenAIEmbedder()
        self.vector_store = ChromaVectorStore()

    async def create_material(self, payload: dict) -> dict:
        now = utc_now()
        doc = {
            **payload,
            "file_name": None,
            "file_url": None,
            "cleaned_text": TextCleaner.clean(payload.get("raw_text", "")),
            "processing_status": "uploaded",
            "created_at": now,
            "updated_at": now,
        }
        return await self.material_repo.create(doc)

    async def upload_material(self, user_id: str, file: UploadFile, metadata: dict) -> dict:
        extension = Path(file.filename or "").suffix.lower()
        if extension not in {".pdf", ".docx", ".txt", ".md"}:
            raise HTTPException(status_code=400, detail="Unsupported file type")

        file_name = f"{uuid.uuid4().hex}{extension}"
        destination = Path(settings.upload_dir) / file_name
        content = await file.read()
        destination.write_bytes(content)

        raw_text = FileParser.parse(str(destination))
        now = utc_now()
        doc = {
            "user_id": user_id,
            "title": metadata.get("title") or Path(file.filename or "material").stem,
            "description": metadata.get("description"),
            "subject": metadata.get("subject"),
            "education_level": metadata.get("education_level"),
            "source_type": extension.replace(".", ""),
            "file_name": file.filename,
            "file_url": f"/api/files/{file_name}/download",
            "raw_text": raw_text,
            "cleaned_text": TextCleaner.clean(raw_text),
            "tags": metadata.get("tags", []),
            "processing_status": "uploaded",
            "created_at": now,
            "updated_at": now,
        }
        return await self.material_repo.create(doc)

    async def get_material(self, material_id: str) -> dict:
        material = await self.material_repo.get_by_id(parse_object_id(material_id))
        if not material:
            raise HTTPException(status_code=404, detail="Material not found")
        return material

    async def list_materials(self, skip: int, limit: int) -> tuple[list[dict], int]:
        return await self.material_repo.list(skip=skip, limit=limit)

    async def process_material(self, material_id: str, force_reprocess: bool = False) -> None:
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
            material = await self.get_material(material_id)
            if material["processing_status"] == "processed" and not force_reprocess:
                await self.job_repo.update_status(job_id, "skipped", {"reason": "already processed"})
                return

            await self.material_repo.update(
                parse_object_id(material_id),
                {"processing_status": "processing", "updated_at": utc_now()},
            )

            cleaned = TextCleaner.clean(material.get("raw_text", ""))
            chunks = self.chunker.split(cleaned)
            texts = [chunk.chunk_text for chunk in chunks]
            embeddings = self.embedder.embed_texts(texts)

            chunk_ids = [f"{material_id}:{chunk.chunk_index}" for chunk in chunks]
            metadatas = [
                {"material_id": material_id, "chunk_index": chunk.chunk_index}
                for chunk in chunks
            ]

            self.vector_store.delete_material_chunks(material_id)
            self.vector_store.upsert_chunks(
                material_id=material_id,
                chunk_ids=chunk_ids,
                texts=texts,
                embeddings=embeddings,
                metadatas=metadatas,
            )

            mongo_chunks = [
                {
                    "material_id": material_id,
                    "chunk_index": chunk.chunk_index,
                    "chunk_text": chunk.chunk_text,
                    "metadata": {"length": len(chunk.chunk_text)},
                    "chroma_id": chunk_ids[idx],
                    "created_at": utc_now(),
                }
                for idx, chunk in enumerate(chunks)
            ]
            await self.material_repo.replace_chunks(material_id, mongo_chunks)

            await self.material_repo.update(
                parse_object_id(material_id),
                {
                    "cleaned_text": cleaned,
                    "processing_status": "processed",
                    "updated_at": utc_now(),
                },
            )
            await self.job_repo.update_status(job_id, "completed", {"chunk_count": len(chunks)})
            logger.info("Processed material %s with %s chunks", material_id, len(chunks))
        except Exception as exc:  # noqa: BLE001
            await self.material_repo.update(
                parse_object_id(material_id),
                {"processing_status": "failed", "updated_at": utc_now()},
            )
            await self.job_repo.update_status(job_id, "failed", {"error": str(exc)})
            logger.exception("Failed processing material %s", material_id)
            raise

    async def enqueue_process(self, material_id: str, force_reprocess: bool = False) -> None:
        asyncio.create_task(self.process_material(material_id, force_reprocess=force_reprocess))
