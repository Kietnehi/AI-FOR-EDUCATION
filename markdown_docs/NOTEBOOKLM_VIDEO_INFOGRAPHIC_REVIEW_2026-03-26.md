# Review chức năng tạo Video + Infographic

Ngày review: 2026-03-26

Phạm vi:
- Frontend: `frontend/app/materials/[id]/page.tsx`, `frontend/lib/api.ts`, `frontend/types/index.ts`
- Backend: `backend/app/api/routes/generated_contents.py`, `backend/app/schemas/generated_content.py`, `backend/app/services/notebooklm_service.py`, `backend/app/services/notebooklm_worker.py`

## Kết luận nhanh

Luồng hiện tại chạy được theo hướng "interactive NotebookLM", nhưng có một số lỗi kiến trúc và hành vi đủ nghiêm trọng để gây mất session, báo thành công giả, trả về danh sách file rỗng mà vẫn coi là thành công, và dễ hỏng khi có nhiều phiên chạy đồng thời.

## Findings

### 1. High: Session tạo media chỉ được giữ trong RAM, nên restart server hoặc đổi process là mất luôn khả năng tiếp tục

File tham chiếu:
- `backend/app/services/notebooklm_service.py:17`
- `backend/app/services/notebooklm_service.py:157`
- `backend/app/services/notebooklm_service.py:501`
- `backend/app/services/notebooklm_service.py:635`

Chi tiết:
- Trạng thái phiên đang mở được lưu trong biến global `_active_sessions`.
- Sau khi upload xong, session chỉ tồn tại trong RAM và phụ thuộc vào process hiện tại.
- Nếu backend restart, hot reload, deploy mới, hoặc request tiếp theo rơi sang process khác, bước `confirm-artifacts` và `confirm-download` sẽ không còn truy cập được browser/session nữa.
- Cơ chế fallback hiện chỉ cứu được trường hợp worker mode đã tạo sẵn file temp; còn session đang dừng ở trạng thái `uploaded` sẽ mất hoàn toàn.

Tác động:
- Người dùng upload xong nhưng không thể bấm tiếp tạo video/infographic.
- Đây là lỗi production-level nếu app chạy nhiều worker hoặc có auto-reload.

Khuyến nghị:
- Persist session state ra DB/Redis/file-store.
- Tách browser-session metadata và artifact-state khỏi RAM process-local.
- Nếu session bị mất, cần có cơ chế resume hoặc trả lỗi rõ ràng kèm hướng dẫn retry an toàn.

### 2. High: Hệ thống đánh dấu `generation_complete` chỉ dựa vào `sleep`, không xác nhận artifact đã render xong thật

File tham chiếu:
- `backend/app/services/notebooklm_service.py:539`
- `backend/app/services/notebooklm_service.py:563`
- `backend/app/services/notebooklm_service.py:573`
- `backend/app/services/notebooklm_service.py:617`
- `backend/app/services/notebooklm_service.py:626`

Chi tiết:
- Sau khi bấm tạo video và infographic, code chỉ `wait_for_timeout(max(settings.notebooklm_generate_wait_seconds, 30) * 1000)`.
- Hết thời gian chờ là tự chuyển sang `stage = "generated"` và trả về `status = "generation_complete"`.
- Không có bước kiểm tra UI/DOM để chắc chắn cả video và infographic thực sự đã xuất hiện hoặc đã sẵn sàng tải xuống.

Tác động:
- Với tài liệu nặng hoặc NotebookLM render chậm, backend sẽ báo "đã tạo xong" trong khi thực tế chưa xong.
- Người dùng bấm tải xuống sẽ dễ nhận kết quả rỗng hoặc thiếu file.

Khuyến nghị:
- Poll UI theo dấu hiệu hoàn tất thực sự.
- Xác định rõ tiêu chí "render complete" cho từng artifact.
- Chỉ trả `generation_complete` khi ít nhất artifact mục tiêu đã sẵn sàng tải.

### 3. High: Bước tải file nuốt lỗi và vẫn cleanup session, dẫn đến mất dữ liệu mà UI vẫn báo thành công

File tham chiếu:
- `backend/app/services/notebooklm_service.py:411`
- `backend/app/services/notebooklm_service.py:450`
- `backend/app/services/notebooklm_service.py:678`
- `backend/app/services/notebooklm_service.py:698`
- `backend/app/services/notebooklm_service.py:730`
- `frontend/app/materials/[id]/page.tsx:215`
- `frontend/app/materials/[id]/page.tsx:228`

Chi tiết:
- `_download_artifacts()` chỉ log warning nếu từng item tải thất bại, rồi tiếp tục vòng lặp.
- Nếu không tìm thấy gì để tải, hàm chỉ `return`, không raise lỗi.
- `_confirm_download_async()` vẫn đóng browser, xóa session khỏi `_active_sessions`, rồi move temp files sang permanent storage.
- `_move_temp_files_to_permanent()` trả về `videos=[]` và `infographics=[]` mà không coi đó là lỗi.
- Frontend sau đó vẫn toast thành công: "Đã bắt đầu tải X tệp...", kể cả khi `X = 0`.

Tác động:
- Có thể xảy ra "success giả": người dùng thấy thành công nhưng không nhận được file nào.
- Vì session đã bị cleanup, người dùng không còn cơ hội retry download từ browser session cũ.

Khuyến nghị:
- Nếu không tải được artifact nào, phải trả lỗi thay vì success.
- Chỉ cleanup session sau khi xác nhận số file hợp lệ.
- Trả metadata tối thiểu mong đợi, ví dụ cần ít nhất 1 video hoặc 1 infographic.

### 4. Medium: Tất cả session dùng chung một Chrome profile persistent, rất dễ xung đột khi chạy đồng thời

File tham chiếu:
- `backend/app/services/notebooklm_service.py:142`
- `backend/app/services/notebooklm_service.py:143`
- `backend/app/services/notebooklm_service.py:197`
- `backend/app/services/notebooklm_service.py:198`

Chi tiết:
- Mọi session đều gọi `launch_persistent_context()` với cùng `settings.notebooklm_user_data_dir`.
- Chrome persistent profile không phù hợp cho nhiều session song song.
- Khi hai người cùng chạy hoặc một người bấm tạo nhiều phiên liên tiếp, profile lock hoặc trạng thái UI dùng chung có thể làm hỏng toàn bộ flow.

Tác động:
- Session sau có thể không mở được.
- Session trước và sau có thể giẫm trạng thái lên nhau.

Khuyến nghị:
- Khóa toàn cục nếu đây là luồng single-user.
- Hoặc cấp user-data-dir riêng cho từng session.
- Hoặc tách worker/service theo queue single-flight rõ ràng.

### 5. Medium: Frontend auto-trigger tải file theo kiểu mở link hàng loạt, dễ bị browser chặn nhưng vẫn báo đã tải thành công

File tham chiếu:
- `frontend/app/materials/[id]/page.tsx:215`
- `frontend/app/materials/[id]/page.tsx:228`

Chi tiết:
- Frontend tạo thẻ `a`, click thủ công từng file, đặt `target="_blank"` và lặp cho toàn bộ danh sách.
- Browser có thể chặn popup/multi-download, đặc biệt khi nhiều file được click liên tiếp.
- UI không kiểm tra file nào tải thành công, chỉ dựa vào số lượng phần tử trong response backend.

Tác động:
- Người dùng có thể không nhận được đủ file dù UI báo đã bắt đầu tải.

Khuyến nghị:
- Nếu cần tải nhiều file, nên zip ở backend rồi trả một file duy nhất.
- Hoặc hiển thị danh sách file để người dùng tải chủ động từng file.

## Open Questions

1. Hệ thống này có được thiết kế chỉ cho một người vận hành nội bộ hay sẽ phục vụ nhiều người dùng đồng thời?
2. Ở bước "render complete", tiêu chí sản phẩm mong muốn là đủ cả video và infographic, hay chỉ cần có ít nhất một artifact?
3. Có chấp nhận mô hình tải file trực tiếp nhiều lần từ frontend, hay nên chuyển sang tải một gói zip?

## Testing Gaps

- Không thấy test tự động cho luồng NotebookLM ở frontend hoặc backend.
- Chưa có test cho các case:
  - mất session sau khi upload xong
  - render quá thời gian chờ nhưng chưa hoàn tất
  - download trả về 0 file
  - chạy đồng thời 2 session
  - browser chặn multiple downloads

## Ưu tiên sửa

1. Chặn success giả ở bước download: nếu không có file thì phải fail.
2. Thay cơ chế `sleep -> generated` bằng kiểm tra artifact ready thật.
3. Persist session state thay vì chỉ giữ trong RAM.
4. Xử lý rõ mô hình concurrency của Chrome profile.
5. Đơn giản hóa bước tải file, ưu tiên backend zip hoặc explicit download list.
