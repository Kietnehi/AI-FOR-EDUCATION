import os
from pathlib import Path
from typing import List
from gtts import gTTS


class AudioGenerator:
    """Generate audio files from podcast script segments using gTTS"""

    def __init__(self, uploads_dir: str = "uploads/podcasts"):
        self.uploads_dir = Path(uploads_dir)
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

    def generate_podcast_audio(
        self, segments: List[dict], output_filename: str, lang: str = "vi"
    ) -> str:
        """
        Generate complete podcast audio from text segments

        Args:
            segments: List of {"speaker": str, "text": str} dictionaries
            output_filename: Desired output filename (without extension)
            lang: Language code for gTTS (default: 'vi' for Vietnamese)

        Returns:
            str: Path to the generated audio file
        """
        if not segments:
            raise ValueError("No segments provided")

        # Combine all text from segments with pauses
        full_text = ""
        for segment in segments:
            text = segment.get("text", "").strip()
            if text:
                speaker = segment.get("speaker", "")
                # Add speaker name and text with natural pauses
                full_text += f"{text}... "  # Triple dot creates natural pause

        if not full_text:
            raise ValueError("No text content in segments")

        # Generate single audio file
        output_path = self.uploads_dir / f"{output_filename}.mp3"
        tts = gTTS(text=full_text.strip(), lang=lang, slow=False)
        tts.save(str(output_path))

        return str(output_path)

    def generate_simple_audio(self, text: str, output_filename: str, lang: str = "vi") -> str:
        """
        Generate simple audio from a single text

        Args:
            text: Text to convert to speech
            output_filename: Desired output filename (without extension)
            lang: Language code for gTTS (default: 'vi' for Vietnamese)

        Returns:
            str: Path to the generated audio file
        """
        output_path = self.uploads_dir / f"{output_filename}.mp3"

        tts = gTTS(text=text, lang=lang, slow=False)
        tts.save(str(output_path))

        return str(output_path)

    def get_audio_url(self, filename: str) -> str:
        """
        Get the URL path for serving the audio file

        Args:
            filename: The audio filename (with or without .mp3 extension)

        Returns:
            str: URL path for the audio file
        """
        if not filename.endswith(".mp3"):
            filename = f"{filename}.mp3"

        return f"/uploads/podcasts/{filename}"
