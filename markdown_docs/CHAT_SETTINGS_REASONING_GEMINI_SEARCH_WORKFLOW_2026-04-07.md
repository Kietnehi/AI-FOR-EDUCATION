# Chat Session Summary (2026-04-07)

## Mục tiêu của phiên làm việc  
Tái cấu trúc và hoàn thiện luồng cấu hình chat trong frontend/backend, sau đó khôi phục đúng workflow web search cũ (Google/Tavily -> refine bằng model mặc định đã cấu hình).

## Tổng quan kết quả cuối cùng  
- Đã chỉnh lại UI Settings (phần AI model) dễ dùng hơn, đẹp hơn, và tương thích light/dark mode.  
- Đã giữ logic Reasoning đúng theo yêu cầu: chỉ là công tắc hiển thị/không hiển thị tính năng reasoning trong UI và payload.  
- Đã bổ sung cập nhật real-time settings giữa các màn hình (chat page + floating mascot) bằng event.  
- Đã sửa luồng Gemini rotation để đi qua luồng unified, không bị bỏ qua ở mascot.  
- Đã nâng cấp hỗ trợ custom model: cho phép thêm nhiều model, xóa theo model được chọn.  
- Đã khôi phục workflow search như cũ:  
  - Chọn Google hoặc Tavily từ UI.  
  - Chạy provider đã chọn (có fallback theo orchestrator).  
  - Kết quả search được đưa vào model mặc định đã cấu hình để refine câu trả lời.  

## Timeline chi tiết  

### 1) Reasoning toggle (UI behavior)  
Yêu cầu: Reasoning trong settings chỉ dùng để bật/tắt khả năng hiển thị/cho phép reasoning, không được phá logic khác.  

Đã làm:  
- Chuẩn hóa đọc setting từ localStorage.  
- Đồng bộ state ở các màn hình chat.  
- Nếu model không hỗ trợ reasoning thì tự tắt reasoningEnabled để tránh payload sai.  

File liên quan:  
- frontend/app/settings/page.tsx  
- frontend/app/materials/[id]/chat/page.tsx  
- frontend/components/3d/floating-mascot.tsx  

---

### 2) Real-time settings sync  
Vấn đề: Đổi settings xong phải reload mới thấy.  

Đã làm:  
- Phát sự kiện custom: chat-settings-updated.  
- Lắng nghe thêm event storage để đồng bộ cross-tab.  

File liên quan:  
- frontend/app/settings/page.tsx  
- frontend/app/materials/[id]/chat/page.tsx  
- frontend/components/3d/floating-mascot.tsx  

---

### 3) Lỗi runtime: useCallback is not defined  
Vấn đề: floating mascot bị crash vì thiếu import useCallback.  

Đã làm:  
- Bổ sung import useCallback.  

File liên quan:  
- frontend/components/3d/floating-mascot.tsx  

---

### 4) UX notifications và thao tác model  
Yêu cầu:  
- Không dùng alert() thô, cần thông báo đẹp.  
- Cần có nút xóa model custom.  

Đã làm:  
- Dùng Toast + thông báo inline.  
- Thêm logic xóa model custom.  

File liên quan:  
- frontend/app/settings/page.tsx  

---

### 5) Đơn giản hóa lựa chọn reasoning  
Yêu cầu: chỉ cần 2 trạng thái model có/không hỗ trợ reasoning.  

Đã làm:  
- Chuyển về 1 checkbox modelSupportsReasoning.  
- UI chat chỉ hiển thị nút reasoning khi modelSupportsReasoning = true.  

File liên quan:  
- frontend/app/settings/page.tsx  
- frontend/app/materials/[id]/chat/page.tsx  
- frontend/components/3d/floating-mascot.tsx  

---

### 6) Gemini rotation không chạy đúng  
Vấn đề: mascot flow không đi qua unified logic nên rotation bị lệch.  

Đã làm:  
- Đưa mascot về text_chat_unified/stream_chat_unified.  
- Truyền use_gemini_rotation xuyên suốt schema -> route -> service -> llm client.  

File liên quan:  
- backend/app/schemas/chat.py  
- backend/app/api/routes/chat.py  
- backend/app/services/chat_service.py  
- backend/app/ai/chatbot/orchestrator.py  
- backend/app/ai/generation/llm_client.py  
- frontend/lib/api.ts  
- frontend/app/materials/[id]/chat/page.tsx  
- frontend/components/3d/floating-mascot.tsx  

---

### 7) Hỗ trợ nhiều custom model  
Yêu cầu: không giới hạn 1 model custom, cần thêm nhiều model và xóa theo model cụ thể.  

Đã làm:  
- Lưu danh sách custom model trong chat_custom_models (array).  
- Thêm form add model + dropdown chọn model cần xóa.  
- Validate duplicate id.  

File liên quan:  
- frontend/app/settings/page.tsx  

---

### 8) UI Settings được redesign  
Yêu cầu: giao diện đẹp hơn và phù hợp light/dark mode.  

Đã làm:  
- Nhóm lại các block cấu hình AI theo card.  
- Chuẩn hóa màu theo biến theme (var(--...)).  
- Cải tiến focus/hover/action button.  

File liên quan:  
- frontend/app/settings/page.tsx  

---

### 9) Search bị sai luồng sau khi update  
Yêu cầu: quay lại workflow cũ:  
- Chọn Google/Tavily như trước.  
- Chạy đúng luồng provider.  
- Sau đó refine bằng model mặc định đã cấu hình.  

Nguyên nhân đã xác định:  
- Endpoint web search chưa nhận model + use_gemini_rotation từ frontend, nên refine model bị cố định ở backend.  

Đã sửa:  
- Mở rộng WebSearchRequest để nhận model và use_gemini_rotation.  
- Route web-search truyền dữ liệu này vào service.  
- frontend lib/api webSearch gửi model + use_gemini_rotation.  
- chat page webSearch gọi kèm model hiện tại và trạng thái rotation.  
- web-search dialog cũng đọc model/rotation từ localStorage để gửi đúng.  
- ChatService refine search bằng selected model:  
  - selected_model = model hoặc settings.web_search_refinement_model  
  - refine qua text_chat_unified để tôn trọng use_gemini_rotation.  

File liên quan:  
- backend/app/schemas/chat.py  
- backend/app/api/routes/chat.py  
- backend/app/services/chat_service.py  
- frontend/lib/api.ts  
- frontend/app/materials/[id]/chat/page.tsx  
- frontend/components/ui/web-search-dialog.tsx  

---

## Workflow search hiện tại (trạng thái chốt)  
1. UI chọn chế độ web search và provider (Google/Tavily).  
2. Frontend gọi /chat/sessions/{session_id}/web-search kèm:  
   - query  
   - use_google  
   - model (model đang cấu hình)  
   - use_gemini_rotation  
3. Backend ChatService gọi orchestrator.web_search(query, use_google).  
4. Orchestrator quyết định provider theo use_google + khả năng truy cập (có fallback).  
5. Kết quả search được refine bởi LLM đã cấu hình (model payload, fallback về web_search_refinement_model nếu null).  
6. Lưu message assistant + metadata search_provider/model_used vào DB và trả về frontend.  

---

## Lỗi/vấn đề đã gặp trong phiên  
- Runtime error: useCallback is not defined.  
- Settings không đồng bộ ngay giữa các view.  
- Save config không hiển thị thông báo rõ ràng.  
- Gemini rotation không đi đúng luồng mascot trước khi refactor.  
- Search refine model bị dùng cấu hình cố định thay vì model người dùng đã chọn.  

---

## Kiểm tra sau chỉnh sửa  
- Kiểm tra lỗi file mục tiêu: không có errors compile/type trên các file đã sửa.  
- Lint frontend: chỉ còn warning cũ liên quan thẻ img (không phải lỗi logic search).  

---

## Trạng thái hiện tại  
- Logic chính đã ổn định theo yêu cầu của user.  
- Search workflow đã trở về đúng mô hình cũ, kèm refine theo model mặc định cấu hình.  
- Có thể tiếp tục bổ sung test tích hợp để khóa chặt hành vi Google/Tavily + refine model trong CI.  

---

## Gợi ý tiếp theo (nếu cần)  
- Thêm test integration cho endpoint /chat/sessions/{session_id}/web-search với 2 case:  
  - use_google=true (có/không fallback)  
  - use_google=false (force Tavily)  
- Assert model_used và search_provider trong response để tránh hồi quy.  