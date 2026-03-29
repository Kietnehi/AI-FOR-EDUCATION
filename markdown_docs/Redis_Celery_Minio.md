# Redis Celery MinIO - Ghi Chú Tiến Độ

Ngày: 2026-03-29
Phạm vi: Tích hợp hạ tầng Phase 2 (Redis + Celery + lớp trừu tượng MinIO/S3)

## 1) Những gì đã triển khai

### 1.1 Dependencies
- Đã bổ sung các dependency mới cho backend:
  - redis
  - celery
  - flower
  - boto3

Tệp liên quan:
- backend/requirements.txt

### 1.2 Cấu hình backend (điều khiển bằng env)
- Đã thêm các cấu hình runtime cho:
  - Redis URL
  - Celery broker/result backend
  - Cờ chuyển MinIO/S3 và thông tin xác thực
  - Region và bucket S3
  - Thời gian hết hạn presigned URL

Tệp liên quan:
- backend/app/core/config.py

### 1.3 Module Celery task
- Đã tạo task app và định nghĩa task cho luồng generate bất đồng bộ:
  - generate_slides_task
  - generate_podcast_task
  - generate_minigame_task
- Luồng task tái sử dụng GenerationService hiện có và vòng đời connect/close Mongo.

Tệp liên quan:
- backend/app/tasks.py

### 1.4 API endpoint bất đồng bộ cho generate
- Đã thêm các endpoint đưa task vào hàng đợi:
  - POST /materials/{material_id}/generate/slides/async
  - POST /materials/{material_id}/generate/podcast/async
  - POST /materials/{material_id}/generate/minigame/async
- Đã thêm endpoint kiểm tra trạng thái task:
  - GET /tasks/{task_id}/status
- Đã thêm response schema:
  - GenerationTaskQueuedResponse
  - GenerationTaskStatusResponse

Tệp liên quan:
- backend/app/api/routes/generated_contents.py
- backend/app/schemas/generated_content.py

### 1.5 Lớp trừu tượng storage cho MinIO/S3
- Đã thêm StorageService cho các thao tác tương thích S3:
  - upload_file
  - upload_file_obj
  - download_file
  - download_file_obj
  - delete_file
  - get_presigned_url
- Hỗ trợ MinIO trong môi trường dev và AWS S3 trong production qua cờ env.

Tệp liên quan:
- backend/app/services/storage.py

### 1.6 Dịch vụ trong Docker Compose
- Đã thêm các service:
  - redis
  - minio
  - celery-worker
  - celery-flower
- Đã thêm các volume:
  - redis_data
  - minio_data
- Đã nối env cho backend và celery-worker để dùng Redis/Celery/MinIO/S3.

Tệp liên quan:
- docker-compose.yml

### 1.7 Mẫu env và env runtime
- Đã cập nhật các tệp env mẫu để có đủ key Redis/Celery/MinIO/S3.
- Đã cập nhật các tệp env runtime để test local.

Tệp liên quan:
- .env.example
- .env.docker.example
- backend/.env.example
- .env
- backend/.env

### 1.8 Sửa lỗi nhỏ
- Đã thêm import HTTPException còn thiếu ở route xóa material.

Tệp liên quan:
- backend/app/api/routes/materials.py

## 2) Kiểm tra và smoke test đã thực hiện

### 2.1 Kiểm tra build/cấu hình
- Python compile check cho các module backend đã chỉnh: pass
- Docker compose config validation: pass

### 2.2 Redis
- redis-cli ping: PONG
- set/get smoke key: pass

### 2.3 MinIO
- health endpoint: HTTP 200
- test ghi/đọc object bằng boto3: pass
  - bucket: ai-learning-storage
  - object: smoke/minio-test.txt
  - value: hello-minio

### 2.4 Celery
- Celery inspect ping từ worker: OK (pong)
- Worker kết nối được đến Redis broker/result backend và hoạt động bình thường.

## 3) Vấn đề đã biết ở thời điểm hiện tại

### 3.1 Container Celery hiển thị unhealthy trong docker compose
- celery-worker và celery-flower hoạt động chức năng bình thường nhưng bị gắn trạng thái unhealthy.
- Nguyên nhân gốc:
  - base image của backend có HTTP healthcheck tới 127.0.0.1:8000/health trong backend/Dockerfile.
  - celery-worker/flower không chạy HTTP server tại cổng 8000.

Tác động:
- Trạng thái sức khỏe container bị âm tính giả trong compose output.
- Không chặn việc xử lý task Celery trong các bài test hiện tại.

## 4) Đề xuất phần fix tiếp theo (future work)

### 4.1 Sửa healthcheck cho Celery (khuyến nghị)
Phương án A (ưu tiên): Override healthcheck theo từng service trong docker-compose.yml
- Ví dụ healthcheck cho celery-worker:
  - celery -A app.tasks.celery_app inspect ping
- Ví dụ healthcheck cho celery-flower:
  - kiểm tra Flower HTTP endpoint ở cổng 5555

Phương án B: Tắt healthcheck cho celery-worker/flower trong compose nếu chưa cần monitor.

### 4.2 Tích hợp StorageService vào đầu ra generation
- Hiện tại một số luồng generate vẫn ghi file_url theo kiểu local.
- Bước tiếp theo:
  - upload artifact đã generate lên MinIO thông qua StorageService
  - lưu object URL/presigned URL vào file_url
  - giữ cơ chế fallback nếu object storage không khả dụng

### 4.3 Bổ sung test tự động
- Thêm integration test cho:
  - endpoint queue async + polling status
  - upload/download object storage
  - ánh xạ lỗi mềm mại khi Celery task thất bại

### 4.4 Cải thiện khả năng quan sát
- Thêm structured log cho task_id và material_id trong API và worker.
- Thêm metrics tùy chọn cho queue delay và task duration.

## 5) Quick runbook

### 5.1 Khởi động dịch vụ
- docker compose up -d --build

### 5.2 Kiểm tra trạng thái
- docker compose ps

### 5.3 Redis smoke
- docker compose exec redis redis-cli ping
- docker compose exec redis redis-cli set smoke:test ok
- docker compose exec redis redis-cli get smoke:test

### 5.4 MinIO smoke
- curl -i http://localhost:9000/minio/health/live

### 5.5 Celery smoke
- docker compose exec celery-worker celery -A app.tasks.celery_app inspect ping

## 6) Danh sách tệp đã chạm trong phase này
- docker-compose.yml
- backend/requirements.txt
- backend/app/core/config.py
- backend/app/tasks.py
- backend/app/services/storage.py
- backend/app/api/routes/generated_contents.py
- backend/app/schemas/generated_content.py
- backend/app/api/routes/materials.py
- .env.example
- .env.docker.example
- backend/.env.example
- .env
- backend/.env

---
Tài liệu này đóng vai trò là mốc checkpoint để tiếp tục fix theo từng bước ở các lần sau.
