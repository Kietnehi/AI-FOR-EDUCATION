from pathlib import Path


class GroqSpeechToTextService:
    def __init__(self, api_key: str, base_url: str = "https://api.groq.com") -> None:
        try:
            from groq import Groq
        except ImportError as exc:
            raise RuntimeError("Missing dependency 'groq'. Please install with: pip install groq") from exc

        normalized_base_url = base_url.rstrip("/")
        if normalized_base_url.endswith("/openai/v1"):
            normalized_base_url = normalized_base_url[: -len("/openai/v1")]

        self.client = Groq(api_key=api_key, base_url=normalized_base_url)

    def transcribe_file(self, file_path: str, model: str, language: str | None = None) -> str:
        filename = Path(file_path).name
        with open(file_path, "rb") as audio_file:
            kwargs: dict[str, str | int | tuple[str, bytes]] = {
                "file": (filename, audio_file.read()),
                "model": model,
                "temperature": 0,
                "response_format": "verbose_json",
            }
            if language:
                kwargs["language"] = language

            transcription = self.client.audio.transcriptions.create(
                **kwargs,
            )

        text = getattr(transcription, "text", "")
        return (text or "").strip()
