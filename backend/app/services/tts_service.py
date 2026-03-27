from io import BytesIO

from gtts import gTTS


class TextToSpeechService:
    # gTTS language codes: https://gtts.readthedocs.io/
    SUPPORTED_LANGS = {
        "vi",
        "en",
        "es",
        "fr",
        "de",
        "it",
        "pt",
        "ja",
        "ko",
        "zh-CN",
        "zh-TW",
    }

    def synthesize(self, text: str, lang: str = "vi") -> bytes:
        cleaned_text = (text or "").strip()
        if not cleaned_text:
            raise ValueError("Empty text")

        language = (lang or "vi").strip()
        if language not in self.SUPPORTED_LANGS:
            raise ValueError("Unsupported TTS language")

        # Keep requests bounded for latency/reliability with gTTS.
        if len(cleaned_text) > 4000:
            cleaned_text = cleaned_text[:4000]

        tts = gTTS(text=cleaned_text, lang=language)
        output = BytesIO()
        tts.write_to_fp(output)
        return output.getvalue()
