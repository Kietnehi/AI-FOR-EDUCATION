"""Extract images from uploaded documents (PDF/DOCX).

Saves each embedded image to a local directory and returns a list of
``ExtractedImage`` records with a local path and metadata.
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings
from app.core.logging import logger


@dataclass
class ExtractedImage:
    """Represents an image extracted from a source document."""

    path: str  # absolute local file path
    page: int | None  # page number (PDF) or position index (DOCX)
    description: str  # short description for matching to slides


class ImageExtractor:
    """Extract embedded images from PDF and DOCX files."""

    def __init__(self, output_dir: str | None = None) -> None:
        self.output_dir = Path(output_dir or settings.image_cache_dir) / "extracted"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        from app.ai.generation.llm_client import LLMClient
        self.llm = LLMClient()

    def _generate_description(self, image_path: str) -> str:
        try:
            import base64
            with open(image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode("utf-8")
            ext = Path(image_path).suffix.lower()
            mime = "image/png" if ext == ".png" else "image/jpeg"
            b64_str = f"data:{mime};base64,{b64}"

            system_prompt = "You are a highly capable computer vision AI. Output valid JSON only."
            user_prompt = "What is shown in this image? Write a short, precise description (1-2 sentences) focusing on the main concept or diagram being illustrated. Format: {\"description\": \"...\"}"
            fallback = {"description": "Hình ảnh minh họa từ tài liệu"}

            resp = self.llm.json_response(system_prompt, user_prompt, fallback, images=[b64_str])
            return resp.get("description", fallback["description"])
        except Exception as exc:
            logger.warning("Failed to caption image %s: %s", image_path, exc)
            return "Hình ảnh minh họa từ tài liệu"

    def extract(self, file_path: str) -> list[ExtractedImage]:
        """Auto-detect file type and extract images."""
        suffix = Path(file_path).suffix.lower()
        if suffix == ".pdf":
            return self._extract_from_pdf(file_path)
        elif suffix == ".docx":
            return self._extract_from_docx(file_path)
        return []

    # ────────── PDF ──────────

    def _extract_from_pdf(self, file_path: str) -> list[ExtractedImage]:
        images: list[ExtractedImage] = []
        try:
            from pypdf import PdfReader

            reader = PdfReader(file_path)
            doc_hash = hashlib.md5(file_path.encode()).hexdigest()[:8]

            for page_num, page in enumerate(reader.pages):
                if "/XObject" not in (page.get("/Resources") or {}):
                    continue
                x_objects = page["/Resources"]["/XObject"].get_object()
                for obj_name in x_objects:
                    obj = x_objects[obj_name].get_object()
                    if obj.get("/Subtype") == "/Image":
                        try:
                            img_data = obj.get_data()
                            # Determine extension from filter
                            ext = self._get_image_ext(obj)
                            filename = f"doc_{doc_hash}_p{page_num}_{uuid.uuid4().hex[:6]}{ext}"
                            out_path = self.output_dir / filename
                            out_path.write_bytes(img_data)
                            description = self._generate_description(str(out_path))
                            images.append(
                                ExtractedImage(
                                    path=str(out_path),
                                    page=page_num,
                                    description=description,
                                )
                            )
                            logger.debug("Extracted PDF image: %s (%s)", filename, description)
                        except Exception as exc:
                            logger.debug("Could not extract PDF image object %s: %s", obj_name, exc)
        except Exception as exc:
            logger.warning("PDF image extraction failed for %s: %s", file_path, exc)
        return images

    def _get_image_ext(self, obj) -> str:
        """Determine image extension from PDF image object filter."""
        filters = obj.get("/Filter", "")
        if isinstance(filters, list):
            filters = filters[-1] if filters else ""
        filter_str = str(filters)
        if "DCTDecode" in filter_str:
            return ".jpg"
        elif "FlateDecode" in filter_str:
            return ".png"
        elif "JPXDecode" in filter_str:
            return ".jp2"
        return ".png"

    # ────────── DOCX ──────────

    def _extract_from_docx(self, file_path: str) -> list[ExtractedImage]:
        images: list[ExtractedImage] = []
        try:
            from docx import Document

            doc = Document(file_path)
            doc_hash = hashlib.md5(file_path.encode()).hexdigest()[:8]

            for idx, rel in enumerate(doc.part.rels.values()):
                if "image" in rel.reltype:
                    try:
                        img_data = rel.target_part.blob
                        content_type = rel.target_part.content_type
                        ext = self._content_type_to_ext(content_type)
                        filename = f"doc_{doc_hash}_img{idx}_{uuid.uuid4().hex[:6]}{ext}"
                        out_path = self.output_dir / filename
                        out_path.write_bytes(img_data)
                        description = self._generate_description(str(out_path))
                        images.append(
                            ExtractedImage(
                                path=str(out_path),
                                page=idx,
                                description=description,
                            )
                        )
                        logger.debug("Extracted DOCX image: %s (%s)", filename, description)
                    except Exception as exc:
                        logger.debug("Could not extract DOCX image %d: %s", idx, exc)
        except Exception as exc:
            logger.warning("DOCX image extraction failed for %s: %s", file_path, exc)
        return images

    @staticmethod
    def _content_type_to_ext(content_type: str) -> str:
        mapping = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/bmp": ".bmp",
            "image/tiff": ".tiff",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
        }
        return mapping.get(content_type, ".png")
