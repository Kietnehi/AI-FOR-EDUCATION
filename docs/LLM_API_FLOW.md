# LLM API Flow

Tài liệu này mô tả cách backend hiện đang gọi LLM, thứ tự fallback, các điểm tối ưu để giảm lag, và cách frontend hiển thị model đang dùng.

## 1. File chính

Logic gọi LLM hiện nằm chủ yếu ở:

- `backend/app/ai/generation/llm_client.py` (Trung tâm điều phối)

Các file liên quan:

- `backend/app/ai/chatbot/orchestrator.py` (Dùng cho Chatbot RAG)
- `backend/app/services/generation_service.py` (Dùng cho Slides, Podcast, Minigame)
- `backend/app/services/chat_service.py` (Lưu log model metadata)
- `backend/app/schemas/generated_content.py`
- `frontend/types/index.ts`
- `frontend/app/materials/[id]/chat/page.tsx`

## 2. Mục tiêu hiện tại

Hệ thống được thiết kế để:

- Ưu tiên Gemini trước (vì chi phí và tốc độ).
- Chỉ chuyển sang OpenAI khi đã thử hết các model Gemini khả dụng hoặc gặp lỗi request vĩnh viễn.
- Giảm độ trễ khi một model hoặc API key Gemini bị lỗi.
- Ghi log rõ model nào đang được dùng và thời gian phản hồi.
- Trả metadata (`model_used`, `fallback_applied`) để frontend hiển thị thông tin trung thực cho người dùng.

## 3. Thứ tự fallback

Model Gemini được thử theo thứ tự ưu tiên giảm dần:

1. `settings.gemini_model` (Mặc định: `gemini-3-flash-preview`)
2. `gemini-3.1-flash-lite-preview`
3. `gemini-2.5-pro`
4. `gemini-2.5-flash`
5. `gemini-2.5-flash-lite`
6. `gemini-2.5-flash-lite-preview-09-2025`

Nếu toàn bộ danh sách Gemini trên đều thất bại (hoặc hết key), hệ thống sẽ fallback sang:

- `settings.openai_model` (Mặc định: `gpt-4o-mini`)

## 4. Luồng gọi thực tế

### 4.1 Entry points

`LLMClient` cung cấp các hàm tiện ích:

- `json_response(...)`: Trả về dict, tự động ép kiểu JSON.
- `text_response(...)`: Trả về string thuần túy.
- `json_response_openai(...)` & `text_response_openai(...)`: Gọi thẳng OpenAI không qua Gemini sweep (dùng cho mascot chat hoặc các task đặc thù).

Luồng mặc định của app:
- Gọi `json_response` hoặc `text_response`.
- Vào `_generate_text(...)` -> khởi tạo metadata.
- Thử `_generate_gemini(...)`.
- Nếu thất bại (trả về `None`) -> Thử `_generate_openai(...)`.

### 4.2 Gemini fast pass

Để giảm lag, hệ thống không quét cạn toàn bộ key của model đầu tiên trước khi thử model kế tiếp.

**Fast pass:**
- Lấy 1 key (key tốt nhất hiện tại) từ danh sách `GEMINI_API_KEYS`.
- Thử lần lượt **từng model** trong danh sách ưu tiên với duy nhất key đó.
- Nếu model nào sống, dừng ngay và trả kết quả.

Mục tiêu: Tìm "đường sống" nhanh nhất với model bất kỳ.

### 4.3 Gemini exhaustive pass

Nếu fast pass không có kết quả:
- Hệ thống thực hiện **exhaustive pass**.
- Thử các model theo thứ tự cũ, nhưng quét qua **tất cả các key còn lại** chưa thử ở bước fast pass.
- Chỉ khi toàn bộ (Models x Keys) đều lỗi mới chính thức từ bỏ Gemini.

## 5. Cách xoay vòng API key Gemini

Hệ thống duy trì `active_gemini_key_index` (stateful trong instance) để:
- Request sau bắt đầu từ key đã thành công ở request trước.
- Tránh việc luôn đâm đầu vào key đầu tiên nếu nó đang bị Rate Limit (429).

**Cooldown logic:**
- Nếu key gặp lỗi tạm thời (timeout, 503, 429), nó bị đưa vào cooldown **20 giây**.
- Key đang cooldown sẽ bị đẩy xuống cuối danh sách ưu tiên khi gọi `_ordered_gemini_clients`.

## 6. Timeout Gemini

Giá trị timeout được cấu hình cứng để đảm bảo tính ổn định:
- `10000ms` (10 giây).

*Lưu ý: Gemini API yêu cầu deadline tối thiểu 10s. Các giá trị thấp hơn (như 8s) có thể gây lỗi `400 INVALID_ARGUMENT` từ phía Google SDK.*

## 7. Gọi trực tiếp `_generate_content` (Internal Method)

SDK `google-genai` bản mới có wrapper `generate_content(...)` tự động bật AFC (Automatic Function Calling). Việc này gây ra:
- Overhead không cần thiết cho các request đơn giản.
- Spam log `AFC is enabled with max remote calls: 10.`

**Giải pháp:**
`LLMClient` ưu tiên gọi `client.models._generate_content(...)` (method nội bộ) để bỏ qua lớp wrapper này. Nếu không tồn tại mới quay lại method public.

## 8. Phân loại lỗi Gemini

### 8.1 Retryable errors (Lỗi tạm thời)
- Bao gồm: Timeout, 429 (Rate Limit), 503 (Service Unavailable), Connection Error, Resource Exhausted.
- **Xử lý:** Đưa key vào cooldown, tiếp tục thử key/model khác.

### 8.2 Permanent errors (Lỗi vĩnh viễn)
- Bao gồm: 400 Bad Request, Invalid Argument, Unsupported Model, Malformed Payload.
- **Xử lý:** Dừng ngay lập tức toàn bộ sweep của Gemini (vì có thử model khác với payload này cũng sẽ lỗi) và fallback thẳng sang OpenAI.

## 9. Kiểm tra JSON response

Khi `force_json=True`:
- Hệ thống kiểm tra xem text trả về có parse được bằng `json.loads` hay không.
- Nếu text lỗi format JSON, model đó coi như thất bại và hệ thống thử candidate tiếp theo.

## 10. Metadata và Hiển thị Frontend

Mỗi kết quả trả về từ backend (cho Slides, Podcast, Chat, v.v.) đều đính kèm:

- `model_used`: Tên model thực tế đã trả về kết quả cuối cùng (ví dụ: `gemini-2.5-flash` hoặc `gpt-4o-mini`).
- `fallback_applied`: Boolean, `true` nếu Gemini đã thất bại và phải dùng OpenAI.

**Frontend (Next.js):**
- Hiển thị badge cảnh báo nếu `fallback_applied` là true.
- Cho người dùng biết họ đang dùng model nào để minh bạch về chất lượng phản hồi.

## 11. Các điểm đã tối ưu tốt

- Xoay vòng key (Round Robin) + Cooldown.
- Fast pass giúp giảm latency khi gặp model chết.
- Giảm overhead bằng cách gọi internal SDK method.
- Log chi tiết model/key/thời gian để debug dễ dàng.

## 12. Tóm tắt ngắn luồng xử lý

1. Nhận request -> `LLMClient`.
2. Thử Gemini Fast Pass (1 key x N models).
3. Nếu fail -> Thử Gemini Exhaustive Pass (M keys x N models).
4. Nếu fail -> Gọi OpenAI (GPT-4o-mini).
5. Trả kết quả + Metadata.
