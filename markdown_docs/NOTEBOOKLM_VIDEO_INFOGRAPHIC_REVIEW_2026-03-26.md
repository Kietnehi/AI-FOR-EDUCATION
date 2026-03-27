# Review kỹ chức năng tạo Video + Infographic (NotebookLM)

Ngày review gốc: 2026-03-26  
Cập nhật lại đầy đủ: 2026-03-27

## Phạm vi kiểm tra

- Frontend:
  - `frontend/app/materials/[id]/page.tsx`
  - `frontend/lib/api.ts`
  - `frontend/types/index.ts`
- Backend:
  - `backend/app/api/routes/generated_contents.py`
  - `backend/app/schemas/generated_content.py`
  - `backend/app/services/notebooklm_service.py`
  - `backend/app/services/notebooklm_worker.py`
  - `backend/app/api/routes/files.py`
  - `backend/app/services/file_service.py`

## Kết luận nhanh

Luồng hiện tại đã tốt hơn bản review trước ở điểm quan trọng: backend không còn cleanup session khi tải 0 file trong interactive mode. Tuy nhiên vẫn còn các vấn đề High về độ tin cậy (mất session, báo `generation_complete` quá sớm, fallback path vẫn có thể trả thành công rỗng), cùng với rủi ro concurrency/profile và UX kẹt trạng thái ở frontend.

Đánh giá tổng thể hiện tại: **Chưa production-safe cho multi-user / multi-process**, và **chưa đảm bảo tính đúng đắn end-to-end** cho trạng thái “đã tạo xong”.

---

## So sánh nhanh với review trước (2026-03-26)

### Đã cải thiện

1. Không còn cleanup session khi tải thất bại trong interactive mode:
   - `backend/app/services/notebooklm_service.py:685`
   - `backend/app/services/notebooklm_service.py:704`
   - Logic `download_ready` giúp chỉ đóng browser + pop session khi có file hợp lệ.

2. Có kiểm tra số file trước khi finalize trong interactive/sync mode:
   - `backend/app/services/notebooklm_service.py:696`
   - `backend/app/services/notebooklm_service.py:734`

### Vẫn chưa xử lý dứt điểm

1. Session vẫn giữ bằng RAM process-local (`_active_sessions`).
2. `generation_complete` vẫn chưa phản ánh “render complete” thật.
3. Fallback nhánh `session not in _active_sessions` vẫn có thể finalize rỗng.

---

## Findings chi tiết

### 1) High - Session state giữ trong RAM process-local, không bền qua restart / scale-out

File tham chiếu:
- `backend/app/services/notebooklm_service.py:17`
- `backend/app/services/notebooklm_service.py:157`
- `backend/app/services/notebooklm_service.py:505`
- `backend/app/services/notebooklm_service.py:638`

Chi tiết:
- Session tương tác đang giữ trong biến global `_active_sessions`.
- Sau bước upload, metadata browser/context/page không persist ra DB/Redis.
- Khi backend restart, hot reload, hoặc request tiếp theo chạy ở process khác, session mất ngay.

Tác động:
- Người dùng bị fail ở bước `confirm-artifacts` hoặc `confirm-download` dù vừa upload thành công.
- Rủi ro cao trong môi trường có nhiều worker hoặc deploy rolling.

Khuyến nghị:
- Persist metadata session + stage vào Redis/DB (ít nhất: session_id, owner, stage, timestamps, temp paths).
- Thiết kế expiration/TTL + cleanup job.
- Nếu session browser thật sự mất, trả lỗi có cấu trúc (`SESSION_LOST`) và hướng dẫn retry an toàn.

---

### 2) High - API trả `generation_complete` quá sớm, chưa xác nhận artifact đã render xong

File tham chiếu:
- `backend/app/services/notebooklm_service.py:543`
- `backend/app/services/notebooklm_service.py:567`
- `backend/app/services/notebooklm_service.py:576`
- `backend/app/services/notebooklm_service.py:620`
- `backend/app/services/notebooklm_service.py:628`

Chi tiết:
- Sau khi click trigger tạo video + infographic, service trả `status="generation_complete"` ngay.
- Chưa có poll/verify DOM cho trạng thái “ready to download”.
- Ngoài ra, `_click_scoped_create_button()` trả bool nhưng kết quả không được bắt buộc kiểm tra thành công trong `_activate_artifact_creation()`.

Tác động:
- UI hiểu là “đã tạo xong”, trong khi thực tế có thể mới chỉ bấm nút hoặc thậm chí chưa bấm thành công.
- Người dùng bấm tải sớm sẽ thấy lỗi lặp lại, gây cảm giác hệ thống không ổn định.

Khuyến nghị:
- Đổi semantic trạng thái:
  - sau khi click trigger: `artifacts_requested`
  - sau khi detect download button/item thật: `artifacts_ready`
- Thêm hàm poll readiness với timeout rõ ràng.
- Chỉ trả `generation_complete` khi đạt tiêu chí ready đã định nghĩa.

---

### 3) High - Fallback path vẫn có thể trả success rỗng (0 video, 0 infographic)

File tham chiếu:
- `backend/app/services/notebooklm_service.py:638`
- `backend/app/services/notebooklm_service.py:641`
- `backend/app/services/notebooklm_service.py:752`
- `backend/app/services/notebooklm_service.py:801`

Chi tiết:
- Khi `session_id` không còn trong RAM nhưng temp dir tồn tại, code đi thẳng vào `_move_temp_files_to_permanent()`.
- Nhánh này không có check tối thiểu số file > 0 trước khi trả response.
- Kết quả có thể là `videos=[]`, `infographics=[]` nhưng vẫn trả 200.

Tác động:
- “Success giả” vẫn có thể xảy ra ở worker/fallback scenario.
- Frontend nhận kết quả rỗng và vẫn hiện luồng thành công tải file.

Khuyến nghị:
- Trước khi move/finalize ở fallback path, validate `temp_file_count > 0`.
- Nếu 0 file, trả lỗi 409 với mã rõ ràng (`ARTIFACTS_NOT_READY`).

---

### 4) High - Không có ràng buộc ownership cho session endpoints (rủi ro thao tác chéo session)

File tham chiếu:
- `backend/app/api/routes/generated_contents.py:155`
- `backend/app/api/routes/generated_contents.py:170`
- `backend/app/api/routes/generated_contents.py:186`

Chi tiết:
- Các endpoint `confirm-artifacts`, `confirm`, `cancel` chỉ nhận `session_id` path param.
- Không có check session thuộc user nào (trong phạm vi code đang review).
- Nếu session_id lộ ra, có khả năng người khác xác nhận/hủy session không thuộc mình.

Tác động:
- Rủi ro bảo mật và toàn vẹn dữ liệu phiên chạy.

Khuyến nghị:
- Lưu `owner_id` trong session state và verify trên mọi bước confirm/cancel.
- Trả 403 nếu không đúng chủ sở hữu.

---

### 5) Medium - Dùng chung 1 Chrome persistent profile cho mọi session, dễ xung đột khi chạy đồng thời

File tham chiếu:
- `backend/app/services/notebooklm_service.py:143`
- `backend/app/services/notebooklm_service.py:198`
- `backend/app/services/notebooklm_worker.py:238`

Chi tiết:
- Tất cả luồng launch persistent context đều dùng chung `settings.notebooklm_user_data_dir`.
- Concurrent sessions dễ lock profile hoặc giẫm trạng thái UI/cookie.

Tác động:
- Session mới có thể không khởi động được hoặc ảnh hưởng session đang chạy.

Khuyến nghị:
- Nếu single-operator: enforce global mutex/queue.
- Nếu multi-user: cấp profile dir riêng theo session/user.

---

### 6) Medium - Frontend có trạng thái “kẹt” khi confirm upload thất bại

File tham chiếu:
- `frontend/app/materials/[id]/page.tsx:200`
- `frontend/app/materials/[id]/page.tsx:203`
- `frontend/app/materials/[id]/page.tsx:227`
- `frontend/app/materials/[id]/page.tsx:293`

Chi tiết:
- Khi người dùng bấm confirm upload (`confirm=true`), UI set sẵn `notebookArtifactPending` với `session_id=""`.
- Nếu API lỗi ở bước upload, khối `catch` chỉ hiển thị toast, không reset state placeholder.
- Nút Hủy sau đó gọi `handleCancelPreview()` nhưng `session_id` rỗng nên không làm gì.

Tác động:
- UI có thể bị kẹt ở trạng thái “đang chờ upload hoàn tất...” cho đến khi reload trang.

Khuyến nghị:
- Trong `catch` của `handleGenerateNotebookMedia`, reset `notebookArtifactPending` khi `session_id` rỗng.
- Hoặc tách state “uploading” riêng, không reuse state `awaiting_artifact_confirmation`.

---

### 7) Medium - Frontend auto-trigger nhiều download liên tiếp, không xác nhận tải thực tế

File tham chiếu:
- `frontend/app/materials/[id]/page.tsx:256`
- `frontend/app/materials/[id]/page.tsx:279`

Chi tiết:
- Sau confirm download, UI tự loop click nhiều thẻ `a` để tải file.
- Trình duyệt có thể chặn multi-download tùy policy.
- UI không có telemetry/ack để biết file nào tải thành công.

Tác động:
- Người dùng tưởng đã nhận đủ file nhưng thực tế thiếu file.

Khuyến nghị:
- Ưu tiên backend zip 1 file.
- Nếu chưa zip, hiển thị danh sách và để user chủ động tải từng file.

---

### 8) Medium - Inconsistency đường dẫn temp giữa service NotebookLM và file preview route

File tham chiếu:
- `backend/app/services/notebooklm_service.py:24`
- `backend/app/services/file_service.py:69`
- `backend/app/api/routes/files.py:19`

Chi tiết:
- Service NotebookLM dùng temp dir: `./storage/notebooklm/temp`.
- `FileService.resolve_temp_file_path()` lại đọc từ `generated_dir/notebooklm/temp` (mặc định `./storage/generated/notebooklm/temp`).

Tác động:
- Endpoint preview temp file có thể không đọc đúng file thực tế của NotebookLM flow.

Khuyến nghị:
- Đồng nhất 1 nguồn cấu hình temp dir cho toàn bộ code path.

---

### 9) Low - Một số semantics/status chưa nhất quán giữa schema và runtime

File tham chiếu:
- `backend/app/schemas/generated_content.py:43`
- `backend/app/schemas/generated_content.py:63`
- `frontend/types/index.ts:69`

Chi tiết:
- `ConfirmNotebookLMDownloadResponse` có `status="saved"`, nhưng frontend type `NotebookLMSavedResult` không khai báo trường `status`.
- `generation_complete` đang được dùng cho cả “đã click tạo” và “đã sẵn sàng tải”.

Tác động:
- Dễ gây hiểu sai trạng thái ở client và khó mở rộng xử lý lỗi.

Khuyến nghị:
- Chuẩn hóa state machine API: `awaiting_confirmation` -> `awaiting_artifact_confirmation` -> `artifacts_requested` -> `artifacts_ready` -> `saved`.
- Đồng bộ schema/backend/frontend type.

---

## Testing gaps

Hiện chưa thấy test tự động cho flow NotebookLM. Thiếu tối thiểu các case sau:

1. Mất session sau upload (restart process / session missing).
2. `confirm-artifacts` trả trạng thái đúng khi click trigger thất bại.
3. `confirm-download` fallback path trả lỗi khi 0 file.
4. Concurrent sessions dùng chung profile.
5. Frontend không bị kẹt state khi upload fail.
6. Multi-download bị browser chặn.

---

## Ưu tiên sửa (đề xuất theo thứ tự)

1. Chặn hoàn toàn success rỗng ở mọi nhánh (`interactive` + `fallback`).
2. Sửa state machine: không trả `generation_complete` khi chưa verify artifact ready.
3. Persist session state + ownership check cho các endpoint confirm/cancel.
4. Chốt mô hình concurrency cho Chrome profile (mutex hoặc profile per session).
5. Sửa UX frontend phần trạng thái upload lỗi và chiến lược download nhiều file.

---

## Open questions cần chốt với product/ops

1. Hệ thống vận hành single-operator hay multi-user thực sự?
2. “Hoàn tất” yêu cầu đủ cả video + infographic, hay chỉ cần một trong hai?
3. Chấp nhận UX tải nhiều file trực tiếp hay bắt buộc zip một file?
4. Có yêu cầu bảo mật theo user cho session_id hay đang chạy trusted internal only?
