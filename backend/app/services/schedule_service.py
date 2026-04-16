import json
import httpx
from datetime import datetime, timedelta
from typing import List, Optional
from pathlib import Path
import pandas as pd
from fastapi import UploadFile
import asyncio

from app.core.config import settings
from app.repositories.schedule_repository import ScheduleRepository
from app.services.converter import extract_from_pdf
from app.ai.generation.llm_client import LLMClient

from app.core.logging import logger

class ScheduleService:
    def __init__(self, repository: ScheduleRepository) -> None:
        self.repository = repository

    async def extract_text_from_image(self, file_path: Path) -> str:
        try:
            from app.ai.parsing.ocr_space_parser import OCRSpaceParser
            # Run the synchronous parser in a separate thread
            result = await asyncio.to_thread(OCRSpaceParser.parse_image, str(file_path))
            text = result.get("text", "")
            logger.info(f"[ScheduleService] OCR Extracted Text: {text[:200]}...")
            return text
        except Exception as e:
            logger.error(f"[ScheduleService] OCR Error: {e}")
            return f"Lỗi OCR: {str(e)}"

    async def extract_text_from_pdf(self, file_path: Path) -> str:
        try:
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            logger.info(f"[ScheduleService] PDF Extracted Text: {text[:200]}...")
            return text
        except Exception as e:
            logger.error(f"[ScheduleService] PDF Parsing Error: {e}")
            return ""

    async def extract_text_from_excel(self, file_path: Path) -> str:
        try:
            df = pd.read_excel(file_path)
            text = df.to_string()
            logger.info(f"[ScheduleService] Excel Extracted Text: {text[:200]}...")
            return text
        except Exception as e:
            logger.error(f"[ScheduleService] Excel parsing error: {e}")
            return f"Excel parsing error: {str(e)}"

    async def parse_schedule_with_ai(self, text: str) -> dict:
        if not text.strip() or text.startswith("Lỗi OCR:"):
            logger.warning(f"[ScheduleService] Skipping AI parsing due to empty or error text")
            return {"events": [], "is_valid": False, "message": "Không có nội dung văn bản để phân tích."}

        # Bước 1: Kiểm duyệt nội dung (Validation Guardrail)
        validation_prompt = f"""
        Dưới đây là văn bản trích xuất từ một tệp tin:
        ---
        {text[:2000]} 
        ---
        Hãy xác định xem nội dung này có phải là một LỊCH TRÌNH, THỜI KHÓA BIỂU, hoặc DANH SÁCH CÔNG VIỆC CÓ THỜI GIAN hay không.
        
        Quy tắc trả về:
        - Nếu ĐÚNG là lịch trình: Chỉ trả về duy nhất chữ 'YES'.
        - Nếu KHÔNG PHẢI: Trả về 'NO: [Lý do ngắn gọn bằng tiếng Việt]'. Ví dụ: 'NO: Đây là một bài báo khoa học'.
        """
        
        is_valid_schedule = True
        message = "Trích xuất lịch trình thành công."
        
        try:
            llm = LLMClient()
            val_response = llm.generate("Bạn là trợ lý kiểm duyệt nội dung chuyên nghiệp.", validation_prompt).strip()
            
            if val_response.upper().startswith("NO"):
                is_valid_schedule = False
                message = val_response[3:].strip() if len(val_response) > 3 else "Tài liệu này không chứa thông tin lịch trình hợp lệ."
                logger.warning(f"[ScheduleService] Content rejected: {message}")
                return {"events": [], "is_valid": False, "message": message}
            
            if "YES" not in val_response.upper():
                # Trường hợp AI trả lời loằng ngoằng không theo format
                logger.warning(f"[ScheduleService] Ambiguous validation response: {val_response}")
                # Vẫn cho qua bước sau nhưng đề phòng
        except Exception as e:
            logger.error(f"[ScheduleService] Validation Error: {e}")

        # Bước 2: Bóc tách dữ liệu
        # (tiếp tục logic cũ...)
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        
        user_prompt = f"""
        HÃY TRÍCH XUẤT TOÀN BỘ CÁC SỰ KIỆN TỪ VĂN BẢN SAU. KHÔNG ĐƯỢC BỎ SÓT BẤT KỲ MỘT SỰ KIỆN NÀO:
        ---
        {text}
        ---
        
        YÊU CẦU QUAN TRỌNG:
        1. Phải trích xuất TẤT CẢ các mốc thời gian và sự kiện có trong tài liệu. Nếu tài liệu dài, hãy kiên trì trích xuất đầy đủ.
        2. Nếu văn bản KHÔNG chứa thông tin về lịch trình hoặc các sự kiện cụ thể, hãy trả về mảng events rỗng: {{ "events": [] }}.
        3. Định dạng kết quả là một JSON Object duy nhất: {{ "events": [ ... ] }}. 
        4. Mỗi sự kiện phải đầy đủ các trường: 
           - title: Tên sự kiện (ví dụ: Học môn Toán)
           - start_time: Thời gian bắt đầu (Định dạng: YYYY-MM-DDTHH:mm:ss)
           - end_time: Thời gian kết thúc (Định dạng tương tự)
           - location: Địa điểm (nếu có)
           - notes: Ghi chú hoặc mô tả chi tiết (nếu có)
        
        Bối cảnh thời gian để tính toán ngày:
        - Hôm nay là: {today.strftime('%A %Y-%m-%d')} (Thứ {today.weekday() + 2 if today.weekday() < 6 else 1}).
        - Thứ 2 của tuần này là ngày: {monday.strftime('%Y-%m-%d')}.
        
        Quy tắc tính ngày:
        - Sử dụng ngày của tuần HIỆN TẠI (tuần có ngày Thứ 2 là {monday.strftime('%Y-%m-%d')}).
        - Nếu lịch chỉ ghi 'Thứ 3', hãy lấy ngày { (monday + timedelta(days=1)).strftime('%Y-%m-%d') }.
        - Áp dụng tương tự cho các thứ khác.
        """

        system_prompt = """
        Bạn là một chuyên gia trích xuất dữ liệu cực kỳ chi tiết và chính xác. 
        Nhiệm vụ của bạn là đọc kỹ tài liệu người dùng cung cấp và liệt kê ĐẦY ĐỦ, KHÔNG THIẾU MỘT CHI TIẾT NÀO các sự kiện có mốc thời gian.
        Hãy chú ý các bảng biểu, danh sách hoặc đoạn văn có chứa giờ giấc.
        Chỉ trả về JSON theo đúng cấu trúc yêu cầu.
        """
        try:
            llm = LLMClient()
            # Request events as an object for OpenAI compatibility
            result = llm.json_response(system_prompt, user_prompt, fallback={})
            
            # Handle both list (Gemini style) and dict (OpenAI style)
            if isinstance(result, list):
                events = result
            elif isinstance(result, dict):
                events = result.get("events", [])
            else:
                events = []

            if not events and is_valid_schedule:
                is_valid_schedule = False
                message = "Không tìm thấy sự kiện nào trong tài liệu này."

            # Ensure every event has notified: false
            for event in events:
                event["notified"] = False
                
            logger.info(f"[ScheduleService] AI Parsed {len(events)} events")
            return {
                "events": events if isinstance(events, list) else [],
                "is_valid": is_valid_schedule,
                "message": message
            }
        except Exception as e:
            logger.error(f"[ScheduleService] AI Parsing Error: {e}")
            return {"events": [], "is_valid": False, "message": f"Lỗi xử lý AI: {str(e)}"}

    async def get_schedule(self, user_id: str):
        return await self.repository.get_for_user(user_id)

    async def save_schedule(self, user_id: str, events: list[dict]):
        return await self.repository.create_or_update(user_id, events)
