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
        parts = []
        for i, page in enumerate(reader.pages):
            parts.append(f"\n[PAGE {i+1}]\n")
            parts.append(page.extract_text() or "")
        return "".join(parts)

    @staticmethod
    def _parse_docx(file_path: str) -> str:
        document = Document(file_path)
        # DOCX doesn't have strict page numbers, but we can simulate virtual pages or just return paragraphs
        parts = []
        for i, paragraph in enumerate(document.paragraphs):
            # inject a fake page marker somewhat evenly, or simply leave it sequential
            if i % 30 == 0:
                parts.append(f"\n[DOC_PART {i // 30 + 1}]\n")
            parts.append(paragraph.text)
        return "\n".join(parts)
