# Nền tảng AI Tạo Học Liệu Số (MVP)

Đây là dự án MVP theo hướng production-ready, ưu tiên chạy được local nhanh, cấu trúc rõ ràng và dễ mở rộng.

Hệ thống hỗ trợ:
- Tạo slide bài giảng `.pptx` bằng `python-pptx`
- Tạo podcast script (đã có sẵn placeholder cho TTS)
- Tạo minigame/bài tập tương tác
- Chatbot hỏi đáp theo RAG dựa trên học liệu đã tải lên

Lưu ý vận hành hiện tại:
- MongoDB sử dụng MongoDB Atlas qua `MONGO_URI`.

## 1. Công nghệ sử dụng

- Frontend: Next.js 14 + React 18
- Backend API: FastAPI + Python
- Cơ sở dữ liệu nghiệp vụ: MongoDB
- Vector database: ChromaDB (persistent local)
- AI pipeline: Python
- Embedding model: `openai/text-embedding-3-small` (biến môi trường `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`)

## 2. Kiến trúc tổng thể

### 2.1 Thành phần
- `frontend/`: giao diện dashboard, upload, trang chi tiết tài liệu, trang slides, podcast, minigame, chatbot
- `backend/`: REST API, business logic, ingestion pipeline, RAG pipeline
- MongoDB: lưu metadata tài liệu, chunks, nội dung tạo sinh, session chat, attempt game
- ChromaDB: lưu vector embeddings để truy vấn ngữ nghĩa
- OpenAI: dùng cho embedding và generation (nếu có API key)

### 2.2 Luồng xử lý chính
1. Người dùng nhập hoặc tải file học liệu (PDF/DOCX/TXT/MD).
2. Backend đọc và trích xuất text.
3. Làm sạch nội dung.
4. Chia nhỏ (chunking).
5. Tạo embeddings cho từng chunk.
6. Lưu vector vào ChromaDB.
7. Lưu metadata/chunk vào MongoDB.
8. Dùng retrieval theo query.
9. Dùng context truy xuất để:
   - Tạo slide
   - Tạo podcast script
   - Tạo minigame
   - Trả lời chatbot có citations

## 3. Cấu trúc thư mục

```text
DACN/
├─ backend/
│  ├─ app/
│  │  ├─ ai/
│  │  │  ├─ chatbot/
│  │  │  ├─ chunking/
│  │  │  ├─ embeddings/
│  │  │  ├─ generation/
│  │  │  ├─ ingestion/
│  │  │  ├─ parsing/
│  │  │  ├─ retrieval/
│  │  │  └─ vector_store/
│  │  ├─ api/
│  │  │  └─ routes/
│  │  ├─ core/
│  │  ├─ db/
│  │  ├─ models/
│  │  ├─ repositories/
│  │  ├─ schemas/
│  │  ├─ services/
│  │  ├─ utils/
│  │  └─ main.py
│  ├─ scripts/seed.py
│  ├─ storage/
│  │  ├─ generated/
│  │  └─ uploads/
│  ├─ requirements.txt
│  └─ .env.example
├─ frontend/
│  ├─ app/
│  │  ├─ materials/
│  │  │  ├─ upload/
│  │  │  └─ [id]/(chat|minigame|podcast|slides)
│  │  ├─ globals.css
│  │  ├─ layout.tsx
│  │  └─ page.tsx
│  ├─ components/
│  ├─ lib/
│  ├─ types/
│  ├─ package.json
│  └─ .env.example
├─ .env.example
└─ README.md
```

## 4. Thiết kế dữ liệu MongoDB

Các collection chính:
- `users`
- `learning_materials`
- `material_chunks`
- `generated_contents`
- `chatbot_sessions`
- `chatbot_messages`
- `game_attempts`

Collection mở rộng:
- `processing_jobs`
- `file_assets`
- `audio_assets`
- `slide_assets`
- `analytics_events`

Index quan trọng đã được tạo trong backend tại `app/db/mongo.py`.

## 5. API chính (MVP)

### 5.1 Materials
- `POST /api/materials`
- `POST /api/materials/upload`
- `GET /api/materials`
- `GET /api/materials/{id}`
- `POST /api/materials/{id}/process`

### 5.2 Generation
- `POST /api/materials/{id}/generate/slides`
- `POST /api/materials/{id}/generate/podcast`
- `POST /api/materials/{id}/generate/minigame`
- `GET /api/generated-contents/{id}`

### 5.3 Files
- `GET /api/files/{file_name}/download`

### 5.4 Chat
- `POST /api/chat/{material_id}/session`
- `GET /api/chat/sessions/{session_id}`
- `POST /api/chat/sessions/{session_id}/message`

### 5.5 Games
- `POST /api/games/{generated_content_id}/submit`
- `GET /api/games/attempts/{id}`

## 6. Hướng dẫn chạy local chi tiết

## 6.1 Yêu cầu trước khi chạy

- Windows 10/11 hoặc Linux/macOS
- Tài khoản MongoDB Atlas (cluster đã tạo sẵn)
- Python 3.11+
- Node.js 20+ và npm

Kiểm tra nhanh:

```powershell
py --version
node -v
npm -v
```

## 6.2 Bước 1: Chuẩn bị MongoDB Atlas

Tạo và cấu hình trên Atlas:

1. Tạo cluster (M0/M2/M5 đều được cho MVP).
2. Tạo Database User (username/password).
3. Vào Network Access và thêm IP hiện tại (hoặc `0.0.0.0/0` cho môi trường dev, không khuyến nghị cho production).
4. Lấy connection string dạng SRV.

Ví dụ:

```text
mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=<app-name>
```

## 6.3 Bước 2: Cấu hình biến môi trường

### Backend

```powershell
cd backend
copy .env.example .env
```

Mở file `.env` và cập nhật tối thiểu:
- `MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=<app-name>`
- `MONGO_DB_NAME=ai_learning_platform`
- `OPENAI_API_KEY=`

Lưu ý:
- Nếu bỏ trống `OPENAI_API_KEY`, hệ thống vẫn chạy bằng fallback để demo luồng.
- Để dùng OpenAI thật, điền API key hợp lệ.
- Nếu password MongoDB có ký tự đặc biệt (ví dụ `@`, `#`, `%`), cần URL-encode trong `MONGO_URI`.

### Frontend

```powershell
cd ..\frontend
copy .env.example .env.local
```

Mặc định đã đúng local:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_API_HOST=http://localhost:8000`

## 6.4 Bước 3: Cài dependencies và chạy backend

```powershell
cd ..\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Khi backend chạy thành công:
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

Kiểm tra backend bằng PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

## 6.5 Bước 4: Cài dependencies và chạy frontend

Mở terminal mới:

```powershell
cd d:\DACN\frontend
npm install
npm run dev
```

Frontend chạy tại:
- `http://localhost:3000`

## 6.6 Bước 5: Seed dữ liệu mẫu (tuỳ chọn)

```powershell
cd d:\DACN\backend
py -m scripts.seed
```

## 6.7 Quy trình test thủ công nhanh

1. Vào `http://localhost:3000`.
2. Chọn Upload, tạo một học liệu (bằng file hoặc text).
3. Mở trang chi tiết material, bấm Process Material.
4. Tạo lần lượt Slides, Podcast, Minigame.
5. Mở trang Chatbot và hỏi câu hỏi theo nội dung vừa tải lên.

## 6.8 Tóm tắt chạy nhanh (copy-paste)

Terminal 1 (backend):

```powershell
cd d:\DACN\backend
copy .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Terminal 2 (frontend):

```powershell
cd d:\DACN\frontend
copy .env.example .env.local
npm install
npm run dev
```

## 7. Ví dụ gọi API bằng PowerShell

### 7.1 Tạo material từ text

```powershell
$body = @{
  title = "Bài học Sinh học"
  description = "Giới thiệu ADN"
  subject = "Biology"
  education_level = "High School"
  tags = @("biology", "dna")
  source_type = "manual_text"
  raw_text = "ADN là vật chất di truyền..."
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:8000/api/materials" -Method Post -ContentType "application/json" -Body $body
```

### 7.2 Process material

```powershell
$processBody = @{ force_reprocess = $false } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/materials/{material_id}/process" -Method Post -ContentType "application/json" -Body $processBody
```

### 7.3 Tạo slides

```powershell
$slidesBody = @{ tone = "teacher"; max_slides = 8 } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/materials/{material_id}/generate/slides" -Method Post -ContentType "application/json" -Body $slidesBody
```

## 8. Trạng thái MVP hiện tại

Đã hỗ trợ:
- Upload/nhập học liệu
- Xử lý tài liệu và lưu MongoDB + ChromaDB
- Tạo file slides `.pptx`
- Tạo podcast script
- Tạo minigame JSON và render trên frontend
- Chatbot RAG theo học liệu

Chưa triển khai đầy đủ production:
- Xác thực/ủy quyền người dùng
- Hàng đợi tác vụ chuyên dụng (Celery/RQ)
- Giám sát nâng cao (metrics/tracing)

## 9. Troubleshooting

### Lỗi không có lệnh `python`
Trên Windows, dùng `py` thay cho `python`.

### Lỗi kết nối MongoDB Atlas
- Kiểm tra lại username/password trong connection string SRV.
- Kiểm tra Network Access trên Atlas đã allow IP hiện tại chưa.
- Kiểm tra biến `MONGO_URI` trong `backend/.env` đã đúng format chưa.

### Lỗi frontend không gọi được backend
- Kiểm tra backend có đang chạy cổng `8000`.
- Kiểm tra `frontend/.env.local` có đúng `NEXT_PUBLIC_API_BASE_URL`.

### Không có OpenAI API key
- Hệ thống vẫn chạy demo với fallback.
- Muốn kết quả AI thật, cần điền `OPENAI_API_KEY` hợp lệ.

## 10. Tài liệu liên quan trong dự án

- Backend env mẫu: `backend/.env.example`
- Frontend env mẫu: `frontend/.env.example`
- Seed script: `backend/scripts/seed.py`
- API entrypoint: `backend/app/main.py`

---

Nếu bạn muốn, bước tiếp theo có thể bổ sung thêm một phần trong README: sơ đồ sequence chi tiết từ Upload đến Chatbot (dạng Mermaid) để nhóm dev mới onboard nhanh hơn.
