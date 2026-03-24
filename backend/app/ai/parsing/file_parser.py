from pathlib import Path

from docx import Document
from pypdf import PdfReader


class FileParser:
    @staticmethod
    def parse(file_path: str) -> str:
        suffix = Path(file_path).suffix.lower()
        if suffix in {".txt", ".md"}:
            return Path(file_path).read_text(encoding="utf-8", errors="ignore")
        if suffix == ".pdf":
            return FileParser._parse_pdf(file_path)
        if suffix == ".docx":
            return FileParser._parse_docx(file_path)
        raise ValueError(f"Unsupported file format: {suffix}")

    @staticmethod
    def _parse_pdf(file_path: str) -> str:
        reader = PdfReader(file_path)
        return "\n".join(page.extract_text() or "" for page in reader.pages)

    @staticmethod
    def _parse_docx(file_path: str) -> str:
        document = Document(file_path)
        return "\n".join(paragraph.text for paragraph in document.paragraphs)
