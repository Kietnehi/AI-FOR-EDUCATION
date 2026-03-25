from app.ai.generation.llm_client import LLMClient


class MinigameGenerator:
    def __init__(self) -> None:
        self.llm = LLMClient()

    def generate(self, context: str, game_type: str) -> dict:
        """Generate minigame with specified type."""
        if game_type == "quiz_mixed":
            return self.generate_quiz_mixed(context)
        elif game_type == "flashcard":
            return self.generate_flashcard(context)
        elif game_type == "scenario_branching":
            return self.generate_scenario(context)
        else:
            # Fallback to quiz_mixed
            return self.generate_quiz_mixed(context)

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
            "BẮT BUỘC có branching tree thực sự, không phải quiz tuyến tính. "
            "Mỗi step có đúng 3 lựa chọn A/B/C với next_step khác nhau. "
            "Mỗi lựa chọn phải có feedback, learning_explanation, effects(score/skills/context_state), next_step."
        )
        user_prompt = (
            "Dựa trên tài liệu sau, tạo Scenario-based Learning Game theo format STRICT JSON này:\n"
            "{\n"
            '  "metadata": {\n'
            '    "topic": "",\n'
            '    "difficulty": "easy | medium | hard",\n'
            '    "estimated_time": "minutes"\n'
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
            '            "next_step": "step2A"\n'
            "          }\n"
            "        ]\n"
            "      }\n"
            "    ],\n"
            '    "endings": [\n'
            "      {\n"
            '        "id": "good",\n'
            '        "condition": "score >= 10",\n'
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
            "- Tối thiểu 6 steps để tạo cây quyết định có độ sâu >= 3.\n"
            "- Mỗi step phải có 3 choices A/B/C.\n"
            "- Trong cùng 1 step, 3 next_step phải khác nhau.\n"
            "- Độ khó tăng dần theo tiến trình, step sau phản ánh quyết định trước qua context_state.\n"
            "- Có ít nhất 2 endings dựa trên score hoặc state.\n"
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
                        "summary": "Ban da ra quyet dinh duoc neo boi tri thuc tu tai lieu va lap luan chat che.",
                        "knowledge_recap": [
                            "Xac minh nguon thong tin truoc khi ra quyet dinh",
                            "Dung bang chung de bao ve ket luan",
                            "Cai tien lien tuc dua tren phan hoi va do luong",
                        ],
                        "suggestion": "Duy tri cach tiep can data-driven va huan luyen them ky nang trinh bay hoc thuat.",
                    },
                    {
                        "id": "needs_improvement",
                        "condition": "score >= 4 and score < 8",
                        "summary": "Ban dat ket qua trung binh, da co tien bo nhung chua on dinh o cac tinh huong kho.",
                        "knowledge_recap": [
                            "Can uu tien doi chieu tai lieu goc",
                            "Can nang cao ky nang danh gia do tin cay thong tin",
                        ],
                        "suggestion": "On lai cac khung danh gia va tap luyen them voi tinh huong co mau thuan du lieu.",
                    },
                    {
                        "id": "bad",
                        "condition": "score < 4",
                        "summary": "Quyet dinh hien tai chua dua tren nen tang tri thuc vung chac, ket qua chua dat muc tieu hoc tap.",
                        "knowledge_recap": [
                            "Ra quyet dinh can dua tren bang chung",
                            "Phan tich nguyen nhan goc giup tranh lap lai sai sot",
                        ],
                        "suggestion": "Quay lai tai lieu, tong hop lai knowledge points va thu lai voi luu do ra quyet dinh co cau truc.",
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
