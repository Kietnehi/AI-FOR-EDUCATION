from pathlib import Path

from pptx import Presentation

from app.ai.generation.llm_client import LLMClient


class SlideGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate_outline(self, context: str, max_slides: int) -> dict:
        fallback = {
            "title": "Bai giang tong hop",
            "slides": [
                {"type": "title", "title": "Gioi thieu", "bullets": ["Muc tieu", "Noi dung chinh"]},
                {"type": "content", "title": "Kien thuc cot loi", "bullets": ["Khai niem", "Vi du", "Ung dung"]},
                {"type": "summary", "title": "Tong ket", "bullets": ["Diem can nho", "Huong on tap"]},
                {"type": "review", "title": "Cau hoi on tap", "bullets": ["Cau hoi 1", "Cau hoi 2"]},
            ],
        }
        system_prompt = "You create concise lecture slide outlines in Vietnamese. Output JSON with title and slides."
        user_prompt = (
            f"Tao toi da {max_slides} slides tu noi dung sau. Moi slide co type,title,bullets(3-5 y).\n\n{context[:12000]}"
        )
        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        slides = result.get("slides", fallback["slides"])
        result["slides"] = slides[:max_slides]
        return result

    def export_pptx(self, outline: dict, output_path: str) -> str:
        prs = Presentation()
        slides = outline.get("slides", [])

        for idx, slide_data in enumerate(slides):
            slide_type = slide_data.get("type", "content")
            title = slide_data.get("title", f"Slide {idx + 1}")
            bullets = slide_data.get("bullets", [])

            if slide_type == "title":
                slide_layout = prs.slide_layouts[0]
                slide = prs.slides.add_slide(slide_layout)
                slide.shapes.title.text = title
                if len(slide.placeholders) > 1:
                    slide.placeholders[1].text = " | ".join(bullets[:2])
                continue

            slide_layout = prs.slide_layouts[1]
            slide = prs.slides.add_slide(slide_layout)
            slide.shapes.title.text = title
            body = slide.shapes.placeholders[1].text_frame
            body.clear()
            for bullet in bullets:
                paragraph = body.add_paragraph()
                paragraph.text = bullet
                paragraph.level = 0

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        prs.save(output)
        return str(output)
