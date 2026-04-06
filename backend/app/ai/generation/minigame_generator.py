from app.ai.generation.llm_client import LLMClient


class MinigameGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate(self, context: str, game_type: str, difficulty: str = "medium") -> dict:
        """Generate minigame with specified type."""
        if game_type == "quiz_mixed":
            return self.generate_quiz_mixed(context, difficulty)
        elif game_type == "flashcard":
            return self.generate_flashcard(context, difficulty)
        elif game_type == "shooting_quiz":
            return self.generate_shooting_quiz(context, difficulty)
        else:
            # Fallback to quiz_mixed
            return self.generate_quiz_mixed(context, difficulty)

    def generate_quiz_mixed(self, context: str, difficulty: str = "medium") -> dict:
        """Generate 10 mixed quiz questions (true/false, mcq, multiple select, fill blank)."""
        diff_instruction = ""
        if difficulty == "easy":
            diff_instruction = "Mức độ: DỄ (Easy). Câu hỏi nhận biết, ghi nhớ cơ bản. Lựa chọn đáp án rõ ràng."
        elif difficulty == "hard":
            diff_instruction = "Mức độ: KHÓ (Hard). Câu hỏi vận dụng cao, suy luận logic. Lựa chọn đáp án dễ nhầm lẫn."
        else:
            diff_instruction = "Mức độ: TRUNG BÌNH (Medium). Câu hỏi hiểu biết, phân tích, có chút gài bẫy."

        system_prompt = (
            f"Bạn là chuyên gia tạo trò chơi giáo dục. {diff_instruction} Tạo 10 câu hỏi đa dạng với 4 dạng (mỗi dạng ~2-3 câu):\n"
            "1. **true_false**: Câu hỏi đúng/sai\n"
            "2. **mcq**: Multiple choice (1 đáp án đúng, 4 lựa chọn)\n"
            "3. **multiple_select**: Chọn nhiều đáp án đúng (2-3 đáp án đúng)\n"
            "4. **fill_blank**: Điền từ/cụm từ vào chỗ trống\n"
            "Bắt buộc dùng tiếng Việt có dấu chuẩn xác. Return strict JSON."
        )
        user_prompt = (
            "Dựa trên tài liệu dưới đây, sinh 10 câu hỏi quiz hỗn hợp (2-3 true/false, 2-3 mcq, 2-3 multiple_select, 2-3 fill_blank):\n"
            "JSON format: {\n"
            '  "title": "Quiz hỗn hợp",\n'
            '  "type": "quiz_mixed",\n'
            '  "items": [\n'
            '    {\n'
            '      "id": "q1",\n'
            '      "question_type": "true_false",\n'
            '      "question": "...",\n'
            '      "options": ["Đúng", "Sai"],\n'
            '      "correct_answer": "Đúng",\n'
            '      "explanation": "..."\n'
            '    },\n'
            '    {\n'
            '      "id": "q2",\n'
            '      "question_type": "mcq",\n'
            '      "question": "...",\n'
            '      "options": ["A", "B", "C", "D"],\n'
            '      "correct_answer": "A",\n'
            '      "explanation": "..."\n'
            '    },\n'
            '    {\n'
            '      "id": "q3",\n'
            '      "question_type": "multiple_select",\n'
            '      "question": "...",\n'
            '      "options": ["A", "B", "C", "D"],\n'
            '      "correct_answers": ["A", "B"],\n'
            '      "explanation": "..."\n'
            '    },\n'
            '    {\n'
            '      "id": "q4",\n'
            '      "question_type": "fill_blank",\n'
            '      "question": "Từ _____ có nghĩa là...",\n'
            '      "correct_answer": "từ_cần_điền",\n'
            '      "explanation": "..."\n'
            '    }\n'
            '  ]\n'
            "}\n\n" + f"{context[:12000]}"
        )
        
        fallback = {
            "title": "Quiz hỗn hợp",
            "type": "quiz_mixed",
            "items": [
                {
                    "id": "q1",
                    "question_type": "true_false",
                    "question": "Nội dung chính của bài học là gì?",
                    "options": ["Đúng", "Sai"],
                    "correct_answer": "Đúng",
                    "explanation": "Đây là nội dung hợp lý theo tài liệu.",
                }
            ]
        }
        
        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        # Đảm bảo có đúng 10 items
        if isinstance(result, dict) and "items" in result:
            result["items"] = result["items"][:10]
            return result
        return fallback

    def generate_flashcard(self, context: str, difficulty: str = "medium") -> dict:
        """Generate 10 flashcard pairs."""
        diff_instruction = ""
        if difficulty == "easy":
            diff_instruction = "Mức độ: DỄ (Easy). Khái niệm cốt lõi, giải thích ngắn gọn, dễ hiểu."
        elif difficulty == "hard":
            diff_instruction = "Mức độ: KHÓ (Hard). Khái niệm phức tạp, giải thích chi tiết có liên hệ logic."
        else:
            diff_instruction = "Mức độ: TRUNG BÌNH (Medium). Khái niệm quan trọng, giải thích rõ ràng."

        system_prompt = (
            f"Bạn là chuyên gia tạo flashcard học ngoại ngữ. {diff_instruction} Tạo 10 cặp flashcard gồm từ/khái niệm ở mặt trước và giải thích ở mặt sau. "
            "Bắt buộc dùng tiếng Việt có dấu chuẩn xác. Return strict JSON."
        )
        user_prompt = (
            "Dựa trên tài liệu dưới đây, sinh 10 cặp flashcard:\n"
            "JSON format: {\n"
            '  "title": "Flashcard",\n'
            '  "type": "flashcard",\n'
            '  "items": [\n'
            '    {\n'
            '      "id": "f1",\n'
            '      "front": "Khái niệm",\n'
            '      "back": "Định nghĩa ngắn gọn (1-2 câu)",\n'
            '      "tags": ["tag1", "tag2"]\n'
            '    }\n'
            '  ]\n'
            "}\n\n" + f"{context[:12000]}"
        )
        
        fallback = {
            "title": "Flashcard",
            "type": "flashcard",
            "items": [
                {
                    "id": "f1",
                    "front": "Khái niệm cơ bản",
                    "back": "Định nghĩa từ tài liệu.",
                    "tags": ["vocabulary"],
                }
            ]
        }
        
        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        if isinstance(result, dict) and "items" in result:
            result["items"] = result["items"][:10]
            return result
        return fallback

    def generate_shooting_quiz(self, context: str, difficulty: str = "medium") -> dict:
        """Generate a 10-round shooting quiz game payload."""
        diff_instruction = ""
        if difficulty == "easy":
            diff_instruction = "Mức độ: DỄ (Easy). Câu hỏi nhận biết, từ khóa rõ ràng, đáp án sai dễ nhận diện."
        elif difficulty == "hard":
            diff_instruction = "Mức độ: KHÓ (Hard). Suy luận phức tạp, đáp án sai rất giống đáp án đúng để đánh lừa."
        else:
            diff_instruction = "Mức độ: TRUNG BÌNH (Medium). Kiểm tra mức độ hiểu bài, đáp án có độ nhiễu vừa phải."

        system_prompt = (
            "Bạn là AI Agent trong hệ thống AI Learning Studio. "
            f"Nhiệm vụ: tạo minigame BẮN GÀ để ôn tập kiến thức từ tài liệu đầu vào. {diff_instruction} "
            "BẮT BUỘC trả về DUY NHẤT JSON hợp lệ, không markdown, không text thừa. "
            "BẮT BUỘC: đúng 10 câu, mỗi câu đúng 4 đáp án A/B/C/D, chỉ 1 đáp án đúng. "
            "Nội dung ngắn gọn, rõ ràng, có giá trị học tập, bám sát tài liệu (RAG)."
        )
        user_prompt = (
            "Sinh JSON theo đúng schema sau:\n"
            "{\n"
            '  "game_type": "shooting_quiz",\n'
            '  "metadata": {\n'
            '    "topic": "",\n'
            f'    "difficulty": "{difficulty}"\n'
            "  },\n"
            '  "game": {\n'
            '    "total_rounds": 10,\n'
            '    "questions": [\n'
            "      {\n"
            '        "id": "q1",\n'
            '        "question": "",\n'
            '        "answers": [\n'
            '          { "id": "A", "text": "", "is_correct": true },\n'
            '          { "id": "B", "text": "", "is_correct": false },\n'
            '          { "id": "C", "text": "", "is_correct": false },\n'
            '          { "id": "D", "text": "", "is_correct": false }\n'
            "        ],\n"
            '        "explanation": ""\n'
            "      }\n"
            "    ]\n"
            "  },\n"
            '  "ui": {\n'
            '    "player": {\n'
            '      "position": "bottom",\n'
            '      "control": "mouse"\n'
            "    },\n"
            '    "enemies": {\n'
            '      "type": "chicken",\n'
            '      "movement": "random_fall"\n'
            "    },\n"
            '    "effects": {\n'
            '      "hit_correct": "green_flash",\n'
            '      "hit_wrong": "red_flash"\n'
            "    }\n"
            "  },\n"
            '  "tracking": {\n'
            '    "score_per_correct": 10,\n'
            '    "max_score": 100,\n'
            '    "skills": ["rag_knowledge", "critical_thinking"]\n'
            "  }\n"
            "}\n\n"
            "Ràng buộc nghiêm ngặt:\n"
            "- Chỉ dùng kiến thức có trong tài liệu, không bịa thông tin ngoài.\n"
            "- Mỗi câu phải ngắn gọn, dễ hiểu, không viết dài như bài giảng.\n"
            "- Mỗi câu chỉ đúng đúng 1 đáp án.\n"
            "- Trả về đúng 10 câu.\n\n"
            f"{context[:12000]}"
        )

        fallback = {
            "game_type": "shooting_quiz",
            "metadata": {
                "topic": "On tap kien thuc tu tai lieu",
                "difficulty": "medium",
            },
            "game": {
                "total_rounds": 10,
                "questions": [
                    {
                        "id": f"q{i}",
                        "question": f"Cau hoi on tap {i}: Noi dung trong tai lieu nhan manh dieu gi?",
                        "answers": [
                            {"id": "A", "text": "Y chinh cua bai hoc", "is_correct": True},
                            {"id": "B", "text": "Thong tin khong lien quan", "is_correct": False},
                            {"id": "C", "text": "Noi dung ngoai tai lieu", "is_correct": False},
                            {"id": "D", "text": "Du doan chu quan", "is_correct": False},
                        ],
                        "explanation": "Can bam sat thong tin da duoc trinh bay trong tai lieu.",
                    }
                    for i in range(1, 11)
                ],
            },
            "ui": {
                "player": {"position": "bottom", "control": "mouse"},
                "enemies": {"type": "chicken", "movement": "random_fall"},
                "effects": {"hit_correct": "green_flash", "hit_wrong": "red_flash"},
            },
            "tracking": {
                "score_per_correct": 10,
                "max_score": 100,
                "skills": ["rag_knowledge", "critical_thinking"],
            },
        }

        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        if isinstance(result, dict) and isinstance(result.get("game"), dict):
            questions = result["game"].get("questions")
            if isinstance(questions, list) and len(questions) == 10:
                is_valid = True
                for question in questions:
                    answers = question.get("answers") if isinstance(question, dict) else None
                    if not isinstance(answers, list) or len(answers) != 4:
                        is_valid = False
                        break
                    correct_count = sum(1 for ans in answers if isinstance(ans, dict) and ans.get("is_correct") is True)
                    if correct_count != 1:
                        is_valid = False
                        break

                if is_valid:
                    result["game"]["total_rounds"] = 10
                    return result
        return fallback
