from app.ai.generation.llm_client import LLMClient


class PodcastGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate_script(self, context: str, style: str, target_duration_minutes: int) -> dict:
        fallback = {
            "title": "Podcast bai giang",
            "style": style,
            "segments": [
                {"speaker": "Host", "text": "Chao mung den voi buoi hoc hom nay."},
                {"speaker": "Host", "text": "Noi dung chinh gom ba y quan trong..."},
                {"speaker": "Host", "text": "Tong ket va goi y tu hoc."},
            ],
            "tts_placeholder": {"provider": "pending", "status": "not_implemented"},
        }

        system_prompt = "You create educational podcast scripts in Vietnamese and return JSON only."
        user_prompt = (
            f"Tao podcast style={style}, duration={target_duration_minutes} phut dua tren noi dung sau. "
            "Tra ve JSON gom title,style,segments[{speaker,text}],tts_placeholder." + f"\n\n{context[:12000]}"
        )
        return self.llm.json_response(system_prompt, user_prompt, fallback)
