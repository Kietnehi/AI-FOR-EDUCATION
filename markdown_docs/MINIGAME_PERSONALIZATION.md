# Minigame & Cá Nhân Hóa

Tài liệu này gộp 2 phần:
- Ý tưởng và định hướng thiết kế tính năng.
- Trạng thái triển khai thực tế đã hoàn thành trong hệ thống.

## 1. Mục tiêu tổng thể

- Xây dựng hệ thống minigame phục vụ học tập với nhiều định dạng.
- Cá nhân hóa trải nghiệm dựa trên lịch sử làm bài của từng người dùng.
- Tạo luồng ôn tập tự động bằng AI để tập trung vào điểm yếu thực tế.

## 2. Định hướng sản phẩm (Product Design)

### 2.1 Hệ thống mức độ khó

Khi người dùng tạo minigame, hệ thống hỗ trợ 3 mức độ khó:

- **Dễ (Easy)**:
    - Nội dung nhận biết, ghi nhớ cơ bản.
    - Đáp án rõ ràng, ít gây nhiễu.
    - Phù hợp người mới bắt đầu hoặc ôn tập lần đầu.
- **Trung bình (Medium)**:
    - Nội dung yêu cầu hiểu và phân tích.
    - Có độ nhiễu vừa phải.
    - Phù hợp người đã có nền tảng cơ bản.
- **Khó (Hard)**:
    - Nội dung vận dụng cao, cần suy luận.
    - Đáp án nhiễu mạnh, yêu cầu chắc kiến thức.
    - Phù hợp luyện nâng cao hoặc ôn thi.

### 2.2 Ý tưởng cá nhân hóa

- Theo dõi câu hỏi người dùng làm sai nhiều lần.
- Tổng hợp chỉ số học tập theo học liệu:
    - số lượt chơi,
    - độ chính xác trung bình,
    - số ngày học.
- Gợi ý hành động tiếp theo:
    - game nên chơi,
    - mức độ khó phù hợp,
    - điểm yếu ưu tiên cần ôn.

### 2.3 Ôn tập khuyết điểm tự động với AI

Luồng mong muốn và đã áp dụng:

1. Thu thập dữ liệu sai từ lịch sử attempts.
2. Chọn top câu sai nhiều nhất.
3. Gọi LLM để sinh bộ quiz ôn tập tập trung đúng điểm yếu.
4. Cho người dùng vào chơi ngay sau khi tạo xong.

## 3. Trạng thái triển khai hiện tại (Implementation Status)

## 3.1 Tổng quan tính năng

### 3.1.1 Minigame
- Có 3 loại game chính:
    - `quiz_mixed` (Trắc nghiệm hỗn hợp)
    - `flashcard`
    - `shooting_quiz` (Bắn gà ôn tập)
- Có 3 mức độ khó: `easy`, `medium`, `hard`.
- Người dùng có thể tạo game mới, mở lại game đã tạo, xóa game.

### 3.1.2 Cá nhân hóa
- Dashboard hiển thị:
    - Số lượt chơi
    - Độ chính xác trung bình
    - Số ngày học
    - Điểm yếu cần ôn lại
    - Hành động đề xuất
- Có CTA **"Ôn tập ngay"** để tạo bộ ôn tập bằng AI.

## 3.2 Backend

### 3.2.1 Chấm điểm và lưu attempt
- Mỗi attempt lưu `difficulty`.
- Hỗ trợ chấm điểm cho quiz/flashcard/shooting quiz.

### 3.2.2 API cá nhân hóa
- `GET /api/games/materials/{material_id}/personalization`
- Trả về:
    - `total_attempts`
    - `average_accuracy`
    - `suggested_game_type`
    - `recommended_difficulty`
    - `streak_days`
    - `weak_points`
    - `next_actions`

### 3.2.3 API ôn tập AI
- `POST /api/games/materials/{material_id}/remediation-quick-start`
- Rule hiện tại:
    - Chỉ tạo **1 game duy nhất**: `quiz_mixed`
    - Lấy **top 10 câu sai nhiều nhất** từ lịch sử `feedback`
    - Truyền danh sách này vào context để LLM sinh quiz ôn tập
- Payload/response:
    - Request: `difficulty`, `top_k_wrong_questions`
    - Response: `top_wrong_questions`, `generated_items` (1 item quiz)

## 3.3 Frontend

### 3.3.1 Trang minigame
- Tách rõ khu vực:
    - Tạo game mới
    - Thư viện game đã tạo
- Có gợi ý AI và thao tác nhanh theo đề xuất.

### 3.3.2 Modal bộ ôn tập AI
- Hiển thị thông tin quiz vừa tạo.
- Hiển thị danh sách top câu sai nhiều nhất.
- Có thu gọn/mở rộng danh sách để tiết kiệm diện tích.
- Có nút vào chơi ngay quiz vừa tạo.

### 3.3.3 Đồng bộ giao diện sáng/tối
- Đã chuẩn hóa theo biến theme:
    - `--bg-*`, `--text-*`, `--border-*`
- Giảm hard-code màu, giảm hiệu ứng quá nổi.
- Khu vực "Cá nhân hóa cho bạn" đã đồng bộ tông với các khối còn lại.

## 4. Luồng nghiệp vụ hiện tại

1. Người dùng chơi minigame và submit kết quả.
2. Hệ thống lưu attempt + feedback từng câu.
3. Dashboard cá nhân hóa tổng hợp chỉ số và điểm yếu.
4. Người dùng bấm "Ôn tập ngay".
5. Backend lấy top 10 câu sai nhiều nhất và gọi LLM tạo 1 quiz ôn tập.
6. Frontend mở modal, hiển thị top sai, cho vào chơi ngay.

## 5. Các file liên quan chính

### Backend
- `backend/app/api/routes/games.py`
- `backend/app/services/game_service.py`
- `backend/app/services/generation_service.py`
- `backend/app/schemas/games.py`

### Frontend
- `frontend/app/materials/[id]/minigame/page.tsx`
- `frontend/components/minigame/RemediationQuickStartModal.tsx`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`

## 6. Trạng thái hiện tại

- Chức năng minigame: Hoạt động.
- Chức năng cá nhân hóa: Hoạt động.
- Chức năng ôn tập AI: Hoạt động theo rule mới (1 quiz + top 10 câu sai).
- UI/UX: Đã tối ưu và đồng bộ theme sáng/tối.

## 7. Đề xuất bước tiếp theo

- Bổ sung telemetry cho CTA ôn tập:
    - Số lần bấm.
    - Tỷ lệ vào chơi ngay sau khi tạo quiz.
- Thêm bộ lọc trong modal top sai:
    - Theo mức độ khó.
    - Theo loại câu hỏi.
- Bổ sung test integration cho API `remediation-quick-start` để tránh regression.

