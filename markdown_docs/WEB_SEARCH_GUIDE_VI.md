# Hướng Dẫn Tìm Kiếm Web cho Chatbot RAG

## Tổng Quan

Chatbot RAG hiện đã được nâng cấp với hai optino tìm kiếm web:

1. **Tìm kiếm Google** - Với grounding (trích dẫn tự động)
   - Chỉ hoạt động với các mô hình Gemini được hỗ trợ
   - Cung cấp trích dẫn nội tuyến tự động từ các nguồn

2. **Tìm kiếm Tavily** - Dự phòng cho các mô hình khác
   - Hoạt động với OpenAI và các mô hình LLM khác
   - Cung cấp kết quả tìm kiếm có chất lượng cao

## Cấu Hình

### 1. Google Search (Khuyến Nghị)

**Yêu cầu:**
- Mô hình Gemini được hỗ trợ: `gemini-2.5-flash`, `gemini-3.1-flash-live-preview`, `gemini-2.5-flash-lite`, hoặc `gemini-2.5-flash-lite-preview-09-2025`
- Khóa API Gemini hợp lệ

**Cấu hình .env:**
```env
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Ưu điểm:**
- ✅ Trích dẫn tự động được tích hợp từ Google
- ✅ Không cần khóa API bổ sung
- ✅ Xử lý ngôn ngữ tự nhiên tốt

### 2. Tavily Search (Dự Phòng)

**Yêu cầu:**
- Khóa API Tavily (lấy từ https://app.tavily.com)

**Cấu hình .env:**
```env
TAVILY_API_KEY=tvly-dev-your_tavily_api_key_here
```

**Ưu điểm:**
- ✅ Hoạt động với mọi mô hình LLM
- ✅ Tìm kiếm nâng cao (basic hoặc advanced)
- ✅ Nội dung đầy đủ từ các trang web

## API Endpoint

### POST `/chat/sessions/{session_id}/web-search`

Thực hiện tìm kiếm web trong bối cảnh phiên chat.

**Yêu cầu:**
```json
{
  "query": "Giá vàng hôm nay 2026",
  "use_google": true
}
```

**Phản hồi:**
```json
{
  "answer": "Câu trả lời với trích dẫn nội tuyến [1](url)",
  "raw_text": "Câu trả lời thô",
  "sources": [
    {
      "index": 1,
      "title": "Tiêu đề trang web",
      "uri": "https://example.com",
      "snippet": "Đoạn trích từ trang"
    }
  ],
  "citations": [
    {
      "index": 1,
      "title": "Tiêu đề trang web",
      "url": "https://example.com",
      "source": "google_search"
    }
  ],
  "search_provider": "google_search",
  "model": "gemini-2.5-flash",
  "search_queries": ["Giá vàng hôm nay 2026"]
}
```

## Sử Dụng Frontend

### 1. Mở Dialog Tìm Kiếm Web

```tsx
import { WebSearchDialog } from "@/components/ui/web-search-dialog";

export function ChatInterface() {
  const [showWebSearch, setShowWebSearch] = useState(false);
  
  return (
    <>
      <button onClick={() => setShowWebSearch(true)}>
        🔍 Tìm kiếm Web
      </button>
      
      <WebSearchDialog
        sessionId={sessionId}
        isOpen={showWebSearch}
        onClose={() => setShowWebSearch(false)}
        onSuccess={(result) => {
          // Hiển thị kết quả
        }}
      />
    </>
  );
}
```

### 2. Hiển Thị Kết Quả

```tsx
import { WebSearchResult } from "@/components/ui/web-search-result";

export function ChatMessage({ message }) {
  if (message.is_web_search) {
    return (
      <WebSearchResult
        answer={message.message}
        sources={message.search_results.sources}
        citations={message.search_results.citations}
        searchProvider={message.search_results.search_provider}
        searchQueries={message.search_results.search_queries}
      />
    );
  }
}
```

### 3. Gọi API Trực Tiếp

```tsx
import { webSearch } from "@/lib/api";

async function handleSearch(sessionId: string, query: string) {
  const result = await webSearch(sessionId, query, true);
  console.log("Kết quả tìm kiếm:", result);
}
```

## Chiến Lược Dự Phòng

Hệ thống sử dụng chiến lược dự phòng thông minh:

```
1. Nếu sử dụng Gemini + use_google=true:
   → Thử Google Search
   → Nếu thất bại → Chuyển sang Tavily
   
2. Nếu sử dụng OpenAI hoặc mô hình khác:
   → Sử dụng Tavily trực tiếp
```

## Cấu Hình Mô Hình

### Mô hình Được Hỗ Trợ cho Google Search:

- `gemini-3.1-flash-live-preview` ✅
- `gemini-2.5-flash` ✅
- `gemini-2.5-flash-lite` ✅
- `gemini-2.5-flash-lite-preview-09-2025` ✅

### Khác:

- Những mô hình không trong danh sách → Được hỗ trợ bởi Tavily

## Ví Dụ Sử Dụng

### Python (Backend)

```python
from app.services.web_search_service import WebSearchOrchestrator

orchestrator = WebSearchOrchestrator()

# Tìm kiếm với Google
result = orchestrator.search_with_answer(
    query="Tin tức công nghệ mới nhất 2026",
    use_google=True,
    llm_provider="gemini"
)

print("Câu trả lời:", result['answer'])
print("Nguồn:", result['sources'])
```

### JavaScript/TypeScript (Frontend)

```typescript
import { webSearch } from "@/lib/api";

const result = await webSearch(
  "session-id-123",
  "Tin tức công nghệ mới nhất 2026",
  true
);

console.log("Câu trả lời:", result.answer);
console.log("Nhà cung cấp:", result.search_provider);
```

## Khắc Phục Sự Cố

### Lỗi: "Dịch vụ Tìm kiếm Google không khả dụng"

**Nguyên nhân:**
- GEMINI_API_KEY chưa được cấu hình
- Mô hình Gemini không được hỗ trợ

**Giải pháp:**
1. Kiểm tra `.env` có `GEMINI_API_KEY`
2. Kiểm tra `GEMINI_MODEL` là một trong các mô hình được hỗ trợ

### Lỗi: "Không có dịch vụ tìm kiếm nào khả dụng"

**Nguyên nhân:**
- Cả Google Search và Tavily đều không được cấu hình

**Giải pháp:**
1. Cấu hình `TAVILY_API_KEY` để sử dụng Tavily
2. Hoặc cấu hình `GEMINI_API_KEY` và `GEMINI_MODEL`

### Lỗi: "Tìm kiếm web thất bại"

**Nguyên nhân:**
- Kết nối mạng bị gián đoạn
- Khóa API không hợp lệ
- Giới hạn yêu cầu đã vượt quá

**Giải pháp:**
1. Kiểm tra kết nối internet
2. Xác minh khóa API
3. Chờ một chút rồi thử lại

## Hiệu Suất & Giới Hạn

### Google Search:
- Tốc độ: **Nhanh** (500-1000ms)
- Giới hạn: Tùy thuộc vào đơn vị định giá Google
- Trích dẫn: Tự động

### Tavily:
- Tốc độ: **TB** (1000-3000ms)
- Giới hạn: Tùy thuộc vào đơn vị định giá Tavily
- Trích dẫn: Cần định dạng thủ công

## Tối Ưu Hóa

### 1. Chọn Mô Hình Đúng

Sử dụng `gemini-2.5-flash` cho tốc độ tối ưu:

```env
GEMINI_MODEL=gemini-2.5-flash
```

### 2. Xoay Vòng Khóa API

Nếu có nhiều khóa Gemini:

```env
GEMINI_API_KEYS=["key1", "key2", "key3"]
```

### 3. Đặt Kích Thước Bộ Nhớ Hội Thoại

```env
CHAT_MEMORY_TURNS=8  # Số tin nhắn gần đây được sử dụng
```

## Bảo Mật

⚠️ **Lưu Ý Quan Trọng:**

1. **Không bao giờ commit** `.env` với khóa API thực
2. **Sử dụng** `.env.example` cho các biến mẫu
3. **Giới hạn quyền** truy cập các khóa API
4. **Quay vòng khóa** nếu bị lộ

## Hỗ Trợ

Nếu gặp vấn đề:

1. Kiểm tra logs trong `backend/logs/`
2. Xác minh cấu hình `.env`
3. Kiểm tra kết nối internet
4. Liên hệ hỗ trợ với mô tả chi tiết lỗi
