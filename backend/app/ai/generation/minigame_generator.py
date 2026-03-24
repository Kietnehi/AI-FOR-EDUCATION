from app.ai.generation.llm_client import LLMClient


class MinigameGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate(self, context: str, game_types: list[str]) -> dict:
        fallback = {
            "games": [
                {
                    "type": "mcq",
                    "title": "Quiz nhanh",
                    "items": [
                        {
                            "id": "q1",
                            "question": "Nội dung chính của bài học là gì?",
                            "options": ["A", "B", "C", "D"],
                            "correct_answer": "A",
                            "explanation": "A là đáp án phù hợp theo tài liệu.",
                        }
                    ],
                },
                {
                    "type": "flashcard",
                    "title": "Flashcard",
                    "items": [
                        {"id": "f1", "front": "Khái niệm", "back": "Định nghĩa ngắn gọn"}
                    ],
                },
            ]
        }

        system_prompt = "Bạn là chuyên gia tạo trò chơi giáo dục. Bắt buộc tạo nội dung bằng tiếng Việt có dấu chuẩn xác (Vietnamese with diacritics) and return strict JSON."
        user_prompt = (
            f"Sinh các game {game_types} dựa trên tài liệu sau. Bắt buộc dùng tiếng Việt có dấu. "
            "Game types: mcq, fill_blank, matching, flashcard. "
            "Trả về JSON: {games:[{type,title,items:...}]}" + f"\n\n{context[:12000]}"
        )
        return self.llm.json_response(system_prompt, user_prompt, fallback)
