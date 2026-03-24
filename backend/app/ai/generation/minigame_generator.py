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
                            "question": "Noi dung chinh cua bai hoc la gi?",
                            "options": ["A", "B", "C", "D"],
                            "correct_answer": "A",
                            "explanation": "A la dap an phu hop theo tai lieu.",
                        }
                    ],
                },
                {
                    "type": "flashcard",
                    "title": "Flashcard",
                    "items": [
                        {"id": "f1", "front": "Khai niem", "back": "Dinh nghia ngan gon"}
                    ],
                },
            ]
        }

        system_prompt = "You generate educational minigames in Vietnamese and return strict JSON."
        user_prompt = (
            f"Sinh cac game {game_types} dua tren tai lieu sau. "
            "Game types: mcq, fill_blank, matching, flashcard. "
            "Tra ve JSON: {games:[{type,title,items:...}]}" + f"\n\n{context[:12000]}"
        )
        return self.llm.json_response(system_prompt, user_prompt, fallback)
