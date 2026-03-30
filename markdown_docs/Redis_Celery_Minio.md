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
        self.use_s3 = settings.use_s3
        self.bucket_name = settings.minio_bucket if not self.use_s3 else settings.aws_s3_bucket
        
    def ensure_bucket_exists(self):
        """Create bucket if not exists (called on app startup)"""
        
    async def upload_file(self, file_path, object_name, content_type) -> str:
        """Upload file to MinIO/S3"""
        
    async def upload_file_obj(self, file_obj, object_name, content_type) -> str:
        """Upload file object to MinIO/S3"""
        
    async def download_file_obj(self, object_name) -> bytes:
        """Download file from MinIO/S3"""
        
    async def delete_file(self, object_name) -> bool:
        """Delete file from MinIO/S3"""
        
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

## Integration Flow

### Luồng Generate Slides

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
USE_S3=false
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

| USE_OBJECT_STORAGE | USE_S3 | Kết quả |
|---|---|---|
| `false` | `false` hoặc `true` | Dùng local filesystem |
| `true` | `false` | Dùng MinIO |
| `true` | `true` | Dùng AWS S3 |

### Ý nghĩa

- `USE_S3` chỉ có hiệu lực khi `USE_OBJECT_STORAGE=true`
- Khi `USE_OBJECT_STORAGE=false`, backend không khởi tạo object storage client và không tạo bucket lúc startup
- Các flow upload/generate sẽ đi thẳng local storage, không còn warning giả kiểu “upload object storage failed vì object storage disabled”

### Phạm vi đã hỗ trợ

- Upload học liệu gốc
- Generate slides
- Generate podcast audio
- NotebookLM video
- NotebookLM infographic
- Resolve file nguồn cho NotebookLM và slide generation từ `local`, `MinIO`, `S3`
- Xóa file local/object storage theo helper chung

### Metadata storage mới

Từ bản cập nhật 2026-03-30:

- `learning_materials.storage_type`
- `generated_contents.storage_type`

Giá trị hiện dùng:

- `local`
- `minio`
- `s3`
- `none`

Mục tiêu là để người dùng biết file đã được lưu theo mode nào tại thời điểm tạo. Dữ liệu cũ chưa có `storage_type` vẫn được fallback suy ra từ `file_url`.

### Cấu hình mẫu

Local:

```env
USE_OBJECT_STORAGE=false
USE_S3=false
```

MinIO:

```env
USE_OBJECT_STORAGE=true
USE_S3=false
MINIO_ENDPOINT=http://localhost:9000
MINIO_BUCKET=ai-learning-storage
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
```

AWS S3:

```env
USE_OBJECT_STORAGE=true
USE_S3=true
AWS_S3_BUCKET=your-bucket
AWS_REGION=ap-southeast-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```
backend/app/services/material_service.py
backend/app/services/generation_service.py
backend/app/api/routes/generated_contents.py
backend/app/api/routes/files.py
```

---

**🎉 Tất cả services hoạt động bình thường!**

*Tài liệu cập nhật: 29/03/2026*
    
