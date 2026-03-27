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

        game_type = generated.get("game_type", "quiz_mixed")
        json_content = generated.get("json_content", {})

        if game_type == "scenario_branching":
            scored_items, score, max_score = self._score_scenario(json_content, answers)
            skills_gained = self._extract_skills_from_scenario(json_content, answers)
            improvement_tips = self._extract_tips_from_scenario(json_content, answers)
        elif game_type == "shooting_quiz":
            scored_items, score, max_score = self._score_shooting_quiz(json_content, answers)
            skills_gained = self._extract_skills_from_shooting(json_content)
            improvement_tips = self._extract_tips_from_shooting(score, max_score)
        else:
            # quiz_mixed or flashcard
            scored_items = self._score_quiz(json_content, answers, game_type)
            score = float(sum(1 for item in scored_items if item["is_correct"]))
            max_score = float(len(scored_items)) if scored_items else 1.0
            skills_gained = []
            improvement_tips = []

        now = utc_now()
        payload = {
            "user_id": user_id,
            "material_id": generated["material_id"],
            "generated_content_id": generated_content_id,
            "game_type": game_type,
            "answers": answers,
            "score": score,
            "max_score": max_score,
            "feedback": scored_items,
            "skills_gained": skills_gained,
            "improvement_tips": improvement_tips,
            "started_at": now,
            "completed_at": now,
        }
        return await self.repo.create_attempt(payload)

    async def get_attempt(self, attempt_id: str) -> dict:
        attempt = await self.repo.get_attempt(parse_object_id(attempt_id))
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return attempt

    def _score_quiz(self, json_content: dict, answers: list[dict], game_type: str) -> list[dict]:
        """Score quiz_mixed or flashcard."""
        items = json_content.get("items", [])
        
        # Ensure all items have IDs
        for idx, item in enumerate(items):
            if not item.get("id"):
                item["id"] = f"{game_type}_{idx}"
        
        answer_map = {item.get("id"): item for item in answers}
        feedback: list[dict] = []

        for item in items:
            item_id = item.get("id")
            if not item_id:
                continue

            user_answer = answer_map.get(item_id, {}).get("answer")
            question_type = item.get("question_type", "")

            # Flashcard: self-study, any answer is "correct"
            if game_type == "flashcard":
                is_correct = bool(user_answer)
                explanation = "Flashcard self-review mode"
                correct_answer = item.get("back", "")
            # multiple_select: user must select ALL correct answers
            elif question_type == "multiple_select":
                correct_answers = set(item.get("correct_answers", []))
                user_answers = set(user_answer.split(",")) if isinstance(user_answer, str) else set()
                is_correct = user_answers == correct_answers
                explanation = item.get("explanation", "")
                correct_answer = ",".join(item.get("correct_answers", []))
            # true_false, mcq, fill_blank: simple match
            else:
                correct_answer = item.get("correct_answer", "")
                is_correct = str(user_answer).strip().lower() == str(correct_answer).strip().lower()
                explanation = item.get("explanation", "")

            feedback.append({
                "id": item_id,
                "question": item.get("question", item.get("front", "")),
                "question_type": question_type,
                "user_answer": user_answer,
                "correct_answer": correct_answer,
                "is_correct": is_correct,
                "explanation": explanation,
            })

        return feedback

    def _score_scenario(self, json_content: dict, answers: list[dict]) -> tuple[list[dict], float, float]:
        """Score scenario game for both legacy and strict schema formats."""
        if isinstance(json_content.get("game"), dict) and isinstance(json_content["game"].get("steps"), list):
            return self._score_scenario_strict(json_content, answers)

        """Score scenario-based learning. answers = [{"node_id": "...", "choice_id": "..."}]"""
        scenarios = json_content.get("scenarios", [])
        answer_map = {item.get("node_id"): item for item in answers}

        feedback: list[dict] = []
        total_score = 0.0
        max_node_score = 10.0  # Max points per scenario path

        for scenario in scenarios:
            scenario_id = scenario.get("id", "")
            root_node_id = scenario.get("root_node_id", "")
            nodes = {n.get("id"): n for n in scenario.get("nodes", [])}

            # Trace user path through scenario
            current_node_id = root_node_id
            path_score = 0.0
            path_feedback = []

            while current_node_id and current_node_id in nodes:
                node = nodes[current_node_id]
                user_choice_id = answer_map.get(current_node_id, {}).get("answer")

                if user_choice_id:
                    # Find the selected choice
                    choices = node.get("choices", [])
                    selected_choice = next((c for c in choices if c.get("id") == user_choice_id), None)

                    if selected_choice:
                        # Score based on impact
                        impact = selected_choice.get("impact", "neutral")
                        impact_score = {"positive": 5, "neutral": 2, "negative": 0}.get(impact, 0)
                        path_score += impact_score

                        path_feedback.append({
                            "scenario_id": scenario_id,
                            "node_id": current_node_id,
                            "chosen": selected_choice.get("text", ""),
                            "feedback": selected_choice.get("feedback", ""),
                            "impact": impact,
                            "score_gained": impact_score,
                        })

                        # Move to next node
                        current_node_id = selected_choice.get("next_node_id")
                    else:
                        break
                else:
                    break

            # If reached end node, add bonus
            end_node = nodes.get(current_node_id) if current_node_id in nodes else None
            if end_node and end_node.get("is_end", False):
                result = end_node.get("result", {})
                path_score += result.get("score", 0) / 10  # Normalize to 0-10 scale
                total_score += path_score
            else:
                # Incomplete scenario
                total_score += path_score

            feedback.extend(path_feedback)

        # Normalize scores
        max_score = float(len(scenarios) * max_node_score)
        final_score = min(total_score, max_score)

        return feedback, final_score, max_score

    def _score_shooting_quiz(self, json_content: dict, answers: list[dict]) -> tuple[list[dict], float, float]:
        """Score shooting quiz game with +10 for each correct answer."""
        game = json_content.get("game", {}) if isinstance(json_content, dict) else {}
        questions = game.get("questions", []) if isinstance(game, dict) else []
        tracking = json_content.get("tracking", {}) if isinstance(json_content, dict) else {}

        score_per_correct = float(tracking.get("score_per_correct", 10) or 10)
        answer_map = {item.get("id"): item for item in answers if item.get("id")}
        feedback: list[dict] = []

        total_score = 0.0
        for question in questions:
            question_id = question.get("id")
            if not question_id:
                continue

            options = question.get("answers", [])
            correct_option = next((opt for opt in options if opt.get("is_correct") is True), None)
            correct_answer_id = correct_option.get("id") if isinstance(correct_option, dict) else None
            correct_answer_text = correct_option.get("text") if isinstance(correct_option, dict) else None

            user_answer = answer_map.get(question_id, {}).get("answer")
            is_correct = bool(user_answer and correct_answer_id and str(user_answer).strip().upper() == str(correct_answer_id).strip().upper())
            gained = score_per_correct if is_correct else 0.0
            total_score += gained

            feedback.append(
                {
                    "id": question_id,
                    "question": question.get("question", ""),
                    "user_answer": user_answer,
                    "correct_answer": correct_answer_id,
                    "correct_answer_text": correct_answer_text,
                    "is_correct": is_correct,
                    "score_gained": gained,
                    "explanation": question.get("explanation", ""),
                }
            )

        declared_max = tracking.get("max_score")
        if isinstance(declared_max, (int, float)) and declared_max > 0:
            max_score = float(declared_max)
        else:
            max_score = float(len(questions) * score_per_correct) if questions else 100.0

        return feedback, float(total_score), float(max(max_score, 1.0))

    def _score_scenario_strict(self, json_content: dict, answers: list[dict]) -> tuple[list[dict], float, float]:
        """Score strict schema scenario game. answers accepts step_id/node_id + answer/choice_id."""
        game = json_content.get("game", {})
        steps = game.get("steps", [])
        step_map = {s.get("id"): s for s in steps if s.get("id")}

        answer_map = {}
        for item in answers:
            step_id = item.get("step_id") or item.get("node_id")
            if step_id:
                answer_map[step_id] = item

        initial_score = float(game.get("initial_state", {}).get("score", 0))
        total_score = initial_score
        max_score = initial_score
        feedback: list[dict] = []

        for step in steps:
            step_id = step.get("id")
            if not step_id:
                continue

            choices = step.get("choices", [])
            step_max = max((float((c.get("effects") or {}).get("score", 0)) for c in choices), default=0.0)
            max_score += max(step_max, 0.0)

            selected_raw = answer_map.get(step_id, {}).get("answer")
            selected_choice_id = answer_map.get(step_id, {}).get("choice_id") or selected_raw

            selected_choice = next((c for c in choices if c.get("id") == selected_choice_id), None)
            if not selected_choice:
                continue

            effects = selected_choice.get("effects", {})
            gained = float(effects.get("score", 0))
            total_score += gained

            feedback.append({
                "step_id": step_id,
                "scenario": step.get("scenario", ""),
                "knowledge_point": step.get("knowledge_point", ""),
                "choice_id": selected_choice.get("id"),
                "choice_text": selected_choice.get("text", ""),
                "user_answer": selected_raw,
                "score_gained": gained,
                "feedback": selected_choice.get("feedback", ""),
                "learning_explanation": selected_choice.get("learning_explanation", ""),
                "next_step": selected_choice.get("next_step"),
            })

        total_score = float(max(total_score, 0.0))
        max_score = float(max(max_score, 1.0))
        if total_score > max_score:
            total_score = max_score

        return feedback, total_score, max_score

    def _extract_skills_from_scenario(self, json_content: dict, answers: list[dict]) -> list[str]:
        """Extract skills gained from scenario completion."""
        if isinstance(json_content.get("game"), dict) and isinstance(json_content["game"].get("steps"), list):
            return self._extract_skills_from_scenario_strict(json_content, answers)

        scenarios = json_content.get("scenarios", [])
        answer_map = {item.get("node_id"): item for item in answers}
        skills = set()

        for scenario in scenarios:
            root_node_id = scenario.get("root_node_id", "")
            nodes = {n.get("id"): n for n in scenario.get("nodes", [])}
            current_node_id = root_node_id

            while current_node_id and current_node_id in nodes:
                node = nodes[current_node_id]
                user_choice_id = answer_map.get(current_node_id, {}).get("answer")

                if user_choice_id:
                    selected_choice = next((c for c in node.get("choices", []) if c.get("id") == user_choice_id), None)
                    current_node_id = selected_choice.get("next_node_id") if selected_choice else None
                else:
                    break

            # Get skills from end node
            end_node = nodes.get(current_node_id) if current_node_id in nodes else None
            if end_node and end_node.get("is_end", False):
                result = end_node.get("result", {})
                skills.update(result.get("skills_gained", []))

        return list(skills)

    def _extract_skills_from_scenario_strict(self, json_content: dict, answers: list[dict]) -> list[str]:
        game = json_content.get("game", {})
        steps = game.get("steps", [])
        answer_map = {}
        for item in answers:
            step_id = item.get("step_id") or item.get("node_id")
            if step_id:
                answer_map[step_id] = item

        skill_scores: dict[str, float] = {}
        for step in steps:
            step_id = step.get("id")
            if not step_id:
                continue
            selected_raw = answer_map.get(step_id, {}).get("answer")
            selected_choice_id = answer_map.get(step_id, {}).get("choice_id") or selected_raw
            selected_choice = next((c for c in step.get("choices", []) if c.get("id") == selected_choice_id), None)
            if not selected_choice:
                continue
            effects_skills = (selected_choice.get("effects") or {}).get("skills") or {}
            for name, val in effects_skills.items():
                try:
                    skill_scores[name] = skill_scores.get(name, 0.0) + float(val)
                except (TypeError, ValueError):
                    continue

        return [name for name, val in skill_scores.items() if val > 0]

    def _extract_tips_from_scenario(self, json_content: dict, answers: list[dict]) -> list[str]:
        """Extract improvement tips from scenario completion."""
        if isinstance(json_content.get("game"), dict) and isinstance(json_content["game"].get("steps"), list):
            return self._extract_tips_from_scenario_strict(json_content)

        scenarios = json_content.get("scenarios", [])
        answer_map = {item.get("node_id"): item for item in answers}
        tips = set()

        for scenario in scenarios:
            root_node_id = scenario.get("root_node_id", "")
            nodes = {n.get("id"): n for n in scenario.get("nodes", [])}
            current_node_id = root_node_id

            while current_node_id and current_node_id in nodes:
                node = nodes[current_node_id]
                user_choice_id = answer_map.get(current_node_id, {}).get("answer")

                if user_choice_id:
                    selected_choice = next((c for c in node.get("choices", []) if c.get("id") == user_choice_id), None)
                    current_node_id = selected_choice.get("next_node_id") if selected_choice else None
                else:
                    break

            # Get tips from end node
            end_node = nodes.get(current_node_id) if current_node_id in nodes else None
            if end_node and end_node.get("is_end", False):
                result = end_node.get("result", {})
                tips.update(result.get("improvement_tips", []))

        return list(tips)

    def _extract_tips_from_scenario_strict(self, json_content: dict) -> list[str]:
        endings = ((json_content.get("game") or {}).get("endings") or [])
        tips = []
        for ending in endings:
            suggestion = ending.get("suggestion")
            if suggestion:
                tips.append(suggestion)
        return tips

    def _extract_skills_from_shooting(self, json_content: dict) -> list[str]:
        tracking = json_content.get("tracking", {}) if isinstance(json_content, dict) else {}
        skills = tracking.get("skills", []) if isinstance(tracking, dict) else []
        if isinstance(skills, list):
            return [str(skill) for skill in skills if str(skill).strip()]
        return ["rag_knowledge", "critical_thinking"]

    def _extract_tips_from_shooting(self, score: float, max_score: float) -> list[str]:
        accuracy = (score / max_score) if max_score > 0 else 0.0
        if accuracy >= 0.8:
            return [
                "Tuyet voi. Hay tang do kho bang cach tai tao minigame voi tai lieu nang cao hon.",
                "Thu giai thich lai tung dap an dung theo cach cua ban de cu cung kien thuc.",
            ]
        if accuracy >= 0.5:
            return [
                "On lai cac phan ban hay nham va choi lai de tang toc do nhan dien dap an dung.",
                "Tap trung vao tu khoa trong cau hoi truoc khi ban de han che chon sai.",
            ]
        return [
            "Doc lai tai lieu va ghi chu cac y chinh, sau do choi lai de cung co tri nho.",
            "Sau moi cau sai, xem explanation de hieu vi sao dap an do la dung.",
        ]
