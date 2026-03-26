import asyncio
from pathlib import Path

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.generation.image_fetcher import ImageFetcher
from app.ai.generation.minigame_generator import MinigameGenerator
from app.ai.generation.podcast_generator import PodcastGenerator
from app.ai.generation.slide_generator import SlideGenerator
from app.ai.generation.audio_generator import AudioGenerator
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

    async def _next_version(self, material_id: str, content_type: str) -> int:
        return await self.generated_repo.get_next_version(material_id, content_type)

    async def _prepare_material_text(self, material_id: str) -> str:
        material = await self.material_service.get_material(material_id)
        if material.get("processing_status") != "processed":
            raise HTTPException(status_code=400, detail="Material must be processed before generation")
        return material.get("cleaned_text") or material.get("raw_text") or ""

    async def generate_slides(self, material_id: str, tone: str, max_slides: int) -> dict:
        text = await self._prepare_material_text(material_id)

        # Step 1: LLM generates structured outline
        outline = self.slide_generator.generate_outline(text, max_slides=max_slides, tone=tone)

        # Step 2: Image Pipeline — fetch images from Pexels
        image_map: dict[str, str | None] = {}
        if self.image_fetcher.available:
            queries = extract_image_queries(outline)
            if queries:
                logger.info("Fetching %d images from Pexels for slides...", len(queries))
                image_map = self.image_fetcher.fetch_images_bulk(queries)
                fetched = sum(1 for v in image_map.values() if v)
                logger.info("Pexels: fetched %d / %d images successfully.", fetched, len(queries))
        else:
            logger.info("Pexels API key not set — slides will use placeholders.")

        # Step 3: Export PPTX with embedded images
        version = await self._next_version(material_id, "slides")
        filename = f"slides_{material_id}_v{version}.pptx"
        output_path = str(Path(settings.generated_dir) / filename)
        self.slide_generator.export_pptx(outline, output_path, image_map=image_map)

        # Step 4: Save metadata to MongoDB
        now = utc_now()
        doc = {
            "material_id": material_id,
            "content_type": "slides",
            "version": version,
            "outline": [item.get("title", "") for item in outline.get("slides", [])],
            "json_content": {"tone": tone, **outline},
            "file_url": f"/api/files/{filename}/download",
            "generation_status": "generated",
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_podcast(self, material_id: str, style: str, target_duration_minutes: int) -> dict:
        text = await self._prepare_material_text(material_id)
        script, version = await asyncio.gather(
            asyncio.to_thread(
                self.podcast_generator.generate_script,
                text,
                style=style,
                target_duration_minutes=target_duration_minutes,
            ),
            self._next_version(material_id, "podcast"),
        )
        model_used = self.podcast_generator.llm.last_model_used
        fallback_applied = self.podcast_generator.llm.fallback_used

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
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def generate_minigame(self, material_id: str, game_type: str = "quiz_mixed") -> dict:
        text = await self._prepare_material_text(material_id)
        game_payload = self.minigame_generator.generate(text, game_type=game_type)
        version = await self._next_version(material_id, "minigame")

        # Extract outline based on game type
        if game_type == "scenario_branching":
            outline = [s.get("title", "") for s in game_payload.get("scenarios", [])]
        else:
            outline = [game_payload.get("title", "")]

        now = utc_now()
        doc = {
            "material_id": material_id,
            "content_type": "minigame",
            "game_type": game_type,
            "version": version,
            "outline": outline,
            "json_content": game_payload,
            "file_url": None,
            "generation_status": "generated",
            "model_used": model_used,
            "fallback_applied": fallback_applied,
            "created_at": now,
            "updated_at": now,
        }
        return await self.generated_repo.create(doc)

    async def get_generated_content(self, content_id: str) -> dict:
        result = await self.generated_repo.get_by_id(parse_object_id(content_id))
        if not result:
            raise HTTPException(status_code=404, detail="Generated content not found")
        return result
