from threading import Lock

from app.core.config import settings


class SpeechToTextService:
    _model = None
    _model_name = ""
    _lock = Lock()

    def __init__(self, model_name: str | None = None) -> None:
        self.model_name = model_name or settings.whisper_model

    def _get_model(self):
        # Load once and reuse to avoid repeated cold starts.
        if SpeechToTextService._model is None or SpeechToTextService._model_name != self.model_name:
            with SpeechToTextService._lock:
                if (
                    SpeechToTextService._model is None
                    or SpeechToTextService._model_name != self.model_name
                ):
                    import whisper

                    SpeechToTextService._model = whisper.load_model(self.model_name)
                    SpeechToTextService._model_name = self.model_name
        return SpeechToTextService._model

    def transcribe_file(self, file_path: str, language: str | None = None) -> str:
        model = self._get_model()

        options: dict[str, str | bool] = {
            "fp16": False,
        }
        if language:
            options["language"] = language

        result = model.transcribe(file_path, **options)
        return (result.get("text") or "").strip()
