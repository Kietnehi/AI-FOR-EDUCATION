# 📺 Hướng dẫn Tính năng YouTube Tương Tác (YouTube Interactive)

Chào mừng bạn đến với tài liệu hướng dẫn tính năng **YouTube Interactive Lesson**. Đây là một trong những tính năng mạnh mẽ nhất của hệ thống, cho phép biến bất kỳ video YouTube nào thành một bài học tương tác thông minh.

---

## 🌟 Tổng quan tính năng
Tính năng này không chỉ đơn thuần là xem video. Hệ thống AI sẽ phân tích nội dung, trích xuất văn bản (transcript) và tạo ra các điểm dừng (checkpoints) để kiểm tra kiến thức của người học ngay trong lúc xem.

### Các thành phần chính:
- **🎬 Trình phát Video thông minh**: Tự động đồng bộ với transcript và các điểm dừng.
- **📜 Transcript đa lớp**: Hiển thị văn bản theo thời gian thực, hỗ trợ dịch thuật đa ngôn ngữ.
- **💡 AI Analysis**: Tự động tóm tắt, chia chương (chapters) và liệt kê các ghi chú quan trọng.
- **❓ Checkpoints (Quiz)**: Video sẽ tự động dừng tại các mốc quan trọng để yêu cầu người học trả lời câu hỏi trắc nghiệm.

---

## 🛠️ Quy trình hoạt động (Workflow)

### 1. Nhập liệu đa phương thức
Người dùng có thể bắt đầu bài học bằng 3 cách:
- **Dán trực tiếp URL**: Nhập link video YouTube (ví dụ: `https://www.youtube.com/watch?v=...`).
- **Tìm kiếm từ khóa**: Nhập chủ đề muốn học, hệ thống sẽ gợi ý các video phù hợp nhất.
- **Video ID**: Nhập mã định danh duy nhất của video.

### 2. Trích xuất nội dung (Transcription)
Hệ thống sử dụng cơ chế fallback thông minh để lấy nội dung văn bản:
- **Ưu tiên 1 (SerpAPI)**: Lấy trực tiếp phụ đề cực nhanh và chính xác từ YouTube.
- **Ưu tiên 2 (STT Models)**: Nếu video không có phụ đề, hệ thống sẽ tải audio và sử dụng AI (Whisper Large V3 hoặc Groq) để chuyển đổi từ tiếng động sang văn bản.

### 3. Phân tích bài học tương tác
Sau khi có transcript, AI sẽ xử lý:
- **Summary**: Tóm tắt nội dung chính của video.
- **Chapters**: Chia video thành các phần rõ rệt với mốc thời gian cụ thể.
- **Key Notes**: Rút ra các kiến thức cốt lõi cần ghi nhớ.
- **Checkpoints**: Tạo ra tối đa 5-10 câu hỏi tương tác (tùy chọn) phân bổ dọc theo chiều dài video.

### 4. Học tập và Tương tác
- Khi video phát đến một **Checkpoint**, trình phát sẽ **tự động tạm dừng**.
- Người dùng phải trả lời câu hỏi trắc nghiệm. Sau khi trả lời (đúng hoặc sai), hệ thống sẽ hiển thị giải thích chi tiết và cho phép phát tiếp.

---

## 🌍 Tính năng Dịch thuật (Translation)
Hệ thống cho phép dịch toàn bộ Transcript sang ngôn ngữ mong muốn (ví dụ: Anh -> Việt) mà vẫn giữ nguyên các mốc thời gian (timestamps).
- **Song ngữ**: Hiển thị song song bản gốc và bản dịch để hỗ trợ việc học ngoại ngữ.
- **Lưu trữ**: Bản dịch được lưu lại trong lịch sử để không cần dịch lại lần sau.

---

## 📜 Quản lý Lịch sử (History)
Tất cả bài học bạn đã tạo sẽ được lưu lại:
- Xem lại bất kỳ lúc nào mà không cần phân tích lại từ đầu.
- Theo dõi tiến trình trả lời các câu hỏi tại Checkpoints.
- Dễ dàng quản lý hoặc xóa bỏ các bài học cũ.

---

## 📂 Các thành phần kỹ thuật liên quan
Nếu bạn là nhà phát triển, bạn có thể tham khảo code tại:
- **Backend API**: `backend/app/api/routes/youtube_lessons.py`
- **Logic Xử lý**: `backend/app/services/youtube_lesson_service.py`
- **Schemas**: `backend/app/schemas/youtube_lesson.py`
- **Frontend UI**: `frontend/app/materials/youtube-lesson/page.tsx`

---
*Tài liệu được cập nhật tự động bởi Antigravity AI.*
