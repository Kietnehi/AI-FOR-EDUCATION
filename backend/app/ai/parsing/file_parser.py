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
        try:
            from docling.document_converter import DocumentConverter, PdfFormatOption
            from docling.datamodel.base_models import InputFormat
            from docling.datamodel.pipeline_options import PdfPipelineOptions

            pipeline_options = PdfPipelineOptions()
            pipeline_options.do_formula_enrichment = True
            pipeline_options.do_ocr = False
            pipeline_options.do_table_structure = True
            pipeline_options.generate_picture_images = True

            doc_converter = DocumentConverter(
                format_options={
                    InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                }
            )

            result = doc_converter.convert(file_path)
            doc = result.document
            return doc.export_to_markdown()
        except Exception:
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
