# 🔴 Redis - 🍀 Celery - 📦 MinIO Integration Guide

**Cập nhật:** 29/03/2026  
**Trạng thái:** ✅ Hoàn thành & Hoạt động  
**Dự án:** AI Learning Studio - AI For Education

---

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
3. [Redis - Message Broker](#redis---message-broker)
4. [Celery - Task Queue](#celery---task-queue)
5. [MinIO - Object Storage](#minio---object-storage)
6. [Integration Flow](#integration-flow)
7. [Cấu hình](#cấu-hình)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Tổng quan

Hệ thống đã tích hợp thành công 3 thành phần hạ tầng quan trọng:

| Component | Vai trò | Port | Status |
|-----------|---------|------|--------|
| **Redis** | Message Broker + Result Backend | 6379 | ✅ Healthy |
| **Celery Worker** | Execute background tasks | - | ✅ Running |
| **Celery Flower** | Task monitoring UI | 5555 | ✅ Running |
| **MinIO** | Object Storage (S3-compatible) | 9000, 9001 | ✅ Healthy |
| **Redis Insight** | Redis monitoring UI | 8081 | ✅ Running |

---

## Kiến trúc hệ thống

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend    │────▶│   MongoDB   │
│  (Next.js)  │◀────│  (FastAPI)   │◀────│  (Atlas)    │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
             ┌──────▼──────┐ ┌───▼────────┐
             │    Redis    │ │   MinIO    │
             │  (Broker +  │ │  (Storage) │
             │   Backend)  │ │            │
             └──────┬──────┘ └────────────┘
                    │
             ┌──────▼──────┐
             │   Celery    │
             │   Worker    │
             └─────────────┘
```

---

## Redis - Message Broker

### Vai trò
- **Message Broker:** Hàng đợi cho Celery tasks (db0)
- **Result Backend:** Lưu trữ kết quả tasks (db1)
- **In-memory data store:** High-performance caching

### Cấu hình Docker
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    retries: 5
```

### Databases
| DB | Mục đích | Keys |
|----|----------|------|
| **db0** | Celery Broker | `_kombu.binding.*` |
| **db1** | Result Backend | `celery-task-meta-*` |

### Commands hữu ích
```bash
# Check connection
docker exec any2-redis redis-cli ping

# Xem keyspace
docker exec any2-redis redis-cli INFO keyspace

# Xem task results
docker exec any2-redis redis-cli -n 1 KEYS "celery-task-meta-*"

# Xem chi tiết task
docker exec any2-redis redis-cli -n 1 GET "celery-task-meta-{task_id}"
```

### Redis Insight UI
- **URL:** http://localhost:8081
- **Container:** `any2-redis-insight`
- **Features:** Browse keys, memory analysis, terminal
- **Connection:** `redis://host.docker.internal:6379/0`

---

## Celery - Task Queue

### Vai trò
- Thực thi background tasks (generate slides, podcast, minigame)
- Async task processing với retry logic
- Distributed task execution

### Use Cases
- ✅ Generate slides từ tài liệu
- ✅ Generate podcast script
- ✅ Generate minigame/quiz
- ✅ Process materials (chunking, embedding)

### Cấu hình Celery App
```python
celery_app = Celery(
    "ai_tasks",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    task_concurrency=4,
    task_acks_late=True,
)
```

### Tasks định nghĩa
```python
@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_slides_task(self, material_id, tone, max_slides, ...):
    """Generate slides from material"""

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_podcast_task(self, material_id, style, duration, ...):
    """Generate podcast script"""

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_minigame_task(self, material_id, game_type, ...):
    """Generate minigame"""
```

### Async API Endpoints
```python
# Queue tasks
POST /api/materials/{id}/generate/slides/async
POST /api/materials/{id}/generate/podcast/async
POST /api/materials/{id}/generate/minigame/async

# Check status
GET /api/tasks/{task_id}/status
```

### Docker Configuration
```yaml
celery-worker:
  build: ./backend
  command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 --pool=solo
  environment:
    CELERY_BROKER_URL: redis://redis:6379/0
    CELERY_RESULT_BACKEND: redis://redis:6379/1
  depends_on:
    - redis
    - minio
  healthcheck:
    test: ["CMD-SHELL", "celery -A app.tasks.celery_app inspect ping"]
    interval: 60s
    timeout: 30s
    retries: 3
    start_period: 30s

celery-flower:
  build: ./backend
  command: celery -A app.tasks.celery_app flower --port=5555
  ports:
    - "5555:5555"
  depends_on:
    - redis
```

### Flower Monitoring UI
- **URL:** http://localhost:5555
- **Features:** Task dashboard, worker monitoring, retry failed tasks
- **No authentication required**

---

## MinIO - Object Storage

### Vai trò
- S3-compatible object storage
- Lưu trữ files thay vì local storage
- Production-ready với AWS S3 compatibility

### Use Cases
- ✅ Lưu trữ tài liệu upload (`uploads/`)
- ✅ Lưu trữ slides generated (`generated/slides/`)
- ✅ Lưu trữ podcast audio (`generated/podcasts/`)

### Docker Configuration
```yaml
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"  # API
    - "9001:9001"  # Console
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin123
  volumes:
    - minio_data:/data
  command: server /data --console-address ":9001"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
    interval: 30s
    retries: 3
```

### Storage Service
```python
class StorageService:
    def __init__(self):
    self.use_r2 = settings.use_r2
    self.bucket_name = settings.minio_bucket if not self.use_r2 else settings.r2_bucket
        
    def ensure_bucket_exists(self):
        """Create bucket if not exists (called on app startup)"""
        
    async def upload_file(self, file_path, object_name, content_type) -> str:
      """Upload file to MinIO/R2"""
        
    async def upload_file_obj(self, file_obj, object_name, content_type) -> str:
      """Upload file object to MinIO/R2"""
        
    async def download_file_obj(self, object_name) -> bytes:
      """Download file from MinIO/R2"""
        
    async def delete_file(self, object_name) -> bool:
      """Delete file from MinIO/R2"""
        
    def get_presigned_url(self, object_name, expiration=3600) -> str:
        """Generate presigned URL"""
```

### Commands hữu ích
```bash
# List files
docker exec any2-minio mc ls myminio/ai-learning-storage/

# Xem chi tiết file
docker exec any2-minio mc stat myminio/ai-learning-storage/uploads/file.txt

# Create bucket
docker exec any2-minio mc mb myminio/ai-learning-storage --ignore-existing
```

### MinIO Console UI
- **URL:** http://localhost:9001
- **Credentials:** `minioadmin` / `minioadmin123`
- **Features:** Browse buckets, upload/download, manage policies

---

## 🔍 Trong project này, 3 thành phần hoạt động như thế nào?

### 💡 Analogy: Nhà hàng AI

```
👤 Khách gọi món "Tạo slides"
    ↓
🧑‍💼 Backend API nhận order → ghi vào giấy → dán lên bảng (Redis)
📋 Nói khách: "Mã order của bạn: task_abc123"
    ↓  
👨‍🍳 Celery Worker thấy order trên bảng → vào bếp làm
    ↓
📦 MinIO = tủ lạnh → lưu nguyên liệu (file upload) + thành phẩm (slides PPTX)
    ↓
✅ Làm xong → dán kết quả lên bảng (Redis)
    ↓
👤 Khách quay lại check → "Đã xong! Đây là slides của bạn"
```

**Tại sao không làm luôn?** Vì gọi AI Gemini tạo slides mất **10-30 giây** → user không thể chờ HTTP request lâu vậy.

---

### 📮 Redis trong project này

**Vai trò:** Cái bảng order trong nhà hàng

**Cụ thể:**
- **db0** = nơi backend dán task chờ (queue)
- **db1** = nơi celery dán kết quả xong

**Trong code:**
```python
# Backend đẩy task vào Redis (db0)
task = generate_slides_task.delay(material_id, tone, max_slides)
# → Trả về task_id ngay cho user, không cần chờ!

# Celery làm xong, lưu kết quả vào Redis (db1)
# → User check status qua task_id này
```

**Config trong docker-compose.yml:**
```yaml
backend:
  CELERY_BROKER_URL: redis://redis:6379/0      # db0 - đẩy task vào đây

celery-worker:
  CELERY_BROKER_URL: redis://redis:6379/0       # db0 - lấy task từ đây
  CELERY_RESULT_BACKEND: redis://redis:6379/1   # db1 - lưu kết quả vào đây
```

---

### 🔄 Celery trong project này

**Vai trò:** Đầu bếp AI, process chạy độc lập

**Có 3 tasks chính:**
```python
@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_slides_task(self, material_id, tone, max_slides, skip_refine):
    """Tạo slides PPTX từ tài liệu"""

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_podcast_task(self, material_id, style, duration):
    """Tạo kịch bản podcast"""

@celery_app.task(bind=True, max_retries=2, default_retry_delay=30)
def generate_minigame_task(self, material_id, game_type, difficulty):
    """Tạo quiz/minigame"""
```

**Mỗi task làm gì?**
1. Kết nối MongoDB → lấy tài liệu
2. Tải file từ MinIO (hoặc local storage)
3. Gọi Gemini API → sinh nội dung (10-30s)
4. Tạo file (PPTX, JSON, ...)
5. Upload file lên MinIO
6. Lưu metadata vào MongoDB
7. Lưu kết quả vào Redis (db1) → user biết đã xong

**Retry:** Nếu lỗi (hết API key, timeout...) → tự thử lại sau 30s, tối đa 2 lần.

**Chạy trong docker-compose.yml:**
```yaml
celery-worker:
  command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 --pool=solo
  # --pool=solo: chạy 1 task tại 1 thời điểm (tránh xung đột GPU)
  # --concurrency=4: tối đa 4 threads
```

---

### 📦 MinIO trong project này

**Vai trò:** Kho lưu trữ file (S3-compatible)

**Lưu gì?**
```
uploads/                    # File user upload
  ├─ abc-123.pdf
  ├─ def-456.docx
  └─ ...

generated/                  # File AI tạo ra
  ├─ slides/
  │   └─ material-xyz.pptx
  └─ podcasts/
      └─ material-abc.json
```

**3 chế độ lưu (config qua .env):**

| USE_OBJECT_STORAGE | USE_R2 | Lưu ở đâu? |
|-------------------|--------|------------|
| `false` | - | **Local** (`./storage/`) - mặc định dev |
| `true` | `false` | **MinIO** (localhost:9000) |
| `true` | `true` | **Cloudflare R2** (cloud) |

**Trong code:**
```python
# Upload file
await storage_service.upload_file(
    file_path="/tmp/slides.pptx",
    object_name="generated/slides/material-123.pptx",
    content_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
)
# → Trả về URL: http://minio:9000/ai-learning-storage/generated/slides/material-123.pptx

# Download file
file_bytes = await storage_service.download_file_obj(
    object_name="generated/slides/material-123.pptx"
)

# MongoDB lưu storage_type để biết file ở đâu
{
  "storage_type": "minio",  # hoặc "local", "r2"
  "file_url": "http://minio:9000/..."
}
```

---

### 🎯 Luồng hoạt động thực tế

**Ví dụ: User click "Generate Slides"**

```
1️⃣ FRONTEND → Backend API
   POST /api/generated/materials/{id}/generate/slides/async
   
2️⃣ BACKEND → Redis
   - Tạo task, push vào Redis db0
   - Trả user: {"task_id": "abc123", "status": "PENDING"}
   
3️⃣ CELERY WORKER → Redis → Làm việc
   - Poll Redis db0, thấy task mới
   - Tải file từ MinIO
   - Gọi Gemini API → sinh nội dung slides
   - Tạo file PPTX
   - Upload PPTX lên MinIO
   - Lưu metadata vào MongoDB
   - Push kết quả vào Redis db1: {"status": "SUCCESS", "file_url": "..."}
   
4️⃣ FRONTEND → Backend → Redis (poll mỗi 2s)
   GET /api/tasks/abc123/status
   → {"status": "SUCCESS", "result": {"file_url": "http://minio:9000/..."}}
   
5️⃣ User click "Download"
   FRONTEND → Backend → MinIO
   GET /api/generated/{content_id}/download
   → Stream file PPTX về cho user
```

---

### 🔧 Kiểm tra nhanh

```bash
# Redis có chạy không?
docker exec any2-redis redis-cli ping
# → PONG

# Celery có đang xử lý task không?
docker logs any2-celery-worker --tail=20
# → "Task generate_slides_task[abc123] succeeded"

# Files trong MinIO?
docker exec any2-minio mc ls myminio/ai-learning-storage/generated/slides/

# Xem tasks trên Flower UI
# → http://localhost:5555
```

---

### 📊 Tóm tắt vai trò

| Thành phần | Vai trò trong project | Giống như |
|-----------|----------------------|-----------|
| **Redis** | Trung gian liên lạc giữa Backend ↔ Celery | Bảng order |
| **Celery Worker** | Chạy background tasks (gọi AI, tạo file) | Đầu bếp |
| **MinIO** | Lưu files (upload + generated) | Tủ lạnh/kho |
| **Flower** | UI giám sát tasks | Camera bếp |
| **Redis Insight** | UI xem dữ liệu Redis | Sổ theo dõi |

---

## Integration Flow

Tóm tắt nhanh:

```
1. User upload file
   └─▶ Backend lưu vào MinIO (uploads/{uuid}.txt)

2. User click "Generate Slides"
   └─▶ Backend push task vào Redis queue

3. Celery Worker poll task
   └─▶ Generate PPTX content
   └─▶ Upload lên MinIO (generated/slides/{id}.pptx)
   └─▶ Lưu result vào Redis

4. Frontend poll status
   └─▶ Return: SUCCESS + file_url

5. User download slides
   └─▶ Stream file từ MinIO
```

---

## Cấu hình

### Environment Variables (.env)
```bash
# === REDIS & CELERY ===
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/1

# === MINIO (Development) ===
USE_R2=false
MINIO_ENDPOINT=http://minio:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=ai-learning-storage
```

### Dependencies
```txt
# backend/requirements.txt
redis
celery
flower
boto3
```

---

## Monitoring

### URLs
| Service | URL | Container | Credentials |
|---------|-----|-----------|-------------|
| **Redis Insight** | http://localhost:8081 | `any2-redis-insight` | Email registration |
| **Flower (Celery)** | http://localhost:5555 | `any2-flower` | None |
| **MinIO Console** | http://localhost:9001 | `any2-minio` | minioadmin / minioadmin123 |
| **Swagger UI** | http://localhost:8000/docs | `any2-backend` | None |

### Check Health
```bash
# All containers
docker compose ps

# Redis
docker exec any2-redis redis-cli ping  # PONG

# MinIO
curl http://localhost:9000/minio/health/live

# Celery Worker logs
docker logs any2-celery-worker --tail=50
```

---

## Troubleshooting

### Celery tasks stuck in PENDING
```bash
# Check worker running
docker compose ps celery-worker

# Restart worker
docker compose restart celery-worker

# Check logs
docker logs any2-celery-worker --tail=100
```

### MinIO upload failed
```bash
# Check bucket exists
docker exec any2-minio mc mb myminio/ai-learning-storage --ignore-existing

# Check credentials
docker exec any2-minio mc alias set myminio http://localhost:9000 minioadmin minioadmin123
```

### Redis connection error
```bash
# Check Redis
docker exec any2-redis redis-cli ping

# Restart Redis
docker compose restart redis
```

---

## Files đã thay đổi

```
docker-compose.yml
backend/requirements.txt
backend/app/core/config.py
backend/app/tasks.py
backend/app/services/storage.py

---

## Cập nhật 2026-03-30: Storage 3 mode

Tài liệu gốc mô tả storage theo hướng MinIO/S3 là mặc định. Trạng thái code hiện tại đã khác:

### Ma trận cấu hình mới

| USE_OBJECT_STORAGE | USE_R2 | Kết quả |
|---|---|---|
| `false` | `false` hoặc `true` | Dùng local filesystem |
| `true` | `false` | Dùng MinIO |
| `true` | `true` | Dùng Cloudflare R2 |

### Ý nghĩa

- `USE_R2` chỉ có hiệu lực khi `USE_OBJECT_STORAGE=true`
- Khi `USE_OBJECT_STORAGE=false`, backend không khởi tạo object storage client và không tạo bucket lúc startup
- Các flow upload/generate sẽ đi thẳng local storage, không còn warning giả kiểu “upload object storage failed vì object storage disabled”

### Phạm vi đã hỗ trợ

- Upload học liệu gốc
- Generate slides
- Generate podcast audio
- NotebookLM video
- NotebookLM infographic
- Resolve file nguồn cho NotebookLM và slide generation từ `local`, `MinIO`, `R2`
- Xóa file local/object storage theo helper chung

### Metadata storage mới

Từ bản cập nhật 2026-03-30:

- `learning_materials.storage_type`
- `generated_contents.storage_type`

Giá trị hiện dùng:

- `local`
- `minio`
- `r2`
- `none`

Mục tiêu là để người dùng biết file đã được lưu theo mode nào tại thời điểm tạo. Dữ liệu cũ chưa có `storage_type` vẫn được fallback suy ra từ `file_url`.

### Cấu hình mẫu

Local:

```env
USE_OBJECT_STORAGE=false
USE_R2=false
```

MinIO:

```env
USE_OBJECT_STORAGE=true
USE_R2=false
MINIO_ENDPOINT=http://localhost:9000
MINIO_BUCKET=ai-learning-storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

Cloudflare R2:

```env
USE_OBJECT_STORAGE=true
USE_R2=true
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET=your-bucket
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_BASE_URL=https://<public-domain>
```
backend/app/services/material_service.py
backend/app/services/generation_service.py
backend/app/api/routes/generated_contents.py
backend/app/api/routes/files.py
```

---

**🎉 Tất cả services hoạt động bình thường!**

*Tài liệu cập nhật: 29/03/2026*
    
