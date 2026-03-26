from __future__ import annotations

from pathlib import Path

from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

from app.ai.generation.llm_client import LLMClient
from app.core.logging import logger

# ──────────────────────────────────────────────
# Slide Generation Prompt Template
# ──────────────────────────────────────────────

SYSTEM_PROMPT = """Bạn là chuyên gia thiết kế bài giảng và slide thuyết trình.

Nhiệm vụ của bạn là tạo slide bài giảng chất lượng cao từ nội dung được cung cấp.

## YÊU CẦU BẮT BUỘC

* Chỉ trả về JSON hợp lệ (KHÔNG markdown, KHÔNG giải thích)
* Không được trả về text ngoài JSON

## CẤU TRÚC OUTPUT

{
"title": "Tiêu đề toàn bộ bài",
"slides": [
  {
    "title": "Tiêu đề slide",
    "layout": "text_image",
    "elements": [
      {
        "type": "bullet",
        "content": ["ý 1", "ý 2"]
      },
      {
        "type": "image",
        "query": "english image search query"
      },
      {
        "type": "highlight",
        "content": "ý chính quan trọng"
      }
    ]
  }
]
}

## LOẠI ELEMENT

1. bullet:
   * type: "bullet"
   * content: 2–5 ý ngắn, không viết đoạn văn

2. image:
   * type: "image"
   * query: mô tả ảnh bằng TIẾNG ANH (ngắn gọn, rõ nghĩa)
   * BẮT BUỘC có trong phần lớn slide

3. highlight:
   * type: "highlight"
   * content: 1 câu ngắn là ý quan trọng nhất

## QUY TẮC NỘI DUNG

* Mỗi slide chỉ 1 ý chính
* Không viết đoạn văn dài
* Không lặp ý giữa các slide
* Ngắn gọn, dễ hiểu
* Ưu tiên trực quan (ít chữ + có hình)
* Ít nhất 70% slide phải có image

## QUY TẮC LAYOUT

* Slide đầu tiên: "title_only"
* Các slide nội dung: ưu tiên "text_image"
* Chỉ dùng "text_only" khi không phù hợp với hình

## XỬ LÝ TRƯỜNG HỢP KHÓ

Nếu không chắc nội dung:
* Vẫn phải tạo slide hợp lệ
* Giữ nội dung đơn giản, dễ hiểu
* KHÔNG được bỏ trường JSON

Chỉ trả về JSON hợp lệ."""


def _build_user_prompt(context: str, max_slides: int, tone: str) -> str:
    return (
        f"Số lượng slide tối đa: {max_slides}\n"
        f"Tone: {tone}\n\n"
        f"## NỘI DUNG ĐẦU VÀO\n\n"
        f"{context[:12000]}\n\n"
        f"Chỉ trả về JSON hợp lệ."
    )


# ──────────────────────────────────────────────
# Styling constants for PPTX export
# ──────────────────────────────────────────────

# Brand colors
BRAND_PRIMARY = RGBColor(0x4F, 0x46, 0xE5)   # Indigo-600
BRAND_LIGHT = RGBColor(0xEE, 0xF2, 0xFF)     # Indigo-50
HIGHLIGHT_BG = RGBColor(0xFE, 0xF3, 0xC7)    # Amber-100
HIGHLIGHT_TEXT = RGBColor(0x92, 0x40, 0x0E)   # Amber-800
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_TEXT = RGBColor(0x1E, 0x1E, 0x2E)
BODY_TEXT = RGBColor(0x4B, 0x55, 0x63)        # Gray-600
SUBTITLE_TEXT = RGBColor(0x6B, 0x72, 0x80)    # Gray-500
IMG_PLACEHOLDER_BG = RGBColor(0xE0, 0xE7, 0xFF)  # Light indigo


class SlideGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    # ────────── LLM outline generation ──────────

    def generate_outline(self, context: str, max_slides: int = 8, tone: str = "teacher") -> dict:
        fallback = {
            "title": "Bài giảng tổng hợp",
            "title": "Bài giảng tổng hợp",
            "slides": [
                {
                    "title": "Giới thiệu",
                    "layout": "title_only",
                    "elements": [
                        {"type": "bullet", "content": ["Mục tiêu bài học", "Nội dung chính"]},
                    ],
                },
                {
                    "title": "Kiến thức cốt lõi",
                    "layout": "text_image",
                    "elements": [
                        {"type": "bullet", "content": ["Khái niệm", "Ví dụ", "Ứng dụng"]},
                        {"type": "image", "query": "knowledge concept diagram"},
                        {"type": "highlight", "content": "Nắm vững kiến thức nền tảng"},
                    ],
                },
                {
                    "title": "Tổng kết",
                    "layout": "text_image",
                    "elements": [
                        {"type": "bullet", "content": ["Điểm cần nhớ", "Hướng ôn tập"]},
                        {"type": "image", "query": "summary review checklist"},
                        {"type": "highlight", "content": "Ôn tập các ý chính để ghi nhớ lâu"},
                    ],
                },
                {
                    "title": "Câu hỏi ôn tập",
                    "layout": "text_only",
                    "elements": [
                        {"type": "bullet", "content": ["Câu hỏi 1", "Câu hỏi 2"]},
                    ],
                },
            ],
        }

        user_prompt = _build_user_prompt(context, max_slides, tone)
        result = self.llm.json_response(SYSTEM_PROMPT, user_prompt, fallback)

        # Ensure slides are capped at max_slides
        slides = result.get("slides", fallback["slides"])
        result["slides"] = slides[:max_slides]
        return result

    # ────────── PPTX export (with real images) ──────────

    def export_pptx(
        self,
        outline: dict,
        output_path: str,
        image_map: dict[str, str | None] | None = None,
    ) -> str:
        """Export outline to a styled PPTX file.

        Args:
            outline: The structured slide JSON from LLM.
            output_path: Destination path for the .pptx file.
            image_map: Optional mapping ``{image_query: local_file_path}``.
                       When a query maps to a valid path the image is embedded;
                       otherwise a styled placeholder is shown.

        Returns:
            The output path string.
        """
        image_map = image_map or {}

        prs = Presentation()
        prs.slide_width = Inches(13.333)
        prs.slide_height = Inches(7.5)

        slides_data = outline.get("slides", [])
        presentation_title = outline.get("title", "Bài giảng")

        for idx, slide_data in enumerate(slides_data):
            layout = slide_data.get("layout", "text_image")
            title = slide_data.get("title", f"Slide {idx + 1}")
            elements = slide_data.get("elements", [])

            # Extract elements by type
            bullets: list[str] = []
            highlight: str | None = None
            image_query: str | None = None
            for elem in elements:
                etype = elem.get("type")
                if etype == "bullet":
                    bullets = elem.get("content", [])
                elif etype == "highlight":
                    highlight = elem.get("content", "")
                elif etype == "image":
                    image_query = elem.get("query", "")

            # Resolve image path from map
            image_path: str | None = None
            if image_query:
                image_path = image_map.get(image_query)

            if layout == "title_only":
                self._add_title_slide(prs, title, presentation_title, bullets, image_path)
            elif layout == "text_only":
                self._add_text_only_slide(prs, title, bullets, highlight, idx, len(slides_data))
            else:  # text_image
                self._add_text_image_slide(prs, title, bullets, highlight, image_query, image_path, idx, len(slides_data))

        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)
        prs.save(output)
        return str(output)

    # ──────────────────────────────────────────────
    # Private slide builders
    # ──────────────────────────────────────────────

    def _add_title_slide(
        self,
        prs: Presentation,
        title: str,
        subtitle: str,
        bullets: list[str],
        image_path: str | None = None,
    ) -> None:
        slide_layout = prs.slide_layouts[6]  # Blank layout
        slide = prs.slides.add_slide(slide_layout)

        # Background
        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = BRAND_PRIMARY

        # Title
        left, top = Inches(1.5), Inches(2.2)
        width, height = Inches(10), Inches(1.5)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(44)
        p.font.bold = True
        p.font.color.rgb = WHITE
        p.alignment = PP_ALIGN.CENTER

        # Subtitle
        left, top = Inches(2.5), Inches(4.0)
        width, height = Inches(8), Inches(1.0)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = subtitle
        p.font.size = Pt(22)
        p.font.color.rgb = BRAND_LIGHT
        p.alignment = PP_ALIGN.CENTER

        # Bullet summary below subtitle
        if bullets:
            left, top = Inches(3), Inches(5.2)
            width, height = Inches(7), Inches(1.5)
            txBox = slide.shapes.add_textbox(left, top, width, height)
            tf = txBox.text_frame
            tf.word_wrap = True
            for b in bullets[:3]:
                pg = tf.add_paragraph()
                pg.text = f"• {b}"
                pg.font.size = Pt(16)
                pg.font.color.rgb = WHITE
                pg.alignment = PP_ALIGN.CENTER

    def _add_text_only_slide(
        self,
        prs: Presentation,
        title: str,
        bullets: list[str],
        highlight: str | None,
        idx: int,
        total: int,
    ) -> None:
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)

        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = WHITE

        self._add_accent_bar(slide)
        self._add_slide_title(slide, title)

        # Bullets
        left, top = Inches(1.5), Inches(2.0)
        width, height = Inches(10), Inches(3.5)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        tf.word_wrap = True
        for b in bullets:
            pg = tf.add_paragraph()
            pg.text = f"▸  {b}"
            pg.font.size = Pt(20)
            pg.font.color.rgb = BODY_TEXT
            pg.space_after = Pt(12)

        if highlight:
            self._add_highlight_box(slide, highlight, top_pos=Inches(5.5))

        self._add_slide_number(slide, idx, total)

    def _add_text_image_slide(
        self,
        prs: Presentation,
        title: str,
        bullets: list[str],
        highlight: str | None,
        image_query: str | None,
        image_path: str | None,
        idx: int,
        total: int,
    ) -> None:
        slide_layout = prs.slide_layouts[6]
        slide = prs.slides.add_slide(slide_layout)

        bg = slide.background
        fill = bg.fill
        fill.solid()
        fill.fore_color.rgb = WHITE

        self._add_accent_bar(slide)
        self._add_slide_title(slide, title)

        # Left column — bullets
        left, top = Inches(1.5), Inches(2.0)
        width, height = Inches(5.5), Inches(3.5)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        tf.word_wrap = True
        for b in bullets:
            pg = tf.add_paragraph()
            pg.text = f"▸  {b}"
            pg.font.size = Pt(20)
            pg.font.color.rgb = BODY_TEXT
            pg.space_after = Pt(12)

        # Right column — REAL image or placeholder
        img_left = Inches(7.8)
        img_top = Inches(1.8)
        img_w = Inches(4.5)
        img_h = Inches(3.5)

        if image_path and Path(image_path).exists():
            # ✅ Embed the actual image
            try:
                slide.shapes.add_picture(image_path, img_left, img_top, img_w, img_h)
                logger.debug("Embedded image for '%s'", image_query)
            except Exception as exc:
                logger.warning("Failed to embed image '%s': %s", image_path, exc)
                self._add_image_placeholder(slide, image_query, img_left, img_top, img_w, img_h)
        elif image_query:
            # Fallback: styled placeholder
            self._add_image_placeholder(slide, image_query, img_left, img_top, img_w, img_h)

        if highlight:
            self._add_highlight_box(slide, highlight, top_pos=Inches(5.8))

        self._add_slide_number(slide, idx, total)

    # ──────────────────────────────────────────────
    # Reusable helpers
    # ──────────────────────────────────────────────

    def _add_image_placeholder(self, slide, query: str | None, left, top, width, height) -> None:
        """Add a branded rectangle with the image query text as placeholder."""
        shape = slide.shapes.add_shape(1, left, top, width, height)  # RECTANGLE
        shape.fill.solid()
        shape.fill.fore_color.rgb = IMG_PLACEHOLDER_BG
        shape.line.fill.background()

        label = query or "image"
        txBox = slide.shapes.add_textbox(
            left + Inches(0.3), top + Inches(1.2),
            width - Inches(0.6), Inches(1.0),
        )
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = f"🖼  {label}"
        p.font.size = Pt(12)
        p.font.color.rgb = SUBTITLE_TEXT
        p.alignment = PP_ALIGN.CENTER

    def _add_accent_bar(self, slide) -> None:
        shape = slide.shapes.add_shape(
            1, Inches(1.5), Inches(0.9), Inches(0.6), Inches(0.08),
        )
        shape.fill.solid()
        shape.fill.fore_color.rgb = BRAND_PRIMARY
        shape.line.fill.background()

    def _add_slide_title(self, slide, title: str) -> None:
        left, top = Inches(1.5), Inches(1.1)
        width, height = Inches(10), Inches(0.8)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = title
        p.font.size = Pt(30)
        p.font.bold = True
        p.font.color.rgb = DARK_TEXT

    def _add_highlight_box(self, slide, text: str, top_pos) -> None:
        left = Inches(1.5)
        width, height = Inches(10), Inches(0.7)
        shape = slide.shapes.add_shape(1, left, top_pos, width, height)
        shape.fill.solid()
        shape.fill.fore_color.rgb = HIGHLIGHT_BG
        shape.line.fill.background()

        txBox = slide.shapes.add_textbox(
            left + Inches(0.3), top_pos + Inches(0.1),
            width - Inches(0.6), height - Inches(0.2),
        )
        tf = txBox.text_frame
        tf.word_wrap = True
        p = tf.paragraphs[0]
        p.text = f"⭐  {text}"
        p.font.size = Pt(16)
        p.font.bold = True
        p.font.color.rgb = HIGHLIGHT_TEXT
        p.alignment = PP_ALIGN.LEFT

    def _add_slide_number(self, slide, idx: int, total: int) -> None:
        left = Inches(11.5)
        top = Inches(6.9)
        width, height = Inches(1.5), Inches(0.4)
        txBox = slide.shapes.add_textbox(left, top, width, height)
        tf = txBox.text_frame
        p = tf.paragraphs[0]
        p.text = f"{idx + 1} / {total}"
        p.font.size = Pt(11)
        p.font.color.rgb = SUBTITLE_TEXT
        p.alignment = PP_ALIGN.RIGHT


# ──────────────────────────────────────────────
# Utility: Extract all image queries from outline
# ──────────────────────────────────────────────

def extract_image_queries(outline: dict) -> list[str]:
    """Return a deduplicated list of image queries from a slide outline."""
    queries: list[str] = []
    seen: set[str] = set()
    for slide in outline.get("slides", []):
        for elem in slide.get("elements", []):
            if elem.get("type") == "image":
                q = (elem.get("query") or "").strip()
                if q and q not in seen:
                    queries.append(q)
                    seen.add(q)
    return queries
