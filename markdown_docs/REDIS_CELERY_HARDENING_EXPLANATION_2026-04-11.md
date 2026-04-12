# Redis + Celery Hardening: Full Explanation (2026-04-11)

## 1) Bối cảnh và mục tiêu

Tại hệ thống hiện tại, Redis đang được dùng làm:

- Celery broker (DB 0)
- Celery result backend (DB 1)

Mục tiêu của đợt cập nhật này:

- Tăng bảo mật cho endpoint xem trạng thái task async
- Giảm nguy cơ Redis bị phồng to do task result tích lũy
- Tăng độ ổn định cho worker/Celery khi gặp lỗi
- Thêm readiness check thật sự cho Mongo + Redis
- Làm log Celery rõ ràng hơn khi lỗi nghiệp vụ (4xx)

---

## 2) Tất cả thay đổi đã thực hiện

### 2.1. Thêm cấu hình Celery hardening vào settings

Đã bổ sung các biến mới trong config:

- `celery_result_expires_seconds` (mặc định 86400)
- `celery_task_soft_time_limit_seconds` (mặc định 1800)
- `celery_task_time_limit_seconds` (mặc định 2100)
- `celery_worker_prefetch_multiplier` (mặc định 1)

Ý nghĩa:

- Result trong Redis không tồn tại vô hạn
- Task có giới hạn thời gian để tránh treo vô tận
- Worker nhận task có kiểm soát hơn (tránh ôm quá nhiều)

---

### 2.2. Cập nhật Celery app config trong tasks

Đã cập nhật `celery_app.conf`:

- `result_expires`
- `task_soft_time_limit`
- `task_time_limit`
- `worker_prefetch_multiplier`
- `task_acks_late=True`
- `broker_connection_retry_on_startup=True`

Đã cập nhật decorator của các task generation:

- `max_retries=3`
- `retry_backoff=True`
- `retry_jitter=True`

Ý nghĩa:

- Retry thông minh hơn, không dồn dập cùng một nhịp
- Broker reconnect tốt hơn khi startup

---

### 2.3. Bảo mật endpoint `/api/tasks/{task_id}/status` theo user

Vấn đề trước đây:

- Nếu ai đó biết `task_id`, có thể truy cập trạng thái task

Đã sửa:

1. Lúc queue task async, lưu mapping `job_id(task_id) -> user_id`
2. Lúc check status, bắt buộc đối chiếu user hiện tại với `user_id` đã lưu
3. Nếu không khớp -> `404 Task not found`

Ý nghĩa:

- Ngăn lộ thông tin trạng thái/kết quả task giữa các tài khoản

---

### 2.4. Thêm helper trong JobRepository

Bổ sung hàm:

- `get_by_job_id(job_id)`

Mục đích:

- Lấy dữ liệu processing_jobs nhanh để phục vụ ownership check

---

### 2.5. Đưa logic queue/status vào GenerationService

Bổ sung trong service:

- `register_generation_task(...)`
- `get_generation_task_status(...)`

Mục đích:

- Tập trung hóa nghiệp vụ ownership + status map
- Route gọn hơn, dễ maintain

---

### 2.6. Thêm readiness endpoint thật sự

Bổ sung endpoint:

- `GET /health/ready`

Xử lý:

- Ping Mongo qua `db.command("ping")`
- Ping Redis qua client Redis

Ý nghĩa:

- Monitoring/deploy biết được phụ thuộc có thực sự sống hay không
- Khác với `/health` (chỉ check app process)

---

### 2.7. Sửa compose cho worker và env đồng bộ

Đã cập nhật:

- Truyền thêm các biến Celery mới vào backend + celery-worker
- Chỉnh worker `--concurrency=1` khi dùng `--pool=solo`

Ý nghĩa:

- Cấu hình đúng với hành vi runtime thật
- Tránh hiểu nhầm throughput với solo pool

---

### 2.8. Xử lý lỗi 4xx trong Celery theo hướng non-retriable

Vấn đề:

- Lỗi nghiệp vụ như `404 Material not found` không nên retry

Đã sửa:

- Bắt `HTTPException` trong task
- Ghi warning non-retriable
- Không gọi `self.retry(...)`

Cập nhật bổ sung để log đẹp:

- Không re-raise trực tiếp `HTTPException` (để tránh `UnpickleableExceptionWrapper`)
- Chuyển thành `RuntimeError("Non-retriable HTTP error ...")`

Ý nghĩa:

- Không tồn tại retry vô ích cho lỗi nghiệp vụ cố định
- Log Celery dễ đọc, dễ debug hơn

---

### 2.9. Bổ sung unique index + monitoring tối thiểu cho Redis/Celery

Đã bổ sung thêm:

- Unique index cho `processing_jobs.job_id`
- Endpoint monitoring queue: `GET /health/queue`

Endpoint `/health/queue` trả về:

- `queue_depth`: số lượng message đang nằm trong queue `celery`
- `result_backend_keys`: tổng số key trong Redis result backend

Ý nghĩa:

- Tránh trùng mapping task ownership trong Mongo
- Có số liệu runtime tối thiểu để giám sát queue và result backend

---

## 3) Danh sách file đã thay đổi

- `backend/app/core/config.py`
- `backend/app/tasks.py`
- `backend/app/services/generation_service.py`
- `backend/app/repositories/job_repository.py`
- `backend/app/api/routes/generated_contents.py`
- `backend/app/main.py`
- `backend/app/db/mongo.py`
- `.env.example`
- `docker-compose.yml`
- `backend/tests/unit/test_generated_contents_async_ownership.py`
- `backend/tests/unit/test_mongo_indexes.py`
- `backend/tests/unit/test_logging_and_main.py`

---

## 4) Luồng hoạt động mới (tóm tắt)

### Luồng async generation

1. User gọi endpoint `/generate/*/async`
2. Hệ thống queue Celery task
3. Hệ thống lưu processing_jobs: `job_id=task_id`, `user_id=owner`
4. Worker đọc queue từ Redis DB0, xử lý task
5. Kết quả task lưu vào Redis DB1, có TTL
6. User poll `/api/tasks/{task_id}/status`
7. API check owner, đúng owner mới được xem

### Luồng lỗi 4xx

1. Task gặp lỗi nghiệp vụ (ví dụ 404 material)
2. Log warning non-retriable
3. Task fail ngay (không retry)

---

## 5) Kết quả test thực tế đã chạy

Đã chạy test runtime và E2E trên data thật, kết quả:

- `/health/ready` trả mongo up + redis up
- `/health/queue` trả queue depth + result backend key count
- Queue async cho `minigame`, `slides`, `podcast` thành công
- Poll status chuyển từ `processing/STARTED` -> `completed/SUCCESS`
- User khác gọi cùng `task_id` nhận `404 Task not found`
- Redis TTL cho `celery-task-meta-*` là số dương (~86399)
- Lỗi 404 material fail ngay, không retry
- Log mới không còn `UnpickleableExceptionWrapper` cho case non-retriable
- Unit tests mới cho ownership + monitoring + unique index: pass

---

## 6) Tại sao thay đổi này quan trọng

- Bảo mật: ngăn lộ task status giữa người dùng
- Độ bền: worker/retry/time-limit rõ ràng, giảm kẹt queue
- Hiệu năng: prefetch đúng cách, kết quả hết hạn đúng lúc
- Vận hành: readiness check thật sự cho hệ thống phụ thuộc
- Debug: log non-retriable dễ hiểu, không gây nhiễu

---

## 7) Hướng phát triển tiếp theo (khuyến nghị)

1. Tách retry policy tinh hơn: 4xx fail ngay, 5xx/network mới retry
2. Thêm test integration tự động cho async queue + ownership
3. Thêm metrics queue depth/fail/retry để monitor chủ động
4. Đưa monitoring `/health/queue` vào dashboard cảnh báo