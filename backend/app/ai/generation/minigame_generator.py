from app.ai.generation.llm_client import LLMClient


class MinigameGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate(self, context: str, game_type: str, source_language: str = "auto") -> dict:
        """Generate minigame with specified type."""
        if game_type == "quiz_mixed":
            return self.generate_quiz_mixed(context)
        elif game_type == "flashcard":
            return self.generate_flashcard(context)
        elif game_type == "scenario_branching":
            return self.generate_scenario(context, source_language=source_language)
        else:
            # Fallback to quiz_mixed
            return self.generate_quiz_mixed(context)

    @staticmethod
    def _normalize_lang(source_language: str) -> str:
        lang = str(source_language or "").strip().lower()
        if lang.startswith("vi"):
            return "vi"
        if lang.startswith("en"):
            return "en"
        return "vi"

    @staticmethod
    def _scenario_fallback_by_lang(lang: str) -> dict:
        if lang == "en":
            return {
                "game": {
                    "title": "RAG Emergency Shift",
                    "initial_state": {"score": 0, "skills": {}},
                    "steps": [
                        {
                            "id": "step1",
                            "scenario": "Live class starts in 2 minutes. The QA bot returns blank answers. Students are already asking questions.",
                            "knowledge_point": "Incident triage under pressure",
                            "choices": [
                                {
                                    "id": "A",
                                    "text": "Check retrieval service logs first",
                                    "feedback": "Good call. You spot failing vector queries.",
                                    "learning_explanation": "Triage starts with finding the failing layer fast.",
                                    "next_step": "step2",
                                    "effects": {"score": 2, "skills": {"critical_thinking": 1}},
                                },
                                {
                                    "id": "B",
                                    "text": "Rewrite prompts during the outage",
                                    "feedback": "Too slow. Students keep waiting.",
                                    "learning_explanation": "Prompt tuning cannot fix infrastructure downtime.",
                                    "next_step": "step2",
                                    "effects": {"score": 0, "skills": {"critical_thinking": 0}},
                                },
                                {
                                    "id": "C",
                                    "text": "Disable citations to respond faster",
                                    "feedback": "Risky move. Trust drops quickly.",
                                    "learning_explanation": "Learning tools need grounded answers, not speed alone.",
                                    "next_step": "step2",
                                    "effects": {"score": -1, "skills": {"domain_knowledge": 0}},
                                },
                            ],
                        },
                        {
                            "id": "step2",
                            "scenario": "You recovered partial service. Answers now appear, but many cite the wrong chunks. The teacher asks for a quick fix.",
                            "knowledge_point": "RAG quality control",
                            "choices": [
                                {
                                    "id": "A",
                                    "text": "Tighten chunk filters by metadata",
                                    "feedback": "Nice. Wrong citations drop immediately.",
                                    "learning_explanation": "Filtering context improves retrieval precision before generation.",
                                    "next_step": "step3",
                                    "effects": {"score": 2, "skills": {"domain_knowledge": 1}},
                                },
                                {
                                    "id": "B",
                                    "text": "Increase context window only",
                                    "feedback": "Mixed result. Noise still leaks in.",
                                    "learning_explanation": "More context is useless if ranking is weak.",
                                    "next_step": "step3",
                                    "effects": {"score": 0, "skills": {"critical_thinking": 0}},
                                },
                                {
                                    "id": "C",
                                    "text": "Ship now and fix tomorrow",
                                    "feedback": "Ouch. Class confidence keeps dropping.",
                                    "learning_explanation": "In teaching scenarios, reliability beats rushed release.",
                                    "next_step": "step3",
                                    "effects": {"score": -1, "skills": {"communication": 0}},
                                },
                            ],
                        },
                        {
                            "id": "step3",
                            "scenario": "Final decision. You can deploy one policy before the next class starts in 5 minutes.",
                            "knowledge_point": "Safe rollout strategy",
                            "choices": [
                                {
                                    "id": "A",
                                    "text": "Enable fallback answers with verified sources",
                                    "feedback": "Great. System stabilizes and students trust it.",
                                    "learning_explanation": "Safe fallback preserves learning continuity with verifiable output.",
                                    "next_step": "ending_good",
                                    "effects": {"score": 2, "skills": {"critical_thinking": 1, "communication": 1}},
                                },
                                {
                                    "id": "B",
                                    "text": "Limit scope to covered lessons only",
                                    "feedback": "Solid recovery. Learning flow survives the session.",
                                    "learning_explanation": "Scope control reduces failure surface during incidents.",
                                    "next_step": "ending_neutral",
                                    "effects": {"score": 1, "skills": {"critical_thinking": 1}},
                                },
                                {
                                    "id": "C",
                                    "text": "Keep full access with no guardrails",
                                    "feedback": "Bad outcome. Errors spread in class.",
                                    "learning_explanation": "Ungrounded output in class can harm learning quality.",
                                    "next_step": "ending_bad",
                                    "effects": {"score": -1, "skills": {"domain_knowledge": 0}},
                                },
                            ],
                        },
                    ],
                    "endings": [
                        {
                            "id": "ending_good",
                            "summary": "Your RAG system runs stable. Students trust the platform again.",
                            "knowledge_recap": [
                                "Debug retrieval before prompt tuning",
                                "Use citations and safe fallback policies",
                            ],
                            "suggestion": "Keep monitoring retrieval quality each week.",
                        },
                        {
                            "id": "ending_neutral",
                            "summary": "The class continues, but the system still has blind spots.",
                            "knowledge_recap": [
                                "Controlled scope can save a session",
                                "Quality checks are needed before full rollout",
                            ],
                            "suggestion": "Prepare an evaluation set before expanding again.",
                        },
                        {
                            "id": "ending_bad",
                            "summary": "The bot misleads students, and confidence drops fast.",
                            "knowledge_recap": [
                                "Do not skip grounding and guardrails",
                                "Rushed deployment increases classroom risk",
                            ],
                            "suggestion": "Roll back and re-enable verified retrieval constraints.",
                        },
                    ],
                }
            }

        return {
            "game": {
                "title": "Ca Truc RAG",
                "initial_state": {"score": 0, "skills": {}},
                "steps": [
                    {
                        "id": "step1",
                        "scenario": "Lớp học trực tiếp sắp bắt đầu. Chatbot bỗng trả lời trống. Sinh viên đang chờ ngay trước màn hình.",
                        "knowledge_point": "Xử lý sự cố dưới áp lực",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Kiểm tra log retrieval trước",
                                "feedback": "Chuẩn rồi. Bạn thấy truy vấn vector đang lỗi.",
                                "learning_explanation": "Khi sự cố xảy ra, cần khoanh vùng lớp lỗi nhanh nhất.",
                                "next_step": "step2",
                                "effects": {"score": 2, "skills": {"critical_thinking": 1}},
                            },
                            {
                                "id": "B",
                                "text": "Viết lại prompt ngay",
                                "feedback": "Hơi chậm. Sinh viên vẫn phải chờ.",
                                "learning_explanation": "Prompt không thể cứu hạ tầng đang lỗi.",
                                "next_step": "step2",
                                "effects": {"score": 0, "skills": {"critical_thinking": 0}},
                            },
                            {
                                "id": "C",
                                "text": "Tắt trích dẫn cho nhanh",
                                "feedback": "Nguy hiểm. Niềm tin tụt rất nhanh.",
                                "learning_explanation": "Hệ học tập cần câu trả lời có nguồn rõ ràng.",
                                "next_step": "step2",
                                "effects": {"score": -1, "skills": {"domain_knowledge": 0}},
                            },
                        ],
                    },
                    {
                        "id": "step2",
                        "scenario": "Hệ thống đã chạy lại một phần. Nhưng nhiều câu trả lời trích sai tài liệu. Giảng viên cần bạn xử lý ngay.",
                        "knowledge_point": "Kiểm soát chất lượng RAG",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Siết lọc metadata cho chunk",
                                "feedback": "Đẹp. Trích dẫn sai giảm thấy rõ.",
                                "learning_explanation": "Lọc ngữ cảnh tốt giúp tăng precision trước khi model sinh câu trả lời.",
                                "next_step": "step3",
                                "effects": {"score": 2, "skills": {"domain_knowledge": 1}},
                            },
                            {
                                "id": "B",
                                "text": "Chỉ tăng context window",
                                "feedback": "Đỡ chút thôi. Nhiễu vẫn còn.",
                                "learning_explanation": "Nhiều ngữ cảnh hơn không giúp nếu xếp hạng chưa tốt.",
                                "next_step": "step3",
                                "effects": {"score": 0, "skills": {"critical_thinking": 0}},
                            },
                            {
                                "id": "C",
                                "text": "Đẩy bản hiện tại lên luôn",
                                "feedback": "Toang nhẹ. Lớp bắt đầu mất niềm tin.",
                                "learning_explanation": "Trong lớp học, độ tin cậy quan trọng hơn phát hành vội.",
                                "next_step": "step3",
                                "effects": {"score": -1, "skills": {"communication": 0}},
                            },
                        ],
                    },
                    {
                        "id": "step3",
                        "scenario": "Còn 5 phút trước tiết kế tiếp. Bạn chỉ được bật một chính sách cuối cùng cho hệ thống.",
                        "knowledge_point": "Chiến lược rollout an toàn",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Bật fallback có nguồn xác minh",
                                "feedback": "Quá ổn. Hệ thống vững lại ngay.",
                                "learning_explanation": "Fallback an toàn giúp giữ nhịp học mà vẫn kiểm chứng được kiến thức.",
                                "next_step": "ending_good",
                                "effects": {"score": 2, "skills": {"critical_thinking": 1, "communication": 1}},
                            },
                            {
                                "id": "B",
                                "text": "Giới hạn phạm vi bài học",
                                "feedback": "Ổn áp. Buổi học vẫn chạy mượt.",
                                "learning_explanation": "Giảm phạm vi giúp giảm rủi ro trong giai đoạn bất ổn.",
                                "next_step": "ending_neutral",
                                "effects": {"score": 1, "skills": {"critical_thinking": 1}},
                            },
                            {
                                "id": "C",
                                "text": "Giữ full mode không rào chắn",
                                "feedback": "Không ổn. Lỗi lan ra cả lớp.",
                                "learning_explanation": "Không rào chắn khi dữ liệu nhiễu dễ làm sai lệch kiến thức.",
                                "next_step": "ending_bad",
                                "effects": {"score": -1, "skills": {"domain_knowledge": 0}},
                            },
                        ],
                    },
                ],
                "endings": [
                    {
                        "id": "ending_good",
                        "summary": "Hệ RAG chạy ổn định. Sinh viên tin lại nền tảng của bạn.",
                        "knowledge_recap": [
                            "Ưu tiên sửa retrieval trước prompt",
                            "Dùng citation và fallback an toàn",
                        ],
                        "suggestion": "Tiếp tục theo dõi chất lượng retrieval theo tuần.",
                    },
                    {
                        "id": "ending_neutral",
                        "summary": "Buổi học được cứu, nhưng hệ thống vẫn còn điểm mù.",
                        "knowledge_recap": [
                            "Giới hạn phạm vi giúp kiểm soát rủi ro",
                            "Cần bộ đánh giá trước khi mở rộng",
                        ],
                        "suggestion": "Chuẩn bị bộ test mới trước đợt rollout tiếp theo.",
                    },
                    {
                        "id": "ending_bad",
                        "summary": "Bot trả lời lệch, niềm tin người học giảm mạnh.",
                        "knowledge_recap": [
                            "Không bỏ qua grounding và guardrails",
                            "Phát hành vội dễ làm hỏng trải nghiệm lớp học",
                        ],
                        "suggestion": "Rollback và bật lại ràng buộc truy xuất có nguồn.",
                    },
                ],
            }
        }

    def generate_scenario(self, context: str, source_language: str = "auto") -> dict:
        """Generate fast-paced card-based role-play game with language matching source material."""
        lang = self._normalize_lang(source_language)
        language_instruction = (
            "Use Vietnamese naturally with concise conversational tone."
            if lang == "vi"
            else "Use English naturally with concise conversational tone."
        )

        system_prompt = (
            "You are creating a CARD-BASED ROLE-PLAY GAME (like Reigns or Tinder), NOT an academic quiz. "
            "The user must feel they are playing under pressure, with short immersive cards and quick decisions. "
            "Use short sentences, action-oriented options, and one-sentence natural feedback. "
            f"{language_instruction} "
            "Return strict JSON only."
        )

        user_prompt = (
            "TOPIC: AI Learning Studio / RAG system / teaching scenario.\n"
            "MANDATORY STRUCTURE:\n"
            "- At least 3 steps: step1, step2, step3.\n"
            "- Flow must be step1 -> step2 -> step3 -> ending.\n"
            "- Each step has exactly 3 choices A/B/C.\n"
            "- Choice text max 10-12 words, action-oriented.\n"
            "- Feedback max 1 sentence, natural tone.\n"
            "- Each choice MUST include next_step and effects(score, skills).\n"
            "- Scenario must be short, immersive, and urgent (max 2 lines).\n\n"
            "OUTPUT JSON SCHEMA:\n"
            "{\n"
            "  \"game\": {\n"
            "    \"title\": \"\",\n"
            "    \"initial_state\": {\"score\": 0, \"skills\": {}},\n"
            "    \"steps\": [\n"
            "      {\"id\": \"step1\", \"scenario\": \"\", \"knowledge_point\": \"\", \"choices\": []},\n"
            "      {\"id\": \"step2\", \"scenario\": \"\", \"knowledge_point\": \"\", \"choices\": []},\n"
            "      {\"id\": \"step3\", \"scenario\": \"\", \"knowledge_point\": \"\", \"choices\": []}\n"
            "    ],\n"
            "    \"endings\": [\n"
            "      {\"id\": \"ending_good\", \"summary\": \"\", \"knowledge_recap\": [\"\",\"\"], \"suggestion\": \"\"},\n"
            "      {\"id\": \"ending_neutral\", \"summary\": \"\", \"knowledge_recap\": [\"\",\"\"], \"suggestion\": \"\"},\n"
            "      {\"id\": \"ending_bad\", \"summary\": \"\", \"knowledge_recap\": [\"\",\"\"], \"suggestion\": \"\"}\n"
            "    ]\n"
            "  }\n"
            "}\n\n"
            f"Source material:\n{context[:12000]}"
        )

        fallback = self._scenario_fallback_by_lang(lang)
        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        if isinstance(result, dict) and isinstance(result.get("game"), dict):
            return result
        return fallback

    def generate_quiz_mixed(self, context: str) -> dict:
        """Generate 10 mixed quiz questions (true/false, mcq, multiple select, fill blank)."""
        system_prompt = (
            "Bạn là chuyên gia tạo trò chơi giáo dục. Tạo 10 câu hỏi đa dạng với 4 dạng (mỗi dạng ~2-3 câu):\n"
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

    def generate_flashcard(self, context: str) -> dict:
        """Generate 10 flashcard pairs."""
        system_prompt = (
            "Bạn là chuyên gia tạo flashcard học ngoại ngữ. Tạo 10 cặp flashcard gồm từ/khái niệm ở mặt trước và giải thích ở mặt sau. "
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

    def generate_scenario(self, context: str) -> dict:
        """Generate scenario-based role-play game in strict JSON schema."""
        system_prompt = (
            "Bạn là AI Agent của nền tảng AI Learning Platform. "
            "Nhiệm vụ là tạo minigame học tập dạng role-play simulation dựa trên kiến thức thật từ tài liệu đầu vào. "
            "BẮT BUỘC: output JSON hợp lệ duy nhất, không markdown, không text thừa. "
            "Trò chơi phải di chuyển dọc theo 10 tình huống nối tiếp nhau (linear progression với 10 steps liên tiếp). "
            "Mỗi step có đúng 3 lựa chọn A/B/C. "
            "Mỗi lựa chọn phải có feedback, learning_explanation, effects(score/skills/context_state), next_step. "
            "Quy tắc chuyển bước: Tất cả các lựa chọn của 'step X' đều phải trỏ next_step tới 'step X+1', "
            "chỉ riêng step 10 mới trỏ next_step tới ending ('ending_good' hoặc 'ending_bad' v.v.)."
        )
        user_prompt = (
            "Dựa trên tài liệu sau, tạo Scenario-based Learning Game gồm đúng 10 câu (steps) theo format STRICT JSON này:\n"
            "{\n"
            '  "metadata": {\n'
            '    "topic": "",\n'
            '    "difficulty": "easy | medium | hard",\n'
            '    "estimated_time": "15 minutes"\n'
            "  },\n"
            '  "game": {\n'
            '    "title": "",\n'
            '    "learning_objectives": [],\n'
            '    "initial_state": {\n'
            '      "score": 0,\n'
            '      "skills": {},\n'
            '      "context_state": {}\n'
            "    },\n"
            '    "steps": [\n'
            "      {\n"
            '        "id": "step1",\n'
            '        "scenario": "",\n'
            '        "knowledge_point": "",\n'
            '        "choices": [\n'
            "          {\n"
            '            "id": "A",\n'
            '            "text": "",\n'
            '            "feedback": "",\n'
            '            "learning_explanation": "",\n'
            '            "effects": {\n'
            '              "score": 2,\n'
            '              "skills": { "critical_thinking": 1 },\n'
            '              "context_state": {}\n'
            "            },\n"
            '            "next_step": "step2"\n'
            "          }\n"
            "        ]\n"
            "      }\n"
            "    ],\n"
            '    "endings": [\n'
            "      {\n"
            '        "id": "ending_good",\n'
            '        "condition": "score >= 15",\n'
            '        "summary": "",\n'
            '        "knowledge_recap": [],\n'
            '        "suggestion": ""\n'
            "      }\n"
            "    ]\n"
            "  },\n"
            '  "ui": {\n'
            '    "layout": "vertical",\n'
            '    "components": {\n'
            '      "progress": { "type": "step_indicator" },\n'
            '      "scene": { "type": "card" },\n'
            '      "choices": { "type": "buttons" },\n'
            '      "feedback": { "type": "alert" }\n'
            "    }\n"
            "  }\n"
            "}\n\n"
            "Ràng buộc bắt buộc:\n"
            "- BẮT BUỘC TẠO ĐÚNG 10 STEPS từ step1 đến step10.\n"
            "- Mỗi step phải có ĐÚNG 3 choices A/B/C.\n"
            "- next_step của step N bắt buộc là 'step(N+1)'. Ví dụ lựa chọn ở step1 đều có next_step là 'step2'.\n"
            "- next_step của tất cả lựa chọn trong step10 phải là các id từ mảng endings (vd: 'ending_good' hoặc 'ending_bad').\n"
            "- Nội dung bám sát kiến thức tài liệu, không hư cấu rời rạc.\n\n"
            f"{context[:12000]}"
        )

        fallback = {
            "metadata": {
                "topic": "Kien thuc tu tai lieu hoc tap",
                "difficulty": "medium",
                "estimated_time": "12",
            },
            "game": {
                "title": "Scenario-based Learning Game",
                "learning_objectives": [
                    "Ap dung kien thuc tu tai lieu vao tinh huong thuc te",
                    "Ren luyen tu duy phan tich va ra quyet dinh",
                ],
                "initial_state": {
                    "score": 0,
                    "skills": {
                        "critical_thinking": 0,
                        "communication": 0,
                        "domain_knowledge": 0,
                    },
                    "context_state": {
                        "risk_level": "medium",
                        "progress": "start",
                    },
                },
                "steps": [
                    {
                        "id": "step1",
                        "scenario": "Ban bat dau phan tich mot tinh huong hoc tap dua tren tai lieu da hoc.",
                        "knowledge_point": "Xac dinh van de cot loi truoc khi de xuat giai phap",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Xac dinh muc tieu va du lieu trong tai lieu truoc.",
                                "feedback": "Dung huong: ban uu tien du lieu goc truoc khi hanh dong.",
                                "learning_explanation": "Buoc dau tien trong giai quyet van de la xac dinh thong tin tin cay.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1, "domain_knowledge": 1},
                                    "context_state": {"progress": "structured_analysis", "risk_level": "low"},
                                },
                                "next_step": "step2A",
                            },
                            {
                                "id": "B",
                                "text": "De xuat giai phap ngay ma khong doi chieu tai lieu.",
                                "feedback": "Chua toi uu: de bo sot thong tin quan trong.",
                                "learning_explanation": "Ra quyet dinh som khi thieu bang chung thuong lam giam do chinh xac.",
                                "effects": {
                                    "score": 0,
                                    "skills": {"critical_thinking": -1},
                                    "context_state": {"progress": "guessing", "risk_level": "high"},
                                },
                                "next_step": "step2B",
                            },
                            {
                                "id": "C",
                                "text": "Hoi y kien nhom truoc, sau do moi doi chieu tai lieu.",
                                "feedback": "Tam on: co hop tac, nhung can uu tien kiem chung tai lieu som hon.",
                                "learning_explanation": "Hop tac hieu qua khi duoc dat tren nen thong tin chinh xac.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"communication": 1},
                                    "context_state": {"progress": "collaboration_first", "risk_level": "medium"},
                                },
                                "next_step": "step2C",
                            },
                        ],
                    },
                    {
                        "id": "step2A",
                        "scenario": "Sau khi tong hop du lieu goc, ban phat hien mot diem mau thuan trong cac nguon.",
                        "knowledge_point": "Danh gia do tin cay nguon thong tin",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Uu tien nguon chinh va ghi chu ly do loai bo nguon yeu.",
                                "feedback": "Rat tot: quy trinh danh gia ro rang.",
                                "learning_explanation": "Danh gia do tin cay giup giam sai lech ket qua.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1, "domain_knowledge": 1},
                                    "context_state": {"evidence_quality": "high"},
                                },
                                "next_step": "step3A",
                            },
                            {
                                "id": "B",
                                "text": "Tron tat ca nguon voi trong so bang nhau.",
                                "feedback": "Khong phu hop: nguon kem chat luong se keo giam ket qua.",
                                "learning_explanation": "Can phan biet trong so thong tin theo muc do tin cay.",
                                "effects": {
                                    "score": 0,
                                    "skills": {"domain_knowledge": -1},
                                    "context_state": {"evidence_quality": "mixed"},
                                },
                                "next_step": "step3B",
                            },
                            {
                                "id": "C",
                                "text": "Tam dung va thu thap them bang chung bo sung.",
                                "feedback": "Hop ly neu co quan ly thoi gian tot.",
                                "learning_explanation": "Bo sung du lieu giup tang do vung chac cua ket luan.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"critical_thinking": 1},
                                    "context_state": {"evidence_quality": "improving"},
                                },
                                "next_step": "step3C",
                            },
                        ],
                    },
                    {
                        "id": "step2B",
                        "scenario": "Giai phap de xuat som bi phan bien vi thieu can cu tu tai lieu.",
                        "knowledge_point": "Can cu hoa lap luan bang tri thuc da hoc",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Quay lai tai lieu de trich dan diem then chot.",
                                "feedback": "Dung: sua sai kip thoi bang bang chung.",
                                "learning_explanation": "Trich dan nguon giup lap luan co suc thuyet phuc.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"domain_knowledge": 1, "critical_thinking": 1},
                                    "context_state": {"recovery": "good"},
                                },
                                "next_step": "step3A",
                            },
                            {
                                "id": "B",
                                "text": "Giu nguyen y kien du khong co bang chung.",
                                "feedback": "Sai chien luoc: de dan den quyet dinh kem chat luong.",
                                "learning_explanation": "Ra quyet dinh can dua tren du lieu, khong chi tren cam tinh.",
                                "effects": {
                                    "score": -1,
                                    "skills": {"critical_thinking": -1},
                                    "context_state": {"recovery": "poor"},
                                },
                                "next_step": "step3B",
                            },
                            {
                                "id": "C",
                                "text": "Xin phan hoi tu nguoi huong dan de dieu chinh.",
                                "feedback": "Tot: biet tim phan hoi de cai thien.",
                                "learning_explanation": "Phan hoi chat luong giup dieu chinh huong hoc tap.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"communication": 1},
                                    "context_state": {"recovery": "moderate"},
                                },
                                "next_step": "step3C",
                            },
                        ],
                    },
                    {
                        "id": "step2C",
                        "scenario": "Nhom de xuat nhieu y tuong, ban can chon phuong an phu hop voi kien thuc tai lieu.",
                        "knowledge_point": "So sanh phuong an theo tieu chi hoc thuat",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Lap bang tieu chi va cham diem tung phuong an.",
                                "feedback": "Rat tot: minh bach va de bao ve quyet dinh.",
                                "learning_explanation": "Khung tieu chi giup danh gia phuong an mot cach co he thong.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1, "communication": 1},
                                    "context_state": {"decision_quality": "high"},
                                },
                                "next_step": "step3A",
                            },
                            {
                                "id": "B",
                                "text": "Chon theo y kien so dong du lieu con mo ho.",
                                "feedback": "Chua tot: de roi vao hieu ung dam dong.",
                                "learning_explanation": "Dong thuan khong dong nghia voi dung neu thieu bang chung.",
                                "effects": {
                                    "score": 0,
                                    "skills": {"critical_thinking": -1},
                                    "context_state": {"decision_quality": "low"},
                                },
                                "next_step": "step3B",
                            },
                            {
                                "id": "C",
                                "text": "Thu nghiem nho 2 phuong an tot nhat truoc khi chon.",
                                "feedback": "Hop ly: can bang giua toc do va do chinh xac.",
                                "learning_explanation": "Thu nghiem nhanh giup xac thuc gia thuyet trong dieu kien thuc te.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"domain_knowledge": 1},
                                    "context_state": {"decision_quality": "improving"},
                                },
                                "next_step": "step3C",
                            },
                        ],
                    },
                    {
                        "id": "step3A",
                        "scenario": "Tinh huong nang cao: can trinh bay ket qua va bao ve quyet dinh truoc hoi dong.",
                        "knowledge_point": "Tong hop bang chung va giao tiep hoc thuat",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Trinh bay theo cau truc: van de - bang chung - ket luan.",
                                "feedback": "Xuat sac: lap luan chat che va de theo doi.",
                                "learning_explanation": "Cau truc ro rang tang kha nang thuyet phuc va ghi nho.",
                                "effects": {
                                    "score": 3,
                                    "skills": {"communication": 1, "domain_knowledge": 1},
                                    "context_state": {"final_readiness": "high"},
                                },
                                "next_step": "ending_good",
                            },
                            {
                                "id": "B",
                                "text": "Chi dua ket qua cuoi, bo qua lap luan.",
                                "feedback": "Thieu chieu sau: hoi dong kho danh gia tinh dung dan.",
                                "learning_explanation": "Qua trinh suy luan quan trong nhu ket qua.",
                                "effects": {
                                    "score": 0,
                                    "skills": {"communication": -1},
                                    "context_state": {"final_readiness": "low"},
                                },
                                "next_step": "ending_needs_improvement",
                            },
                            {
                                "id": "C",
                                "text": "Tap trung vao rui ro va de xuat giam sat sau trien khai.",
                                "feedback": "Tot: cho thay tu duy he thong.",
                                "learning_explanation": "Danh gia rui ro giup quyet dinh ben vung hon.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1},
                                    "context_state": {"final_readiness": "medium"},
                                },
                                "next_step": "ending_good",
                            },
                        ],
                    },
                    {
                        "id": "step3B",
                        "scenario": "Tinh huong kho: ket qua bi sai lech do quyet dinh truoc do chua dua tren tri thuc vung.",
                        "knowledge_point": "Nhan dien sai lech va cai tien quy trinh",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Thuc hien phan tich nguyen nhan goc va sua quy trinh.",
                                "feedback": "Dung: hoc tu sai lam de tien bo.",
                                "learning_explanation": "Root-cause analysis giup tranh lap lai sai sot.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1},
                                    "context_state": {"remediation": "good"},
                                },
                                "next_step": "ending_needs_improvement",
                            },
                            {
                                "id": "B",
                                "text": "Do loi cho yeu to ngoai canh va khong thay doi.",
                                "feedback": "Khong hieu qua: bo lo co hoi hoc tap.",
                                "learning_explanation": "Nang luc tu danh gia la dieu kien de phat trien ben vung.",
                                "effects": {
                                    "score": -1,
                                    "skills": {"critical_thinking": -1},
                                    "context_state": {"remediation": "poor"},
                                },
                                "next_step": "ending_bad",
                            },
                            {
                                "id": "C",
                                "text": "Xin tai lieu bo sung va thuc hien lai tung buoc.",
                                "feedback": "Tich cuc: uu tien hoc lai co he thong.",
                                "learning_explanation": "Hoc bo sung dung luc giup phuc hoi chat luong quyet dinh.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"domain_knowledge": 1},
                                    "context_state": {"remediation": "moderate"},
                                },
                                "next_step": "ending_needs_improvement",
                            },
                        ],
                    },
                    {
                        "id": "step3C",
                        "scenario": "Tinh huong trung gian: ket qua tam on nhung can toi uu them de dat chuan cao hon.",
                        "knowledge_point": "Lien tuc cai tien dua tren phan hoi",
                        "choices": [
                            {
                                "id": "A",
                                "text": "Dat chi so do luong va theo doi sau moi lan ap dung.",
                                "feedback": "Tot: cai tien dua tren du lieu do luong.",
                                "learning_explanation": "Do luong lien tuc giup phat hien diem nghe va nang cap chat luong.",
                                "effects": {
                                    "score": 2,
                                    "skills": {"critical_thinking": 1, "domain_knowledge": 1},
                                    "context_state": {"optimization": "data_driven"},
                                },
                                "next_step": "ending_good",
                            },
                            {
                                "id": "B",
                                "text": "Giu nguyen hien trang vi ket qua tam chap nhan duoc.",
                                "feedback": "Han che: bo qua co hoi toi uu.",
                                "learning_explanation": "Tu duy cai tien lien tuc giup nang cao nang luc dai han.",
                                "effects": {
                                    "score": 0,
                                    "skills": {"domain_knowledge": 0},
                                    "context_state": {"optimization": "stagnant"},
                                },
                                "next_step": "ending_needs_improvement",
                            },
                            {
                                "id": "C",
                                "text": "Chia se bai hoc kinh nghiem cho nhom de dong bo thuc hanh.",
                                "feedback": "Tot: tao hieu ung hoc tap cho tap the.",
                                "learning_explanation": "Chia se tri thuc giup cu cung hieu biet va nang cao hop tac.",
                                "effects": {
                                    "score": 1,
                                    "skills": {"communication": 1},
                                    "context_state": {"optimization": "team_learning"},
                                },
                                "next_step": "ending_needs_improvement",
                            },
                        ],
                    },
                ],
                "endings": [
                    {
                        "id": "good",
                        "condition": "score >= 8",
                        "summary": "Bạn đã ra quyết định được neo bởi tri thức từ tài liệu và lập luận chặt chẽ.",
                        "knowledge_recap": [
                            "Xác minh nguồn thông tin trước khi ra quyết định",
                            "Dùng bằng chứng để bảo vệ kết luận",
                            "Cải tiến liên tục dựa trên phản hồi và đo lường",
                        ],
                        "suggestion": "Duy trì cách tiếp cận data-driven và huấn luyện thêm kỹ năng trình bày học thuật.",
                    },
                    {
                        "id": "needs_improvement",
                        "condition": "score >= 4 and score < 8",
                        "summary": "Bạn đạt kết quả trung bình, đã có tiến bộ nhưng chưa ổn định ở các tình huống khó.",
                        "knowledge_recap": [
                            "Cần ưu tiên đối chiếu tài liệu gốc",
                            "Cần nâng cao kỹ năng đánh giá độ tin cậy thông tin",
                        ],
                        "suggestion": "Ôn lại các khung đánh giá và tập luyện thêm với tình huống có mâu thuẫn dữ liệu.",
                    },
                    {
                        "id": "bad",
                        "condition": "score < 4",
                        "summary": "Quyet dinh hien tai chua dua tren nen tang tri thuc vung chac, ket qua chua dat muc tieu hoc tap.",
                        "knowledge_recap": [
                            "Ra quyết định dựa trên bằng chứng",
                            "Phân tích nguyên nhân gốc giúp tránh lặp lại sai sót",
                        ],
                        "suggestion": "Quay lại tài liệu, tổng hợp lại knowledge points và thử lại với lưu đồ ra quyết định có cấu trúc.",
                    },
                ],
            },
            "ui": {
                "layout": "vertical",
                "components": {
                    "progress": {"type": "step_indicator"},
                    "scene": {"type": "card"},
                    "choices": {"type": "buttons"},
                    "feedback": {"type": "alert"},
                },
            },
        }

        result = self.llm.json_response(system_prompt, user_prompt, fallback)
        if isinstance(result, dict) and isinstance(result.get("game"), dict) and isinstance(result["game"].get("steps"), list):
            return result
        return fallback
