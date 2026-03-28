<div align="center">

  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=150&section=header&text=AI%20Learning%20Studio&fontSize=40&fontAlignY=35&animation=twinkling&fontColor=ffffff" width="100%" alt="Header"/>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION">
    <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&weight=600&size=22&pause=1000&color=3B82F6&center=true&vCenter=true&width=600&lines=🚀+Nền+tảng+AI+Tạo+Học+Liệu+Số;🤖+Multimodal+RAG+%7C+FastAPI+%7C+Next.js;🎓+Dự+án+AI+For+Education+-+SGU" alt="Typing SVG" />
  </a>

  <br/><br/>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/stargazers">
    <img src="https://img.shields.io/github/stars/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=FFD700&logo=github&logoColor=black&label=Stars" alt="Stars"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/network/members">
    <img src="https://img.shields.io/github/forks/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=FF8C00&logo=github&logoColor=white&label=Forks" alt="Forks"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/issues">
    <img src="https://img.shields.io/github/issues/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=FF4D4D&logo=github&logoColor=white&label=Issues" alt="Issues"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/pulls">
    <img src="https://img.shields.io/github/issues-pr/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=00E676&logo=github&logoColor=white&label=Pull%20Requests" alt="Pull Requests"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=0088FF&logo=github&logoColor=white&label=License" alt="License"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/actions/workflows/project-ci.yml">
    <img src="https://github.com/Kietnehi/AI-FOR-EDUCATION/actions/workflows/project-ci.yml/badge.svg" alt="CI Dự Án"/>
  </a>

  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION/actions/workflows/project-cd.yml">
    <img src="https://github.com/Kietnehi/AI-FOR-EDUCATION/actions/workflows/project-cd.yml/badge.svg" alt="CD Dự Án"/>
  </a>

  <br/><br/>

  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=nextjs,react,tailwind,ts,python,fastapi,mongodb,docker" alt="Tech Stack"/>
  </a>

  <br/><br/>

  <img src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/openai.svg" alt="OpenAI" height="48"/>&nbsp;&nbsp;&nbsp;
  <img src="https://commons.wikimedia.org/wiki/Special:FilePath/Google-gemini-icon.png" alt="Gemini" height="48"/>

  <br/><br/>

</div>

![AI Learning Studio Pipeline](image/pipeline.png)

# 🎓 AI Learning Studio — Nền tảng AI Tạo Học Liệu Số

**Nền tảng MVP production-ready giúp giáo viên và học sinh tạo nội dung học tập thông minh bằng AI. Chỉ cần tải tài liệu lên, hệ thống sẽ tự động tạo slide, podcast, minigame và chatbot hỏi đáp trong vài phút.**

Đây là hệ thống AI Agent đa phương thức (Multimodal RAG) toàn diện, được thiết kế theo kiến trúc vi dịch vụ (microservices) và triển khai hoàn toàn bằng **Docker**.

Dự án được chia thành 2 luồng xử lý chính:

  * **Chatbot for Student:** Trợ lý ảo hỗ trợ học tập trực tiếp. Hệ thống tự động trích xuất tri thức từ tài liệu (PDF, Word, Excel) và sử dụng các LLM (OpenAI, Gemini) để giải đáp thắc mắc của học sinh một cách chính xác.
  * **AI Worker Service:** Trái tim của hệ thống, xử lý các tác vụ nền tảng phức tạp được điều phối bởi **FastAPI** và quản lý trạng thái qua **MongoDB**. Phân hệ này có khả năng xử lý đầu vào đa phương thức (nhận diện giọng nói bằng Whisper, đọc ảnh bằng OCR), kết hợp tìm kiếm web (Tavily) để tự động hóa việc tạo ra các học liệu trực quan như: Slide bài giảng, Video, Infographic, âm thanh (TTS) và tự động chấm điểm (SCORE).

**🛠 Công nghệ cốt lõi:** FastAPI, Node.js, MongoDB, Hệ sinh thái Vector DB (Chroma, Pinecone, Milvus), và đa dạng mô hình AI (LLM, Hugging Face).
## Tính năng chính

- 📊 **Tạo slide bài giảng** `.pptx` tự động bằng `python-pptx`
- 🎙️ **Tạo podcast script** với cấu trúc speaker/timeline (có placeholder cho TTS)
- 🎮 **Tạo minigame/quiz** tương tác (trắc nghiệm, điền từ, flashcard, ghép cặp)
- 🤖 **Chatbot RAG** hỏi đáp theo học liệu với citations từ nguồn gốc
- 🌐 **Web Search cho Chatbot RAG**: hỗ trợ hỏi đáp bằng dữ liệu web mới nhất, có thể ưu tiên Google Search grounding hoặc Tavily Search và hiển thị danh sách nguồn tham khảo
- 🧭 **Web Search cho Mascot**: mascot có thể bật chế độ tìm kiếm web để trả lời các câu hỏi thời sự/ngoài tài liệu, với cơ chế fallback về chat thường khi search gặp lỗi
- 🎤 **Speech-to-Text cho Chatbot**: ghi âm bằng mic và chuyển giọng nói thành chữ
  - Local: `openai-whisper` model `base`
  - Cloud: Groq `whisper-large-v3` hoặc `whisper-large-v3-turbo`
- 🔊 **Text-to-Speech**: chuyển văn bản thành giọng nói tiếng Việt
- 🌙 **Dark mode** hoàn chỉnh
- 📱 **Responsive** trên mọi kích thước màn hình

> **Lưu ý:** MongoDB sử dụng MongoDB Atlas qua `MONGO_URI`

---

## 1. Công nghệ sử dụng

### Frontend

| Công nghệ | Mô tả |
|-----------|-------|
| Next.js 14 | App Router, Server/Client Components |
| React 18 | UI rendering |
| TailwindCSS v4 | Utility-first CSS framework |
| Framer Motion | Micro-interactions & animations |
| Lucide React | Icon system (outline style) |

### Backend

| Công nghệ | Mô tả |
|-----------|-------|
| FastAPI | REST API framework |
| Python 3.11+ | AI pipeline & business logic |
| MongoDB Atlas | Cơ sở dữ liệu nghiệp vụ |
| ChromaDB | Vector database (persistent local) |
| OpenAI API | Embedding (`text-embedding-3-small`) & generation |
| OpenAI Whisper (local) | Speech-to-Text local model `base` |
| Groq API | Speech-to-Text cloud (`whisper-large-v3`, `whisper-large-v3-turbo`) |
| FFmpeg | Tiền xử lý audio cho Whisper |
| python-pptx | Tạo file PowerPoint tự động |

---

## 2. Kiến trúc tổng thể

### 2.1 Thành phần

- `frontend/` — Giao diện AI Learning Studio (dashboard, upload, materials, slides, podcast, minigame, chatbot)
- `backend/` — REST API, business logic, ingestion pipeline, RAG pipeline
- MongoDB — Lưu metadata tài liệu, chunks, nội dung tạo sinh, session chat, attempt game
- ChromaDB — Lưu vector embeddings để truy vấn ngữ nghĩa
- OpenAI — Dùng cho embedding và generation (nếu có API key)
- Whisper/Groq — Dùng cho Speech-to-Text khi người dùng ghi âm trong chatbot

### 2.2 Luồng xử lý chính

```mermaid
flowchart LR
    A[Upload tài liệu] --> B[Trích xuất text]
    B --> C[Làm sạch & Chunking]
    C --> D[Tạo Embeddings]
    D --> E[Lưu ChromaDB + MongoDB]
    E --> F{Tạo nội dung}
    F --> G[📊 Slides]
    F --> H[🎙️ Podcast]
    F --> I[🎮 Minigame]
    F --> J[🤖 Chatbot RAG]
```

1. Người dùng nhập hoặc tải file học liệu (PDF/DOCX/TXT/MD).
2. Backend đọc và trích xuất text.
3. Làm sạch nội dung.
4. Chia nhỏ (chunking).
5. Tạo embeddings cho từng chunk.
6. Lưu vector vào ChromaDB.
7. Lưu metadata/chunk vào MongoDB.
8. Dùng retrieval theo query.
9. Dùng context truy xuất để tạo slide, podcast script, minigame, trả lời chatbot có citations.

---

## 3. Cấu trúc thư mục

```text
AI-FOR-EDUCATION/
├─ backend/                     ← Mã nguồn Server (FastAPI + AI Pipeline)
│  ├─ app/                      ← Logic ứng dụng chính
│  │  ├─ ai/                    ← Các module xử lý AI (RAG, Chatbot, Embeddings,...)
│  │  │  ├─ chatbot/            ← Điều phối chatbot và logic hội thoại
│  │  │  ├─ chunking/           ← Chia nhỏ tài liệu để xử lý RAG
│  │  │  ├─ embeddings/         ← Chuyển đổi văn bản thành vector
│  │  │  ├─ generation/         ← Tạo nội dung (Slides, Podcast, Minigame,...)
│  │  │  ├─ ingestion/          ← Làm sạch và nạp dữ liệu đầu vào
│  │  │  ├─ parsing/            ← Trích xuất text từ các định dạng file (PDF, Word,...)
│  │  │  ├─ retrieval/          ← Truy xuất thông tin từ Vector DB
│  │  │  └─ vector_store/       ← Quản lý lưu trữ vector (ChromaDB)
│  │  ├─ api/                   ← Định nghĩa các Endpoints REST API
│  │  ├─ core/                  ← Cấu hình hệ thống, biến môi trường, logging
│  │  ├─ db/                    ← Kết nối Database (MongoDB, ChromaDB)
│  │  ├─ models/                ← Định nghĩa Schema Database (Pydantic/Mongo)
│  │  ├─ repositories/          ← Lớp tương tác trực tiếp với Database
│  │  ├─ schemas/               ← Data Transfer Objects (DTO) cho API request/response
│  │  ├─ services/              ← Business logic xử lý yêu cầu nghiệp vụ
│  │  ├─ utils/                 ← Các hàm tiện ích dùng chung
│  │  └─ main.py                ← File chạy chính của FastAPI
│  ├─ storage/                  ← Thư mục lưu trữ dữ liệu cục bộ
│  │  ├─ chroma/                ← Cơ sở dữ liệu Vector (Persistent)
│  │  ├─ extracted/             ← Dữ liệu text trích xuất từ file
│  │  ├─ generated/             ← Sản phẩm AI tạo ra (Slides, Audio,...)
│  │  ├─ images/                ← Hình ảnh trích xuất từ tài liệu
│  │  ├─ notebooklm/            ← File tạm xử lý cho NotebookLM
│  │  ├─ outputs/               ← Kết quả xử lý tổng hợp
│  │  └─ uploads/               ← Tài liệu người dùng tải lên
│  ├─ tests/                    ← Unit tests và Integration tests backend
│  ├─ Dockerfile                ← Docker cấu hình cho backend
│  ├─ requirements.txt          ← Danh sách thư viện Python
│  └─ .env.example              ← Mẫu file biến môi trường backend
├─ frontend/                    ← Mã nguồn Giao diện (Next.js + TailwindCSS)
│  ├─ app/                      ← Các trang và Layout (Next.js App Router)
│  │  ├─ chatbot/               ← Giao diện chat hỏi đáp
│  │  ├─ converter/             ← Công cụ chuyển đổi định dạng
│  │  ├─ generated/             ← Quản lý các nội dung đã tạo
│  │  ├─ materials/             ← Quản lý và xem chi tiết học liệu
│  │  ├─ globals.css            ← Cấu hình Tailwind v4 và styles toàn cục
│  │  ├─ layout.tsx             ← Cấu trúc khung trang chính
│  │  └─ page.tsx               ← Trang chủ Dashboard
│  ├─ components/               ← Các thành phần UI dùng chung
│  │  ├─ 3d/                    ← Các hiệu ứng 3D (nếu có)
│  │  ├─ converter/             ← UI cho phần converter
│  │  ├─ layout/                ← Sidebar, Topbar, AppShell
│  │  ├─ minigame/              ← Các component trò chơi tương tác
│  │  ├─ ui/                    ← Các UI nguyên tử (Button, Card, Toast,...)
│  ├─ lib/                      ← Thư viện hỗ trợ, API Client, utils frontend
│  ├─ public/                   ← Tài nguyên tĩnh (Logo, Icons, Fonts)
│  ├─ test/                     ← Kiểm thử frontend (Unit/Integration)
│  ├─ types/                    ← Định nghĩa kiểu dữ liệu TypeScript
│  ├─ Dockerfile                ← Docker cấu hình cho frontend
│  ├─ package.json              ← Quản lý thư viện Node.js
│  └─ .env.example              ← Mẫu file biến môi trường frontend
├─ Document_PRD/                ← Tài liệu đặc tả yêu cầu và thiết kế dự án
├─ image/                       ← Ảnh minh họa cho README và hệ thống
├─ markdown_docs/               ← Các tài liệu hướng dẫn chi tiết (.md)
├─ TESTING_CODE/                ← Code test mẫu và tài liệu API bên thứ 3
├─ docker-compose.yml           ← Cấu hình triển khai toàn bộ hệ thống bằng Docker
├─ README.md                    ← Hướng dẫn dự án chính
└─ .env.example                 ← Mẫu file môi trường tổng cho Docker
```

---

## 4. API chính (MVP)

> **API Documentation:** [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)

<p align="center">
<table style="margin: 0 auto;">
  <tr>
    <td align="center" style="padding:8px;">
      <img src="image/docs_8000.png" alt="Swagger UI" width="540" style="border:1px solid #e6e6e6; border-radius:6px;" />
      <div style="margin-top:8px; font-weight:600;">Swagger UI — <a href="http://localhost:8000/docs">/docs</a></div>
    </td>
    <td align="center" style="padding:8px;">
      <img src="image/health_8000.png" alt="Health Check" width="260" style="border:1px solid #e6e6e6; border-radius:6px;" />
      <div style="margin-top:8px; font-weight:600;">Health Check — <a href="http://localhost:8000/health">/health</a></div>
    </td>
  </tr>
</table>
</p>

### 4.1 Materials
- `POST /api/materials` — Tạo học liệu từ text
- `POST /api/materials/upload` — Tạo học liệu từ file upload
- `GET /api/materials` — Danh sách học liệu (có pagination)
- `GET /api/materials/{material_id}` — Chi tiết học liệu
- `POST /api/materials/{material_id}/process` — Xử lý tài liệu (extract, chunk, embedding)
- `DELETE /api/materials/{material_id}` — Xóa học liệu
- `POST /api/materials/guardrail-check` — Kiểm tra nội dung học liệu (guardrail)
- `POST /api/materials/guardrail-check-upload` — Kiểm tra nội dung từ file upload

### 4.2 Generation
- `POST /api/materials/{material_id}/generate/slides` — Tạo slides `.pptx`
- `POST /api/materials/{material_id}/generate/podcast` — Tạo podcast script
- `POST /api/materials/{material_id}/generate/minigame` — Tạo minigame/quiz
- `GET /api/generated-contents/{content_id}` — Lấy nội dung đã tạo
- `POST /api/notebooklm/generate-media` — Tạo video + infographic với NotebookLM (2 bước: confirm → download)

### 4.3 Files
- `GET /api/files/{file_path}/download` — Download file (hỗ trợ đường dẫn tuyệt đối)
- `GET /api/files/notebooklm/temp/{session_id}/{file_type}/{file_name}/preview` — Xem trước file tạm từ NotebookLM (video/infographic)

### 4.4 Chat
- `POST /api/chat/{material_id}/session` — Tạo session chat mới
- `GET /api/chat/sessions/{session_id}` — Lấy session + tin nhắn
- `POST /api/chat/sessions/{session_id}/message` — Gửi tin nhắn (có hỗ trợ ảnh)
- `POST /api/chat/sessions/{session_id}/web-search` — Web search cho chatbot theo tài liệu
- `POST /api/chat/mascot/message` — Chat với mascot (không dùng RAG)
- `POST /api/chat/transcribe` — Chuyển audio thành text (hỗ trợ `local-base`, `whisper-large-v3`, `whisper-large-v3-turbo`)
- `POST /api/chat/tts` — Chuyển text thành audio (Text-to-Speech)

### 4.5 Games
- `POST /api/games/{generated_content_id}/submit` — Nộp bài làm minigame
- `GET /api/games/attempts/{attempt_id}` — Xem kết quả bài làm

---


## 🚀 Chạy toàn bộ hệ thống bằng Docker Compose

Dự án đã được cấu hình đầy đủ Docker cho các service:

* `frontend`
* `backend`
* `mongo`



## 📁 Các file liên quan

* `docker-compose.yml`
* `backend/Dockerfile`
* `frontend/Dockerfile`
* `.env.docker.example`


## ⚙️ Hướng dẫn chạy nhanh

### 1. Tạo file môi trường

```bash
cp .env.docker.example .env
```

---

### 2. Cấu hình biến môi trường

Mở file `.env` và điền các API key cần thiết, ví dụ:

* OpenAI
* Gemini
* Groq
  *(tùy theo nhu cầu sử dụng của bạn)*


### 3. Build và chạy toàn bộ hệ thống

```bash
docker compose up -d --build
```



### 4. Truy cập hệ thống

* 🌐 Frontend: [http://localhost:3000](http://localhost:3000)
* 🔧 Backend API: [http://localhost:8000](http://localhost:8000)
* 📄 Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)


### 5. Dừng hệ thống

```bash
docker compose down
```

---

### 🧹 Xóa toàn bộ dữ liệu (bao gồm MongoDB + volume)

```bash
docker compose down -v
```

---

Nếu bạn muốn, mình có thể:

* Viết thêm phần **troubleshooting (lỗi hay gặp Docker)**
* Hoặc tối ưu luôn file `docker-compose.yml` cho production 🚀


---

## 5. Hướng dẫn chạy local chi tiết

### 5.1 Yêu cầu trước khi chạy

- Windows 10/11 hoặc Linux/macOS
- Tài khoản MongoDB Atlas (cluster đã tạo sẵn)
- Python 3.11+
- Node.js 20+ và npm
- FFmpeg (bắt buộc cho local Whisper)

Kiểm tra nhanh:

```powershell
py --version
node -v
npm -v
```

### 5.2 Bước 1: Chuẩn bị MongoDB Atlas

Tạo và cấu hình trên Atlas:

1. Tạo cluster (M0/M2/M5 đều được cho MVP).
2. Tạo Database User (username/password).
3. Vào Network Access và thêm IP hiện tại (hoặc `0.0.0.0/0` cho môi trường dev, không khuyến nghị cho production).
4. Lấy connection string dạng SRV.

Ví dụ:

```text
mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=<app-name>
```

### 5.3 Bước 2: Cấu hình biến môi trường

#### Backend

```powershell
cd backend
copy .env.example .env
```

Mở file `.env` và cập nhật tối thiểu:
- `MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/?retryWrites=true&w=majority&appName=<app-name>`
- `MONGO_DB_NAME=ai_learning_platform`
- `OPENAI_API_KEY=` (có thể để trống nếu chỉ dùng Gemini, nhưng cần để fallback)

**Lưu ý về Gemini API keys:**
- **Nếu muốn dùng nhiều Gemini keys** (để tránh rate limit): điền `GEMINI_API_KEYS` với các keys phân cách bằng dấu phẩy (ví dụ: `key1,key2,key3`). Hệ thống sẽ thử lần lượt từng key.
- **Nếu chỉ có 1 Gemini key**: điền `GEMINI_API_KEY` là đủ. Có thể để `GEMINI_API_KEYS` trống.
- **Ưu tiên**: `GEMINI_API_KEYS` sẽ được dùng trước. Nếu `GEMINI_API_KEYS` rỗng, hệ thống dùng `GEMINI_API_KEY`.
- **Không cần điền cả hai**. Chọn một trong hai để tránh nhầm lẫn.
- **Fallback**: Khi tất cả Gemini keys đều thất bại, hệ thống sẽ tự động dùng OpenAI (nếu `OPENAI_API_KEY` có sẵn).
- **Backup**: Bạn nên có ít nhất 2 Gemini keys để đảm bảo tính sẵn sàng cao.

Biến môi trường cho Speech-to-Text:
- `WHISPER_MODEL=base`
- `WHISPER_LANGUAGE=` (để trống để auto detect)
- `GROQ_API_KEY=` (điền khi dùng Groq model)
- `GROQ_BASE_URL=https://api.groq.com`

Lưu ý:
- Nếu bỏ trống `OPENAI_API_KEY`, hệ thống vẫn chạy bằng fallback để demo luồng.
- Muốn kết quả AI thật, cần điền `OPENAI_API_KEY` hợp lệ.
- **Hệ thống hỗ trợ nhiều Gemini API keys qua `GEMINI_API_KEYS` (comma-separated)**. Keys sẽ được dùng xoay vòng. Nếu `GEMINI_API_KEYS` không có, hệ thống dùng `GEMINI_API_KEY` đơn (backward compatibility). Khi tất cả Gemini keys fail, sẽ fallback sang OpenAI (nếu có).
- Nếu password MongoDB có ký tự đặc biệt (ví dụ `@`, `#`, `%`), cần URL-encode trong `MONGO_URI`.
- Nếu dùng model Groq cho Speech-to-Text, bắt buộc điền `GROQ_API_KEY`.

#### Frontend

```powershell
cd ..\frontend
copy .env.example .env.local
```

Mặc định đã đúng local:
- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api`
- `NEXT_PUBLIC_API_HOST=http://localhost:8000`

### 5.4 Bước 3: Cài dependencies và chạy backend

**Cách 1 (khuyên dùng - đơn giản):**
```powershell
cd ..\backend
pip install -r requirements.txt
python run.py
```

**Cách 2 (lệnh đầy đủ):**
```powershell
cd ..\backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Cài FFmpeg (Windows) nếu chưa có:

```powershell
choco install ffmpeg
```

Khi backend chạy thành công:
- API: `http://localhost:8000`
- Swagger: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health`

Kiểm tra backend bằng PowerShell:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get
```

### 5.5 Bước 4: Cài dependencies và chạy frontend

Mở terminal mới:

```powershell
cd d:\DACN\frontend
npm install
npm run dev
```

Frontend chạy tại: `http://localhost:3000`

### 5.6 Tóm tắt chạy nhanh (copy-paste)

Terminal 1 (backend) - **Cách 1 (đơn giản):**

```powershell
cd d:\DACN\backend
copy .env.example .env
pip install -r requirements.txt
python run.py
```

Hoặc **Cách 2 (lệnh đầy đủ):**

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

---

## 6. CI / CD

Hiện tại dự án có **CI đầy đủ**, và **CD bán thực tế**: đã build artifact, publish Docker image lên GHCR, nhưng **chưa deploy lên server thật**. Bước triển khai hiện vẫn là `deploy-placeholder` để tổng hợp metadata và báo cáo phát hành.

- Workflow CI: `.github/workflows/project-ci.yml`
- Workflow CD: `.github/workflows/project-cd.yml`
- CI trigger: `push` và `pull_request` khi thay đổi ở `frontend/`, `backend/`, `docker-compose.yml`, `docker-compose.ci.yml`, `.env.docker.example`, `project-ci.yml`, `project-cd.yml`
- CD trigger: `workflow_dispatch`, hoặc `workflow_run` sau khi `CI Dự Án` thành công trên `main` hoặc `kiet`
- Flow hiện tại:
  `CI` pass -> `CD Dự Án` tạo metadata -> build frontend artifact -> package backend artifact -> resolve Docker bundle -> publish image frontend/backend lên GHCR -> tạo `deploy-placeholder` -> gộp `full-release-bundle`
- Frontend CI: `npm ci` -> `npm run lint` -> `npx vitest run --coverage --reporter=json`
- Backend CI: `pip install -r requirements-test.txt` -> `pytest --junitxml=junit.xml`
- Docker CI: `docker compose -f docker-compose.ci.yml up -d --build`, chờ `/health` của backend và HTTP response của frontend, rồi `down -v`
- Khi CI fail trên sự kiện `push`, workflow sẽ tự tạo hoặc cập nhật GitHub Issue
- Nếu CD fail, workflow CD cũng sẽ tự tạo hoặc cập nhật GitHub Issue
- GHCR login hiện dùng secret cố định `GHCR_TOKEN`
- Docker images được publish lên:
  - `ghcr.io/kietnehi/ai-for-education-backend`
  - `ghcr.io/kietnehi/ai-for-education-frontend`
- Tag image hiện có thể bao gồm:
  - `latest` cho default branch
  - `<sha7>`
  - `<branch>`
- Artifact CD quan trọng nhất: `full-release-bundle-<sha>` trong tab Actions Artifacts của workflow `CD Dự Án`
- Các artifact trung gian:
  `cd-release-metadata`, `frontend-release-bundle-<sha>`, `backend-release-bundle-<sha>`, `docker-release-bundle-<sha>`, `ghcr-images-<sha>`, `deployment-summary-<sha>`
- Tài liệu chi tiết:
  - `markdown_docs/CI_SUMMARY_2026-03-28.md`
  - `markdown_docs/TOM_TAT_CD_2026-03-28.md`

### 6.1 Sơ đồ Pipeline CI/CD

```mermaid
flowchart TD
    subgraph CI["🔄 CI Pipeline - Project CI"]
        A[Push / PR<br/>frontend/, backend/] --> B{CI Trigger}

        B --> C[Frontend Job]
        B --> D[Backend Job]
        B --> E[Docker Compose Smoke]

        C --> C1[Checkout]
        C1 --> C2[Setup Node.js 20]
        C2 --> C3[npm ci]
        C3 --> C4[npm run lint]
        C4 --> C5[npm run test:coverage]
        C5 --> C6[Upload Coverage Artifact]

        D --> D1[Checkout]
        D1 --> D2[Setup Python 3.11]
        D2 --> D3[Install Dependencies]
        D3 --> D4[pytest + coverage]
        D4 --> D5[Upload Coverage Artifact]

        E --> E1[Checkout]
        E1 --> E2[Prepare .env]
        E2 --> E3[docker compose up -d --build]
        E3 --> E4[Backend Health Check<br/>30 iterations x 3s]
        E4 --> E5[Frontend HTTP Check<br/>20 iterations x 3s]
        E5 --> E6[Thu thập ps + logs]
        E6 --> E7[docker compose down]

        C6 --> F{All Jobs Pass?}
        D5 --> F
        E7 --> F
    end

    F -->|Yes ✅| G[Merge to main]
    F -->|No ❌| H[Create/Update GitHub Issue]

    subgraph CD["🚀 CD Pipeline - CD Dự Án"]
        G --> I{CD Trigger}
        I -->|main success| J[Prepare Release]
        I -->|workflow_dispatch| J

        J --> J1[Checkout]
        J1 --> J2[Generate Metadata]
        J2 --> J3[Create Release Notes]
        J3 --> J4[Upload Metadata Artifact]

        J4 --> K[Build Frontend Artifact]
        J4 --> L[Package Backend Artifact]
        J4 --> M[Package Docker Bundle]
        J4 --> P[Publish GHCR Images]

        K --> K1[Checkout + Node.js Setup]
        K1 --> K2[npm ci]
        K2 --> K3[npm run build]
        K3 --> K4[Copy .next, public, package.json]
        K4 --> K5[Upload Frontend Bundle]

        L --> L1[Checkout + Python Setup]
        L1 --> L2[python -m compileall app]
        L2 --> L3[Copy app, requirements.txt]
        L3 --> L4[Upload Backend Bundle]

        M --> M1[Checkout]
        M1 --> M2[Prepare .env]
        M2 --> M3[docker compose config]
        M3 --> M4[Upload Docker Bundle]

        P --> P1[Checkout theo SOURCE_SHA]
        P1 --> P2[Login GHCR bằng GHCR_TOKEN]
        P2 --> P3[Build + Push backend image]
        P3 --> P4[Build + Push frontend image]
        P4 --> P5[Upload ghcr-images-<sha>]

        K5 --> N[Deploy Placeholder]
        L4 --> N
        M4 --> N
        P5 --> N

        N --> N1[Download Metadata]
        N1 --> N2[Generate Deployment Summary]
        N2 --> N3[Upload Deploy Report]

        N3 --> O[Release Bundle]
        O --> O1[Download All Artifacts]
        O1 --> O2[Merge: Frontend + Backend + Docker + Deploy]
        O2 --> O3[Upload full-release-bundle-<sha>]
    end

    H -.-> A

    style CI fill:#1e3a5f,stroke:#00d9ff,stroke-width:2px,color:#fff
    style CD fill:#2d5016,stroke:#00ff88,stroke-width:2px,color:#fff
    style F fill:#ff9800,stroke:#fff,stroke-width:2px,color:#000
    style H fill:#f44336,stroke:#fff,stroke-width:2px,color:#fff
```

### 6.2 Luồng Health Check Docker Compose

```mermaid
sequenceDiagram
    participant GH as GitHub Actions
    participant DC as Docker Compose
    participant BE as Backend :8000
    participant FE as Frontend :3000

    GH->>DC: docker compose up -d --build
    Note over DC: Build backend + frontend bằng docker-compose.ci.yml

    DC-->>GH: Containers started

    loop Health Check Backend (max 90s)
        GH->>BE: curl /health (every 3s)
        alt Backend ready
            BE-->>GH: 200 OK
        else Backend not ready
            BE-->>GH: Connection refused
        end
    end

    alt Backend healthy
        loop Frontend HTTP Check (max 60s)
            GH->>FE: curl :3000
            alt Frontend ready
                FE-->>GH: 200 OK
            else Frontend not ready
                FE-->>GH: Connection refused
            end
        end
        alt Frontend ready
            FE-->>GH: 200 OK
            GH->>DC: docker compose down -v
            Note over GH: ✅ Smoke test passed
        else Frontend not ready
            FE-->>GH: Connection refused
            GH->>DC: docker compose logs
            Note over GH: ❌ Frontend failed
        end
    else Backend unhealthy
        GH->>DC: docker compose logs backend
        Note over GH: ❌ Backend failed
        GH->>DC: docker compose down -v
    end
```

### 6.3 Các job chính và thời gian ước tính

| Job | Thời gian (lần đầu) | Thời gian (có cache) | Mô tả |
|-----|---------------------|----------------------|-------|
| **Frontend** | 2-3 phút | 1-2 phút | Install deps + lint + test + coverage |
| **Backend** | 1-2 phút | 30-60 giây | Install deps + pytest + coverage |
| **Docker Compose Smoke** | 3-5 phút | 1-2 phút | Build images + health check |
| **CD Prepare Release** | 30 giây | 30 giây | Generate metadata + release notes |
| **CD Build Frontend** | 2-3 phút | 1-2 phút | npm build + bundle |
| **CD Package Backend** | 30 giây | 30 giây | Syntax check + bundle |
| **CD Package Docker** | 30 giây | 30 giây | Compose config + bundle |
| **CD Publish GHCR Images** | 2-5 phút | 1-3 phút | Build và push image frontend/backend |
| **CD Deploy Placeholder** | 30 giây | 30 giây | Tạo deployment summary placeholder |
| **CD Release Bundle** | 1 phút | 1 phút | Download + merge all release artifacts |

> 💡 **Lưu ý:** Thời gian có thể thay đổi tùy thuộc vào kích thước code changes và tình trạng cache của GitHub Actions.

### 6.4 Cách chạy CI local

```bash
cd frontend
npm ci
npm run test:ci

cd ../backend
python -m pip install -r requirements-test.txt
python -m pytest

cp .env.docker.example .env
docker compose up -d --build
curl http://localhost:8000/health
docker compose down -v
```

Coverage report sau khi chạy:

- Frontend: `frontend/coverage/index.html`
- Backend: `backend/htmlcov/index.html`
- Docker: kiểm tra `http://localhost:8000/health` và `docker compose ps`

### 6.5 Ghi chú

- Frontend có coverage threshold trong `frontend/vitest.config.ts`
- Backend có coverage threshold trong `backend/pytest.ini`
- Tài liệu chi tiết hơn:
  - `markdown_docs/CI_SUMMARY_2026-03-28.md`
  - `markdown_docs/TOM_TAT_CD_2026-03-28.md`

### 6.6 Hướng dẫn tải full-release-bundle từ CD

1. Vào tab **Actions** trên GitHub
2. Chọn workflow **CD Dự Án**
3. Click vào lần chạy gần nhất (có status ✅ thành công)
4. Kéo xuống phần **Artifacts** ở cuối trang
5. Click vào `full-release-bundle-<sha>` để tải release bundle hoặc `ghcr-images-<sha>` để xem danh sách image đã publish

> 💡 **Lưu ý:** Artifact chỉ được lưu trong **90 ngày**. Tải về ngay sau khi CD chạy thành công.

---

## 7. Troubleshooting

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

### Lỗi Speech-to-Text Groq trả 500
- Kiểm tra đã cài package `groq`: `pip install groq`.
- Kiểm tra `GROQ_API_KEY` trong `backend/.env`.
- Đảm bảo `GROQ_BASE_URL=https://api.groq.com`.
- Nếu đổi model STT sang `local-base`, kiểm tra FFmpeg có sẵn bằng lệnh `ffmpeg -version`.

### Lỗi 404 với đường dẫn `/openai/v1/openai/v1/audio/transcriptions`
- Nguyên nhân: base URL Groq bị lặp path.
- Cách đúng: dùng `GROQ_BASE_URL=https://api.groq.com`.

### Lỗi CSS/TailwindCSS
- Đảm bảo đã cài đầy đủ: `npm install tailwindcss @tailwindcss/postcss postcss`
- File `postcss.config.mjs` phải tồn tại trong `frontend/`.

---

## Phụ lục: Chức năng tạo Video + Infographic với NotebookLM

Chức năng này dùng NotebookLM để tạo **video tóm tắt** và **infographic** từ học liệu đã có trong hệ thống.

Luồng hiện tại gồm 3 bước:

1. Nhấn **Tạo Video + Infographic** để upload học liệu lên NotebookLM.
2. Nhấn **Xác nhận và bắt đầu tạo Video + Infographic** để hệ thống bấm tạo media.
3. Khi NotebookLM render xong, nhấn **Tải xuống** để backend kéo file về lưu trữ.

Trải nghiệm hiện tại:

- Thông báo hiển thị ở phía trên, tự ẩn sau `6 giây` và hỗ trợ cả chế độ sáng lẫn tối.
- Infographic có thể bấm xem trực tiếp ngay trên web, không mở tab mới.
- Nếu NotebookLM chưa render xong, backend sẽ trả lỗi rõ ràng thay vì báo thành công giả.

API chính:

- `POST /api/materials/{id}/generate/notebooklm-media`
- `POST /api/notebooklm/sessions/{session_id}/confirm-artifacts`
- `POST /api/notebooklm/sessions/{session_id}/confirm`
- `POST /api/notebooklm/sessions/{session_id}/cancel`

Lưu ý vận hành:

- Tài khoản Google dùng cho NotebookLM phải đăng nhập sẵn trong Chrome profile của backend.
- Cần cấu hình đúng `NOTEBOOKLM_DOCUMENTS_DIR`, `NOTEBOOKLM_USER_DATA_DIR`, `NOTEBOOKLM_GENERATE_WAIT_SECONDS`, `NOTEBOOKLM_HEADLESS`.
- Chức năng này hiện phù hợp hơn cho môi trường demo hoặc nội bộ; nếu chạy nhiều người dùng đồng thời thì cần hoàn thiện thêm phần session và concurrency.

---

## Minigame

- Tạo minigame tự động từ học liệu (MCQ, điền từ, ghép cặp).
- API: `POST /api/materials/{material_id}/generate/minigame` — tạo minigame.
- Chơi & nộp: `POST /api/games/{generated_content_id}/submit` — nộp kết quả.
- Frontend: trang minigame tại `frontend/app/materials/[id]/minigame`.

---

## 8. Tài liệu bổ sung

- [WEB_SEARCH_GUIDE_VI.md](markdown_docs/WEB_SEARCH_GUIDE_VI.md) — Hướng dẫn Web Search.
- [DOCKER_REVIEW_2026-03-27.md](markdown_docs/DOCKER_REVIEW_2026-03-27.md) — Docker review.
- [LLM_API_FLOW.md](markdown_docs/LLM_API_FLOW.md) — Luồng API LLM.
- [MINIGAME.md](markdown_docs/MINIGAME.md) — Thiết kế minigame.
- [NOTEBOOKLM_VIDEO_INFOGRAPHIC_REVIEW_2026-03-26.md](markdown_docs/NOTEBOOKLM_VIDEO_INFOGRAPHIC_REVIEW_2026-03-26.md) — NotebookLM media notes.
- [CI_SUMMARY_2026-03-28.md](markdown_docs/CI_SUMMARY_2026-03-28.md) — Tóm tắt đầy đủ phần CI hiện tại của dự án.

---

## 🔗 Các tác giả & Tài khoản Github

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=120&section=header" alt="header" />
</p>

| | | |
| :---: | :---: | :---: |
| <a href="https://github.com/Kietnehi"><img src="https://github-readme-stats.vercel.app/api?username=Kietnehi&show_icons=true&hide_title=true&hide=issues,contribs,prs&rank_icon=github&hide_border=true"/></a> | <a href="https://github.com/ductoanoxo"><img src="https://github-readme-stats.vercel.app/api?username=ductoanoxo&show_icons=true&hide_title=true&hide=issues,contribs,prs&rank_icon=github&hide_border=true"/></a> | <a href="https://github.com/phatle224"><img src="https://github-readme-stats.vercel.app/api?username=phatle224&show_icons=true&hide_title=true&hide=issues,contribs,prs&rank_icon=github&hide_border=true"/></a> |
| <img src="https://github.com/Kietnehi.png" width="80"/> | <img src="https://github.com/ductoanoxo.png" width="80"/> | <img src="https://github.com/phatle224.png" width="80"/> |
| <b><a href="https://github.com/Kietnehi">Trương Phú Kiệt</a></b> | <b><a href="https://github.com/ductoanoxo">Đức Toàn</a></b> | <b><a href="https://github.com/phatle224">Phát Lê</a></b> |
| Fullstack Dev & AI Researcher | Developer | Developer |
| <p align="center"><img src="https://img.shields.io/github/followers/Kietnehi?style=for-the-badge"/> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github-star-counter.workers.dev%2Fuser%2FKietnehi&query=%24.stars&style=for-the-badge&color=yellow&label=Stars&logo=github"/> <a href="https://github.com/Kietnehi"><img src="https://img.shields.io/badge/Profile-GitHub-181717?style=for-the-badge&logo=github"/></a></p> | <p align="center"><img src="https://img.shields.io/github/followers/ductoanoxo?style=for-the-badge"/> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github-star-counter.workers.dev%2Fuser%2Fductoanoxo&query=%24.stars&style=for-the-badge&color=yellow&label=Stars&logo=github"/> <a href="https://github.com/ductoanoxo"><img src="https://img.shields.io/badge/Profile-GitHub-181717?style=for-the-badge&logo=github"/></a></p> | <p align="center"><img src="https://img.shields.io/github/followers/phatle224?style=for-the-badge"/> <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fapi.github-star-counter.workers.dev%2Fuser%2Fphatle224&query=%24.stars&style=for-the-badge&color=yellow&label=Stars&logo=github"/> <a href="https://github.com/phatle224"><img src="https://img.shields.io/badge/Profile-GitHub-181717?style=for-the-badge&logo=github"/></a></p> |

<p align="center">
  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION">
    <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&pause=1000&color=236AD3&center=true&vCenter=true&width=500&lines=AI+for+Education+Project;SGU26+Seminar+Chuyen+De" alt="Typing SVG" />
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SGU-Sai_Gon_University-0056D2?style=flat-square" alt="SGU" />
  <img src="https://img.shields.io/badge/Base-Ho_Chi_Minh_City-FF4B4B?style=flat-square" alt="HCMC" />
</p>

### 🛠 Tech Stack

<p align="center">
  <img src="https://skillicons.dev/icons?i=docker,python,react,nodejs,mongodb,git,fastapi,pytorch" alt="Tech Stack" />
</p>

### 📘 AI FOR EDUCATION

<p align="center">
  <a href="https://github.com/Kietnehi/AI-FOR-EDUCATION">
    <img src="https://img.shields.io/github/stars/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=yellow" alt="Stars" />
    <img src="https://img.shields.io/github/forks/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=orange" alt="Forks" />
    <img src="https://img.shields.io/github/issues/Kietnehi/AI-FOR-EDUCATION?style=for-the-badge&color=red" alt="Issues" />
  </a>
</p>


<!-- Quote động -->
  <p align="center">
    <img src="https://quotes-github-readme.vercel.app/api?type=horizontal&theme=dark" alt="Daily Quote"/>
  </p>

  <p align="center">
  <i>Thank you for stopping by! Don’t forget to give this repo a <b>⭐️ Star</b> if you find it useful.</i>
  </p>

  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&height=80&section=footer"/>

  </div>
