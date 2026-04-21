import re

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.ai.generation.llm_client import LLMClient
from app.repositories.game_repository import GameRepository
from app.services.generation_service import GenerationService
from app.services.material_service import MaterialService
from app.utils.object_id import parse_object_id
from app.utils.time import utc_now


class GameService:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self.repo = GameRepository(db)
        self.generation_service = GenerationService(db)
        self.material_service = MaterialService(db)
        self.llm = LLMClient()

    async def submit_attempt(self, generated_content_id: str, user_id: str, answers: list[dict]) -> dict:
        generated = await self.generation_service.get_generated_content(
            generated_content_id,
            user_id=user_id,
        )
        if generated.get("content_type") != "minigame":
            raise HTTPException(status_code=400, detail="generated_content_id must be a minigame")

        game_type = generated.get("game_type", "quiz_mixed")
        difficulty = generated.get("difficulty", "medium")
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
            "difficulty": difficulty,
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

    async def get_attempt(self, attempt_id: str, user_id: str | None = None) -> dict:
        attempt_object_id = parse_object_id(attempt_id)
        if user_id:
            attempt = await self.repo.get_attempt_for_user(attempt_object_id, user_id)
        else:
            attempt = await self.repo.get_attempt(attempt_object_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")
        return attempt

    async def get_personalization_summary(self, material_id: str, user_id: str) -> dict:
        attempts = await self.repo.list_attempts_for_user_material(user_id=user_id, material_id=material_id, limit=60)

        if not attempts:
            material = await self.material_service.get_material(material_id, user_id=user_id)
            first_time_level_plan, allocation_reason = self._build_first_time_level_plan(material)
            auto_assigned_difficulty = first_time_level_plan[0] if first_time_level_plan else "easy"
            return {
                "material_id": material_id,
                "total_attempts": 0,
                "average_accuracy": 0.0,
                "suggested_game_type": "quiz_mixed",
                "recommended_difficulty": auto_assigned_difficulty,
                "streak_days": 0,
                "game_type_stats": [],
                "difficulty_stats": [
                    {"difficulty": "easy", "attempts": 0, "average_accuracy": 0.0},
                    {"difficulty": "medium", "attempts": 0, "average_accuracy": 0.0},
                    {"difficulty": "hard", "attempts": 0, "average_accuracy": 0.0},
                ],
                "weak_points": [],
                "next_actions": [
                    f"Lần đầu chơi: AI đã phân bổ lộ trình mức độ {', '.join(first_time_level_plan)}.",
                    "Bắt đầu với mức Dễ để hệ thống học thói quen làm bài của bạn.",
                    "Sau 2-3 lượt chơi, hệ thống sẽ tự đưa ra gợi ý cá nhân hóa chính xác hơn.",
                ],
                "is_first_time_user": True,
                "auto_assigned_difficulty": auto_assigned_difficulty,
                "first_time_level_plan": first_time_level_plan,
                "first_time_allocation_reason": allocation_reason,
                "has_tried_all_difficulties": False,
                "knowledge_notes": {},
            }

        accuracies: list[float] = []
        grouped: dict[str, list[dict]] = {}
        grouped_by_difficulty: dict[str, list[dict]] = {"easy": [], "medium": [], "hard": []}
        weak_count: dict[str, int] = {}
        played_days: set[str] = set()

        for attempt in attempts:
            max_score = float(attempt.get("max_score") or 0)
            score = float(attempt.get("score") or 0)
            accuracy = (score / max_score) if max_score > 0 else 0.0
            accuracy = max(0.0, min(1.0, accuracy))
            accuracies.append(accuracy)

            game_type = str(attempt.get("game_type") or "quiz_mixed")
            grouped.setdefault(game_type, []).append(attempt)

            played_difficulty = str(attempt.get("difficulty") or "medium").lower()
            if played_difficulty in grouped_by_difficulty:
                grouped_by_difficulty[played_difficulty].append(attempt)

            completed_at = attempt.get("completed_at")
            if completed_at is not None:
                played_days.add(str(completed_at)[:10])

            for row in attempt.get("feedback", []):
                if not isinstance(row, dict):
                    continue
                if row.get("is_correct") is True:
                    continue
                text = row.get("question") or row.get("knowledge_point") or row.get("id")
                if isinstance(text, str) and text.strip():
                    key = text.strip()[:100]
                    weak_count[key] = weak_count.get(key, 0) + 1

        overall_accuracy = round((sum(accuracies) / len(accuracies)) * 100, 1) if accuracies else 0.0

        def infer_difficulty(avg_percent: float) -> str:
            if avg_percent >= 85:
                return "hard"
            if avg_percent >= 60:
                return "medium"
            return "easy"

        game_type_stats: list[dict] = []
        for game_type, game_attempts in grouped.items():
            game_accuracies: list[float] = []
            for game_attempt in game_attempts:
                game_max = float(game_attempt.get("max_score") or 0)
                game_score = float(game_attempt.get("score") or 0)
                game_acc = (game_score / game_max) if game_max > 0 else 0.0
                game_accuracies.append(max(0.0, min(1.0, game_acc)))

            average_percent = round((sum(game_accuracies) / len(game_accuracies)) * 100, 1) if game_accuracies else 0.0
            last_played_difficulty = str(game_attempts[0].get("difficulty") or "medium")
            game_type_stats.append(
                {
                    "game_type": game_type,
                    "attempts": len(game_attempts),
                    "average_accuracy": average_percent,
                    "recommended_difficulty": infer_difficulty(average_percent),
                    "last_played_difficulty": last_played_difficulty,
                }
            )

        game_type_stats.sort(key=lambda row: row["average_accuracy"])
        suggested_game_type = game_type_stats[0]["game_type"] if game_type_stats else "quiz_mixed"
        recommended_difficulty = infer_difficulty(overall_accuracy)
        weak_points = [item for item, _ in sorted(weak_count.items(), key=lambda pair: pair[1], reverse=True)[:5]]

        difficulty_stats: list[dict] = []
        for difficulty_key in ("easy", "medium", "hard"):
            difficulty_attempts = grouped_by_difficulty.get(difficulty_key, [])
            difficulty_accuracies: list[float] = []
            for attempt in difficulty_attempts:
                game_max = float(attempt.get("max_score") or 0)
                game_score = float(attempt.get("score") or 0)
                game_acc = (game_score / game_max) if game_max > 0 else 0.0
                difficulty_accuracies.append(max(0.0, min(1.0, game_acc)))

            difficulty_stats.append(
                {
                    "difficulty": difficulty_key,
                    "attempts": len(difficulty_attempts),
                    "average_accuracy": round((sum(difficulty_accuracies) / len(difficulty_accuracies)) * 100, 1)
                    if difficulty_accuracies
                    else 0.0,
                }
            )

        has_tried_all_difficulties = all(item["attempts"] > 0 for item in difficulty_stats)
        knowledge_notes = self._build_knowledge_notes(difficulty_stats=difficulty_stats, weak_points=weak_points)

        next_actions: list[str] = []
        if overall_accuracy < 60:
            next_actions.append("Bạn nên ưu tiên mức Dễ hoặc Trung bình, tập trung sửa các câu sai lặp lại.")
        elif overall_accuracy < 85:
            next_actions.append("Bạn đang tiến bộ tốt, giữ mức Trung bình và tăng dần lên Khó ở lượt kế tiếp.")
        else:
            next_actions.append("Hiệu suất rất cao, nên chuyển sang mức Khó để tăng độ thử thách.")

        if weak_points:
            next_actions.append("Ôn lại 2-3 điểm yếu đầu danh sách trước khi bắt đầu lượt chơi mới.")
        next_actions.append(f"Game được gợi ý hiện tại: {suggested_game_type}.")
        if has_tried_all_difficulties:
            next_actions.append("Bạn đã thử đủ 3 mức độ. Hãy đọc lưu ý kiến thức theo level trước khi chọn game mới.")

        return {
            "material_id": material_id,
            "total_attempts": len(attempts),
            "average_accuracy": overall_accuracy,
            "suggested_game_type": suggested_game_type,
            "recommended_difficulty": recommended_difficulty,
            "streak_days": len(played_days),
            "game_type_stats": game_type_stats,
            "difficulty_stats": difficulty_stats,
            "weak_points": weak_points,
            "next_actions": next_actions,
            "is_first_time_user": False,
            "auto_assigned_difficulty": None,
            "first_time_level_plan": [],
            "first_time_allocation_reason": None,
            "has_tried_all_difficulties": has_tried_all_difficulties,
            "knowledge_notes": knowledge_notes if has_tried_all_difficulties else {},
        }

    def _build_first_time_level_plan(self, material: dict) -> tuple[list[str], str]:
        fallback_plan = ["easy", "medium", "hard"]
        fallback_reason = "AI đề xuất bắt đầu từ Dễ, sau đó Trung bình và Khó để tăng dần độ thử thách."

        title = str(material.get("title") or "")[:200]
        subject = str(material.get("subject") or "")[:120]
        education_level = str(material.get("education_level") or "")[:120]
        description = str(material.get("description") or "")[:400]

        system_prompt = (
            "Bạn là AI tư vấn lộ trình học minigame. "
            "Nhiệm vụ: phân bổ thứ tự 3 mức độ easy/medium/hard cho người mới chơi lần đầu. "
            "Trả về JSON hợp lệ dạng: {\"level_plan\":[\"easy\",\"medium\",\"hard\"],\"reason\":\"...\"}. "
            "BẮT BUỘC level_plan gồm đúng 3 phần tử, không lặp, chỉ dùng easy/medium/hard."
        )
        user_prompt = (
            f"Tiêu đề học liệu: {title}\n"
            f"Môn/chủ đề: {subject}\n"
            f"Cấp độ học: {education_level}\n"
            f"Mô tả: {description}\n"
            "Hãy đề xuất lộ trình chơi 3 level cho lần đầu."
        )

        response = self.llm.json_response(
            system_prompt,
            user_prompt,
            fallback={"level_plan": fallback_plan, "reason": fallback_reason},
        )

        raw_plan = response.get("level_plan") if isinstance(response, dict) else None
        reason = response.get("reason") if isinstance(response, dict) else None

        normalized_plan: list[str] = []
        if isinstance(raw_plan, list):
            for item in raw_plan:
                difficulty = str(item).lower().strip()
                if difficulty in {"easy", "medium", "hard"} and difficulty not in normalized_plan:
                    normalized_plan.append(difficulty)

        for difficulty in fallback_plan:
            if difficulty not in normalized_plan:
                normalized_plan.append(difficulty)

        final_plan = normalized_plan[:3]
        final_reason = str(reason).strip() if isinstance(reason, str) and reason.strip() else fallback_reason
        return final_plan, final_reason

    @staticmethod
    def _build_knowledge_notes(difficulty_stats: list[dict], weak_points: list[str]) -> dict[str, str]:
        stats_map = {str(item.get("difficulty")): item for item in difficulty_stats}
        top_weak_points = weak_points[:3]
        weak_points_text = ", ".join(top_weak_points) if top_weak_points else "các khái niệm cốt lõi"

        easy_acc = float(stats_map.get("easy", {}).get("average_accuracy", 0.0))
        medium_acc = float(stats_map.get("medium", {}).get("average_accuracy", 0.0))
        hard_acc = float(stats_map.get("hard", {}).get("average_accuracy", 0.0))

        return {
            "easy": (
                f"Lưu ý mức Dễ: ôn chắc nền tảng trước, tập trung vào {weak_points_text}. "
                f"Độ chính xác hiện tại ở mức Dễ là {easy_acc:.1f}% - ưu tiên làm đúng ổn định."
            ),
            "medium": (
                f"Lưu ý mức Trung bình: sau khi nắm nền tảng, hãy luyện các câu có bẫy nhẹ về {weak_points_text}. "
                f"Độ chính xác mức Trung bình là {medium_acc:.1f}%."
            ),
            "hard": (
                f"Lưu ý mức Khó: tập trung suy luận và tránh lặp lỗi ở {weak_points_text}. "
                f"Độ chính xác mức Khó là {hard_acc:.1f}% - nên đọc kỹ giải thích trước khi chọn đáp án."
            ),
        }

    async def generate_remediation_quick_start(
        self,
        material_id: str,
        user_id: str,
        difficulty: str | None = None,
        top_k_wrong_questions: int = 10,
    ) -> dict:
        summary = await self.get_personalization_summary(material_id=material_id, user_id=user_id)
        attempts = await self.repo.list_attempts_for_user_material(
            user_id=user_id,
            material_id=material_id,
            limit=120,
        )
        top_wrong_questions = self._collect_top_wrong_questions(attempts, limit=top_k_wrong_questions)
        weak_points = [item["question"] for item in top_wrong_questions[:5]]

        recommended_difficulty = str(summary.get("recommended_difficulty") or "medium").lower()
        if recommended_difficulty not in {"easy", "medium", "hard"}:
            recommended_difficulty = "medium"

        selected_difficulty = str(difficulty or recommended_difficulty).lower()
        if selected_difficulty not in {"easy", "medium", "hard"}:
            selected_difficulty = recommended_difficulty

        if top_wrong_questions:
            wrong_questions_text = "\n".join(
                f"{index}. {item['question']}"
                + (f" | Đáp án đúng tham chiếu: {item['correct_answer']}" if item.get("correct_answer") else "")
                for index, item in enumerate(top_wrong_questions, start=1)
            )
            remediation_focus = (
                "Mục tiêu ôn tập cá nhân hóa cho QUIZ_MIXED: tập trung sửa top câu sai nhiều nhất của người học.\n"
                "BẮT BUỘC tạo đúng 10 câu hỏi, ưu tiên phủ toàn bộ danh sách câu sai bên dưới theo thứ tự ưu tiên.\n"
                "Mỗi câu cần có giải thích ngắn gọn để người học hiểu vì sao sai trước đó.\n"
                f"{wrong_questions_text}"
            )
        else:
            remediation_focus = (
                "Người học chưa có đủ dữ liệu lỗi sai cụ thể. "
                "Hãy tạo bộ câu hỏi nền tảng để phát hiện lỗ hổng kiến thức và củng cố các khái niệm quan trọng nhất."
            )

        try:
            generated_quiz = await self.generation_service.generate_minigame(
                material_id,
                game_type="quiz_mixed",
                difficulty=selected_difficulty,
                user_id=user_id,
                force_regenerate=True,
                focus_context=remediation_focus,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Không thể tạo bộ ôn tập AI ở thời điểm hiện tại. Vui lòng thử lại sau.",
            ) from exc

        generated_items = [
            {
                "game_type": "quiz_mixed",
                "generated_content_id": generated_quiz["id"],
                "difficulty": selected_difficulty,
                "title": "Trắc nghiệm hỗn hợp",
            }
        ]

        if top_wrong_questions:
            message = "Đã tạo quiz ôn tập từ top 10 câu sai nhiều nhất của bạn."
        else:
            message = "Đã tạo quiz ôn tập nền tảng vì chưa đủ dữ liệu câu sai trước đó."

        return {
            "material_id": material_id,
            "weak_points": weak_points,
            "top_wrong_questions": top_wrong_questions,
            "recommended_difficulty": selected_difficulty,
            "generated_items": generated_items,
            "message": message,
        }

    @staticmethod
    def _collect_top_wrong_questions(attempts: list[dict], limit: int = 10) -> list[dict]:
        normalized_limit = max(1, min(limit, 20))
        question_map: dict[str, dict] = {}

        for attempt in attempts:
            for row in attempt.get("feedback", []):
                if not isinstance(row, dict):
                    continue
                if row.get("is_correct") is True:
                    continue

                question_text = row.get("question") or row.get("knowledge_point") or row.get("id")
                if not isinstance(question_text, str):
                    continue

                normalized_question = question_text.strip()
                if not normalized_question:
                    continue

                key = normalized_question[:220]
                entry = question_map.get(key)
                if entry is None:
                    entry = {
                        "question": key,
                        "wrong_count": 0,
                        "correct_answer": None,
                    }
                    question_map[key] = entry

                entry["wrong_count"] += 1

                if entry["correct_answer"] is None:
                    correct_answer = row.get("correct_answer") or row.get("correct_answer_text")
                    if isinstance(correct_answer, str) and correct_answer.strip():
                        entry["correct_answer"] = correct_answer.strip()[:120]

        ranked = sorted(
            question_map.values(),
            key=lambda item: (-int(item["wrong_count"]), str(item["question"])),
        )
        return ranked[:normalized_limit]

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
