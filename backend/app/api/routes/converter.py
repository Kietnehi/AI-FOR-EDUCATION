import uuid
import shutil
import re
import os
import csv
import asyncio
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.responses import FileResponse, JSONResponse

from app.api.dependencies import get_current_user
from app.schemas.auth import AuthUser

from app.services.converter import (
    convert_web_to_pdf,
    convert_file_to_pdf,
    extract_from_pdf,
    OUTPUT_DIR,
    UPLOAD_DIR,
    EXTRACTED_DIR
)

router = APIRouter()

async def cleanup_files(input_p=None, output_p=None):
    await asyncio.sleep(60)
    try:
        if input_p and os.path.exists(input_p): os.remove(input_p)
        if output_p and os.path.exists(output_p): os.remove(output_p)
    except: pass


@router.post("/convert-url")
async def convert_url(
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    user: AuthUser = Depends(get_current_user),
):
    file_id = str(uuid.uuid4())
    output_path = OUTPUT_DIR / f"{file_id}.pdf"
    success = await convert_web_to_pdf(url, output_path)
    if success:
        background_tasks.add_task(cleanup_files, None, str(output_path))
        safe_filename = re.sub(r'[\\/*?:"<>|]', '_', url.split('//')[-1])[:50]
        if not safe_filename.endswith('.pdf'):
            safe_filename += '.pdf'
        return FileResponse(output_path, filename=safe_filename, media_type='application/pdf')
    raise HTTPException(status_code=500, detail="Conversion failed")


@router.post("/convert-file")
async def convert_upload(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    file_id = str(uuid.uuid4())
    input_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
    output_path = OUTPUT_DIR / f"{file_id}.pdf"
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    success = await convert_file_to_pdf(str(input_path), str(output_path))
    background_tasks.add_task(cleanup_files, str(input_path), str(output_path))
    
    if success:
        original_name = Path(file.filename).stem
        safe_name = re.sub(r'[\\/*?:"<>|]', '_', original_name)
        return FileResponse(output_path, filename=f"{safe_name}.pdf", media_type='application/pdf')
    
    raise HTTPException(status_code=500, detail="Conversion failed on Windows")


@router.post("/extract-pdf")
async def extract_pdf(
    background_tasks: BackgroundTasks, 
    file: UploadFile = File(...),
    user: AuthUser = Depends(get_current_user),
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    extract_id = str(uuid.uuid4())
    input_path = UPLOAD_DIR / f"{extract_id}_{file.filename}"
    
    with open(input_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, extract_from_pdf, str(input_path), extract_id)
    
    if not result.get("success"):
        background_tasks.add_task(cleanup_files, str(input_path))
        raise HTTPException(status_code=500, detail=f"Extraction failed: {result.get('error', 'Unknown')}")
    
    # Just cleanup the uploaded PDF, keep the extracted dir for viewing
    background_tasks.add_task(cleanup_files, str(input_path))
    
    return JSONResponse({
        "success": True,
        "extract_id": extract_id,
        "summary": result["summary"]
    })

@router.get("/extracted/{extract_id}/text")
async def get_extracted_text(
    extract_id: str,
    user: AuthUser = Depends(get_current_user),
):
    output_base = EXTRACTED_DIR / extract_id
    text_file = output_base / "text" / "extracted_text.md"
    if not text_file.exists():
        raise HTTPException(status_code=404, detail="Text not found")
    with open(text_file, "r", encoding="utf-8") as f:
        return JSONResponse({"content": f.read()})

@router.get("/extracted/{extract_id}/tables/{filename}")
async def serve_table(
    extract_id: str,
    filename: str,
    user: AuthUser = Depends(get_current_user),
):
    table_file = EXTRACTED_DIR / extract_id / "tables" / filename
    if not table_file.exists():
        raise HTTPException(status_code=404, detail="Table not found")
    return FileResponse(table_file)

@router.get("/extracted/{extract_id}/tables/{filename}/data")
async def get_table_data(
    extract_id: str,
    filename: str,
    user: AuthUser = Depends(get_current_user),
):
    """Return CSV table data as JSON for inline rendering."""
    csv_name = Path(filename).stem + ".csv"
    csv_file = EXTRACTED_DIR / extract_id / "tables" / csv_name
    if not csv_file.exists():
        raise HTTPException(status_code=404, detail="Table CSV not found")
    rows = []
    with open(csv_file, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        for row in reader:
            rows.append(row)
    return JSONResponse({"headers": headers, "rows": rows})

@router.get("/extracted/{extract_id}/images/{filename}")
async def serve_image(
    extract_id: str,
    filename: str,
    user: AuthUser = Depends(get_current_user),
):
    image_file = EXTRACTED_DIR / extract_id / "images" / filename
    if not image_file.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(image_file)

@router.get("/extracted/{extract_id}/download")
async def download_extracted(
    extract_id: str,
    background_tasks: BackgroundTasks,
    user: AuthUser = Depends(get_current_user),
):
    output_base = EXTRACTED_DIR / extract_id
    if not output_base.exists():
        raise HTTPException(status_code=404, detail="Extraction not found")
    
    import zipfile
    zip_filename = f"extracted_{extract_id}.zip"
    zip_path = EXTRACTED_DIR / zip_filename
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(output_base):
            for file_name in files:
                file_path = Path(root) / file_name
                arcname = file_path.relative_to(output_base)
                zipf.write(file_path, arcname)
    
    async def cleanup_zip():
        await asyncio.sleep(120)
        try:
            if zip_path.exists(): os.remove(zip_path)
            # We keep the output_base alive for a while? Or just remove it if downloaded.
            # Usually we don't clean output_base here if we still want to view it.
        except: pass
    background_tasks.add_task(cleanup_zip)
    
    return FileResponse(
        zip_path, 
        filename=zip_filename, 
        media_type='application/zip'
    )
