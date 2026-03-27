# Hướng Dẫn Review Chức Năng Web Search

## Tổng quan

Tài liệu này tổng hợp kết quả review lại toàn bộ chức năng web search trong hệ thống, bao gồm cả phía backend lẫn frontend.

Phạm vi review gồm:

- Luồng web search cho chatbot theo tài liệu.
- Luồng web search cho mascot chat.
- Logic chọn provider tìm kiếm.
- Bước refinement sau khi lấy dữ liệu từ provider.
- Cách frontend gọi API và hiển thị kết quả.

Hiện tại hệ thống đang có hai provider web search:

- Google Search grounding qua Gemini.
- Tavily Search dùng làm fallback hoặc chạy trực tiếp trong một số trường hợp.

## Các file đã đối chiếu

- `backend/app/services/web_search_service.py`
- `backend/app/services/chat_service.py`
- `backend/app/api/routes/chat.py`
- `backend/app/schemas/chat.py`
- `backend/app/ai/chatbot/orchestrator.py`
- `backend/app/core/config.py`
- `backend/app/ai/generation/llm_client.py`
- `backend/app/repositories/chat_repository.py`
- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `frontend/components/ui/web-search-result.tsx`
- `frontend/components/3d/floating-mascot.tsx`
- `frontend/app/materials/[id]/chat/page.tsx`

## Kết luận review nhanh

Sau khi rà soát code hiện tại, có thể kết luận như sau:

1. Chức năng web search cho chatbot theo tài liệu đang được triển khai đầy đủ từ backend đến frontend, bao gồm cả hiển thị danh sách nguồn.
2. Mascot chat cũng đã hỗ trợ bật web search, nhưng response public hiện tại chỉ trả về câu trả lời dạng text và metadata cơ bản, chưa trả ra danh sách nguồn cho frontend hiển thị.
3. Cả hai luồng web search đều có bước refinement bằng model riêng là `WEB_SEARCH_REFINEMENT_MODEL`.
4. Nếu Google Search lỗi và Tavily khả dụng, hệ thống sẽ fallback sang Tavily.
5. Nếu bước refinement lỗi, hệ thống sẽ fallback về output gốc của provider để tránh gián đoạn trải nghiệm.
6. Một số mô tả trong tài liệu cũ không còn đúng với code hiện tại, đặc biệt là phần nói rằng Google tự chèn citation inline vào `answer`.

## Cấu hình `.env`

Các biến môi trường liên quan trực tiếp đến web search gồm:

```env
LLM_PROVIDER=gemini

GEMINI_API_KEY=...
GEMINI_API_KEYS=["key1", "key2"]
GEMINI_MODEL=gemini-3-flash-preview

OPENAI_API_KEY=...
OPENAI_MODEL=openai/gpt-4o-mini
OPENAI_BASE_URL=https://openrouter.ai/api/v1

TAVILY_API_KEY=tvly-...

MASCOT_CHAT_MODEL=openai/gpt-4o-mini
WEB_SEARCH_REFINEMENT_MODEL=openai/gpt-4o-mini
```

### Ghi chú quan trọng

- `GEMINI_API_KEY` là key kiểu cũ để tương thích ngược.
- Nếu `GEMINI_API_KEYS` đang để rỗng nhưng `GEMINI_API_KEY` có giá trị, backend sẽ tự động đưa `GEMINI_API_KEY` vào danh sách `GEMINI_API_KEYS`.
- `WEB_SEARCH_REFINEMENT_MODEL` là model riêng cho bước biên tập lại kết quả web search.
- Sau khi thay đổi `.env`, cần restart backend để cấu hình mới có hiệu lực.

## Logic chọn provider tìm kiếm

Logic này nằm trong `WebSearchOrchestrator.search_with_answer(...)` ở `backend/app/services/web_search_service.py`.

### Trường hợp 1: Ưu tiên Google Search

Google chỉ được ưu tiên khi đồng thời thỏa cả ba điều kiện sau:

- `use_google=true`
- `LLM_PROVIDER=gemini`
- Google service khởi tạo thành công và đang available

Khi thỏa điều kiện trên:

- Hệ thống sẽ gọi Google Search trước.
- Nếu Google Search lỗi, hệ thống sẽ thử fallback sang Tavily nếu Tavily đang khả dụng.

### Trường hợp 2: Dùng Tavily trực tiếp

Nếu không thỏa điều kiện để đi vào nhánh Google, nhưng Tavily đang khả dụng:

- Hệ thống sẽ gọi Tavily trực tiếp.

### Trường hợp 3: Không có provider nào khả dụng

Nếu cả Google lẫn Tavily đều không dùng được:

- Hệ thống sẽ trả lỗi yêu cầu cấu hình `GEMINI_API_KEY` hoặc `TAVILY_API_KEY`.

### Lưu ý thực tế

- `use_google=true` không có nghĩa là chắc chắn sẽ dùng Google.
- Nếu `LLM_PROVIDER` khác `gemini`, nhánh Google sẽ bị bỏ qua ngay cả khi `use_google=true`.
- Trong thực tế, `LLM_PROVIDER` đang ảnh hưởng trực tiếp đến việc có được đi vào Google Search grounding hay không.

## Triển khai Google Search grounding

Phần này nằm trong `GoogleSearchService` ở `backend/app/services/web_search_service.py`.

### Cách hoạt động

Luồng hiện tại đang làm như sau:

1. Khởi tạo `google.genai.Client` bằng Gemini API key khả dụng đầu tiên.
2. Tạo tool `types.Tool(google_search=types.GoogleSearch())`.
3. Gọi `client.models.generate_content(...)` với cấu hình có `tools=[grounding_tool]`.
4. Lấy `response.text` làm đầu ra chính.
5. Đọc `grounding_metadata` để thu thập thông tin nguồn.

### Metadata được lấy ra

Từ `grounding_metadata`, hệ thống đang thu thập:

- `web_search_queries`
- `grounding_chunks`
- thông tin `title` và `uri` của từng nguồn

Sau đó hệ thống map thành:

- `sources`
- `citations`

### Hành vi thực tế hiện tại

- `answer` của tầng search hiện đang chính là `response.text`.
- `raw_text` cũng chính là `response.text`.
- `search_provider` được gán là `google_search`.
- `search_queries` được lấy từ `grounding_metadata.web_search_queries` nếu có.

### Điểm cần lưu ý

1. Code hiện tại không có đoạn nào chèn trực tiếp citation dạng `[n](url)` vào text trả lời.
2. Trường `snippet` của nguồn Google hiện đang để rỗng vì SDK không phải lúc nào cũng trả trường này.
3. Hàm `search_and_answer()` đang mặc định dùng model `gemini-2.5-flash`.
4. `settings.gemini_model` hiện chưa được dùng trực tiếp cho nhánh web search này.
5. Danh sách `supported_models` hiện chỉ dùng để log warning, không phải để chặn request.

## Triển khai Tavily Search

Phần này nằm trong `TavilySearchService` và helper `_search_with_tavily()` trong `backend/app/services/web_search_service.py`.

### Cách hoạt động

Luồng hiện tại:

1. Khởi tạo `TavilyClient` nếu có `TAVILY_API_KEY`.
2. Gọi `search(...)` với các tham số:
   - `search_depth="advanced"`
   - `max_results=10`
   - `include_raw_content=True`
3. Đọc `response["results"]` để build `sources` và `citations`.

### Hành vi thực tế hiện tại

- `snippet` của mỗi nguồn lấy từ `content` hoặc `snippet` rồi cắt tối đa 300 ký tự.
- `search_provider` được gán là `tavily`.
- Nhánh Tavily không tự sinh ra một câu trả lời hoàn chỉnh ngay ở tầng search.
- Thay vào đó, toàn bộ `results` sẽ được serialize thành JSON string để đưa sang bước refinement.

### Ý nghĩa của cách triển khai này

Điều đó có nghĩa là với Tavily:

- phần search chỉ đóng vai trò lấy dữ liệu,
- còn phần “viết lại thành câu trả lời dễ đọc” phụ thuộc chủ yếu vào bước refinement.

## Bước refinement sau web search

Logic refinement nằm trong `ChatService._refine_web_search_answer(...)` ở `backend/app/services/chat_service.py`.

### Input của refinement

Bước refinement nhận vào:

- câu hỏi gốc của người dùng
- toàn bộ `search_result` sau khi được `json.dumps(...)`

Nói cách khác, model refinement không chỉ nhìn thấy `answer`, mà nhìn thấy gần như toàn bộ dữ liệu mà tầng search đã trả về.

### Mục tiêu của prompt refinement

Prompt hiện tại yêu cầu model:

- viết lại bằng tiếng Việt rõ ràng, mạch lạc, dễ đọc
- chỉ sử dụng thông tin có trong input
- không suy diễn, không thêm dữ kiện mới
- giữ nguyên tên riêng, số liệu, ngày tháng và liên kết
- không để lộ JSON hoặc dữ liệu kỹ thuật nội bộ

### Cấu trúc output bắt buộc

Prompt refinement đang yêu cầu output markdown với cấu trúc:

1. Một đoạn trả lời chính từ 2 đến 4 câu, trả lời trực tiếp câu hỏi.
2. Một phần `Nguồn tham khảo` dạng danh sách đánh số.

Ngoài ra:

- nếu provider là Tavily, prompt còn yêu cầu làm sạch câu văn, bỏ các đoạn cụt, bỏ lặp ý.

### Cơ chế fallback

Nếu refinement lỗi:

- với chatbot theo tài liệu, hệ thống trả lại `search_result["answer"]`
- với mascot, hệ thống cũng trả lại `search_result["answer"]`

Điểm này giúp hệ thống không bị vỡ luồng chỉ vì model refinement gặp lỗi.

## API web search cho chat theo tài liệu

Endpoint nằm ở `backend/app/api/routes/chat.py`:

### `POST /chat/sessions/{session_id}/web-search`

### Request mẫu

```json
{
  "query": "Who won the Euro 2024 final and what was the score?",
  "use_google": true
}
```

### Response mẫu

```json
{
  "answer": "Câu trả lời đã qua refinement",
  "raw_text": "Output gốc từ provider trước refinement",
  "sources": [
    {
      "index": 1,
      "title": "...",
      "uri": "https://...",
      "snippet": "..."
    }
  ],
  "citations": [
    {
      "index": 1,
      "title": "...",
      "url": "https://...",
      "source": "google_search"
    }
  ],
  "search_provider": "google_search",
  "model": "openai/gpt-4o-mini",
  "search_queries": ["..."]
}
```

### Ý nghĩa các trường

- `answer`: câu trả lời sau refinement nếu refinement thành công
- `raw_text`: output gốc từ provider trước refinement
- `sources`: danh sách nguồn để frontend hiển thị
- `citations`: metadata trích dẫn ở mức web source
- `search_provider`: provider thực tế đã được dùng
- `model`: thường là model refinement, không nhất thiết là search model ban đầu
- `search_queries`: các truy vấn tìm kiếm mà Google grounding đã sử dụng, nếu có

### Dữ liệu được lưu vào database

Khi gọi endpoint này, backend sẽ lưu:

- một user message chứa câu hỏi gốc
- một assistant message chứa:
  - `message`: refined answer
  - `model_used`
  - `fallback_applied`
  - `search_results.sources`
  - `search_results.search_provider`
  - `search_results.search_queries`
  - `search_results.raw_text`
  - `search_results.refined_with_llm`
  - `search_results.search_model`

### Điểm quan trọng cần biết

Mặc dù metadata web search đã được lưu vào MongoDB, nhưng endpoint lấy lại lịch sử session là `GET /chat/sessions/{session_id}` hiện đang trả theo schema `ChatMessageResponse`, và schema này chưa expose đầy đủ:

- `search_results`
- `is_web_search`

Vì vậy:

- dữ liệu có lưu trong DB,
- nhưng chưa được trả ra đầy đủ khi load lại lịch sử chat từ backend.

## API web search cho mascot

Endpoint nằm ở `backend/app/api/routes/chat.py`:

### `POST /chat/mascot/message`

### Request mẫu

```json
{
  "message": "Tin công nghệ mới nhất hôm nay",
  "session_id": "optional-session-id",
  "images": [],
  "use_web_search": true,
  "use_google": true
}
```

### Response mẫu

```json
{
  "message": "Câu trả lời mascot",
  "model": "openai/gpt-4o-mini",
  "session_id": "...",
  "model_used": "openai/gpt-4o-mini",
  "fallback_applied": false,
  "is_web_search": true,
  "search_provider": "google_search"
}
```

### Hành vi thực tế

Nếu `use_web_search=true`:

1. Backend sẽ gọi `self.orchestrator.web_search(...)`.
2. Sau đó chạy refinement.
3. Lưu kết quả vào collection message của mascot.
4. Trả response về cho frontend.

### Điểm khác biệt lớn so với document chat

Mascot response hiện tại không expose các trường sau ra ngoài:

- `sources`
- `citations`
- `search_queries`
- `raw_text`

Điều đó có nghĩa là:

- mascot vẫn có web search thật,
- backend vẫn có lưu metadata,
- nhưng frontend mascot hiện chỉ nhận được phần câu trả lời text và vài cờ metadata cơ bản.

### Cơ chế fallback riêng của mascot

Nếu web search hoặc refinement bị lỗi trong mascot:

- hệ thống không trả lỗi ra ngoài ngay,
- mà sẽ âm thầm fallback về luồng mascot chat bình thường để giữ trải nghiệm ổn định.

Đây là điểm khác biệt quan trọng so với document chat, nơi web search lỗi sẽ trả HTTP 500.

## Frontend tích hợp web search

## Chat theo tài liệu

Phần frontend chính nằm ở `frontend/app/materials/[id]/chat/page.tsx`.

### API helper

Trong `frontend/lib/api.ts` có hàm:

- `webSearch(sessionId, query, useGoogle)`

Hàm này gọi tới:

- `POST /chat/sessions/{session_id}/web-search`

### Cách UI hoạt động

Trong trang chat theo tài liệu:

- có nút Globe để bật hoặc tắt web search
- khi đang bật web search thì có dropdown chọn provider ưu tiên:
  - Google Search
  - Tavily Search

Khi người dùng gửi tin nhắn:

- nếu web search đang tắt, frontend gọi endpoint chat RAG bình thường
- nếu web search đang bật, frontend gọi endpoint web search riêng

### Cách hiển thị kết quả

Khi nhận được response web search, frontend sẽ tự dựng một assistant message tạm trong client state với:

- `is_web_search: true`
- `search_results.sources`
- `search_results.search_provider`
- `search_results.search_queries`

Sau đó message này được render bằng component `WebSearchResult` trong `frontend/components/ui/web-search-result.tsx`.

Component này hiện đang hiển thị:

- phần answer dạng markdown
- provider đang dùng
- danh sách search queries nếu có
- danh sách source cards có thể click mở link

Ngoài ra:

- khi `is_web_search=true`, UI sẽ không hiển thị chunk citations của RAG

## Mascot

Phần frontend mascot nằm ở `frontend/components/3d/floating-mascot.tsx`.

### API helper

Frontend dùng hàm:

- `sendMascotChatMessage(message, sessionId, images, { useWebSearch, useGoogle })`

Hàm này gửi lên backend các trường:

- `use_web_search`
- `use_google`

### Cách UI hoạt động

Trong mascot:

- có nút `Search` để bật hoặc tắt web search
- có settings panel để chọn provider:
  - Google Search
  - Tavily Search

### Cách hiển thị kết quả hiện tại

Sau khi nhận response từ backend:

- frontend mascot chỉ append `response.message` vào danh sách chat
- phần answer được render dưới dạng markdown
- không có phần hiển thị source cards
- không có phần hiển thị danh sách link nguồn

Nói ngắn gọn:

- mascot có khả năng tìm kiếm web thật,
- nhưng trải nghiệm frontend hiện tại vẫn là dạng “answer-only”.

## So sánh document chat và mascot web search

| Hạng mục | Chat theo tài liệu | Mascot |
| --- | --- | --- |
| Endpoint | `/chat/sessions/{id}/web-search` | `/chat/mascot/message` |
| Có bật/tắt web search | Có | Có |
| Có chọn Google/Tavily | Có | Có |
| Có refinement | Có | Có |
| Search lỗi thì xử lý thế nào | Trả lỗi HTTP 500 | Fallback về mascot chat thường |
| Response có `sources` | Có | Không |
| UI hiển thị danh sách nguồn | Có | Không |
| Có lưu metadata search vào DB | Có | Có |

## Những điểm đang đúng với code hiện tại

- Hệ thống có hai provider web search hoạt động song song.
- Có fallback từ Google sang Tavily.
- Có model refinement riêng cho kết quả web search.
- Document chat có UI hiển thị nguồn khá đầy đủ.
- Mascot đã hỗ trợ bật web search từ UI.
- Backend có lưu metadata search vào MongoDB cho cả document chat và mascot.

## Những hạn chế hoặc điểm cần lưu ý

### 1. Tài liệu cũ nói Google chèn citation inline là không còn đúng

Code hiện tại không có logic chèn citation trực tiếp vào text theo dạng `[n](url)`.

### 2. `GEMINI_MODEL` hiện chưa chi phối trực tiếp nhánh Google web search

Ở luồng Google Search grounding, hàm đang mặc định dùng `gemini-2.5-flash` thay vì lấy trực tiếp từ `settings.gemini_model`.

### 3. Mascot chưa trả nguồn ra frontend

Backend mascot có lưu metadata search, nhưng schema response hiện tại chưa expose các trường nguồn nên UI mascot không thể hiển thị danh sách link.

### 4. Lịch sử session chưa expose đủ metadata web search

Route `GET /chat/sessions/{session_id}` chưa trả đầy đủ `search_results` và `is_web_search`, dù dữ liệu đó đã được lưu vào DB.

### 5. `fallback_applied` trong web search cần hiểu đúng nghĩa

Trong luồng web search, cờ này hiện đang được set theo việc provider thực tế có khác `google_search` hay không. Điều đó có nghĩa là nó đang phản ánh fallback provider tìm kiếm, không hoàn toàn giống nghĩa “fallback model LLM” ở các luồng khác.

## Checklist kiểm thử nhanh

## Kiểm thử chat theo tài liệu

1. Mở trang chat của một material.
2. Bật nút Globe.
3. Chọn `Google Search`.
4. Đặt một câu hỏi cần dữ liệu mới, ví dụ tin tức hoặc sự kiện gần đây.
5. Kiểm tra:
   - có câu trả lời dạng web search
   - có phần `Nguồn tham khảo`
   - có danh sách source cards
   - nếu Google gặp lỗi thì có thể thấy kết quả đi qua Tavily

## Kiểm thử mascot web search

1. Mở mascot chat.
2. Bật `Search`.
3. Chọn provider.
4. Gửi một câu hỏi thời sự.
5. Kiểm tra:
   - có câu trả lời liên quan web search
   - nếu search lỗi thì mascot vẫn trả lời theo chế độ chat thường
   - hiện tại sẽ không thấy danh sách nguồn hiển thị trên UI mascot

## Khắc phục sự cố

## Google Search không hoạt động

Nguyên nhân phổ biến:

- `GEMINI_API_KEY` hoặc `GEMINI_API_KEYS` rỗng hoặc sai
- `LLM_PROVIDER` không phải `gemini`
- client Google không khởi tạo được
- lỗi quota, rate limit hoặc timeout

Cách xử lý:

1. Kiểm tra `GEMINI_API_KEY` và `GEMINI_API_KEYS`.
2. Kiểm tra `LLM_PROVIDER=gemini` nếu muốn ưu tiên Google.
3. Kiểm tra log backend.
4. Restart backend.

## Hệ thống luôn chạy Tavily dù đã bật Google

Hãy kiểm tra:

- request có gửi `use_google=true` hay không
- `LLM_PROVIDER` có phải `gemini` hay không
- Google Search có đang ném exception và bị fallback hay không

## Không có provider nào khả dụng

Nguyên nhân:

- không có Gemini key khả dụng
- không có `TAVILY_API_KEY`

Cách xử lý:

1. Cấu hình ít nhất một trong hai loại key.
2. Restart backend.

## Bảo mật

- Không commit API key thật vào repository.
- Nên dùng `.env.example` làm mẫu cấu hình.
- Nên xoay vòng key định kỳ.
- Nếu dùng OpenRouter thì nên cấu hình thêm `OPENROUTER_SITE_URL` và `OPENROUTER_SITE_NAME` nếu muốn gắn metadata request.

## Tham khảo

- Tavily console: [https://app.tavily.com](https://app.tavily.com)
- OpenRouter docs: [https://openrouter.ai/docs](https://openrouter.ai/docs)
