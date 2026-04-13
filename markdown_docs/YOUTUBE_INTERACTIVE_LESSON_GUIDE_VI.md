# YouTube Interactive Lesson Guide (VI)

## 1. Mục tiêu tính năng
Tính năng YouTube Interactive Lesson cho phép người dùng:
- Dán link YouTube hoặc tìm video theo từ khóa.
- Tự động tạo transcript có timestamp.
- Sinh bài học tương tác bằng AI (summary, chapters, key notes, checkpoints).
- Tự động tạm dừng video ở các checkpoint để hỏi câu hỏi tương tác.
- Lưu lịch sử bài học theo từng người dùng.
- Dịch transcript sang ngôn ngữ người dùng chọn, đồng thời vẫn giữ bản gốc.

## 2. Luồng nghiệp vụ tổng quan
1. Người dùng nhập URL hoặc từ khóa.
2. Backend tìm metadata video (title, channel, thumbnail, duration).
3. Backend lấy transcript theo nhiều tầng fallback:
   - `youtube_transcript_api`
   - timedtext endpoint
   - watch page caption tracks
   - `yt-dlp` captions
   - audio download + Whisper/Groq transcription
4. Backend sinh nội dung bài học tương tác bằng AI.
5. Frontend render:
   - YouTube player
   - Transcript có timestamp (click để seek)
   - Checkpoint auto-pause + quiz
   - AI Analysis tabs
6. Kết quả được lưu vào lịch sử (`youtube_lesson_history`).

## 3. API chính
### 3.1 Search video
- `POST /api/youtube-lessons/search`
- Input: `query`, `limit`
- Output: danh sách video YouTube phù hợp.

### 3.2 Tạo bài học tương tác
- `POST /api/youtube-lessons/interactive`
- Input:
  - `youtube_url` hoặc `video_id` hoặc `query`
  - `max_checkpoints`
  - `stt_model`: `local-base`, `local-small`, `whisper-large-v3`, `whisper-large-v3-turbo`
- Output:
  - `video`
  - `transcript`
  - `lesson` (summary, key_takeaways, chapters, key_notes, checkpoints)

### 3.3 Lịch sử bài học
- `GET /api/youtube-lessons/history`
- `GET /api/youtube-lessons/history/{history_id}`
- `DELETE /api/youtube-lessons/history/{history_id}`

### 3.4 Dịch transcript
- `POST /api/youtube-lessons/translate-transcript`
- Input: transcript gốc + `target_language`
- Output: transcript đã dịch theo ngôn ngữ đích (giữ nguyên timestamp/start/duration).

## 4. UI hiện có (frontend)
Trang: `/materials/youtube-lesson`

### 4.1 Khu input
- Nhập URL/từ khóa.
- Nút tìm kiếm, tạo bài học.
- Tùy chỉnh số lượng kết quả search.
- Chọn model STT.
- Voice input.

### 4.2 Video + transcript
- Render YouTube player embedded.
- Transcript có timestamp, click để tua tới mốc tương ứng.
- Khi dịch transcript:
  - Vẫn hiển thị bản gốc.
  - Hiển thị thêm bản dịch ngay dưới từng dòng (không ghi đè bản gốc).

### 4.3 Checkpoint tương tác
- Video tự pause tại checkpoint chưa trả lời.
- Hiển thị câu hỏi trắc nghiệm, đáp án, giải thích.
- Người dùng bấm tiếp tục để phát video tiếp.

### 4.4 AI Analysis panel
- `Summary`
- `Chapters`
- `Key Notes`
- Click chapter/note để jump tới timestamp.

### 4.5 History panel
- Danh sách bài học đã lưu theo user.
- Mở lại chi tiết bài học.
- Xóa từng mục lịch sử.

## 5. Ràng buộc ngôn ngữ tiếng Việt
Backend đã ép prompt và chuẩn hóa hậu xử lý để đảm bảo:
- Summary, key takeaways, chapters, key notes, câu hỏi, lựa chọn, giải thích
- Đều ở tiếng Việt có dấu hoàn chỉnh.

## 6. Độ bền lấy transcript
### 6.1 Nguyên nhân thường fail dù video có transcript
- Caption phụ thuộc client/region/session.
- Transcript hiển thị trên web YouTube không đồng nghĩa server-side access luôn thành công.

### 6.2 Khuyến nghị vận hành
- Cấu hình cookie file khi cần:
  - `YTDLP_COOKIE_FILE` hoặc đặt `cookie.txt` ở root project.
- Chọn model STT phù hợp:
  - Local (`local-base`, `local-small`) cho chạy offline/local.
  - Groq (`whisper-large-v3`, `whisper-large-v3-turbo`) khi có API key.

## 7. Dữ liệu MongoDB liên quan
Collection: `youtube_lesson_history`
- Unique index: `user_id + video.video_id`
- Index truy vấn: `user_id + updated_at`

## 8. Files chính liên quan
Backend:
- `backend/app/api/routes/youtube_lessons.py`
- `backend/app/services/youtube_lesson_service.py`
- `backend/app/repositories/youtube_lesson_history_repository.py`
- `backend/app/schemas/youtube_lesson.py`

Frontend:
- `frontend/app/materials/youtube-lesson/page.tsx`
- `frontend/lib/api.ts`

## 9. Checklist test nhanh
1. Tạo bài học từ URL YouTube.
2. Xác nhận transcript + timestamp hiển thị.
3. Xác nhận auto-pause tại checkpoint.
4. Trả lời câu hỏi và tiếp tục video.
5. Đổi ngôn ngữ transcript, bấm dịch.
6. Xác nhận hiển thị đồng thời bản gốc và bản dịch.
7. Reload trang, kiểm tra lịch sử vẫn còn.
8. Mở lại bài từ lịch sử và chạy bình thường.
