# LLM API Flow

Tài liệu này mô tả cách backend hiện đang gọi LLM, thứ tự fallback, các điểm tối ưu để giảm lag, và cách frontend hiển thị model đang dùng.

## 1. File chính

Logic gọi LLM hiện nằm chủ yếu ở:

- `backend/app/ai/generation/llm_client.py`

Các file liên quan:

- `backend/app/services/generation_service.py`
- `backend/app/schemas/generated_content.py`
- `frontend/types/index.ts`
- `frontend/app/materials/[id]/chat/page.tsx`

## 2. Mục tiêu hiện tại

Hệ thống được thiết kế để:

- ưu tiên Gemini trước
- chỉ chuyển sang OpenAI khi đã thử hết đường Gemini cần thiết
- giảm độ trễ khi một model hoặc API key Gemini bị lỗi
- ghi log rõ model nào đang được dùng
- trả metadata để frontend biết model thực tế đã trả kết quả

## 3. Thứ tự fallback

Model Gemini được thử theo thứ tự:

1. `settings.gemini_model`
2. `gemini-3.1-flash-lite-preview`
3. `gemini-2.5-pro`
4. `gemini-2.5-flash`
5. `gemini-2.5-flash-lite`

Nếu toàn bộ Gemini đều không dùng được thì mới fallback sang:

- `settings.openai_model`

## 4. Luồng gọi thực tế

### 4.1 Entry points

`LLMClient` có 4 hàm public chính:

- `json_response(...)`
- `text_response(...)`
- `json_response_openai(...)`
- `text_response_openai(...)`

Luồng mặc định của app đi qua:

- `json_response(...)` hoặc `text_response(...)`
- sau đó vào `_generate_text(...)`
- `_generate_text(...)` gọi `_generate_gemini(...)`
- nếu Gemini thất bại thì gọi `_generate_openai(...)`

### 4.2 Gemini fast pass

Để giảm lag, backend không còn đốt toàn bộ key của một model trước khi thử model kế tiếp.

Fast pass hiện hoạt động như sau:

- lấy danh sách Gemini keys theo thứ tự ưu tiên hiện tại
- chỉ lấy key tốt nhất hiện tại để test nhanh
- thử lần lượt từng model Gemini với key đó
- model nào trả kết quả hợp lệ thì dừng ngay

Mục tiêu của fast pass là tìm đường sống nhanh nhất thay vì vét cạn toàn bộ tổ hợp model x key.

### 4.3 Gemini exhaustive pass

Nếu fast pass không có kết quả:

- hệ thống chạy exhaustive pass
- tiếp tục thử các key Gemini còn lại
- vẫn theo thứ tự model cố định
- nếu có model nào trả kết quả hợp lệ thì dừng ngay

Chỉ khi cả fast pass lẫn exhaustive pass đều thất bại mới chuyển OpenAI.

## 5. Cách xoay vòng API key Gemini

Backend giữ `active_gemini_key_index` để nhớ key Gemini gần nhất đã chạy thành công.

Điều này giúp:

- request sau bắt đầu từ key đang sống tốt
- tránh luôn bị kẹt ở key đầu tiên nếu key đầu tiên đang rate-limit hoặc lỗi mạng

Ngoài ra có cooldown ngắn cho key lỗi tạm thời:

- retryable error sẽ đưa key vào cooldown khoảng 20 giây
- key đang cooldown bị đẩy xuống cuối danh sách

## 6. Timeout Gemini

Mỗi request Gemini đang dùng HTTP timeout native của `google-genai`.

Giá trị hiện tại:

- `10000ms`

Lưu ý:

- Gemini API không chấp nhận deadline thấp hơn `10s`
- trước đó `8000ms` gây `400 INVALID_ARGUMENT`

## 7. Vì sao gọi trực tiếp `_generate_content`

SDK `google-genai` có wrapper `generate_content(...)` tự bật AFC.

Điều này gây ra 2 vấn đề:

- thêm overhead không cần thiết
- log `AFC is enabled with max remote calls: 10.`

Để tránh lớp wrapper đó, backend hiện ưu tiên gọi:

- `client.models._generate_content(...)`

Nếu SDK không có method nội bộ này thì mới fallback về:

- `client.models.generate_content(...)`

Mục đích là giữ request Gemini đơn giản, ít tầng trung gian hơn, và dễ đo lỗi thật hơn.

## 8. Phân loại lỗi Gemini

### 8.1 Retryable errors

Các lỗi kiểu sau được coi là tạm thời:

- timeout
- `429`
- `503`
- connection error
- unavailable
- resource exhausted

Với nhóm này:

- key bị đưa vào cooldown
- hệ thống tiếp tục thử model/key khác

### 8.2 Permanent errors

Các lỗi kiểu sau được coi là lỗi request:

- `400`
- `bad request`
- `invalid argument`
- `unknown field`
- `invalid value`
- `malformed`

Với nhóm này:

- Gemini sweep bị dừng sớm
- hệ thống fallback sang OpenAI

Mục tiêu là tránh mất thời gian quét hết tất cả models/keys khi payload hiện tại chắc chắn sai.

## 9. Kiểm tra JSON response

Nếu request yêu cầu JSON:

- Gemini phải trả text
- text đó phải parse được bằng `json.loads(...)`

Nếu text không parse được:

- không coi là thành công
- hệ thống thử candidate Gemini tiếp theo

Điều này tránh việc model trả text gần đúng nhưng làm luồng JSON fail về sau.

## 10. Logging hiện tại

Backend log các điểm chính:

- bắt đầu `fast pass`
- bắt đầu `exhaustive pass`
- model nào đang được thử
- key số mấy đang được dùng
- model nào thành công
- mỗi attempt mất bao nhiêu ms
- message lỗi thật từ Gemini nếu thất bại

Ví dụ log mong muốn:

```text
Starting Gemini fast pass
Trying Gemini model gemini-3-flash-preview (1/5)
Calling Gemini model gemini-3-flash-preview with key 1/6
Gemini generation successful with model gemini-3-flash-preview after 1240ms
```

## 11. OpenAI fallback

Nếu Gemini không trả được kết quả:

- `_generate_text(...)` log fallback
- backend gọi `_generate_openai(...)`

OpenAI hiện dùng:

- `settings.openai_base_url`
- `settings.openai_api_key`
- `settings.openai_model`

Nếu đang đi qua OpenRouter thì request có thể kèm:

- `HTTP-Referer`
- `X-OpenRouter-Title`

## 12. Metadata trả về cho frontend

Backend lưu và trả các thông tin:

- `model_used`
- `fallback_applied`

Ý nghĩa:

- `model_used`: model thực tế đã tạo ra kết quả cuối cùng
- `fallback_applied`: có dùng model dự phòng hay không

Frontend dùng các field này để hiển thị:

- model đang dùng
- thông báo đã chuyển sang model dự phòng

## 13. Các điểm hiện đang tối ưu tốt

Những điểm đã hợp lý hơn trước:

- không còn luôn bắt đầu từ key Gemini đầu tiên
- không còn quét toàn bộ key của model đầu tiên trước khi thử model khác
- có cooldown cho key lỗi tạm thời
- có timeout native của Gemini SDK
- có fail-fast cho lỗi request vĩnh viễn
- có log model/key/thời gian rõ hơn

## 14. Các điểm có thể tối ưu thêm sau này

Nếu cần tối ưu sâu hơn nữa, có thể làm tiếp:

- lưu thống kê latency theo từng model/key
- thêm circuit breaker mạnh hơn cho key lỗi liên tục
- reorder model fallback theo dữ liệu thực tế thay vì cố định
- log riêng thời gian embeddings, Gemini, OpenAI để biết bottleneck nằm ở đâu

## 15. Tóm tắt ngắn

Luồng hiện tại là:

1. thử Gemini theo thứ tự model đã định
2. fast pass trước để tìm model sống nhanh
3. nếu cần thì exhaustive pass trên các key còn lại
4. nếu Gemini không dùng được thì mới sang OpenAI
5. log rõ model nào đang được dùng và mất bao lâu

Tài liệu này cần được cập nhật mỗi khi sửa:

- thứ tự fallback model
- timeout Gemini
- logic cooldown
- cấu trúc metadata `model_used` hoặc `fallback_applied`
