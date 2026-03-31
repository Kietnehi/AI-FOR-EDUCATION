# Cập nhật Storage, Podcast, Slides và NotebookLM

Ngày cập nhật: 2026-03-30

## Mục tiêu

Tài liệu này tổng hợp các thay đổi mới nhất liên quan đến:

- storage mode `local / MinIO / S3`
- podcast play/download
- slide generation và slide preview
- NotebookLM input/output
- metadata `storage_type` để người dùng biết file đang được lưu theo kiểu nào

## 1. Storage mode mới

Hệ thống hiện hỗ trợ 3 mode theo 2 biến env:

| USE_OBJECT_STORAGE | USE_S3 | Kết quả |
|---|---|---|
| `false` | `false` hoặc `true` | Local filesystem |
| `true` | `false` | MinIO |
| `true` | `true` | AWS S3 |

Ghi chú:

- `USE_S3` chỉ có ý nghĩa khi `USE_OBJECT_STORAGE=true`
- khi `USE_OBJECT_STORAGE=false`, backend không khởi tạo object storage client
- startup không còn cố tạo bucket khi object storage đang tắt

## 2. Podcast

### Đã sửa

- sau khi generate podcast, frontend không còn bị điều hướng nhầm sang trang minigame
- frontend không còn ghép sai URL kiểu `http://localhost:8000http://localhost:9000/...`
- absolute URL từ MinIO/S3 được giữ nguyên
- relative URL `/api/files/...` mới được ghép với backend host

### Kết quả

- play podcast hoạt động đúng
- download podcast hoạt động đúng
- local mode không còn log warning giả kiểu “upload object storage failed vì object storage disabled”

## 3. Slides

### Đã sửa

- modal tạo slide được render bằng portal để không bị lệch tâm
- backend resolve được source file từ cả `local`, `MinIO`, `S3`
- slide generation có thể tải file nguồn từ object storage về local khi cần extract ảnh
- xóa file local/object storage được parse bằng helper chung thay vì string split cũ

### Preview ảnh slide

Đã bổ sung:

- `image_url` cho slide preview
- route preview file cho ảnh trích xuất
- frontend slides page đọc được `image_source`, `doc_image`, `image_url`

Lưu ý:

- bộ slides cũ có thể chưa có `image_url` trong `json_content`
- nếu mở bộ slides cũ, có thể cần generate lại để thấy ảnh thật

## 4. NotebookLM

### Đã sửa

- parse `material.file_url` đúng cho:
  - local `/api/files/.../download`
  - MinIO URL
  - S3 URL
- nếu file local không tồn tại nhưng `file_url` đang trỏ object storage, backend sẽ tải file đó về local trước khi xử lý
- NotebookLM video/infographic output không còn local-only
- output NotebookLM giờ lưu theo đúng mode env

### Trạng thái

- input: hỗ trợ `local / MinIO / S3`
- output: hỗ trợ `local / MinIO / S3`
- các vấn đề concurrency/session lifecycle của NotebookLM không nằm trong phạm vi fix storage lần này

## 5. Metadata storage_type

Đã thêm metadata `storage_type` để biết file đang nằm ở đâu.

Áp dụng cho:

- `learning_materials`
- `generated_contents`
- file trả về từ NotebookLM saved result

Giá trị dùng:

- `local`
- `minio`
- `s3`
- `none`

## 6. Hiển thị cho người dùng

Frontend hiện đã có thể hiển thị nhãn storage ở các khu vực chính:

- trang chi tiết học liệu
- trang slides
- dữ liệu generated content mới

Ý nghĩa:

- người dùng biết học liệu được upload bằng local, MinIO hay S3
- người dùng biết file tạo ra đang nằm ở local, MinIO hay S3

## 7. Ghi chú về dữ liệu cũ

Dữ liệu cũ trong database có thể chưa có `storage_type` hoặc `image_url`.

Hiện tại:

- `storage_type` có fallback suy ra từ `file_url`
- `image_url` của slides chủ yếu có trên dữ liệu mới được tạo sau bản cập nhật này

## 8. File liên quan

Backend:

- `backend/app/services/storage.py`
- `backend/app/services/material_service.py`
- `backend/app/services/generation_service.py`
- `backend/app/services/notebooklm_service.py`
- `backend/app/services/file_service.py`
- `backend/app/api/routes/files.py`
- `backend/app/api/routes/materials.py`
- `backend/app/api/routes/generated_contents.py`
- `backend/app/schemas/materials.py`
- `backend/app/schemas/generated_content.py`

Frontend:

- `frontend/lib/api.ts`
- `frontend/types/index.ts`
- `frontend/app/materials/[id]/page.tsx`
- `frontend/app/materials/[id]/podcast/page.tsx`
- `frontend/app/materials/[id]/slides/page.tsx`
- `frontend/components/ui/dialog.tsx`
- `frontend/components/ui/slide-generation-dialog.tsx`
