import asyncio
import mimetypes
from pathlib import Path

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.generation.image_fetcher import ImageFetcher
from app.ai.generation.minigame_generator import MinigameGenerator
from app.ai.generation.podcast_generator import PodcastGenerator
from app.ai.generation.slide_generator import SlideGenerator, extract_image_queries
from app.ai.generation.audio_generator import AudioGenerator
from app.ai.parsing.image_extractor import ImageExtractor
from app.ai.parsing.image_matcher import match_images_to_chunk
from app.ai.parsing.text_chunker import split_text_into_chunks
from app.core.config import settings
from app.core.logging import logger
from app.repositories.generated_content_repository import GeneratedContentRepository
from app.services.material_service import MaterialService
from app.services.storage import storage_service
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now

class GenerationService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.db = db
        self.generated_repo = GeneratedContentRepository(db)
        self.material_service = MaterialService(db)
        self.slide_generator = SlideGenerator()
        self.podcast_generator = PodcastGenerator()
        self.minigame_generator = MinigameGenerator()
        self.audio_generator = AudioGenerator(uploads_dir=str(Path(settings.generated_dir) / "podcasts"))
        self.image_fetcher = ImageFetcher()
        self.image_extractor = ImageExtractor()

    async def _next_version(
        self,
        material_id: str,
        content_type: str,
        user_id: str | None = None,
    ) -> int:
        return await self.generated_repo.get_next_version(material_id, content_type, user_id=user_id)

    async def _prepare_material(self, material_id: str, user_id: str | None = None) -> dict:
        """Return the full material document (must be processed)."""
        material = await self.material_service.get_material(material_id, user_id=user_id)
        if material.get("processing_status") != "processed":
            raise HTTPException(status_code=400, detail="Material must be processed before generation")
        return material

    def _get_material_text(self, material: dict) -> str:
        return material.get("cleaned_text") or material.get("raw_text") or ""

    @staticmethod
    def _preferred_storage_type(material: dict) -> str | None:
        return material.get("storage_type")

    @staticmethod
    def _build_local_extracted_image_url(image_path: str) -> str | None:
        try:
            relative_path = Path(image_path).resolve().relative_to(
                Path(settings.image_cache_dir).resolve()
            )
        except ValueError:
            return None
        return storage_service.build_local_file_url(str(relative_path).replace("\\", "/"))

    async def _build_extracted_image_url(
        self,
        image_path: str,
        preferred_storage_type: str | None,
    ) -> str | None:
        local_url = self._build_local_extracted_image_url(image_path)
        if not local_url:
            return None

        if preferred_storage_type == "local":
            return local_url

        try:
            relative_path = Path(image_path).resolve().relative_to(
                Path(settings.image_cache_dir).resolve()
            )
        except ValueError:
            return local_url

        normalized_relative_path = str(relative_path).replace("\\", "/")
        object_name = f"generated/slide-images/{normalized_relative_path}"
        content_type = mimetypes.guess_type(image_path)[0] or "application/octet-stream"

        try:
            return await storage_service.upload_file(
                file_path=image_path,
                object_name=object_name,
                content_type=content_type,
                storage_type=preferred_storage_type,
            )
        except Exception as exc:
            logger.warning("Failed to upload extracted slide image to object storage: %s", exc)
            return local_url

    def _enrich_slide_images(self, outline: dict, image_urls: dict[int, str]) -> dict:
        slides = outline.get("slides", [])
        for slide in slides:
            doc_image_index = slide.get("doc_image_index")
            if doc_image_index is None:
                image_source_id = slide.get("image_source_id")
                if isinstance(image_source_id, str) and image_source_id.startswith("img_"):
                    try:
                        doc_image_index = int(image_source_id.replace("img_", ""))
                    except ValueError:
                        doc_image_index = None

            if not isinstance(doc_image_index, int):
                continue
            image_url = image_urls.get(doc_image_index)
            if not image_url:
                continue

            slide["image_url"] = image_url
            elements = slide.setdefault("elements", [])
            updated = False
            for element in elements:
                if element.get("type") in ("image", "image_source", "doc_image"):
                    element["image_url"] = image_url
                    updated = True
            if not updated:
                elements.append(
                    {
                        "type": "image_source",
                        "image_id": slide.get("image_source_id"),
                        "image_context": "Ảnh từ tài liệu nguồn",
                        "image_url": image_url,
                    }
                )
        return outline

    async def _resolve_source_file(self, material: dict) -> str | None:
        """Return the local file path of the uploaded source document."""
        file_url = material.get("file_url") or ""
        if not file_url:
            return None

        relative_path = storage_service.extract_local_relative_path(file_url)
        if relative_path:
            candidate = Path(settings.upload_dir) / relative_path
            if candidate.exists():
                return str(candidate)

        object_name = storage_service.extract_object_name(file_url)
        if storage_service.enabled and object_name:
            filename = Path(object_name).name
            candidate = Path(settings.upload_dir) / filename
            if candidate.exists():
                return str(candidate)
            try:
                candidate.parent.mkdir(parents=True, exist_ok=True)
                await storage_service.download_file(
                    object_name,
                    str(candidate),
                    storage_type=storage_service.detect_storage_type(file_url),
                )
                logger.info(
                    "Downloaded source file from object storage for slide generation: %s",
                    object_name,
                )
                return str(candidate)
            except Exception as exc:
                logger.warning(
                    "Failed to download source file from object storage for slide generation: %s",
                    exc,
                )
        return None

    @staticmethod
    def _pick_image_source_id(matched_images: list[dict]) -> str | None:
        if not matched_images:
            return None
        image = matched_images[0]
        index = image.get("index")
        if isinstance(index, int) and index >= 0:
            return f"img_{index}"
        return None

    @staticmethod
    def _available_images_metadata(matched_images: list[dict]) -> list[dict]:
        metadata: list[dict] = []
        for item in matched_images:
            index = item.get("index")
            if not isinstance(index, int):
                continue
            metadata.append(
                {
                    "image_id": f"img_{index}",
                    "description": item.get("description") or "",
                    "page": item.get("page"),
                }
            )
        return metadata

    async def generate_slides(
        self,
        material_id: str,
        tone: str,
        max_slides: int,
        skip_refine: bool = False,
        user_id: str | None = None,
        force_regenerate: bool = False,
    ) -> dict:
        if not force_regenerate:
            existing = await self.generated_repo.list_by_material_and_type(
                material_id,
                "slides",
                user_id=user_id,
            )
            if existing:
                # Return the latest version if it exists
                return existing[0]

        material = await self._prepare_material(material_id, user_id=user_id)
        text = self._get_material_text(material)

        source_path = await self._resolve_source_file(material)
        doc_image_paths: list[str] = []
        extracted_images = []
        
        if source_path:
            try:
                extracted_images = self.image_extractor.extract(source_path)
                extracted_images = extracted_images[:10]
                for img in extracted_images:
                    doc_image_paths.append(img.path)
                if extracted_images:
                    logger.info(
                        "Extracted %d images from source document %s",
                        len(extracted_images), Path(source_path).name,
                    )
            except Exception as exc:
                logger.warning("Failed to extract images from source doc: %s", exc)

        # Step 1: Chunk text (heading-aware first, overlap fallback)
        chunks = split_text_into_chunks(text)
        logger.info("Split text into %d chunks.", len(chunks))
        if not chunks:
            chunks = [{"chunk_id": 1, "title": material.get("title", "Nội dung"), "content": text, "page": None}]

        # Step 2: Generate 1-2 slides per chunk until reaching max_slides
        all_slides = []
        for chunk in chunks:
            if len(all_slides) >= max_slides:
                break

            remaining = max_slides - len(all_slides)
            per_chunk_budget = 2 if remaining >= 2 else 1

            # Pass available images metadata to LLM for context
            match_result = match_images_to_chunk(chunk, extracted_images)
            matched_images = match_result.get("matched_images", [])
            available_images = self._available_images_metadata(matched_images)

            chunk_slides = self.slide_generator.generate_from_chunk(
                chunk=chunk,
                tone=tone,
                slide_budget=per_chunk_budget,
                available_images=available_images,
            )

            # Match images to EACH SLIDE individually (not the whole chunk)
            for slide in chunk_slides:
                if not matched_images:
                    continue

                # Create a "mini-chunk" from slide content to find best matching image
                slide_text = f"{slide.get('title', '')}\n" + "\n".join(slide.get('bullets', []))
                slide_chunk = {
                    "title": slide.get("title", ""),
                    "content": slide_text,
                    "page": chunk.get("page")  # Inherit page from parent chunk
                }

                slide_match = match_images_to_chunk(slide_chunk, extracted_images)
                slide_matched = slide_match.get("matched_images", [])

                if slide_matched:
                    best_image = slide_matched[0]
                    image_index = best_image.get("index")
                    if isinstance(image_index, int) and image_index >= 0:
                        slide["image_source_id"] = f"img_{image_index}"
                        slide["doc_image_index"] = image_index
                        page_dist = best_image.get("page_distance")
                        logger.info(
                            "Matched image %d (score=%.2f, page_dist=%s) to slide '%s' (page=%s)",
                            image_index,
                            best_image.get("score", 0),
                            page_dist if page_dist is not None else "N/A",
                            slide.get("title", ""),
                            chunk.get("page", "N/A")
                        )

            all_slides.extend(chunk_slides)

        # Step 3: LLM refine pass (deduplicate + ordering + quality)
        # For cost optimization: set skip_refine=True to skip this step
        if skip_refine:
            logger.info("Skipping refine step for cost optimization - using %d raw slides.", len(all_slides))
            # Convert to legacy format directly
            final_slides = [self.slide_generator._to_legacy_slide_model(slide, idx) for idx, slide in enumerate(all_slides[:max_slides])]
            outline = {
                "title": material.get("title", "Bài giảng tổng hợp"),
                "slides": final_slides
            }
        else:
            logger.info("Refining %d generated slides...", len(all_slides))
            outline = self.slide_generator.refine_slides(
                slides=all_slides,
                presentation_title=material.get("title", "Bài giảng tổng hợp"),
                max_slides=max_slides
            )

        image_urls: dict[int, str] = {}
        for index, image_path in enumerate(doc_image_paths):
            image_url = await self._build_extracted_image_url(
                image_path,
                self._preferred_storage_type(material),
            )
            if image_url:
                image_urls[index] = image_url

        outline = self._enrich_slide_images(outline, image_urls)

        # Step 4: Skip external image fetching - only use document images
        image_map: dict[str, str | None] = {}
        logger.info("Using document images only - external image fetching disabled for cost optimization.")

        # Step 5: Export PPTX with priority: doc image -> Pexels -> placeholder
        version = await self._next_version(material_id, "slides", user_id=user_id)
        filename = f"slides_{material_id}_v{version}.pptx"
        output_path = str(Path(settings.generated_dir) / filename)
        self.slide_generator.export_pptx(
            outline,
            output_path,
            image_map=image_map,
            doc_image_paths=doc_image_paths,
        )

        # Step 6: Persist generated file according to storage mode
        preferred_storage_type = self._preferred_storage_type(material)
        file_url, storage_type = await storage_service.persist_file(
            file_path=output_path,
            local_relative_path=filename,
            object_name=f"generated/slides/{filename}",
            content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
            preferred_storage_type=preferred_storage_type,
            source_file_url=material.get("file_url"),
        )

        # Step 7: Persist without changing schema
        llm = getattr(self.slide_generator, "llm", None)
        model_used = getattr(llm, "last_model_used", None) if llm else None
        fallback_applied = getattr(llm, "fallback_used", False) if llm else False
        now = utc_now()
        doc = {
            "user_id": material.get("user_id"),
            "material_id": material_id,
            "content_type": "slides",
            "version": version,
            "outline": [item.get("title", "") for item in outline.get("slides", [])],
            "json_content": {"tone": tone, **outline},
            "file_url": file_url,
            "storage_type": storage_type,
            "generation_status": "generated",
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_podcast(
        self,
        material_id: str,
        style: str,
        target_duration_minutes: int,
        user_id: str | None = None,
        force_regenerate: bool = False,
    ) -> dict:
        if not force_regenerate:
            existing = await self.generated_repo.list_by_material_and_type(
                material_id,
                "podcast",
                user_id=user_id,
            )
            if existing:
                return existing[0]

        material = await self._prepare_material(material_id, user_id=user_id)
        text = self._get_material_text(material)
        script, version = await asyncio.gather(
            asyncio.to_thread(
                self.podcast_generator.generate_script,
                text,
                style=style,
                target_duration_minutes=target_duration_minutes,
            ),
            self._next_version(material_id, "podcast", user_id=user_id),
        )
        llm = getattr(self.podcast_generator, "llm", None)
        model_used = getattr(llm, "last_model_used", None) if llm else None
        fallback_applied = getattr(llm, "fallback_used", False) if llm else False

        # Generate audio file from podcast segments
        audio_filename = f"podcast_{material_id}_v{version}"
        segments = script.get("segments", [])
        audio_file_path = None
        audio_url = None

        if segments:
            try:
                audio_file_path = await asyncio.to_thread(
                    self.audio_generator.generate_podcast_audio,
                    segments=segments,
                    output_filename=audio_filename,
                )
                # Persist podcast file according to storage mode
                audio_url, storage_type = await storage_service.persist_file(
                    file_path=audio_file_path,
                    local_relative_path=f"podcasts/{audio_filename}.mp3",
                    object_name=f"generated/podcasts/{audio_filename}.mp3",
                    content_type="audio/mpeg",
                    preferred_storage_type=self._preferred_storage_type(material),
                    source_file_url=material.get("file_url"),
                )
            except Exception as e:
                # Log error but don't fail the entire generation
                logger.warning("Failed to generate audio for podcast: %s", e)

        storage_type = storage_service.detect_storage_type(audio_url) if audio_url else "none"

        now = utc_now()
        doc = {
            "user_id": material.get("user_id"),
            "material_id": material_id,
            "content_type": "podcast",
            "version": version,
            "outline": [segment.get("text", "")[:80] for segment in segments[:5]],
            "json_content": script,
            "file_url": audio_url,
            "storage_type": storage_type,
            "generation_status": "generated",
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_minigame(
        self,
        material_id: str,
        game_type: str = "quiz_mixed",
        user_id: str | None = None,
        force_regenerate: bool = False,
    ) -> dict:
        if not force_regenerate:
            existing = await self.generated_repo.list_by_material_and_type(
                material_id,
                "minigame",
                user_id=user_id,
            )
            if existing:
                # Return the same game type if possible or just the latest
                for item in existing:
                    if item.get("game_type") == game_type:
                        return item
                return existing[0]

        material = await self._prepare_material(material_id, user_id=user_id)
        text = self._get_material_text(material)
        valid_game_types = {"quiz_mixed", "flashcard", "shooting_quiz"}
        selected_game_type = game_type if game_type in valid_game_types else "quiz_mixed"
        game_payload, version = await asyncio.gather(
            asyncio.to_thread(
                self.minigame_generator.generate,
                text,
                game_type=selected_game_type,
            ),
            self._next_version(material_id, "minigame", user_id=user_id),
        )
        llm = getattr(self.minigame_generator, "llm", None)
        model_used = getattr(llm, "last_model_used", None) if llm else None
        fallback_applied = getattr(llm, "fallback_used", False) if llm else False

        outline: list[str] = []
        if isinstance(game_payload, dict):
            items = game_payload.get("items")
            if isinstance(items, list):
                for item in items[:5]:
                    if not isinstance(item, dict):
                        continue
                    snippet = item.get("question") or item.get("front") or item.get("scenario") or item.get("text")
                    if isinstance(snippet, str) and snippet.strip():
                        outline.append(snippet.strip()[:80])
            if not outline:
                title = game_payload.get("title")
                if isinstance(title, str) and title.strip():
                    outline = [title.strip()[:80]]

        now = utc_now()
        doc = {
            "user_id": material.get("user_id"),
            "material_id": material_id,
            "content_type": "minigame",
            "game_type": selected_game_type,
            "version": version,
            "outline": outline,
            "json_content": game_payload,
            "file_url": None,
            "storage_type": "none",
            "generation_status": "generated",
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def delete_generated_content(
        self, content_id: str, user_id: str | None = None
    ) -> bool:
        content_object_id = parse_object_id(content_id)
        content = await self.get_generated_content(content_id, user_id=user_id)
        if not content:
            return False

        # If it has a file_url, we might want to delete the file too
        file_url = content.get("file_url")
        if file_url:
            object_name = storage_service.extract_object_name(file_url)
            if object_name:
                try:
                    await storage_service.delete_file(
                        object_name,
                        storage_type=storage_service.detect_storage_type(file_url),
                    )
                except Exception as exc:
                    logger.warning("Failed to delete file from storage: %s", exc)

        # Use delete_one on the collection directly since repo doesn't have delete_by_id
        result = await self.db.generated_contents.delete_one({"_id": content_object_id})
        return result.deleted_count > 0

    async def list_generated_contents(
        self, material_id: str, content_type: str | None = None, user_id: str | None = None
    ) -> list[dict]:
        if content_type:
            return await self.generated_repo.list_by_material_and_type(
                material_id,
                content_type,
                user_id=user_id,
            )
        if user_id:
            return await self.generated_repo.list_by_material_id_for_user(material_id, user_id)
        return await self.generated_repo.list_by_material_id(material_id)

    async def get_generated_content(
        self, content_id: str, user_id: str | None = None
    ) -> dict:
        content_object_id = parse_object_id(content_id)
        if user_id:
            result = await self.generated_repo.get_by_id_for_user(content_object_id, user_id)
            if not result:
                legacy_result = await self.generated_repo.get_by_id(content_object_id)
                if legacy_result:
                    material_id = legacy_result.get("material_id")
                    if material_id:
                        await self.material_service.get_material(material_id, user_id=user_id)
                        result = legacy_result
        else:
            result = await self.generated_repo.get_by_id(content_object_id)
        if not result:
            raise HTTPException(status_code=404, detail="Generated content not found")
        return result
