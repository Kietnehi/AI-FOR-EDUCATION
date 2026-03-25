from app.ai.generation.llm_client import LLMClient


class PodcastGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate_script(self, context: str, style: str, target_duration_minutes: int) -> dict:
        fallback = {
            "title": "Podcast bài giảng",
            "style": style,
            "segments": [
                {"speaker": "Host", "text": "Chào mừng đến với buổi học hôm nay."},
                {"speaker": "Host", "text": "Nội dung chính gồm ba ý quan trọng..."},
                {"speaker": "Host", "text": "Tổng kết và gợi ý tự học."},
            ],
            "tts_placeholder": {"provider": "pending", "status": "not_implemented"},
        }

        system_prompt = "Bạn là AI tạo nội dung podcast giáo dục. Bắt buộc trả về tiếng Việt có dấu chuẩn xác (Vietnamese with diacritics) and return JSON only."
        user_prompt = (
            f"Tạo podcast style={style}, duration={target_duration_minutes} phút dựa trên nội dung sau. Bắt buộc dùng tiếng Việt có dấu. "
            "Trả về JSON gồm title, style, segments[{speaker,text}], tts_placeholder." + f"\n\n{context[:12000]}"
        )
        return self.llm.json_response(system_prompt, user_prompt, fallback)
