# Cá nhân hóa trải nghiệm học tập qua Minigame

Tài liệu này mô tả ý tưởng và kế hoạch triển khai tính năng cá nhân hóa cho người dùng dựa trên tương tác của họ với hệ thống minigame, đồng thời bổ sung các cấp độ khó cho từng loại game.

## 1. Hệ thống cá độ khó (Difficulty Levels)

Khi người dùng chọn tạo một minigame (Trắc nghiệm hỗn hợp, Flashcard, Bắn gà ôn tập), hệ thống sẽ cung cấp 3 cấp độ để người dùng lựa chọn. Mức độ khó sẽ ảnh hưởng đến nội dung tạo ra, thời gian và yêu cầu hoàn thành:

*   **Dễ (Easy):**
    *   **Nội dung:** Câu hỏi mang tính chất nhận biết, ghi nhớ cơ bản. Các khái niệm cốt lõi.
    *   **Cơ chế:** Thời gian trả lời dài hoặc không giới hạn. Số lượng câu hỏi ít (ví dụ: 10 câu). Lựa chọn đáp án rõ ràng.
    *   **Phù hợp cho:** Người mới bắt đầu học chủ đề, ôn tập lần đầu.
*   **Trung bình (Medium):**
    *   **Nội dung:** Câu hỏi yêu cầu sự hiểu biết, phân tích và áp dụng. Có thể có các câu hỏi gài bẫy nhẹ.
    *   **Cơ chế:** Thời gian trả lời vừa phải. Số lượng câu hỏi trung bình (ví dụ: 15-20 câu). Tốc độ game (như Bắn gà) tăng dần.
    *   **Phù hợp cho:** Người đã nắm được kiến thức cơ bản và muốn kiểm tra mức độ hiểu bài.
*   **Khó (Hard):**
    *   **Nội dung:** Câu hỏi vận dụng cao, suy luận logic, kết hợp nhiều kiến thức. 
    *   **Cơ chế:** Áp lực thời gian cao. Số lượng câu hỏi nhiều (ví dụ: 20-30 câu). Tốc độ game nhanh, phạt nặng khi sai (trừ điểm, mất mạng). Lựa chọn đáp án dễ gây nhầm lẫn.
    *   **Phù hợp cho:** Người muốn thử thách bản thân, ôn thi cường độ cao, master chủ đề.

## 2. Ý tưởng thiết kế tính năng Cá nhân hóa (Personalization)

Dựa trên dữ liệu chơi game và lựa chọn cấp độ của người dùng, hệ thống sẽ thực hiện theo dõi và tinh chỉnh trải nghiệm học tập của họ:

### 2.1. Phân tích điểm yếu và Khuyến nghị học tập
*   **Theo dõi câu hỏi sai:** Hệ thống sẽ lưu lại những câu hỏi, thẻ flashcard hoặc từ khóa mà người dùng thường xuyên trả lời sai hoặc mất nhiều thời gian để trả lời.
*   **Đề xuất nội dung ôn tập:** Dựa trên các điểm yếu đã ghi nhận, hệ thống tự động:
    *   Tạo ra các mini-quiz "Khắc phục điểm yếu" chỉ chứa những câu làm sai.
    *   Đề xuất người dùng đọc lại phần tài liệu (Document) tương ứng với kiến thức bị hổng.
    *   Gửi thông báo/nhắc nhở ôn tập (Spaced Repetition) với các câu hỏi này vào ngày hôm sau.

### 2.2. Tiến trình học tập thích ứng (Adaptive Learning)
*   **Tự động điều chỉnh độ khó:** Nếu người dùng liên tục đạt điểm tối đa ở mức "Dễ", hệ thống sẽ gợi ý hoặc tự động mở khóa mức "Trung bình" cho lần chơi tiếp theo của chủ đề đó. Ngược lại, nếu người dùng thất bại nhiều ở mức "Khó", hệ thống sẽ khuyên họ nên quay lại mức "Trung bình" hoặc đọc lại tài liệu.
*   **Báo cáo năng lực cá nhân:** Cung cấp một Dashboard nhỏ trong trang Profile thống kê: 
    *   Biểu đồ radar biểu diễn năng lực theo từng môn học/chủ đề dựa trên điểm số game.
    *   Tỷ lệ thắng/thua, độ chính xác trung bình, chuỗi ngày học tập (streak).

### 2.3. Hệ thống Thành tựu và Phần thưởng (Gamification & Rewards)
*   **Huy hiệu (Badges) cá nhân hóa:** Người dùng nhận được huy hiệu dựa trên phong cách chơi (ví dụ: "Tay súng bắn tỉa" cho ai có độ chính xác cao trong game bắn gà, "Bậc thầy trí nhớ" cho ai lật flashcard ít sai nhất).

## 3. Các bước Triển khai kỹ thuật (Technical Implementation)

1.  **Database (MongoDB):**
    *   Cập nhật schema `Game` để lưu thêm trường `difficulty` (easy, medium, hard).
    *   Tạo collection `UserGameStats` để lưu kết quả từng ván chơi (số câu đúng, sai, thời gian, câu nào sai).
2.  **AI Generation (Backend):**
    *   Cập nhật prompt cho LLM: Thêm tham số `difficulty` vào prompt để LLM sinh ra câu hỏi/trắc nghiệm phù hợp với mức độ yêu cầu (từ vựng, độ lắt léo, độ dài câu hỏi).
3.  **Frontend (UI/UX):**
    *   Thêm UI chọn "Độ khó" trước khi bắt đầu tạo game chung với form tạo.
    *   Xây dựng UI Dashboard cá nhân (Settings/Profile) để hiển thị biểu đồ và lịch sử ôn tập.
    *   Xây dựng module hiển thị "Gợi ý ôn tập" ngoài Trang chủ hoặc Trang Materials.

---
*Tài liệu này đóng vai trò như bản phác thảo ban đầu để định hướng phát triển tính năng.*