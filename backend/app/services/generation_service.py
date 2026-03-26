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

    async def _next_version(self, material_id: str, content_type: str) -> int:
        existing = await self.generated_repo.list_by_material_and_type(material_id, content_type)
        if not existing:
            return 1
        return max(item.get("version", 1) for item in existing) + 1

    async def _prepare_material(self, material_id: str) -> dict:
        """Return the full material document (must be processed)."""
        material = await self.material_service.get_material(material_id)
        if material.get("processing_status") != "processed":
            raise HTTPException(status_code=400, detail="Material must be processed before generation")
        return material

    def _get_material_text(self, material: dict) -> str:
        return material.get("cleaned_text") or material.get("raw_text") or ""

    def _resolve_source_file(self, material: dict) -> str | None:
        """Return the local file path of the uploaded source document."""
        file_url = material.get("file_url") or ""
        if not file_url:
            return None
        # file_url looks like /api/files/{filename}/download
        parts = file_url.strip("/").split("/")
        # Expected: api / files / {filename} / download
        if len(parts) >= 3:
            filename = parts[2]  # the stored filename (uuid + ext)
            candidate = Path(settings.upload_dir) / filename
            if candidate.exists():
                return str(candidate)
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

    async def generate_slides(self, material_id: str, tone: str, max_slides: int, skip_refine: bool = False) -> dict:
        material = await self._prepare_material(material_id)
        text = self._get_material_text(material)

        source_path = self._resolve_source_file(material)
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

        # Step 4: Skip external image fetching - only use document images
        image_map: dict[str, str | None] = {}
        logger.info("Using document images only - external image fetching disabled for cost optimization.")

        # Step 5: Export PPTX with priority: doc image -> Pexels -> placeholder
        version = await self._next_version(material_id, "slides")
        filename = f"slides_{material_id}_v{version}.pptx"
        output_path = str(Path(settings.generated_dir) / filename)
        self.slide_generator.export_pptx(
            outline,
            output_path,
            image_map=image_map,
            doc_image_paths=doc_image_paths,
        )

        # Step 6: Persist without changing schema
        now = utc_now()
        doc = {
            "material_id": material_id,
            "content_type": "slides",
            "version": version,
            "outline": [item.get("title", "") for item in outline.get("slides", [])],
            "json_content": {"tone": tone, **outline},
            "file_url": f"/api/files/{filename}/download",
            "generation_status": "generated",
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_podcast(self, material_id: str, style: str, target_duration_minutes: int) -> dict:
        material = await self._prepare_material(material_id)
        text = self._get_material_text(material)
        script = self.podcast_generator.generate_script(text, style=style, target_duration_minutes=target_duration_minutes)
        version = await self._next_version(material_id, "podcast")

        # Generate audio file from podcast segments
        audio_filename = f"podcast_{material_id}_v{version}"
        segments = script.get("segments", [])
        audio_file_path = None
        audio_url = None

        if segments:
            try:
                audio_file_path = self.audio_generator.generate_podcast_audio(
                    segments=segments,
                    output_filename=audio_filename
                )
                # Create URL for serving the audio file
                audio_url = f"/api/files/podcasts/{audio_filename}.mp3/download"
            except Exception as e:
                # Log error but don't fail the entire generation
                print(f"Warning: Failed to generate audio for podcast: {e}")

        now = utc_now()
        doc = {
            "material_id": material_id,
            "content_type": "podcast",
            "version": version,
            "outline": [segment.get("text", "")[:80] for segment in segments[:5]],
            "json_content": script,
            "file_url": audio_url,
            "generation_status": "generated",
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_minigame(self, material_id: str, game_types: list[str]) -> dict:
        material = await self._prepare_material(material_id)
        text = self._get_material_text(material)
        game_payload = self.minigame_generator.generate(text, game_types=game_types)
        version = await self._next_version(material_id, "minigame")

        now = utc_now()
        doc = {
            "material_id": material_id,
            "content_type": "minigame",
            "version": version,
            "outline": [game.get("title", "") for game in game_payload.get("games", [])],
            "json_content": game_payload,
            "file_url": None,
            "generation_status": "generated",
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def get_generated_content(self, content_id: str) -> dict:
        result = await self.generated_repo.get_by_id(parse_object_id(content_id))
        if not result:
            raise HTTPException(status_code=404, detail="Generated content not found")
        return result
