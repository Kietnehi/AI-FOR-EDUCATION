from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.repositories.game_repository import GameRepository
from app.services.generation_service import GenerationService
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now


class GameService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.repo = GameRepository(db)
        self.generation_service = GenerationService(db)

    async def submit_attempt(self, generated_content_id: str, user_id: str, answers: list[dict]) -> dict:
        generated = await self.generation_service.get_generated_content(generated_content_id)
        if generated.get("content_type") != "minigame":
            raise HTTPException(status_code=400, detail="generated_content_id must be a minigame")

        games = generated.get("json_content", {}).get("games", [])
        scored_items = self._score(games, answers)
        max_score = float(len(scored_items)) if scored_items else 1.0
        score = float(sum(1 for item in scored_items if item["is_correct"]))

        now = utc_now()
        payload = {
            "user_id": user_id,
            "material_id": generated["material_id"],
            "generated_content_id": generated_content_id,
            "answers": answers,
            "score": score,
            "max_score": max_score,
            "feedback": scored_items,
            "started_at": now,
            "completed_at": now,
        }
        return await self.repo.create_attempt(payload)

    async def get_attempt(self, attempt_id: str) -> dict:
        attempt = await self.repo.get_attempt(parse_object_id(attempt_id))
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return attempt

    def _score(self, games: list[dict], answers: list[dict]) -> list[dict]:
        answer_map = {item.get("id"): item for item in answers}
        feedback: list[dict] = []
        for game in games:
            for item in game.get("items", []):
                item_id = item.get("id")
                if not item_id:
                    continue
                user_answer = answer_map.get(item_id, {}).get("answer")
                correct_answer = item.get("correct_answer")

                # Flashcards are self-study; mark answered if any value provided.
                if game.get("type") == "flashcard":
                    is_correct = bool(user_answer)
                    explanation = "Flashcard self-review mode"
                else:
                    is_correct = user_answer == correct_answer
                    explanation = item.get("explanation", "")

                feedback.append(
                    {
                        "id": item_id,
                        "question": item.get("question") or item.get("front"),
                        "user_answer": user_answer,
                        "correct_answer": correct_answer,
                        "is_correct": is_correct,
                        "explanation": explanation,
                    }
                )
        return feedback
