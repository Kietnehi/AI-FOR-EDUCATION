# Reasoning Và Streaming Trong AI Learning Studio

Tài liệu này mô tả cơ chế **Reasoning** (suy luận sâu) và **Streaming** (trả kết quả theo luồng) đang được triển khai thực tế trong project.

## 1. Mục tiêu

- Giảm thời gian chờ khi chat bằng cách trả dữ liệu dần theo chunk.
- Cho phép bật/tắt chế độ reasoning để nhận thêm phần suy luận từ model hỗ trợ.
- Vẫn lưu đầy đủ hội thoại vào MongoDB, gồm nội dung trả lời, citations và reasoning_details.

## 2. Các điểm code chính

Backend:
- `backend/app/api/routes/chat.py`
- `backend/app/services/chat_service.py`
- `backend/app/ai/chatbot/orchestrator.py`
- `backend/app/ai/generation/llm_client.py`
- `backend/app/schemas/chat.py`

Frontend:
- `frontend/lib/api.ts`
- `frontend/app/materials/[id]/chat/page.tsx`
- `frontend/components/3d/floating-mascot.tsx`
- `frontend/components/ui/reasoning-block.tsx`

## 3. Cơ chế Reasoning

## 3.1 Cờ bật/tắt reasoning

Trong schema request:
- `ChatMessageRequest.reasoning_enabled: bool = False`
- `MascotChatRequest.reasoning_enabled: bool = False`

Frontend truyền cờ này qua API:
- `reasoning_enabled: options?.reasoningEnabled || false`

## 3.2 Bật reasoning trên giao diện

Ở trang chat và mascot chat, UI có toggle **Suy luận sâu (Reasoning)**.

Lưu ý quan trọng trong implementation hiện tại:
- Toggle reasoning chỉ hiện khi model thuộc nhóm hỗ trợ trong điều kiện UI (ví dụ model chứa `minimax`, `deepseek`, `qwen`).
- Nếu bật reasoning, frontend tạo trước placeholder assistant message với `reasoning_details: { reasoning: "" }` để cộng dồn dần dữ liệu reasoning khi stream.

## 3.3 Reasoning được lấy từ model như thế nào

Trong `LLMClient`:
- Non-streaming (`text_response_chat_openai`):
  - Nếu `reasoning_enabled=True`, payload gửi thêm:
    - `extra_body: { reasoning: { enabled: true } }`
  - Kết quả reasoning được lấy từ:
    - `response_message.reasoning`
    - hoặc `response_message.reasoning_details`
- Streaming (`stream_text_response_chat_openai`):
  - Mỗi delta chunk có thể chứa:
    - `content`
    - `reasoning`
  - Backend giữ cả hai luồng này để trả ra ngoài.

## 4. Cơ chế Streaming

## 4.1 Endpoint streaming

Hiện có 2 endpoint stream chính:
- `POST /chat/sessions/{session_id}/message/stream`
- `POST /chat/mascot/message/stream`

Trong route, FastAPI trả `StreamingResponse` với:
- `media_type="application/x-ndjson"`
- Header:
  - `X-Accel-Buffering: no`
  - `Cache-Control: no-cache`

Điểm quan trọng:
- Hệ thống dùng **NDJSON** (mỗi dòng là 1 JSON object), không dùng chuẩn SSE `text/event-stream`.

## 4.2 Luồng chunk trả về

Trong `ChatService.stream_add_user_message_and_answer`:
- Chunk citations đầu tiên (nếu có):
  - `{"citations": [...]}`
- Các chunk nội dung/suy luận:
  - `{"content": "...", "reasoning": "..."}`
- Chunk kết thúc:
  - `{"done": true, "model": "..."}`

Sau khi stream xong, backend mới ghi assistant message hoàn chỉnh vào DB, gồm:
- `message` (full content)
- `citations`
- `model_used`
- `reasoning_details` (nếu có)

## 4.3 Frontend đọc stream

Trong `frontend/lib/api.ts`:
- Dùng `fetch` + `response.body.getReader()` + `TextDecoder`.
- Buffer dữ liệu theo `\n`.
- Parse từng dòng JSON và callback `onChunk(parsed)`.

Trong UI chat:
- Mỗi chunk `content` được nối vào message cuối.
- Mỗi chunk `reasoning` được cộng dồn vào `last.reasoning_details.reasoning` nếu toggle reasoning đang bật.
- Khi nhận chunk có `model`, frontend gán `model_used` cho message.

## 5. Hành vi đặc biệt theo model (rất quan trọng)

Trong `LLMClient.stream_chat_unified` có logic sau:

- Nếu model là **default route** (nhánh RAG mặc định):
  - Không stream token theo thời gian thực.
  - Hệ thống gọi non-streaming (Gemini trước, fallback OpenAI) rồi `yield` 1 chunk lớn.
  - Mục tiêu: giảm jitter trong workflow mặc định.

- Nếu người dùng chọn **custom model** (không phải default):
  - Đi theo `stream_text_response_chat_openai`.
  - Có thể nhận chunk theo thời gian thực, gồm cả `content` và `reasoning`.

Kết luận:
- Cùng là endpoint `/stream`, nhưng mức độ “streaming real-time” phụ thuộc model và nhánh xử lý bên dưới.

## 6. Ví dụ dữ liệu NDJSON

```json
{"citations":[{"chunk_index":3,"snippet":"..."}]}
{"content":"Đầu tiên, ta xét...","reasoning":"Phân tích bước 1..."}
{"content":"Tiếp theo...","reasoning":"Phân tích bước 2..."}
{"done":true,"model":"openai/gpt-4o-mini"}
```

## 7. Cách hiển thị Reasoning trên UI

Component `ReasoningBlock`:
- Hiển thị khối “Quá trình suy luận”.
- Có trạng thái thu gọn/mở rộng.
- Nếu đang stream sẽ có nhãn “Đang suy luận...” và hiệu ứng pulse.
- Nội dung reasoning render bằng Markdown.

Điều này giúp:
- Người dùng thấy được phần trả lời chính trước.
- Có thể mở reasoning khi cần kiểm tra quá trình suy luận.

## 8. Checklist kiểm tra nhanh

1. Bật một model hỗ trợ reasoning, bật toggle Suy luận sâu.
2. Gửi tin nhắn bằng endpoint stream.
3. Quan sát Network response phải là nhiều dòng NDJSON.
4. Kiểm tra UI:
   - Nội dung trả lời tăng dần.
   - Khối reasoning có dữ liệu và cập nhật theo chunk.
5. Reload phiên chat, xác nhận message đã lưu `reasoning_details` trong DB.

## 9. Rủi ro và lưu ý vận hành

- Nếu proxy/reverse proxy buffer response, cảm giác stream sẽ bị “dồn cục”.
- Nếu model không phát reasoning delta, UI vẫn chạy bình thường nhưng reasoning có thể rỗng.
- Với default RAG route, stream có thể chỉ về 1 chunk lớn do chủ đích thiết kế để tránh jitter.

## 10. Đề xuất cải tiến (nếu cần mở rộng)

- Chuẩn hóa schema chunk với `type` rõ ràng (`citations`, `delta`, `done`) để frontend parse an toàn hơn.
- Thêm telemetry riêng cho tốc độ stream: time-to-first-byte, time-to-first-token, total stream duration.
- Bổ sung chế độ cấu hình cho phép bật “true real-time streaming” cả ở default route khi cần thử nghiệm.

---

Tài liệu này phản ánh hành vi thực tế trong code hiện tại của project tại thời điểm cập nhật.