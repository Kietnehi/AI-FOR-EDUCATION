import os
import shutil
import re
import asyncio
import uuid
import nest_asyncio
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
import pandas as pd
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
import httpx
import zipfile

# Windows-only import
if os.name == 'nt':
    try:
        import win32com.client
        import pythoncom
    except ImportError:
        pass

nest_asyncio.apply()

UPLOAD_DIR = Path("storage/uploads")
OUTPUT_DIR = Path("storage/outputs")
EXTRACTED_DIR = Path("storage/extracted")

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EXTRACTED_DIR.mkdir(parents=True, exist_ok=True)
def _sync_web_to_pdf(url: str, output_path: Path) -> bool:
    """Synchronous playwright execution - safe to run in a thread on Windows."""
    import time
    print(f"[*] Converting URL: {url}")
    try:
        # Direct PDF download path
        if url.lower().endswith('.pdf') or '/pdf/' in url.lower():
            import httpx as _httpx
            try:
                r = _httpx.get(url, follow_redirects=True, timeout=60.0)
                r.raise_for_status()
                content_type = r.headers.get('content-type', '').lower()
                if 'application/pdf' in content_type:
                    with open(output_path, 'wb') as f:
                        f.write(r.content)
                    print(f"[V] PDF downloaded to {output_path}")
                    return True
            except Exception as e:
                print(f"[!] Direct download failed: {e}, falling back to browser...")

        with sync_playwright() as p:
            browser = p.chromium.launch(args=['--no-sandbox'])
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            # Auto scroll to load lazy content
            page.evaluate("""
                () => new Promise(resolve => {
                    let total = 0;
                    const dist = 100;
                    const timer = setInterval(() => {
                        window.scrollBy(0, dist);
                        total += dist;
                        if (total >= document.body.scrollHeight) {
                            clearInterval(timer);
                            resolve();
                        }
                    }, 100);
                })
            """)
            time.sleep(2)
            page.pdf(path=str(output_path), format="A4", print_background=True)
            browser.close()
        return True
    except Exception as e:
        print(f"Web Error: {e}")
        return False


async def convert_web_to_pdf(url: str, output_path: Path) -> bool:
    """Async wrapper — runs sync playwright in a thread to avoid Windows asyncio subprocess issues."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _sync_web_to_pdf, url, output_path)


def windows_office_to_pdf(input_path: str, output_path: str, ext: str):
    if os.name != 'nt':
        return False
    pythoncom.CoInitialize()
    try:
        input_path = str(Path(input_path).absolute())
        output_path = str(Path(output_path).absolute())
        if ext in ['.doc', '.docx']:
            word = win32com.client.DispatchEx("Word.Application")
            doc = word.Documents.Open(input_path)
            doc.SaveAs(output_path, FileFormat=17)
            doc.Close()
            word.Quit()
            return True
        elif ext in ['.xls', '.xlsx']:
            excel = win32com.client.DispatchEx("Excel.Application")
            wb = excel.Workbooks.Open(input_path)
            wb.ExportAsFixedFormat(0, output_path)
            wb.Close(False)
            excel.Quit()
            return True
        elif ext in ['.ppt', '.pptx']:
            ppt = win32com.client.DispatchEx("PowerPoint.Application")
            pres = ppt.Presentations.Open(input_path, WithWindow=False)
            pres.SaveAs(output_path, 32)
            pres.Close()
            ppt.Quit()
            return True
    except Exception as e:
        print(f"Office Error: {e}")
    finally:
        pythoncom.CoUninitialize()
    return False


def linux_office_to_pdf(input_path: str, output_path: str):
    """Convert Office files to PDF using LibreOffice on Linux."""
    import subprocess
    try:
        # LibreOffice wants an output directory, not a full path
        output_dir = Path(output_path).parent
        cmd = [
            "libreoffice",
            "--headless",
            "--convert-to", "pdf",
            "--outdir", str(output_dir),
            input_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        # LibreOffice creates a file with the same name but .pdf extension in the outdir
        # We need to rename it to our target output_path if it's different
        input_stem = Path(input_path).stem
        created_pdf = output_dir / f"{input_stem}.pdf"
        
        if created_pdf.exists():
            if str(created_pdf) != output_path:
                shutil.move(str(created_pdf), output_path)
            return True
        else:
            print(f"LibreOffice error: {result.stderr}")
            return False
    except Exception as e:
        print(f"Linux Office Error: {e}")
        return False


async def convert_file_to_pdf(input_path: str, output_path: str):
    input_p = Path(input_path)
    output_p = Path(output_path)
    ext = input_p.suffix.lower()
    try:
        if ext in ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp']:
            image = Image.open(input_p)
            if image.mode in ("RGBA", "P", "LA"): 
                image = image.convert("RGB")
            image.save(output_p, "PDF", resolution=100.0)
            return True
        
        if os.name == 'nt':
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, windows_office_to_pdf, str(input_p), str(output_p), ext)
        else:
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, linux_office_to_pdf, str(input_p), str(output_p))
    except Exception as e:
        print(f"System Error: {e}")
        return False


def extract_from_pdf(pdf_path: str, extract_id: str):
    try:
        pdf_p = Path(pdf_path)
        output_base = EXTRACTED_DIR / extract_id
        output_base.mkdir(exist_ok=True)
        
        text_dir = output_base / "text"
        tables_dir = output_base / "tables"
        images_dir = output_base / "images"
        text_dir.mkdir(exist_ok=True)
        tables_dir.mkdir(exist_ok=True)
        images_dir.mkdir(exist_ok=True)
        
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        pipeline_options.do_table_structure = True
        pipeline_options.generate_picture_images = True
        
        doc_converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
        
        result = doc_converter.convert(str(pdf_p))
        doc = result.document
        
        md_content = doc.export_to_markdown()
        text_file = text_dir / "extracted_text.md"
        with open(text_file, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        try:
            plain_text = doc.export_to_text()
        except AttributeError:
            plain_text = re.sub(r'[#*`\[\]()]', '', md_content)
        
        txt_file = text_dir / "extracted_text.txt"
        with open(txt_file, "w", encoding="utf-8") as f:
            f.write(plain_text)
        
        table_count = 0
        if hasattr(doc, 'tables') and doc.tables:
            for i, table in enumerate(doc.tables):
                try:
                    df = table.export_to_dataframe(doc)
                    if not df.empty:
                        csv_path = tables_dir / f"table_{i+1}.csv"
                        df.to_csv(csv_path, index=False, encoding="utf-8-sig")
                        excel_path = tables_dir / f"table_{i+1}.xlsx"
                        df.to_excel(excel_path, index=False, engine='openpyxl')
                        table_count += 1
                except Exception as e:
                    print(f"Error extracting table {i+1}: {e}")
        
        image_count = 0
        image_filenames = []
        if hasattr(doc, 'pictures') and doc.pictures:
            for i, picture in enumerate(doc.pictures):
                try:
                    image = picture.get_image(doc)
                    if image:
                        page_no = picture.prov[0].page_no if picture.prov else 0
                        filename = f"image_{i+1}_page_{page_no}.png"
                        img_path = images_dir / filename
                        image.save(img_path, "PNG")
                        image_filenames.append(filename)
                        image_count += 1
                except Exception as e:
                    print(f"Error extracting image {i+1}: {e}")
        
        summary = {
            "pdf_filename": pdf_p.name,
            "extracted_at": extract_id,
            "text_files": 2,
            "tables_count": table_count,
            "images_count": image_count,
            "images": image_filenames,
        }
        
        summary_file = output_base / "summary.txt"
        with open(summary_file, "w", encoding="utf-8") as f:
            f.write("=" * 60 + "\nPDF EXTRACTION SUMMARY\n" + "=" * 60 + "\n\n")
            f.write(f"Source PDF: {summary['pdf_filename']}\n")
            f.write(f"Extraction ID: {summary['extracted_at']}\n\n")
            f.write(f"Text Files: {summary['text_files']}\n")
            f.write(f"Tables Extracted: {summary['tables_count']}\n")
            f.write(f"Images Extracted: {summary['images_count']}\n")
            
        return {
            "success": True,
            "extract_id": extract_id,
            "summary": summary,
            "output_path": str(output_base)
        }
        
    except Exception as e:
        print(f"Extraction error: {e}")
        return {
            "success": False,
            "error": str(e)
        }
