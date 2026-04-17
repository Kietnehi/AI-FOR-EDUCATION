import html
import json
import importlib
import os
import re
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
from xml.etree import ElementTree as ET

import requests

from app.ai.generation.llm_client import LLMClient
from app.core.config import settings
from app.services.groq_speech_service import GroqSpeechToTextService


def _format_timestamp(seconds: float) -> str:
    total = max(0, int(seconds))
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"


def _timestamp_to_seconds(ts_str: str) -> float:
    """Chuyển định dạng M:SS, MM:SS hoặc H:MM:SS thành giây."""
    parts = ts_str.strip().split(":")
    try:
        if len(parts) == 2:  # M:SS
            return float(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:  # H:MM:SS
            return float(parts[0]) * 3600 + float(parts[1]) * 60 + float(parts[2])
    except (ValueError, IndexError):
        return 0.0
    return 0.0


class YouTubeLessonService:
    def parse_manual_transcript(self, raw_text: str) -> list[dict[str, Any]]:
        """
        Parse transcript thủ công có dạng:
        Tiêu đề (optional)
        0:00
        Nội dung câu 1...
        0:06
        Nội dung câu 2...
        """
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]
        segments: list[dict[str, Any]] = []
        
        current_start = 0.0
        current_text_parts: list[str] = []
        
        # Regex tìm mốc thời gian (ví dụ: 0:00, 12:34, 1:02:03)
        ts_pattern = re.compile(r"^\d{1,2}:\d{2}(:\d{2})?$")

        for line in lines:
            if ts_pattern.match(line):
                # Nếu đã có nội dung trước đó, lưu lại segment cũ
                if current_text_parts:
                    text = " ".join(current_text_parts).strip()
                    if text:
                        segments.append({
                            "text": text,
                            "start": current_start,
                            "timestamp": _format_timestamp(current_start)
                        })
                    current_text_parts = []
                
                # Cập nhật mốc thời gian mới
                current_start = _timestamp_to_seconds(line)
            else:
                # Đây là nội dung văn bản
                current_text_parts.append(line)
        
        # Lưu segment cuối cùng
        if current_text_parts:
            text = " ".join(current_text_parts).strip()
            if text:
                segments.append({
                    "text": text,
                    "start": current_start,
                    "timestamp": _format_timestamp(current_start)
                })
        
        # Tính duration cho từng segment dựa trên segment tiếp theo
        for i in range(len(segments)):
            if i < len(segments) - 1:
                segments[i]["duration"] = max(0.5, segments[i+1]["start"] - segments[i]["start"])
            else:
                segments[i]["duration"] = 5.0  # Mặc định segment cuối là 5s
                
        return segments
    _VIDEO_PATTERNS = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]

    def __init__(self) -> None:
        self.llm = LLMClient()
        self.whisper_model_size = os.getenv("WHISPER_MODEL", "base")
        self._whisper_models: dict[str, Any] = {}

    _LOCAL_WHISPER_MODELS = {
        "local-base": "base",
        "local-small": "small",
    }
    _GROQ_WHISPER_MODELS = {"whisper-large-v3", "whisper-large-v3-turbo"}

    def translate_transcript(
        self,
        transcript: list[dict[str, Any]],
        *,
        target_language: str,
    ) -> list[dict[str, Any]]:
        lang = (target_language or "").strip()
        if not lang or lang.lower() in {"original", "auto", "source"}:
            return transcript
        if not transcript:
            return []

        translated: list[dict[str, Any]] = []
        chunk_size = 24

        for start in range(0, len(transcript), chunk_size):
            chunk = transcript[start : start + chunk_size]
            items = [{"i": idx, "text": str(seg.get("text") or "")} for idx, seg in enumerate(chunk)]

            system_prompt = (
                "Bạn là công cụ dịch transcript video. "
                "Chỉ trả về JSON hợp lệ, không markdown, không giải thích."
            )
            user_prompt = (
                f"Dịch toàn bộ các câu sau sang ngôn ngữ đích: {lang}.\n"
                "Giữ nguyên ý nghĩa, tự nhiên, ngắn gọn.\n"
                "Không thay đổi index i.\n"
                "Trả về JSON theo schema:\n"
                "{\n"
                "  \"items\": [\n"
                "    {\"i\": 0, \"text\": \"...\"}\n"
                "  ]\n"
                "}\n\n"
                f"Input:\n{json.dumps({'items': items}, ensure_ascii=False)}"
            )

            fallback = {"items": items}
            result = self.llm.json_response(system_prompt, user_prompt, fallback)
            raw_items = result.get("items") if isinstance(result, dict) else None
            mapping: dict[int, str] = {}
            if isinstance(raw_items, list):
                for row in raw_items:
                    if not isinstance(row, dict):
                        continue
                    try:
                        idx = int(row.get("i"))
                    except Exception:
                        continue
                    text = str(row.get("text") or "").strip()
                    if text:
                        mapping[idx] = text

            for idx, seg in enumerate(chunk):
                new_text = mapping.get(idx) or str(seg.get("text") or "")
                translated.append(
                    {
                        "text": new_text,
                        "start": float(seg.get("start") or 0.0),
                        "duration": float(seg.get("duration") or 0.0),
                        "timestamp": str(seg.get("timestamp") or _format_timestamp(float(seg.get("start") or 0.0))),
                    }
                )

        return translated

    @staticmethod
    def _resolve_cookie_file() -> str | None:
        # Priority: explicit env var, then common local/container paths.
        candidates = [
            os.getenv("YTDLP_COOKIE_FILE", "").strip(),
            os.path.join(os.getcwd(), "cookie.txt"),
            os.path.join(os.getcwd(), "..", "cookie.txt"),
            "/app/cookie.txt",
        ]
        for candidate in candidates:
            if candidate and os.path.isfile(candidate):
                return candidate
        return None

    @staticmethod
    def _yt_dlp_base_options() -> dict[str, Any]:
        # yt-dlp now requires explicit JS runtime config for some YouTube formats.
        options: dict[str, Any] = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "js_runtimes": {"node": {}},
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web", "tv"],
                }
            },
        }

        cookie_file = YouTubeLessonService._resolve_cookie_file()
        if cookie_file:
            options["cookiefile"] = cookie_file
        return options

    def extract_video_id(self, source: str) -> str | None:
        from urllib.parse import urlparse, parse_qs
        
        raw = (source or "").strip()
        if not raw:
            return None

        # Trường hợp chỉ là ID 11 ký tự
        if len(raw) == 11 and re.match(r"^[a-zA-Z0-9_-]{11}$", raw):
            return raw

        try:
            parsed_url = urlparse(raw)
            # Dạng youtube.com/watch?v=... hoặc youtube.com/shorts/...
            if "youtube.com" in parsed_url.hostname:
                if parsed_url.path == "/watch":
                    query = parse_qs(parsed_url.query)
                    return query.get("v", [None])[0]
                elif parsed_url.path.startswith(("/embed/", "/shorts/", "/live/")):
                    parts = parsed_url.path.split("/")
                    if len(parts) >= 3:
                        return parts[2]
            
            # Dạng youtu.be/ID
            if parsed_url.hostname == "youtu.be":
                return parsed_url.path[1:] if len(parsed_url.path) > 1 else None
        except Exception:
            pass

        # Fallback dùng Regex nếu urlparse thất bại
        for pattern in self._VIDEO_PATTERNS:
            match = re.search(pattern, raw)
            if match:
                return match.group(1)
        return None

    def search_videos(self, query: str, limit: int = 6) -> list[dict[str, Any]]:
        from yt_dlp import YoutubeDL

        text = (query or "").strip()
        if not text:
            return []

        options = {
            **self._yt_dlp_base_options(),
            "extract_flat": "in_playlist",
        }

        items: list[dict[str, Any]] = []
        with YoutubeDL(options) as ydl:
            data = ydl.extract_info(f"ytsearch{max(1, limit)}:{text}", download=False)

        entries = data.get("entries") if isinstance(data, dict) else []
        for entry in entries or []:
            if not isinstance(entry, dict):
                continue
            video_id = str(entry.get("id") or "").strip()
            if not video_id:
                continue
            title = str(entry.get("title") or "Untitled").strip()
            channel = str(entry.get("uploader") or "").strip() or None
            duration = entry.get("duration")
            duration_seconds = int(duration) if isinstance(duration, (int, float)) else None
            thumbnail = str(entry.get("thumbnail") or "").strip() or None
            if not thumbnail:
                thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
            items.append(
                {
                    "video_id": video_id,
                    "title": title,
                    "channel": channel,
                    "duration_seconds": duration_seconds,
                    "thumbnail": thumbnail,
                    "url": f"https://www.youtube.com/watch?v={video_id}",
                }
            )

        return items

    def get_video_meta(self, video_id: str) -> dict[str, Any]:
        from yt_dlp import YoutubeDL

        options = self._yt_dlp_base_options()
        with YoutubeDL(options) as ydl:
            data = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)

        title = str(data.get("title") or "Untitled").strip()
        channel = str(data.get("uploader") or "").strip() or None
        duration = data.get("duration")
        duration_seconds = int(duration) if isinstance(duration, (int, float)) else None
        thumbnail = str(data.get("thumbnail") or "").strip() or None
        if not thumbnail:
            thumbnail = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
        return {
            "video_id": video_id,
            "title": title,
            "channel": channel,
            "duration_seconds": duration_seconds,
            "thumbnail": thumbnail,
            "url": f"https://www.youtube.com/watch?v={video_id}",
        }

    def get_transcript(self, video_id: str, *, stt_model: str = "local-base") -> list[dict[str, Any]]:
        diagnostics: list[str] = []

        # 1. Thử youtube_transcript_api (Cách nhanh nhất và chuẩn nhất)
        try:
            transcript_list = self._fetch_with_youtube_transcript_api(video_id)
            if transcript_list:
                normalized = self._normalize_transcript_segments(transcript_list)
                if normalized:
                    return normalized
            diagnostics.append("youtube_transcript_api: empty")
        except Exception as exc:
            diagnostics.append(f"youtube_transcript_api: {type(exc).__name__}: {exc}")

        # 2. Thử Smart API fallback (biến thể khác)
        try:
            smart_transcript = self._fetch_smart_youtube_transcript_api(video_id)
            if smart_transcript:
                return smart_transcript
            diagnostics.append("smart_youtube_api: empty")
        except Exception as exc:
            diagnostics.append(f"smart_youtube_api: {type(exc).__name__}: {exc}")

        # 3. Thử Google TimedText endpoint
        try:
            timedtext_segments = self._fetch_with_google_timedtext(video_id)
            if timedtext_segments:
                return timedtext_segments
            diagnostics.append("timedtext: empty")
        except Exception as exc:
            diagnostics.append(f"timedtext: {type(exc).__name__}: {exc}")

        # 4. Thử parse trực tiếp captionTracks từ watch page
        try:
            watch_page_segments = self._fetch_with_watch_page_captions(video_id)
            if watch_page_segments:
                return watch_page_segments
            diagnostics.append("watch_page_captions: empty")
        except Exception as exc:
            diagnostics.append(f"watch_page_captions: {type(exc).__name__}: {exc}")

        # 5. Thử yt-dlp extraction
        try:
            fallback_segments = self._fetch_with_ytdlp_captions(video_id)
            if fallback_segments:
                return fallback_segments
            diagnostics.append("yt_dlp_captions: empty")
        except Exception as exc:
            diagnostics.append(f"yt_dlp_captions: {type(exc).__name__}: {exc}")

        # 6. CUỐI CÙNG: Dùng AI nghe (STT) - Chỉ khi tất cả các cách trên thất bại
        if stt_model in self._GROQ_WHISPER_MODELS:
            try:
                groq_segments = self._transcribe_with_groq(video_id, stt_model, diagnostics=diagnostics)
                if groq_segments:
                    return groq_segments
                diagnostics.append(f"groq_transcribe({stt_model}): empty")
            except Exception as exc:
                diagnostics.append(f"groq_transcribe({stt_model}): {type(exc).__name__}: {exc}")
        else:
            local_model = self._LOCAL_WHISPER_MODELS.get(stt_model, self.whisper_model_size)
            try:
                whisper_segments = self._transcribe_with_whisper(
                    video_id,
                    model_size=local_model,
                    diagnostics=diagnostics,
                )
                if whisper_segments:
                    return whisper_segments
                diagnostics.append(f"local_whisper({local_model}): empty")
            except Exception as exc:
                diagnostics.append(f"local_whisper({local_model}): {type(exc).__name__}: {exc}")

        details = " | ".join(diagnostics[:8]) if diagnostics else "unknown"
        raise RuntimeError(
            "Không lấy được transcript từ YouTube. "
            f"Vui lòng thử lại hoặc chọn Model STT khác. Chi tiết: {details}"
        )

    def _get_transcript_with_smart_strategy(
        self,
        video_id: str,
        *,
        stt_model: str,
        diagnostics: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        # Match Smart_Youtube behavior as closely as possible.
        try:
            transcript = self._fetch_smart_youtube_transcript_api(video_id)
            if transcript:
                return transcript
            if diagnostics is not None:
                diagnostics.append("smart_youtube_api: empty")
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"smart_youtube_api: {type(exc).__name__}: {exc}")

        # Smart project fallback is Whisper local; keep that for local models.
        if stt_model in self._GROQ_WHISPER_MODELS:
            return []

        local_model = self._LOCAL_WHISPER_MODELS.get(stt_model, self.whisper_model_size)
        whisper_segments = self._transcribe_with_whisper_smart(video_id, model_size=local_model, diagnostics=diagnostics)
        if whisper_segments:
            return whisper_segments

        return []

    def _fetch_smart_youtube_transcript_api(self, video_id: str) -> list[dict[str, Any]]:
        # Ported from Smart_Youtube/backend/services/transcript_service.py
        transcript_list = None
        yta = importlib.import_module("youtube_transcript_api")

        # 1) Module-level helper
        try:
            if hasattr(yta, "get_transcript"):
                transcript_list = yta.get_transcript(video_id, languages=["en"])
        except Exception:
            transcript_list = None

        # 2) Class-level helper / instance method
        if transcript_list is None:
            try:
                yt_class = getattr(yta, "YouTubeTranscriptApi", None)
                if yt_class is not None and hasattr(yt_class, "get_transcript"):
                    transcript_list = yt_class.get_transcript(video_id, languages=["en"])
                else:
                    instance = yt_class()
                    if hasattr(instance, "get_transcript"):
                        transcript_list = instance.get_transcript(video_id, languages=["en"])
            except Exception:
                transcript_list = None

        # 3) Last resort: no language restriction
        if transcript_list is None:
            try:
                if hasattr(yta, "get_transcript"):
                    transcript_list = yta.get_transcript(video_id)
            except Exception:
                transcript_list = None

        if transcript_list is None:
            return []

        normalized: list[dict[str, Any]] = []
        for segment in transcript_list:
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            start = float(segment.get("start") or 0.0)
            duration = float(segment.get("duration") or 0.0)
            normalized.append(
                {
                    "text": text,
                    "start": start,
                    "duration": duration,
                    "timestamp": _format_timestamp(start),
                }
            )
        return normalized

    def _transcribe_with_whisper_smart(
        self,
        video_id: str,
        *,
        model_size: str,
        diagnostics: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        # Ported fallback style from Smart_Youtube transcript service.
        try:
            import whisper
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"smart_whisper({model_size}): import_failed: {type(exc).__name__}")
            return []

        audio_path, download_error = self._download_audio_for_whisper_smart(video_id)
        if not audio_path:
            if diagnostics is not None:
                diagnostics.append(f"smart_whisper({model_size}): download_failed: {download_error or 'unknown'}")
            return []

        try:
            model = self._whisper_models.get(model_size)
            if model is None:
                model = whisper.load_model(model_size)
                self._whisper_models[model_size] = model

            result = model.transcribe(audio_path, verbose=False)
            segments = result.get("segments") if isinstance(result, dict) else None
            if not isinstance(segments, list):
                return []

            normalized: list[dict[str, Any]] = []
            for seg in segments:
                if not isinstance(seg, dict):
                    continue
                text = str(seg.get("text") or "").strip()
                if not text:
                    continue
                start = float(seg.get("start") or 0.0)
                end = float(seg.get("end") or start)
                normalized.append(
                    {
                        "text": text,
                        "start": start,
                        "duration": max(0.2, end - start),
                        "timestamp": _format_timestamp(start),
                    }
                )

            return normalized
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"smart_whisper({model_size}): transcribe_failed: {type(exc).__name__}: {exc}")
            return []
        finally:
            try:
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
            except Exception:
                pass

    def _download_audio_for_whisper_smart(self, video_id: str) -> tuple[str | None, str | None]:
        # Close to Smart_Youtube ydl options to avoid behavior drift.
        from yt_dlp import YoutubeDL

        temp_dir = os.getenv("TEMP_DIR", "/tmp/youtube_audio")
        os.makedirs(temp_dir, exist_ok=True)

        outtmpl = os.path.join(temp_dir, f"{video_id}.%(ext)s")
        output_path = os.path.join(temp_dir, f"{video_id}.mp3")

        ydl_opts: dict[str, Any] = {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        cookie_file = self._resolve_cookie_file()
        if cookie_file:
            ydl_opts["cookiefile"] = cookie_file

        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            with YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as exc:
            return None, f"smart_yt_dlp_download_error: {type(exc).__name__}: {exc}"

        if os.path.exists(output_path):
            return output_path, None
        return None, "smart_audio_file_not_found_after_download"

    def _transcribe_with_whisper(
        self,
        video_id: str,
        *,
        model_size: str,
        diagnostics: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        try:
            import whisper
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"local_whisper({model_size}): import_failed: {type(exc).__name__}")
            return []

        audio_path, download_error = self._download_audio_for_whisper(video_id)
        if not audio_path:
            if diagnostics is not None:
                diagnostics.append(f"local_whisper({model_size}): download_failed: {download_error or 'unknown'}")
            return []

        try:
            model = self._whisper_models.get(model_size)
            if model is None:
                model = whisper.load_model(model_size)
                self._whisper_models[model_size] = model

            result = model.transcribe(audio_path, verbose=False)
            segments = result.get("segments") if isinstance(result, dict) else None
            if not isinstance(segments, list):
                return []

            normalized: list[dict[str, Any]] = []
            for seg in segments:
                if not isinstance(seg, dict):
                    continue
                text = str(seg.get("text") or "").strip()
                if not text:
                    continue
                start = float(seg.get("start") or 0.0)
                end = float(seg.get("end") or start)
                normalized.append(
                    {
                        "text": text,
                        "start": start,
                        "duration": max(0.2, end - start),
                        "timestamp": _format_timestamp(start),
                    }
                )

            return normalized
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"local_whisper({model_size}): transcribe_failed: {type(exc).__name__}: {exc}")
            return []
        finally:
            try:
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
            except Exception:
                pass

    def _transcribe_with_groq(
        self,
        video_id: str,
        groq_model: str,
        diagnostics: list[str] | None = None,
    ) -> list[dict[str, Any]]:
        if not settings.groq_api_key:
            if diagnostics is not None:
                diagnostics.append(f"groq_transcribe({groq_model}): missing_groq_api_key")
            return []

        audio_path, download_error = self._download_audio_for_whisper(video_id)
        if not audio_path:
            if diagnostics is not None:
                diagnostics.append(f"groq_transcribe({groq_model}): download_failed: {download_error or 'unknown'}")
            return []

        try:
            groq_service = GroqSpeechToTextService(
                api_key=settings.groq_api_key,
                base_url=settings.groq_base_url,
            )
            data = groq_service.transcribe_file_verbose(audio_path, model=groq_model)
            segments = data.get("segments") if isinstance(data, dict) else None

            if isinstance(segments, list) and segments:
                normalized: list[dict[str, Any]] = []
                for seg in segments:
                    if not isinstance(seg, dict):
                        continue
                    text = str(seg.get("text") or "").strip()
                    if not text:
                        continue
                    start = float(seg.get("start") or 0.0)
                    end = float(seg.get("end") or start)
                    normalized.append(
                        {
                            "text": text,
                            "start": start,
                            "duration": max(0.2, end - start),
                            "timestamp": _format_timestamp(start),
                        }
                    )
                if normalized:
                    return normalized

            text = str(data.get("text") or "").strip() if isinstance(data, dict) else ""
            if not text:
                return []
            return self._segment_plain_text(text)
        except Exception as exc:
            if diagnostics is not None:
                diagnostics.append(f"groq_transcribe({groq_model}): failed: {type(exc).__name__}: {exc}")
            return []
        finally:
            try:
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
            except Exception:
                pass

    def _segment_plain_text(self, text: str) -> list[dict[str, Any]]:
        chunks = [chunk.strip() for chunk in re.split(r"(?<=[.!?])\s+", text) if chunk.strip()]
        if not chunks:
            chunks = [text.strip()]

        grouped: list[str] = []
        step = 2
        for i in range(0, len(chunks), step):
            grouped.append(" ".join(chunks[i : i + step]).strip())

        segments: list[dict[str, Any]] = []
        cursor = 0.0
        for part in grouped:
            if not part:
                continue
            duration = max(6.0, min(22.0, len(part) / 18.0))
            segments.append(
                {
                    "text": part,
                    "start": cursor,
                    "duration": duration,
                    "timestamp": _format_timestamp(cursor),
                }
            )
            cursor += duration
        return segments

    def _download_audio_for_whisper(self, video_id: str) -> tuple[str | None, str | None]:
        from yt_dlp import YoutubeDL

        temp_dir = os.getenv("TEMP_DIR", "/tmp/youtube_audio")
        os.makedirs(temp_dir, exist_ok=True)

        outtmpl = os.path.join(temp_dir, f"{video_id}.%(ext)s")
        output_path = os.path.join(temp_dir, f"{video_id}.mp3")

        ydl_opts = {
            "format": "bestaudio/best",
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": "192",
                }
            ],
            "outtmpl": outtmpl,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
            "js_runtimes": {"node": {}},
            "extractor_args": {
                "youtube": {
                    "player_client": ["android", "web", "tv"],
                }
            },
        }

        cookie_file = self._resolve_cookie_file()
        if cookie_file:
            ydl_opts["cookiefile"] = cookie_file

        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            with YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
        except Exception as exc:
            return None, f"yt_dlp_download_error: {type(exc).__name__}: {exc}"

        if os.path.exists(output_path):
            return output_path, None
        return None, "audio_file_not_found_after_download"

    def _fetch_with_youtube_transcript_api(self, video_id: str) -> list[dict[str, Any]] | None:
        import importlib

        yta = importlib.import_module("youtube_transcript_api")

        # Thử lấy danh sách transcript khả dụng
        try:
            yt_class = getattr(yta, "YouTubeTranscriptApi", None)
            instance = yt_class() if (yt_class and callable(yt_class)) else yt_class
            list_fn = getattr(instance, "list_transcripts", None) if instance else None
            
            if not list_fn and hasattr(yta, "list_transcripts"):
                list_fn = yta.list_transcripts

            if list_fn:
                transcripts = list_fn(video_id)
                
                # 1. Thử tìm tiếng Việt hoặc tiếng Anh (ưu tiên)
                try:
                    return transcripts.find_transcript(["vi", "vi-VN", "en", "en-US", "en-GB"]).fetch()
                except Exception:
                    pass

                # 2. Nếu không có, thử lấy cái đầu tiên bất kỳ (tự động hoặc thủ công)
                try:
                    for item in transcripts:
                        return item.fetch()
                except Exception:
                    pass
        except Exception:
            pass

        # Fallback cũ nếu logic trên thất bại
        try:
            if hasattr(yta, "get_transcript"):
                return yta.get_transcript(video_id)
        except Exception:
            pass

        return None

    def _fetch_any_language_with_transcript_api(self, yta_module: Any, video_id: str) -> list[dict[str, Any]] | None:
        list_fn = getattr(yta_module, "list_transcripts", None)
        if not callable(list_fn):
            yt_class = getattr(yta_module, "YouTubeTranscriptApi", None)
            if yt_class is not None:
                instance = yt_class() if callable(yt_class) else yt_class
                list_fn = getattr(instance, "list_transcripts", None)

        if not callable(list_fn):
            return None

        try:
            transcripts = list_fn(video_id)
        except Exception:
            return None

        # Try preferred languages first, then first available transcript.
        preference = ["vi", "vi-VN", "en", "en-US", "en-GB"]
        for lang in preference:
            try:
                item = transcripts.find_transcript([lang])
                return item.fetch()
            except Exception:
                continue

        try:
            for item in transcripts:
                fetched = item.fetch()
                if fetched:
                    return fetched
        except Exception:
            return None

        return None

    def _normalize_transcript_segments(self, transcript_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized: list[dict[str, Any]] = []
        for segment in transcript_list:
            text = str(segment.get("text") or "").strip()
            if not text:
                continue
            start = float(segment.get("start") or 0.0)
            duration = float(segment.get("duration") or 0.0)
            normalized.append(
                {
                    "text": text,
                    "start": start,
                    "duration": duration,
                    "timestamp": _format_timestamp(start),
                }
            )
        return normalized

    def _fetch_with_google_timedtext(self, video_id: str) -> list[dict[str, Any]]:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        tracks: list[dict[str, str]] = []
        list_urls = [
            f"https://video.google.com/timedtext?type=list&v={video_id}",
            f"https://www.youtube.com/api/timedtext?type=list&v={video_id}",
        ]
        for list_url in list_urls:
            try:
                response = requests.get(list_url, headers=headers, timeout=20)
                response.raise_for_status()
                xml_text = response.text
                root = ET.fromstring(xml_text)
            except Exception:
                continue

            for node in root.findall(".//track"):
                lang_code = str(node.attrib.get("lang_code") or "").strip()
                if not lang_code:
                    continue
                track = {
                    "lang_code": lang_code,
                    "name": str(node.attrib.get("name") or "").strip(),
                    "kind": str(node.attrib.get("kind") or "").strip(),
                }
                if track not in tracks:
                    tracks.append(track)

        # If list endpoint fails, probe common languages directly.
        if not tracks:
            for lang in ["vi", "en", "en-US", "en-GB"]:
                tracks.append({"lang_code": lang, "name": "", "kind": ""})
                tracks.append({"lang_code": lang, "name": "", "kind": "asr"})

        preferred_langs = ["vi", "vi-VN", "en", "en-US", "en-GB"]
        ordered_tracks: list[dict[str, str]] = []
        for lang in preferred_langs:
            for track in tracks:
                if track["lang_code"] == lang:
                    ordered_tracks.append(track)
        for track in tracks:
            if track not in ordered_tracks:
                ordered_tracks.append(track)

        for track in ordered_tracks:
            params = {
                "v": video_id,
                "lang": track["lang_code"],
            }
            if track.get("name"):
                params["name"] = track["name"]
            if track.get("kind"):
                params["kind"] = track["kind"]

            base_urls = [
                f"https://video.google.com/timedtext?{urlencode(params, doseq=True)}",
                f"https://www.youtube.com/api/timedtext?{urlencode(params, doseq=True)}",
            ]

            # Try JSON3 first (best fidelity), then VTT, then XML.
            for base in base_urls:
                for ext in ("json3", "vtt", "xml"):
                    if ext == "xml":
                        url = base
                    else:
                        url = self._with_query_param(base, "fmt", ext)

                    content = self._download_caption_content(url, ext)
                    if not content:
                        continue

                    if ext == "json3" or content.lstrip().startswith("{"):
                        parsed = self._parse_json3_captions(content)
                    elif ext == "vtt" or "-->" in content:
                        parsed = self._parse_vtt_captions(content)
                    else:
                        parsed = self._parse_xml_captions(content)

                    if parsed:
                        return parsed

        return []

    def _fetch_with_watch_page_captions(self, video_id: str) -> list[dict[str, Any]]:
        watch_url = f"https://www.youtube.com/watch?v={video_id}&hl=en"
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            )
        }

        try:
            response = requests.get(watch_url, headers=headers, timeout=20)
            response.raise_for_status()
            html_text = response.text
        except Exception:
            return []

        player_response = self._extract_yt_initial_player_response(html_text)
        if not isinstance(player_response, dict):
            return []

        caption_tracks = (
            player_response.get("captions", {})
            .get("playerCaptionsTracklistRenderer", {})
            .get("captionTracks", [])
        )
        if not isinstance(caption_tracks, list) or not caption_tracks:
            return []

        # Prefer Vietnamese/English tracks first, then any available.
        preferred_langs = ["vi", "vi-VN", "en", "en-US", "en-GB"]
        ordered_tracks: list[dict[str, Any]] = []
        for lang in preferred_langs:
            for track in caption_tracks:
                if not isinstance(track, dict):
                    continue
                if str(track.get("languageCode") or "").strip() == lang:
                    ordered_tracks.append(track)
        for track in caption_tracks:
            if isinstance(track, dict) and track not in ordered_tracks:
                ordered_tracks.append(track)

        for track in ordered_tracks:
            base_url = str(track.get("baseUrl") or "").strip()
            if not base_url:
                continue

            for ext in ("json3", "vtt", "ttml"):
                content = self._download_caption_content(self._with_query_param(base_url, "fmt", ext), ext)
                if not content:
                    continue

                if ext == "json3" or content.lstrip().startswith("{"):
                    parsed = self._parse_json3_captions(content)
                elif ext == "vtt" or "-->" in content:
                    parsed = self._parse_vtt_captions(content)
                else:
                    parsed = self._parse_xml_captions(content)

                if parsed:
                    return parsed

        return []

    def _extract_yt_initial_player_response(self, html_text: str) -> dict[str, Any] | None:
        marker = "ytInitialPlayerResponse"
        idx = html_text.find(marker)
        if idx < 0:
            return None

        start = html_text.find("{", idx)
        if start < 0:
            return None

        decoder = json.JSONDecoder()
        try:
            obj, _ = decoder.raw_decode(html_text[start:])
        except Exception:
            return None

        return obj if isinstance(obj, dict) else None

    def _fetch_with_ytdlp_captions(self, video_id: str) -> list[dict[str, Any]]:
        from yt_dlp import YoutubeDL

        url = f"https://www.youtube.com/watch?v={video_id}"
        options = self._yt_dlp_base_options()

        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=False)

        track = self._pick_caption_track(info)
        if not track:
            return []

        track_url = track.get("url")
        if not track_url:
            return []

        ext = str(track.get("ext") or "").lower()
        content = self._download_caption_content(track_url, ext)
        if not content:
            return []

        if "json3" in ext or content.lstrip().startswith("{"):
            segments = self._parse_json3_captions(content)
        elif ext in {"vtt", "webvtt"} or "-->" in content:
            segments = self._parse_vtt_captions(content)
        elif ext in {"srv1", "srv2", "srv3", "ttml", "xml"} or content.lstrip().startswith("<"):
            segments = self._parse_xml_captions(content)
        else:
            # Last chance detection by content shape.
            if content.lstrip().startswith("{"):
                segments = self._parse_json3_captions(content)
            elif content.lstrip().startswith("<"):
                segments = self._parse_xml_captions(content)
            else:
                segments = self._parse_vtt_captions(content)

        return segments

    def _download_caption_content(self, track_url: str, ext: str) -> str:
        urls = [track_url]
        # Some tracks are exposed in srv/ttml; forcing json3/vtt often makes parsing reliable.
        if ext not in {"json3", "vtt"}:
            urls.append(self._with_query_param(track_url, "fmt", "json3"))
            urls.append(self._with_query_param(track_url, "fmt", "vtt"))

        for url in urls:
            try:
                response = requests.get(url, timeout=20)
                response.raise_for_status()
                text = response.text or ""
                if text.strip():
                    return text
            except Exception:
                continue
        return ""

    @staticmethod
    def _with_query_param(url: str, key: str, value: str) -> str:
        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        query[key] = value
        return urlunparse(parsed._replace(query=urlencode(query, doseq=True)))

    def _pick_caption_track(self, info: dict[str, Any] | None) -> dict[str, Any] | None:
        if not isinstance(info, dict):
            return None

        subtitles = info.get("subtitles") if isinstance(info.get("subtitles"), dict) else {}
        auto_captions = (
            info.get("automatic_captions") if isinstance(info.get("automatic_captions"), dict) else {}
        )

        preferred_langs = ["vi", "vi-VN", "en", "en-US", "en-GB"]
        preferred_exts = ["json3", "vtt", "srv3", "srv2", "srv1", "ttml"]

        def pick_from_bucket(bucket: dict[str, Any]) -> dict[str, Any] | None:
            candidate_langs = preferred_langs + [lang for lang in bucket.keys() if lang not in preferred_langs]
            for lang in candidate_langs:
                entries = bucket.get(lang)
                if not isinstance(entries, list):
                    continue

                for ext in preferred_exts:
                    for entry in entries:
                        if not isinstance(entry, dict):
                            continue
                        if str(entry.get("ext") or "").lower() == ext and entry.get("url"):
                            return entry

                for entry in entries:
                    if isinstance(entry, dict) and entry.get("url"):
                        return entry
            return None

        return pick_from_bucket(subtitles) or pick_from_bucket(auto_captions)

    def _parse_vtt_captions(self, content: str) -> list[dict[str, Any]]:
        lines = content.splitlines()
        segments: list[dict[str, Any]] = []
        idx = 0

        while idx < len(lines):
            line = lines[idx].strip()
            if "-->" not in line:
                idx += 1
                continue

            timing_match = re.search(
                r"([0-9:.]+)\s*-->\s*([0-9:.]+)",
                line,
            )
            if not timing_match:
                idx += 1
                continue

            start = self._timestamp_to_seconds(timing_match.group(1))
            end = self._timestamp_to_seconds(timing_match.group(2))
            idx += 1

            text_lines: list[str] = []
            while idx < len(lines) and lines[idx].strip():
                clean = re.sub(r"<[^>]+>", "", lines[idx].strip())
                clean = html.unescape(clean)
                if clean:
                    text_lines.append(clean)
                idx += 1

            text = " ".join(text_lines).strip()
            if text:
                segments.append(
                    {
                        "text": text,
                        "start": start,
                        "duration": max(0.2, end - start),
                        "timestamp": _format_timestamp(start),
                    }
                )

            idx += 1

        return segments

    def _parse_json3_captions(self, content: str) -> list[dict[str, Any]]:
        try:
            payload = json.loads(content)
        except Exception:
            return []

        events = payload.get("events") if isinstance(payload, dict) else None
        if not isinstance(events, list):
            return []

        segments: list[dict[str, Any]] = []
        for event in events:
            if not isinstance(event, dict):
                continue
            segs = event.get("segs")
            if not isinstance(segs, list):
                continue

            text_parts: list[str] = []
            for seg in segs:
                if not isinstance(seg, dict):
                    continue
                chunk = str(seg.get("utf8") or "").replace("\n", " ").strip()
                if chunk:
                    text_parts.append(chunk)

            text = " ".join(text_parts).strip()
            if not text:
                continue

            start = float(event.get("tStartMs") or 0) / 1000.0
            duration = float(event.get("dDurationMs") or 2000) / 1000.0

            segments.append(
                {
                    "text": text,
                    "start": start,
                    "duration": max(0.2, duration),
                    "timestamp": _format_timestamp(start),
                }
            )

        return segments

    def _parse_xml_captions(self, content: str) -> list[dict[str, Any]]:
        try:
            root = ET.fromstring(content)
        except Exception:
            return []

        segments: list[dict[str, Any]] = []

        # YouTube timedtext format: <text start=".." dur="..">...</text>
        for node in root.findall(".//text"):
            text = "".join(node.itertext()).strip()
            text = html.unescape(text)
            if not text:
                continue
            start = self._parse_timecode(node.attrib.get("start", "0"))
            duration = self._parse_timecode(node.attrib.get("dur", "2"))
            segments.append(
                {
                    "text": text,
                    "start": start,
                    "duration": max(0.2, duration),
                    "timestamp": _format_timestamp(start),
                }
            )

        if segments:
            return segments

        # TTML style: <p begin=".." end="..">...</p> or <p begin=".." dur="..">...</p>
        for node in root.findall(".//{*}p"):
            text = " ".join("".join(node.itertext()).split()).strip()
            text = html.unescape(text)
            if not text:
                continue
            begin = self._parse_timecode(node.attrib.get("begin", "0"))
            end = self._parse_timecode(node.attrib.get("end", "0"))
            dur = self._parse_timecode(node.attrib.get("dur", "0"))
            duration = dur if dur > 0 else max(0.2, end - begin)
            segments.append(
                {
                    "text": text,
                    "start": begin,
                    "duration": max(0.2, duration),
                    "timestamp": _format_timestamp(begin),
                }
            )

        return segments

    def _parse_timecode(self, value: str) -> float:
        raw = str(value or "").strip()
        if not raw:
            return 0.0
        if raw.endswith("s"):
            raw = raw[:-1]
        return self._timestamp_to_seconds(raw)

    @staticmethod
    def _timestamp_to_seconds(value: str) -> float:
        raw = value.replace(",", ".").strip()
        parts = raw.split(":")
        try:
            if len(parts) == 3:
                hours = float(parts[0])
                minutes = float(parts[1])
                seconds = float(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            if len(parts) == 2:
                minutes = float(parts[0])
                seconds = float(parts[1])
                return minutes * 60 + seconds
            return float(raw)
        except Exception:
            return 0.0

    def build_interactive_lesson(
        self,
        transcript: list[dict[str, Any]],
        *,
        title: str,
        max_checkpoints: int,
    ) -> dict[str, Any]:
        formatted = "\n".join(
            f"[{item['timestamp']}] {item['text']}" for item in transcript[:900]
        )

        system_prompt = (
            "Bạn là giáo viên AI chuyên biến transcript video thành bài học tương tác. "
            "Bắt buộc trả về JSON hợp lệ, không markdown, không giải thích thêm. "
            "TẤT CẢ nội dung văn bản phải là tiếng Việt có dấu hoàn chỉnh."
        )
        user_prompt = (
            f"Video title: {title}\n"
            f"Số điểm dừng mong muốn: {max_checkpoints}\n\n"
            "Nhiệm vụ:\n"
            "1) Tạo summary ngắn gọn 5-8 câu, dễ hiểu cho học sinh.\n"
            "2) Tạo key_takeaways gồm 5-8 ý chính.\n"
            "3) Tạo chapters (5-10 mục) theo mốc thời gian quan trọng.\n"
            "4) Tạo key_notes (8-15 mục) chứa insight quan trọng theo timestamp.\n"
            "5) Tạo checkpoints để auto-pause theo định dạng dưới đây.\n"
            "- Mỗi checkpoint phải có start_seconds, timestamp, title, key_point, question, choices (4 lựa chọn), correct_answer_index (0-3), explanation.\n"
            "- start_seconds phải tăng dần, phân bố theo các đoạn quan trọng.\n"
            "- question phải kiểm tra hiểu nội dung ngay trước mốc thời gian đó.\n"
            "- explanation ngắn gọn, rõ ràng.\n"
            "- Không được để mảng rỗng.\n"
            "- BẮT BUỘC viết 100% tiếng Việt có dấu; không dùng tiếng Anh trong summary, key_takeaways, chapters, key_notes, question, choices, explanation.\n\n"
            "Trả về JSON theo schema:\n"
            "{\n"
            "  \"summary\": \"...\",\n"
            "  \"key_takeaways\": [\"...\"],\n"
            "  \"chapters\": [{\"timestamp\": \"0:00\", \"title\": \"...\"}],\n"
            "  \"key_notes\": [{\"time\": \"0:16\", \"note\": \"...\"}],\n"
            "  \"checkpoints\": [\n"
            "    {\n"
            "      \"start_seconds\": 61,\n"
            "      \"timestamp\": \"1:01\",\n"
            "      \"title\": \"...\",\n"
            "      \"key_point\": \"...\",\n"
            "      \"question\": \"...\",\n"
            "      \"choices\": [\"A\", \"B\", \"C\", \"D\"],\n"
            "      \"correct_answer_index\": 1,\n"
            "      \"explanation\": \"...\"\n"
            "    }\n"
            "  ]\n"
            "}\n\n"
            f"Transcript:\n{formatted}"
        )

        fallback = self._build_fallback_lesson(transcript, max_checkpoints=max_checkpoints)
        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        normalized = self._normalize_lesson(result, transcript, max_checkpoints=max_checkpoints)
        return self._ensure_lesson_vietnamese(normalized)

    def _ensure_lesson_vietnamese(self, lesson: dict[str, Any]) -> dict[str, Any]:
        system_prompt = (
            "Bạn là công cụ chuẩn hóa nội dung học tập sang tiếng Việt có dấu hoàn chỉnh. "
            "Chỉ trả về JSON hợp lệ, không markdown, không giải thích."
        )
        user_prompt = (
            "Hãy chuyển toàn bộ text trong JSON sau sang tiếng Việt có dấu hoàn chỉnh, "
            "giữ nguyên cấu trúc key, giữ nguyên số lượng phần tử trong mảng, giữ nguyên timestamp/start_seconds.\n"
            "Các trường bắt buộc là tiếng Việt: summary, key_takeaways, chapters.title, key_notes.note, "
            "checkpoints.title, checkpoints.key_point, checkpoints.question, checkpoints.choices, checkpoints.explanation.\n\n"
            f"Input:\n{json.dumps(lesson, ensure_ascii=False)}"
        )

        result = self.llm.json_response(system_prompt, user_prompt, lesson)
        if not isinstance(result, dict):
            return lesson
        return self._normalize_lesson(result, transcript=[], max_checkpoints=max(1, len(lesson.get("checkpoints") or [])))

    def _build_fallback_lesson(
        self, transcript: list[dict[str, Any]], *, max_checkpoints: int
    ) -> dict[str, Any]:
        checkpoints: list[dict[str, Any]] = []
        if transcript:
            step = max(1, len(transcript) // max(1, max_checkpoints))
            for i in range(0, len(transcript), step):
                seg = transcript[i]
                checkpoints.append(
                    {
                        "start_seconds": float(seg.get("start") or 0.0),
                        "timestamp": seg.get("timestamp") or _format_timestamp(float(seg.get("start") or 0.0)),
                        "title": "Tạm dừng để kiểm tra",
                        "key_point": str(seg.get("text") or "")[:160],
                        "question": "Ý chính của đoạn vừa xem là gì?",
                        "choices": [
                            "Diễn giải ý chính của đoạn",
                            "Nhận xét về hình ảnh",
                            "Nói về nhân vật phụ",
                            "Thông tin không liên quan",
                        ],
                        "correct_answer_index": 0,
                        "explanation": "Cần nắm ý chính trước khi tiếp tục video.",
                    }
                )
                if len(checkpoints) >= max_checkpoints:
                    break

        return {
            "summary": "Video trình bày một chủ đề chính với nhiều ý quan trọng theo từng mốc thời gian.",
            "key_takeaways": [
                "Xác định thông điệp chính của video",
                "Theo dõi theo từng mốc thời gian",
                "Dừng lại ở điểm quan trọng để tự đánh giá",
            ],
            "chapters": [
                {
                    "timestamp": checkpoints[0]["timestamp"] if checkpoints else "0:00",
                    "title": "Tổng quan nội dung",
                }
            ],
            "key_notes": [
                {
                    "time": checkpoints[0]["timestamp"] if checkpoints else "0:00",
                    "note": "Theo dõi các điểm dừng để nắm ý chính của video.",
                }
            ],
            "checkpoints": checkpoints,
        }

    def _normalize_lesson(
        self,
        lesson: dict[str, Any],
        transcript: list[dict[str, Any]],
        *,
        max_checkpoints: int,
    ) -> dict[str, Any]:
        summary = str(lesson.get("summary") or "").strip()
        if not summary:
            summary = "Nội dung video đã được tổng hợp thành bài học tương tác."

        key_takeaways = lesson.get("key_takeaways")
        if not isinstance(key_takeaways, list):
            key_takeaways = []
        key_takeaways = [str(item).strip() for item in key_takeaways if str(item).strip()][:8]
        if not key_takeaways:
            key_takeaways = ["Tập trung vào các điểm dừng và trả lời câu hỏi để nhớ lâu hơn."]

        raw_chapters = lesson.get("chapters")
        if not isinstance(raw_chapters, list):
            raw_chapters = []
        chapters: list[dict[str, str]] = []
        for item in raw_chapters:
            if not isinstance(item, dict):
                continue
            timestamp = str(item.get("timestamp") or "").strip()
            title = str(item.get("title") or "").strip()
            if not timestamp or not title:
                continue
            chapters.append({"timestamp": timestamp, "title": title})

        raw_notes = lesson.get("key_notes")
        if not isinstance(raw_notes, list):
            raw_notes = []
        key_notes: list[dict[str, str]] = []
        for item in raw_notes:
            if not isinstance(item, dict):
                continue
            time = str(item.get("time") or "").strip()
            note = str(item.get("note") or "").strip()
            if not time or not note:
                continue
            key_notes.append({"time": time, "note": note})

        raw_checkpoints = lesson.get("checkpoints")
        if not isinstance(raw_checkpoints, list):
            raw_checkpoints = []

        checkpoints: list[dict[str, Any]] = []
        for cp in raw_checkpoints:
            if not isinstance(cp, dict):
                continue
            start_seconds = float(cp.get("start_seconds") or 0.0)
            timestamp = str(cp.get("timestamp") or _format_timestamp(start_seconds)).strip()
            title = str(cp.get("title") or "Checkpoint").strip() or "Checkpoint"
            key_point = str(cp.get("key_point") or "").strip() or "Điểm quan trọng trong video"
            question = str(cp.get("question") or "Ý chính của đoạn vừa xem là gì?").strip()
            choices = cp.get("choices")
            if not isinstance(choices, list):
                choices = []
            choices = [str(item).strip() for item in choices if str(item).strip()][:4]
            while len(choices) < 4:
                choices.append(f"Lựa chọn {len(choices) + 1}")

            answer_index = cp.get("correct_answer_index")
            try:
                answer_index = int(answer_index)
            except Exception:
                answer_index = 0
            if answer_index < 0 or answer_index > 3:
                answer_index = 0

            explanation = str(cp.get("explanation") or "Cần nắm ý chính trước khi tiếp tục.").strip()
            checkpoints.append(
                {
                    "start_seconds": start_seconds,
                    "timestamp": timestamp,
                    "title": title,
                    "key_point": key_point,
                    "question": question,
                    "choices": choices,
                    "correct_answer_index": answer_index,
                    "explanation": explanation,
                }
            )

        if not checkpoints:
            fallback = self._build_fallback_lesson(transcript, max_checkpoints=max_checkpoints)
            checkpoints = fallback["checkpoints"]

        if not chapters:
            chapters = [
                {
                    "timestamp": cp["timestamp"],
                    "title": cp["title"],
                }
                for cp in checkpoints[:8]
            ]

        if not key_notes:
            key_notes = [
                {
                    "time": cp["timestamp"],
                    "note": cp["key_point"],
                }
                for cp in checkpoints[:10]
            ]

        checkpoints = sorted(checkpoints, key=lambda item: float(item.get("start_seconds") or 0.0))
        unique: list[dict[str, Any]] = []
        last_second = -9999.0
        for cp in checkpoints:
            sec = float(cp.get("start_seconds") or 0.0)
            # Skip checkpoints too early to avoid pausing at video start (0:00)
            if sec < 8:
                continue
            if sec - last_second < 8:
                continue
            unique.append(cp)
            last_second = sec
            if len(unique) >= max_checkpoints:
                break

        if not unique and checkpoints:
            # Fallback if every checkpoint was filtered out
            for cp in checkpoints:
                sec = float(cp.get("start_seconds") or 0.0)
                if sec < 3:
                    continue
                unique.append(cp)
                if len(unique) >= max_checkpoints:
                    break

        return {
            "summary": summary,
            "key_takeaways": key_takeaways,
            "chapters": chapters,
            "key_notes": key_notes,
            "checkpoints": unique,
        }
