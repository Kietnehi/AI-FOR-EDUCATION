# 📋 AI Learning Studio - Project Planning & Technical Recommendations

**Version:** 2.0  
**Last Updated:** 2026-03-28  
**Project:** AI For Education - SGU

---

## 🎯 Mục Lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Kiến trúc hiện tại](#2-kiến-trúc-hiện-tại)
3. [Công cụ bổ sung](#3-công-cụ-bổ-sung)
4. [Hướng dẫn cài đặt](#4-hướng-dẫn-cài-đặt)
5. [Lộ trình phát triển](#5-lộ-trình-phát-triển)

---

## 1. Tổng quan dự án

### 1.1 Mục tiêu
Nền tảng MVP production-ready giúp giáo viên và học sinh tạo nội dung học tập thông minh bằng AI với các tính năng:
- 📊 Tạo slide bài giảng (.pptx)
- 🎙️ Tạo podcast script
- 🎮 Tạo minigame/quiz tương tác
- 🤖 Chatbot RAG hỏi đáp theo học liệu
- 🌐 Web Search integration
- 🎤 Speech-to-Text & Text-to-Speech

### 1.2 Tech Stack hiện tại

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TailwindCSS v4, Framer Motion, Three.js |
| **Backend** | FastAPI, Python 3.11+ |
| **Database** | MongoDB Atlas (chính), ChromaDB (vector - local) |
| **AI/ML** | OpenAI API, Gemini API, Groq API, Whisper |
| **Deployment** | Docker, Docker Compose, GitHub Actions (CI/CD) |

---

## 2. Kiến trúc hiện tại

### 2.1 Sơ đồ luồng xử lý

```mermaid
flowchart LR
    A[Upload tài liệu] --> B[Trích xuất text]
    B --> C[Làm sạch & Chunking]
    C --> D[Tạo Embeddings]
    D --> E[ChromaDB + MongoDB]
    E --> F{Tạo nội dung}
    F --> G[📊 Slides]
    F --> H[🎙️ Podcast]
    F --> I[🎮 Minigame]
    F --> J[🤖 Chatbot RAG]
```

### 2.2 Các service hiện có

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│   MongoDB   │
│  (Next.js)  │     │  (FastAPI)  │     │  (Atlas)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  ChromaDB   │
                    │  (Vector)   │
                    └─────────────┘
```

---

## 3. Công cụ bổ sung

### 3.1 🟢 **Redis** - Caching & Message Broker

**Lý do:**
- Giảm tải cho MongoDB và ChromaDB khi truy vấn lặp lại
- Lưu session chat, user state tạm thời
- Rate limiting cho API endpoints
- Làm message broker cho Celery
- Real-time features (live progress khi tạo slide/podcast)

**Use cases cụ thể:**
```python
# 1. Cache kết quả RAG retrieval (tránh query ChromaDB nhiều lần cùng 1 query)
cache_key = f"rag:{material_id}:{query_hash}"
cached_result = await redis.get(cache_key)

# 2. Lưu temporary state khi tạo content (progress tracking)
await redis.setex(f"generation:{task_id}", 3600, {"status": "processing", "progress": 45})

# 3. Rate limiting cho API
from fastapi-limiter import FastAPILimiter
await FastAPILimiter.init(redis)

# 4. Session storage cho chatbot
await redis.setex(f"session:{session_id}", 1800, conversation_history)

# 5. Celery broker
celery_app = Celery('ai_tasks', broker='redis://redis:6379/0')
```

**Cài đặt Docker:**
```yaml
# docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: any2-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

volumes:
  redis_data:
```

**Dependencies:**
```txt
# requirements.txt
redis>=5.0.0
fastapi-limiter>=0.1.6
```

**Độ ưu tiên:** ⭐⭐⭐⭐⭐ (5/5)  
**Độ phức tạp:** Thấp  
**Impact:** Cao

---

### 3.2 🟡 **Celery** - Background Job Processing

**Lý do:**
- Hiện tại backend xử lý đồng bộ các tác vụ nặng (tạo slide, podcast, minigame)
- Khi có nhiều request, API có thể bị timeout
- Cần background job processing cho các tác vụ dài (>30s)
- Trả kết quả ngay lập tức cho user, xử lý ở background

**Kiến trúc:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   FastAPI   │────▶│   Redis     │
│             │     │   (API)     │     │  (Broker)   │
└─────────────┘     └─────────────┘     └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │   Celery    │
                                          │   Worker    │
                                          └─────────────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │  MongoDB    │
                                          │  ChromaDB   │
                                          │  MinIO/S3   │
                                          └─────────────┘
```

**Use cases:**
```python
# backend/app/tasks.py
from celery import Celery
import os

celery_app = Celery(
    'ai_tasks',
    broker=os.getenv('REDIS_URL', 'redis://localhost:6379/0'),
    backend=os.getenv('REDIS_URL', 'redis://localhost:6379/1')
)

@celery_app.task(bind=True, max_retries=3)
def generate_slides_task(self, material_id: str):
    try:
        # Xử lý tạo slide
        from app.services.slide_service import create_slides
        result = create_slides(material_id)
        return {"status": "completed", "file_url": result}
    except Exception as exc:
        raise self.retry(exc, countdown=60)

@celery_app.task(bind=True)
def generate_podcast_task(self, material_id: str):
    try:
        from app.services.podcast_service import create_podcast
        result = create_podcast(material_id)
        return {"status": "completed", "script": result}
    except Exception as exc:
        raise self.retry(exc, countdown=60)

@celery_app.task(bind=True)
def generate_minigame_task(self, material_id: str):
    try:
        from app.services.minigame_service import create_minigame
        result = create_minigame(material_id)
        return {"status": "completed", "game_data": result}
    except Exception as exc:
        raise self.retry(exc, countdown=60)
```

**API endpoint mẫu:**
```python
# backend/app/api/generation.py
from fastapi import BackgroundTasks, HTTPException
from app.tasks import generate_slides_task, generate_podcast_task, generate_minigame_task

@app.post("/api/materials/{material_id}/generate/slides")
async def generate_slides(material_id: str, use_celery: bool = True):
    if use_celery:
        # Gửi task vào Celery queue
        task = generate_slides_task.delay(material_id)
        return {
            "task_id": task.id,
            "status": "queued",
            "message": "Slide generation started. Check status with task_id."
        }
    else:
        # Xử lý đồng bộ (cho testing)
        result = generate_slides_task(material_id)
        return result

@app.get("/api/tasks/{task_id}/status")
async def get_task_status(task_id: str):
    from app.tasks import generate_slides_task
    task = generate_slides_task.AsyncResult(task_id)
    
    if task.state == 'PENDING':
        return {"status": "pending", "progress": 0}
    elif task.state == 'STARTED':
        return {"status": "processing", "progress": 50}
    elif task.state == 'SUCCESS':
        return {"status": "completed", "progress": 100, "result": task.result}
    elif task.state == 'FAILURE':
        return {"status": "failed", "error": str(task.info)}
    else:
        return {"status": task.state}
```

**Cài đặt Docker:**
```yaml
# docker-compose.yml
services:
  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: any2-celery-worker
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 --pool=solo
    environment:
      REDIS_URL: redis://redis:6379/0
      MONGO_URI: ${MONGO_URI:-mongodb://mongo:27017}
      MONGO_DB_NAME: ${MONGO_DB_NAME:-ai_learning_platform}
      # Các env vars khác cho AI providers
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
    volumes:
      - ./backend:/app
      - backend_storage:/app/storage
    depends_on:
      - redis
      - mongo
    restart: unless-stopped

  # Flower - Celery monitoring dashboard (optional)
  celery-flower:
    build: ./backend
    container_name: any2-flower
    command: celery -A app.tasks.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped
```

**Dependencies:**
```txt
# requirements.txt
celery>=5.3.0
redis>=5.0.0
flower>=2.0.0  # Monitoring dashboard
```

**Độ ưu tiên:** ⭐⭐⭐⭐ (4/5)  
**Độ phức tạp:** Trung bình  
**Impact:** Rất cao

---

### 3.3 🟤 **MinIO** - Object Storage (S3-compatible)

**Lý do:**
- Lưu trữ file upload, generated content (slides, audio, video, infographic)
- Hiện tại backend lưu local file system (`./backend/storage/`) → khó scale
- MinIO là S3-compatible → code viết 1 lần, sau này migrate sang AWS S3 dễ dàng
- Self-hosted, miễn phí, chạy trong Docker

**Chiến lược:** Dùng MinIO cho development/testing → Migrate sang AWS S3 khi production

---

#### 📦 **Cấu hình MinIO**

**Docker Compose:**
```yaml
# docker-compose.yml
services:
  minio:
    image: minio/minio:latest
    container_name: any2-minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"  # API endpoint
      - "9001:9001"  # Web console
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

volumes:
  minio_data:
```

**Environment variables (.env.example):**
```bash
# MinIO Configuration (Development)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=ai-learning-storage

# AWS S3 Configuration (Production - để trống khi dùng MinIO)
USE_S3=false
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

---

#### 📦 **Storage Abstraction Layer - MinIO → AWS S3**

Viết code 1 lần, dùng cho cả MinIO và AWS S3:

```python
# backend/app/services/storage.py
import boto3
from botocore.config import Config
from typing import Optional, List
import os
from pathlib import Path

class StorageService:
    """
    Storage service abstraction layer.
    Supports both MinIO (development) and AWS S3 (production).
    """
    
    def __init__(self):
        self.use_s3 = os.getenv("USE_S3", "false").lower() == "true"
        
        if self.use_s3:
            # AWS S3 Configuration
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
                aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
                region_name=os.getenv("AWS_REGION", "ap-southeast-1"),
                config=Config(signature_version='s3v4')
            )
            self.bucket_name = os.getenv("AWS_S3_BUCKET")
            self.endpoint_url = None
            self.is_minio = False
        else:
            # MinIO Configuration (S3-compatible)
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv("MINIO_ROOT_USER"),
                aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD"),
                endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000"),
                config=Config(signature_version='s3v4')
            )
            self.bucket_name = os.getenv("MINIO_BUCKET", "ai-learning-storage")
            self.endpoint_url = os.getenv("MINIO_ENDPOINT")
            self.is_minio = True
        
        # Ensure bucket exists (for MinIO)
        if self.is_minio:
            self._ensure_bucket_exists()
    
    def _ensure_bucket_exists(self):
        """Create bucket if it doesn't exist (MinIO only)"""
        try:
            self.s3_client.head_bucket(Bucket=self.bucket_name)
        except:
            self.s3_client.create_bucket(Bucket=self.bucket_name)
    
    async def upload_file(
        self, 
        file_path: str, 
        object_name: str,
        content_type: Optional[str] = None
    ) -> str:
        """
        Upload file to storage and return URL.
        
        Args:
            file_path: Local file path
            object_name: Object name in bucket (e.g., 'slides/material_123.pptx')
            content_type: MIME type (e.g., 'application/vnd.ms-powerpoint')
        
        Returns:
            Public or presigned URL to access the file
        """
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type
        
        self.s3_client.upload_file(
            file_path, 
            self.bucket_name, 
            object_name,
            ExtraArgs=extra_args
        )
        
        if self.use_s3:
            # AWS S3 - Return public URL or presigned URL
            if self._is_bucket_public():
                return f"https://{self.bucket_name}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{object_name}"
            else:
                return self.get_presigned_url(object_name)
        else:
            # MinIO - Return direct URL
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
    
    async def upload_file_obj(
        self, 
        file_obj, 
        object_name: str,
        content_type: Optional[str] = None
    ) -> str:
        """Upload file object (BytesIO) to storage."""
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type
        
        self.s3_client.upload_fileobj(
            file_obj, 
            self.bucket_name, 
            object_name,
            ExtraArgs=extra_args
        )
        
        if self.use_s3 and not self._is_bucket_public():
            return self.get_presigned_url(object_name)
        elif self.is_minio:
            return f"{self.endpoint_url}/{self.bucket_name}/{object_name}"
        else:
            return f"https://{self.bucket_name}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/{object_name}"
    
    async def download_file(self, object_name: str, download_path: str) -> str:
        """Download file from storage to local path."""
        Path(download_path).parent.mkdir(parents=True, exist_ok=True)
        self.s3_client.download_file(self.bucket_name, object_name, download_path)
        return download_path
    
    async def download_file_obj(self, object_name: str) -> bytes:
        """Download file from storage as bytes."""
        import io
        buffer = io.BytesIO()
        self.s3_client.download_fileobj(self.bucket_name, object_name, buffer)
        return buffer.getvalue()
    
    async def delete_file(self, object_name: str) -> bool:
        """Delete file from storage."""
        self.s3_client.delete_object(Bucket=self.bucket_name, Key=object_name)
        return True
    
    async def delete_files(self, object_names: List[str]) -> bool:
        """Delete multiple files from storage."""
        objects = [{'Key': name} for name in object_names]
        self.s3_client.delete_objects(
            Bucket=self.bucket_name,
            Delete={'Objects': objects}
        )
        return True
    
    def get_presigned_url(self, object_name: str, expiration: int = 3600) -> str:
        """
        Generate temporary presigned URL for private bucket access.
        
        Args:
            object_name: Object name in bucket
            expiration: URL expiration in seconds (default: 1 hour)
        
        Returns:
            Presigned URL
        """
        return self.s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': self.bucket_name, 'Key': object_name},
            ExpiresIn=expiration
        )
    
    def get_upload_presigned_url(self, object_name: str, expiration: int = 3600) -> str:
        """Generate presigned URL for uploading."""
        return self.s3_client.generate_presigned_url(
            'put_object',
            Params={'Bucket': self.bucket_name, 'Key': object_name},
            ExpiresIn=expiration
        )
    
    def _is_bucket_public(self) -> bool:
        """Check if bucket is public (AWS S3 only)."""
        # Implement bucket policy check if needed
        return False
    
    async def list_files(self, prefix: str = "") -> List[str]:
        """List files with given prefix."""
        response = self.s3_client.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=prefix
        )
        
        if 'Contents' not in response:
            return []
        
        return [obj['Key'] for obj in response['Contents']]
    
    async def get_file_metadata(self, object_name: str) -> dict:
        """Get file metadata."""
        response = self.s3_client.head_object(
            Bucket=self.bucket_name,
            Key=object_name
        )
        return {
            'content_type': response.get('ContentType'),
            'size': response.get('ContentLength'),
            'last_modified': response.get('LastModified'),
            'etag': response.get('ETag')
        }


# Singleton instance
storage_service = StorageService()
```

---

#### 📦 **Sử dụng Storage Service trong code**

```python
# backend/app/services/slide_service.py
from app.services.storage import storage_service
import os

async def create_and_upload_slides(material_id: str, content: str) -> str:
    """Create slides and upload to MinIO/S3."""
    from app.utils.slide_generator import generate_pptx
    
    # Generate slides locally
    temp_file = f"/tmp/slides_{material_id}.pptx"
    generate_pptx(content, temp_file)
    
    # Upload to storage
    object_name = f"slides/{material_id}/presentation.pptx"
    file_url = await storage_service.upload_file(
        temp_file, 
        object_name,
        content_type='application/vnd.ms-powerpoint'
    )
    
    # Cleanup
    os.remove(temp_file)
    
    return file_url
```

```python
# backend/app/services/audio_service.py
from app.services.storage import storage_service

async def create_and_upload_audio(text: str, session_id: str) -> str:
    """Create TTS audio and upload to MinIO/S3."""
    from app.services.tts_service import generate_speech
    
    # Generate audio
    audio_bytes = await generate_speech(text)
    
    # Upload to storage
    import io
    object_name = f"audio/{session_id}/speech.mp3"
    file_url = await storage_service.upload_file_obj(
        io.BytesIO(audio_bytes), 
        object_name,
        content_type='audio/mpeg'
    )
    
    return file_url
```

---

#### 📦 **Migration từ MinIO sang AWS S3**

Khi sẵn sàng chuyển sang production với AWS S3:

**Bước 1: Tạo AWS S3 bucket**
```bash
# AWS CLI
aws s3 mb s3://ai-learning-storage-prod --region ap-southeast-1
aws s3api put-bucket-versioning --bucket ai-learning-storage-prod --versioning-configuration Status=Enabled
```

**Bước 2: Cấu hình CORS cho bucket**
```json
// cors-config.json
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": []
        }
    ]
}
```
```bash
aws s3api put-bucket-cors --bucket ai-learning-storage-prod --cors-configuration file://cors-config.json
```

**Bước 3: Tạo IAM user với S3 access**
```json
// s3-policy.json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::ai-learning-storage-prod",
                "arn:aws:s3:::ai-learning-storage-prod/*"
            ]
        }
    ]
}
```

**Bước 4: Chạy migration script**
```python
# scripts/migrate_minio_to_s3.py
"""
Migration script: MinIO → AWS S3
Usage: python scripts/migrate_minio_to_s3.py
"""
import boto3
from botocore.config import Config
import os
import tempfile

def migrate_minio_to_s3():
    """Migrate tất cả files từ MinIO sang AWS S3."""
    
    print("🚀 Starting migration from MinIO to AWS S3...")
    
    # MinIO client
    minio_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv("MINIO_ROOT_USER"),
        aws_secret_access_key=os.getenv("MINIO_ROOT_PASSWORD"),
        endpoint_url=os.getenv("MINIO_ENDPOINT", "http://localhost:9000")
    )
    
    # AWS S3 client
    s3_client = boto3.client(
        's3',
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION")
    )
    
    minio_bucket = os.getenv("MINIO_BUCKET", "ai-learning-storage")
    s3_bucket = os.getenv("AWS_S3_BUCKET")
    
    if not s3_bucket:
        print("❌ Error: AWS_S3_BUCKET not configured")
        return
    
    # List tất cả objects trong MinIO
    print(f"📋 Listing objects in MinIO bucket: {minio_bucket}")
    objects = minio_client.list_objects_v2(Bucket=minio_bucket)
    
    if 'Contents' not in objects or len(objects['Contents']) == 0:
        print("⚠️  No objects to migrate")
        return
    
    total_objects = len(objects['Contents'])
    print(f"📦 Found {total_objects} objects to migrate")
    
    migrated_count = 0
    failed_count = 0
    
    for idx, obj in enumerate(objects['Contents'], 1):
        key = obj['Key']
        size = obj.get('Size', 0)
        
        print(f"[{idx}/{total_objects}] Migrating: {key} ({size:,} bytes)")
        
        try:
            # Download từ MinIO
            with tempfile.NamedTemporaryFile(delete=False) as tmp_file:
                minio_client.download_file(minio_bucket, key, tmp_file.name)
                tmp_path = tmp_file.name
            
            # Upload lên S3
            s3_client.upload_file(tmp_path, s3_bucket, key)
            
            # Xóa file tạm
            os.remove(tmp_path)
            
            migrated_count += 1
            print(f"   ✅ Success")
            
        except Exception as e:
            failed_count += 1
            print(f"   ❌ Failed: {str(e)}")
    
    print("\n" + "="*50)
    print(f"✅ Migration completed!")
    print(f"   - Successful: {migrated_count}/{total_objects}")
    print(f"   - Failed: {failed_count}/{total_objects}")
    print("="*50)

if __name__ == "__main__":
    migrate_minio_to_s3()
```

**Bước 5: Update environment variables cho production**
```bash
# .env.production
# Switch sang AWS S3
USE_S3=true

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-southeast-1  # Singapore
AWS_S3_BUCKET=ai-learning-storage-prod

# MinIO Configuration (để trống)
MINIO_ENDPOINT=
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=
MINIO_BUCKET=
```

---

#### 📦 **So sánh chi phí**

| Storage | Chi phí | Khi nào dùng |
|---------|---------|--------------|
| **MinIO (self-hosted)** | Miễn phí (chỉ tốn server) | Development, Testing, On-premise |
| **AWS S3 Standard** | ~$0.023/GB/tháng | Production, cần scale, global users |
| **AWS S3 Glacier** | ~$0.004/GB/tháng | Lưu trữ lâu dài, ít truy cập |

**Ví dụ chi phí AWS S3:**
- 100 GB storage: ~$2.3/tháng
- 1 TB storage: ~$23/tháng
- 10 TB storage: ~$230/tháng

---

#### 📦 **Checklist khi migrate sang Production**

- [ ] Tạo AWS S3 bucket với versioning enabled
- [ ] Cấu hình CORS cho bucket
- [ ] Tạo IAM user với policy S3 access
- [ ] Update environment variables (.env.production)
- [ ] Chạy migration script để copy files từ MinIO → S3
- [ ] Test upload/download với S3
- [ ] Update `USE_S3=true` trong production
- [ ] Monitor S3 costs với AWS Cost Explorer
- [ ] Cấu hình S3 Lifecycle Policy (optional - archive old files to Glacier)

---

### ✅ **Khuyến nghị triển khai:**

**Phase 2 (Development - Bây giờ):**
```bash
# Chạy Redis, MinIO, Celery trong Docker
docker compose up -d redis minio celery-worker

# Truy cập MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin123

# Truy cập Flower (Celery monitoring): http://localhost:5555
```

**Phase 3 (Production - Khi sẵn sàng):**
```bash
# 1. Tạo AWS S3 bucket
# 2. Chạy migration script
# 3. Update .env.production với USE_S3=true
# 4. Deploy với docker-compose.prod.yml
docker compose -f docker-compose.prod.yml up -d
```

**Lợi ích:**
- ✅ Code không đổi (cùng boto3 S3 API)
- ✅ Test kỹ với MinIO trước khi production
- ✅ Không bị vendor lock-in
- ✅ Dễ rollback nếu cần
- ✅ Chi phí tối ưu (free khi dev, chỉ trả phí khi production)

---

## 4. Hướng dẫn cài đặt

### 4.1 Cài đặt nhanh (Development)

**Bước 1: Thêm dependencies**
```bash
cd backend

# Thêm vào requirements.txt
echo "redis>=5.0.0" >> requirements.txt
echo "celery>=5.3.0" >> requirements.txt
echo "flower>=2.0.0" >> requirements.txt
echo "boto3>=1.34.0" >> requirements.txt

# Cài đặt
pip install -r requirements.txt
```

**Bước 2: Cập nhật docker-compose.yml**
```yaml
# Thêm vào docker-compose.yml
services:
  redis:
    image: redis:7-alpine
    container_name: any2-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    command: redis-server --appendonly yes

  minio:
    image: minio/minio:latest
    container_name: any2-minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin123}
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped

  celery-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: any2-celery-worker
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4 --pool=solo
    environment:
      REDIS_URL: redis://redis:6379/0
      MONGO_URI: ${MONGO_URI:-mongodb://mongo:27017}
      MONGO_DB_NAME: ${MONGO_DB_NAME:-ai_learning_platform}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      GROQ_API_KEY: ${GROQ_API_KEY}
    volumes:
      - ./backend:/app
      - backend_storage:/app/storage
    depends_on:
      - redis
      - mongo
    restart: unless-stopped

  celery-flower:
    build: ./backend
    container_name: any2-flower
    command: celery -A app.tasks.celery_app flower --port=5555
    ports:
      - "5555:5555"
    environment:
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - redis
    restart: unless-stopped

volumes:
  redis_data:
  minio_data:
```

**Bước 3: Cập nhật .env**
```bash
# .env.example

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO (Development)
MINIO_ENDPOINT=http://localhost:9000
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin123
MINIO_BUCKET=ai-learning-storage

# AWS S3 (Production - để trống khi dev)
USE_S3=false
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

**Bước 4: Chạy services**
```bash
# Build và chạy
docker compose up -d --build

# Kiểm tra status
docker compose ps

# Xem logs
docker compose logs -f redis
docker compose logs -f minio
docker compose logs -f celery-worker
```

### 4.2 Truy cập các services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Redis** | localhost:6379 | No password (dev) |
| **MinIO API** | http://localhost:9000 | minioadmin / minioadmin123 |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin123 |
| **Flower (Celery)** | http://localhost:5555 | No auth (dev) |

### 4.3 Chạy local (không dùng Docker)

**Redis:**
```bash
# Windows (cần cài Redis trước)
redis-server

# Hoặc dùng Docker
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**MinIO:**
```bash
# Download MinIO binary
# https://min.io/download

# Chạy MinIO
minio server ./minio_data --console-address ":9001"
```

**Celery Worker:**
```bash
cd backend
celery -A app.tasks.celery_app worker --loglevel=info --pool=solo
```

---

## 5. Lộ trình phát triển

### 5.1 Phase 1: MVP (Hiện tại) ✅

**Mục tiêu:** Hoàn thiện tính năng core, ổn định

| Task | Priority | Status |
|------|----------|--------|
| Chatbot RAG | P0 | ✅ Done |
| Slide generation | P0 | ✅ Done |
| Podcast generation | P0 | ✅ Done |
| Minigame generation | P0 | ✅ Done |
| Speech-to-Text | P1 | ✅ Done |
| Web Search integration | P1 | ✅ Done |
| CI/CD pipeline | P1 | ✅ Done |

### 5.2 Phase 2: Production Ready (Q2 2026)

**Mục tiêu:** Thêm Redis, Celery, MinIO - Sẵn sàng scale

| Task | Priority | Estimated Effort | Status |
|------|----------|------------------|--------|
| **Redis integration** | P0 | 2 days | ⏳ Pending |
| **Celery worker setup** | P0 | 3 days | ⏳ Pending |
| **MinIO integration** | P0 | 2 days | ⏳ Pending |
| **Storage abstraction layer** | P0 | 1 day | ⏳ Pending |
| **Update existing services** | P1 | 3 days | ⏳ Pending |
| **Testing & debugging** | P1 | 2 days | ⏳ Pending |

**Tổng thời gian ước tính:** 2-3 tuần

### 5.3 Phase 3: AWS S3 Migration (Khi cần production)

**Mục tiêu:** Migrate từ MinIO sang AWS S3

| Task | Priority | Estimated Effort |
|------|----------|------------------|
| Create AWS S3 bucket | P0 | 1 hour |
| Configure IAM & CORS | P0 | 1 hour |
| Run migration script | P0 | 2-4 hours (tùy data) |
| Update environment | P0 | 1 hour |
| Testing | P1 | 1 day |

**Tổng thời gian ước tính:** 1-2 ngày

---

## 6. Kiến trúc cuối cùng

### 6.1 Development (với MinIO)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│   MongoDB   │
│  (Next.js)  │     │  (FastAPI)  │     │  (Atlas)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Redis     │◀──────┐
                    │  (Cache +   │       │
                    │   Broker)   │       │
                    └─────────────┘       │
                           │              │
                           ▼              │
                    ┌─────────────┐       │
                    │   Celery    │───────┘
                    │   Worker    │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  ChromaDB   │     │    MinIO    │
                    │  (Vector)   │     │  (Storage)  │
                    └─────────────┘     └─────────────┘
```

### 6.2 Production (với AWS S3)

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend   │────▶│   MongoDB   │
│  (Next.js)  │     │  (FastAPI)  │     │  (Atlas)    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   Redis     │◀──────┐
                    │  (ElastiCache)      │
                    └─────────────┘       │
                           │              │
                           ▼              │
                    ┌─────────────┐       │
                    │   Celery    │───────┘
                    │   Workers   │
                    └─────────────┘
                           │
                           ▼
                    ┌─────────────┐     ┌─────────────┐
                    │  ChromaDB   │     │  AWS S3     │
                    │  (Vector)   │     │  (Storage)  │
                    └─────────────┘     └─────────────┘
```

---

## 📚 Tài liệu tham khảo

- [Redis Documentation](https://redis.io/docs/)
- [Celery Documentation](https://docs.celeryq.dev/)
- [MinIO Documentation](https://min.io/docs/minio/linux/index.html)
- [boto3 Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/index.html)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/latest/userguide/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)

---

## 👥 Đóng góp

Nếu bạn có đề xuất cải tiến, vui lòng tạo PR hoặc issue trên GitHub.

**Repository:** https://github.com/Kietnehi/AI-FOR-EDUCATION

---

*Generated with ❤️ for AI For Education Project*
