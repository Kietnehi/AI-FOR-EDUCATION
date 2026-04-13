# Báo cáo triển khai Minigame (chi tiết)

## 1) Mục tiêu triển khai

Tài liệu này tổng hợp toàn bộ phần đã triển khai cho hệ thống minigame trong dự án AI Learning Studio, bao gồm:

1. Hệ minigame với 3 loại game chính.
2. 3 cấp độ độ khó xuyên suốt backend/frontend.
3. Logic cá nhân hóa theo lịch sử chơi.
4. Logic ôn tập khuyết điểm tự động bằng AI.
5. Các cải tiến gameplay, UX/UI và hành vi người dùng liên quan trực tiếp minigame.

Phạm vi tài liệu này tập trung vào minigame. Các phần chatbot/reasoning không nằm trong phạm vi chính của báo cáo này.

---

## 2) Phạm vi tính năng đã hoàn thành

### 2.1 Ba loại minigame

Hệ thống hiện hỗ trợ tạo/chạy 3 loại game:

1. `quiz_mixed`
2. `flashcard`
3. `shooting_quiz`

Nguồn định nghĩa request generation: `GenerateMinigameRequest` trong [backend/app/schemas/generated_content.py](backend/app/schemas/generated_content.py).

### 2.2 Ba cấp độ độ khó

Mỗi minigame được gán và lưu độ khó:

1. `easy`
2. `medium`
3. `hard`

Độ khó được truyền xuyên suốt từ UI -> API -> generation prompt -> persisted generated content -> khi submit attempt và khi hiển thị thư viện game.

### 2.3 Cá nhân hóa

Đã có endpoint tổng hợp personalization theo từng học liệu và user:

1. Tổng quan hiệu suất (`total_attempts`, `average_accuracy`, `streak_days`).
2. Gợi ý game tiếp theo (`suggested_game_type`).
3. Gợi ý level (`recommended_difficulty`).
4. Thống kê theo game type và theo difficulty.
5. Weak points (điểm sai lặp lại).
6. Next actions (hành động đề xuất).
7. First-time logic (AI phân bổ level cho user mới).
8. Tried-all-levels logic + knowledge notes theo level.

### 2.4 Ôn tập khuyết điểm tự động

Đã hoàn thiện flow tạo nhanh 1 quiz ôn tập cá nhân hóa dựa trên top câu sai:

1. Thu thập top câu sai nhiều nhất.
2. Dùng AI generate đúng 1 quiz `quiz_mixed`.
3. Mặc định top 10 câu sai.
4. Hiển thị modal kết quả với danh sách lỗi sai có thể mở rộng/thu gọn.
5. CTA vào chơi ngay quiz ôn tập.

---

## 3) Kiến trúc và luồng dữ liệu

## 3.1 Luồng generation minigame

1. Frontend gọi `generateMinigame(materialId, gameType, difficulty, force_regenerate)`.
2. API route nhận request ở [backend/app/api/routes/generated_contents.py](backend/app/api/routes/generated_contents.py).
3. Service xử lý ở `GenerationService.generate_minigame(...)` trong [backend/app/services/generation_service.py](backend/app/services/generation_service.py).
4. `MinigameGenerator` dựng prompt theo `game_type` và `difficulty` tại [backend/app/ai/generation/minigame_generator.py](backend/app/ai/generation/minigame_generator.py).
5. Kết quả được lưu vào generated_contents với các trường: `game_type`, `difficulty`, `json_content`, `model_used`, `fallback_applied`.

## 3.2 Luồng submit attempt và chấm điểm

1. Frontend submit answers qua `submitGameAttempt`.
2. API route `/games/{generated_content_id}/submit` tại [backend/app/api/routes/games.py](backend/app/api/routes/games.py).
3. `GameService.submit_attempt(...)` chấm điểm theo game type tại [backend/app/services/game_service.py](backend/app/services/game_service.py).
4. Attempt lưu vào collection `game_attempts` qua [backend/app/repositories/game_repository.py](backend/app/repositories/game_repository.py).

## 3.3 Luồng personalization

1. Frontend gọi `/games/materials/{material_id}/personalization`.
2. `GameService.get_personalization_summary(...)` tổng hợp attempts gần nhất.
3. Trả về cấu trúc `MinigamePersonalizationResponse` ở [backend/app/schemas/games.py](backend/app/schemas/games.py).

## 3.4 Luồng remediation quick start

1. Frontend gọi `/games/materials/{material_id}/remediation-quick-start`.
2. Backend lấy personalization + attempts.
3. Backend trích xuất top sai qua `_collect_top_wrong_questions(...)`.
4. Backend tạo 1 quiz mới bằng `generate_minigame(..., focus_context=...)`.
5. Frontend mở modal để bắt đầu game vừa tạo.

---

## 4) Thiết kế chi tiết 3 loại minigame

## 4.1 Quiz Mixed

### Dữ liệu

`json_content.items` gồm nhiều dạng câu hỏi:

1. `true_false`
2. `mcq`
3. `multiple_select`
4. `fill_blank`

### Chấm điểm

1. `true_false`, `mcq`, `fill_blank`: so khớp 1 đáp án đúng.
2. `multiple_select`: bắt buộc tập đáp án user chọn phải bằng tập đáp án đúng.

### Cải tiến đã làm

1. Multiple-select bị giới hạn số lượng chọn đúng bằng số đáp án đúng.
2. Khi đã chọn đủ số lượng, các lựa chọn còn lại bị khóa tạm thời.
3. Hiển thị feedback rõ đúng/sai và đáp án đúng cho từng câu.

## 4.2 Flashcard

### Dữ liệu

`json_content.items` gồm cặp `front/back` (và tags tùy chọn).

### Hành vi

1. User lật thẻ để học.
2. Có ghi nhận known/unknown.
3. Có submit cuối phiên để lưu attempt.

## 4.3 Shooting Quiz

### Dữ liệu

Payload gồm:

1. `game.questions` (10 câu, mỗi câu 4 đáp án A/B/C/D, đúng 1 đáp án).
2. `tracking.score_per_correct`, `tracking.max_score`.

### Cải tiến gameplay đã làm

1. Cải thiện cơ chế va chạm bằng swept hit test để giảm miss-hit.
2. Target lock cho bullet để tránh bắn đáp án A nhưng ăn đáp án B gần đó.
3. Tinh chỉnh kích thước và đường đạn để cảm giác bắn ổn định hơn.
4. Hoàn thiện xử lý timeout/pause/continue theo round.

---

## 5) Thiết kế 3 cấp độ game (Easy/Medium/Hard)

Độ khó được áp dụng nhất quán trong generation prompt:

1. Easy: nhận biết, cơ bản, đáp án rõ.
2. Medium: hiểu và phân tích, có nhiễu vừa phải.
3. Hard: vận dụng cao, suy luận, phương án gây nhiễu nhiều.

Mỗi generator function (`generate_quiz_mixed`, `generate_flashcard`, `generate_shooting_quiz`) đều có nhánh hướng dẫn theo difficulty tại [backend/app/ai/generation/minigame_generator.py](backend/app/ai/generation/minigame_generator.py).

Độ khó được lưu trong generated content (`difficulty`) và attempt (`difficulty`) để phục vụ analytics/personalization.

---

## 6) Logic cá nhân hóa chi tiết

## 6.1 Dữ liệu đầu vào personalization

Nguồn chính là danh sách attempts theo `user_id + material_id`, lấy theo thời gian gần nhất.

## 6.2 Công thức và chỉ số

1. `accuracy` mỗi attempt = `score / max_score`.
2. `average_accuracy` tổng hợp theo phần trăm.
3. `streak_days` = số ngày có hoạt động chơi.
4. `game_type_stats`:
   1. số lần chơi từng game type.
   2. accuracy trung bình theo game type.
   3. difficulty đề xuất theo ngưỡng accuracy.
   4. difficulty gần nhất đã chơi.
5. `difficulty_stats`:
   1. số lượt ở easy/medium/hard.
   2. accuracy trung bình theo từng mức.
6. `weak_points`:
   1. trích từ feedback sai.
   2. đếm tần suất sai.
   3. lấy top mục sai nhiều nhất.

## 6.3 Rule đề xuất difficulty

Suy từ accuracy tổng:

1. `>= 85%` -> `hard`
2. `>= 60%` và `< 85%` -> `medium`
3. `< 60%` -> `easy`

## 6.4 First-time user logic (AI phân bổ level)

Khi user chưa có attempt nào:

1. Gọi `_build_first_time_level_plan(material)` dùng LLM.
2. LLM trả `level_plan` gồm đúng 3 mức không lặp.
3. Có fallback cứng `easy -> medium -> hard` nếu LLM trả về không hợp lệ.
4. `auto_assigned_difficulty` lấy từ level đầu tiên trong plan.

Mục tiêu của cơ chế này là cho user mới có lộ trình tăng độ khó có kiểm soát thay vì chọn ngẫu nhiên.

## 6.5 Tried-all-levels logic + knowledge notes

Khi user đã có ít nhất 1 attempt ở cả easy/medium/hard:

1. `has_tried_all_difficulties = true`.
2. Sinh `knowledge_notes` theo từng level.
3. Frontend hiển thị lưu ý kiến thức theo level user đang chọn trước khi tạo game mới.

---

## 7) Logic ôn tập khuyết điểm tự động (AI)

## 7.1 Mục tiêu

Cho phép user ôn tập rất nhanh từ lỗi sai thực tế, thay vì làm game ngẫu nhiên.

## 7.2 Rule nghiệp vụ đã chốt

1. Chỉ tạo 1 game duy nhất.
2. Game luôn là `quiz_mixed`.
3. Dùng top 10 câu sai nhiều nhất (config được, mặc định 10).

## 7.3 Trích xuất lỗi sai

Hàm `_collect_top_wrong_questions(...)`:

1. Duyệt feedback của attempts.
2. Bỏ các mục đúng.
3. Chuẩn hóa text câu hỏi.
4. Đếm `wrong_count`.
5. Lấy đáp án đúng tham chiếu nếu có.
6. Sort giảm dần theo số lần sai.

## 7.4 Generation quiz remediation

`generate_remediation_quick_start(...)` tạo `focus_context` chứa top câu sai để ép AI sinh quiz bám sát lỗi của user.

Nếu chưa có đủ dữ liệu sai:

1. Backend fallback sang bộ quiz nền tảng để khảo sát lỗ hổng.

## 7.5 UX remediation

1. CTA `Ôn tập ngay`.
2. Nếu chưa có lịch sử chơi thì CTA bị disable.
3. Modal hiển thị top câu sai.
4. Danh sách top sai có trạng thái mở rộng/thu gọn.
5. Nút bắt đầu quiz remediation ngay từ modal.

---

## 8) Frontend minigame hub và hành vi người dùng

Màn hình chính nằm ở [frontend/app/materials/[id]/minigame/page.tsx](frontend/app/materials/[id]/minigame/page.tsx) với các khối:

1. Khu vực chuyển chế độ:
   1. Tạo game mới.
   2. Thư viện game đã tạo.
2. Khối personalization card:
   1. KPI tổng quan.
   2. suggested game + difficulty.
   3. weak points.
   4. next actions.
   5. first-time auto level plan.
   6. remediation CTA.
3. Bộ chọn difficulty + game type.
4. Knowledge note theo level khi user đã thử đủ 3 level.
5. Thư viện game hiển thị tên game + level (không dùng nhãn version-centric).

---

## 9) API contracts liên quan minigame

## 9.1 Generation

1. `POST /materials/{material_id}/generate/minigame`
2. `POST /materials/{material_id}/generate/minigame/async`

Body chính:

1. `game_type`: `quiz_mixed | flashcard | shooting_quiz`
2. `difficulty`: `easy | medium | hard`
3. `force_regenerate`: bool

## 9.2 Attempt

1. `POST /games/{generated_content_id}/submit`
2. `GET /games/attempts/{attempt_id}`

## 9.3 Personalization

1. `GET /games/materials/{material_id}/personalization`

## 9.4 Remediation

1. `POST /games/materials/{material_id}/remediation-quick-start`
2. Body: `difficulty?`, `top_k_wrong_questions` (3..20, default 10)

---

## 10) Dữ liệu và schema quan trọng

## 10.1 Generated content minigame

Các trường quan trọng:

1. `content_type = minigame`
2. `game_type`
3. `difficulty`
4. `json_content`
5. `model_used`
6. `fallback_applied`

## 10.2 Game attempt

Các trường quan trọng:

1. `generated_content_id`
2. `game_type`
3. `difficulty`
4. `answers`
5. `score`, `max_score`
6. `feedback`
7. `skills_gained`, `improvement_tips`
8. `started_at`, `completed_at`

## 10.3 Personalization response

Các trường mở rộng đã có:

1. `is_first_time_user`
2. `auto_assigned_difficulty`
3. `first_time_level_plan`
4. `first_time_allocation_reason`
5. `has_tried_all_difficulties`
6. `knowledge_notes`

---

## 11) Các cải tiến chất lượng đã làm cho minigame

1. Đồng bộ difficulty end-to-end toàn stack.
2. Chuyển hiển thị thư viện game theo `tên game + level`.
3. Hoàn thiện personalization thật bằng dữ liệu attempts.
4. Hoàn thiện remediation AI theo top lỗi sai.
5. Sửa hành vi multiple-select chuẩn theo số đáp án đúng.
6. Sửa gameplay shooting quiz để giảm hit sai/miss-hit.
7. Cải thiện UX: gợi ý AI actions, modal rõ ràng, expand/collapse danh sách lỗi sai.
8. Hành vi quay lại khi đang chơi minigame được điều chỉnh về trang tổng minigame.

---

## 12) Giới hạn hiện tại và hướng mở rộng

## 12.1 Giới hạn hiện tại

1. Remediation hiện tạo 1 quiz duy nhất (theo rule nghiệp vụ hiện tại).
2. Weak points trích chủ yếu từ feedback text; chưa chuẩn hóa ontology kiến thức sâu.
3. Difficulty recommendation đang dùng rule-based theo accuracy.

## 12.2 Hướng mở rộng đề xuất

1. Bổ sung analytics dashboard theo từng dạng câu hỏi và theo thời gian.
2. Tạo adaptive quiz theo micro-skill thay vì chỉ theo level tổng quát.
3. A/B test chiến lược remediation (số câu, phân phối dạng câu, độ dài giải thích).
4. Chuẩn hóa weak point taxonomy để báo cáo học tập chính xác hơn.

---

## 13) Danh sách file chính đã can thiệp cho minigame

### Backend

1. [backend/app/schemas/generated_content.py](backend/app/schemas/generated_content.py)
2. [backend/app/ai/generation/minigame_generator.py](backend/app/ai/generation/minigame_generator.py)
3. [backend/app/services/generation_service.py](backend/app/services/generation_service.py)
4. [backend/app/api/routes/generated_contents.py](backend/app/api/routes/generated_contents.py)
5. [backend/app/tasks.py](backend/app/tasks.py)
6. [backend/app/schemas/games.py](backend/app/schemas/games.py)
7. [backend/app/repositories/game_repository.py](backend/app/repositories/game_repository.py)
8. [backend/app/services/game_service.py](backend/app/services/game_service.py)
9. [backend/app/api/routes/games.py](backend/app/api/routes/games.py)

### Frontend

1. [frontend/types/index.ts](frontend/types/index.ts)
2. [frontend/lib/api.ts](frontend/lib/api.ts)
3. [frontend/app/materials/[id]/minigame/page.tsx](frontend/app/materials/[id]/minigame/page.tsx)
4. [frontend/components/minigame/QuizMixedPlayer.tsx](frontend/components/minigame/QuizMixedPlayer.tsx)
5. [frontend/components/minigame/FlashcardPlayer.tsx](frontend/components/minigame/FlashcardPlayer.tsx)
6. [frontend/components/minigame/ShootingQuizPlayer.tsx](frontend/components/minigame/ShootingQuizPlayer.tsx)
7. [frontend/components/minigame/RemediationQuickStartModal.tsx](frontend/components/minigame/RemediationQuickStartModal.tsx)

---

## 14) Kết luận

Phần minigame đã được nâng từ mức tạo game cơ bản sang một hệ thống học tập có cá nhân hóa thực tế:

1. Có 3 loại game + 3 level xuyên suốt toàn stack.
2. Có personalization theo dữ liệu chơi thật của user.
3. Có remediation AI dựa trên lỗi sai thực tế.
4. Có cải thiện gameplay và UX để tăng tính học tập và khả năng quay lại luyện tập.

Tài liệu này có thể dùng làm baseline kỹ thuật cho việc bảo trì, bàn giao và mở rộng các vòng tiếp theo.