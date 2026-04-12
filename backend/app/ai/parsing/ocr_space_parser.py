from pathlib import Path

import requests

from app.core.config import settings


class OCRSpaceParser:
    @staticmethod
    def _post_ocr_request(
        file_path: str,
        *,
        engine: int,
        overlay: bool,
        language: str = "auto",
    ) -> dict:
        with Path(file_path).open("rb") as image_file:
            response = requests.post(
                settings.ocr_space_url,
                headers={"apikey": settings.ocr_space_api_key},
                files={"file": image_file},
                data={
                    "language": language,
                    "OCREngine": engine,
                    "detectOrientation": "true",
                    "scale": "true",
                    "isTable": "true",
                    "isOverlayRequired": "true" if overlay else "false",
                },
                timeout=settings.ocr_space_timeout_seconds,
            )
            response.raise_for_status()
            return response.json()

    @staticmethod
    def parse_image(file_path: str) -> dict:
        layout_response = OCRSpaceParser._post_ocr_request(
            file_path,
            engine=settings.ocr_space_layout_engine,
            overlay=False,
        )
        boxes_response = OCRSpaceParser._post_ocr_request(
            file_path,
            engine=settings.ocr_space_boxes_engine,
            overlay=True,
        )

        layout_text = "\n\n".join(
            page.get("ParsedText", "")
            for page in layout_response.get("ParsedResults", [])
        ).strip()

        words: list[dict] = []
        for page in boxes_response.get("ParsedResults", []):
            overlay = page.get("TextOverlay") or {}
            for line in overlay.get("Lines", []):
                for word in line.get("Words", []):
                    words.append(
                        {
                            "text": word.get("WordText", ""),
                            "left": float(word.get("Left", 0)),
                            "top": float(word.get("Top", 0)),
                            "width": float(word.get("Width", 0)),
                            "height": float(word.get("Height", 0)),
                        }
                    )

        if not layout_text and words:
            layout_text = " ".join(word["text"] for word in words if word.get("text")).strip()

        if not layout_text:
            error_messages = layout_response.get("ErrorMessage") or boxes_response.get("ErrorMessage")
            if error_messages:
                if isinstance(error_messages, list):
                    raise ValueError("; ".join(str(msg) for msg in error_messages))
                raise ValueError(str(error_messages))
            raise ValueError("No text extracted from image")

        return {
            "text": layout_text,
            "words": words,
            "raw_layout": layout_response,
            "raw_boxes": boxes_response,
        }