# Monitoring và Cloudflare R2

Ngày cập nhật: 2026-04-03

## 1) Monitoring (Prometheus + Grafana)

### Mục tiêu
- Thu thập metrics từ backend FastAPI qua endpoint `/metrics`
- Cho Prometheus scrape metrics định kỳ
- Hiển thị dữ liệu trên Grafana bằng datasource Prometheus

### Cấu hình hiện có trong project
- Backend đã expose metrics tại endpoint `/metrics`
- File: `backend/app/main.py`
- Thư viện dùng để instrument FastAPI: `prometheus-fastapi-instrumentator`
- Khai báo dependency: `backend/requirements.txt`

- Prometheus đã có job scrape backend
- File: `Monitoring/railway-grafana-stack/prometheus/prom.yml`
- Target hiện tại: `host.docker.internal:8000`

### Cách chạy local
1. Chạy backend:
  - Từ thư mục gốc project:
  - `py -3.14 backend/run.py`

2. Kiểm tra metrics endpoint:
  - Mở: `http://localhost:8000/metrics`
  - Nếu thấy dữ liệu text theo format Prometheus là OK

3. Chạy stack monitoring:
  - `cd Monitoring/railway-grafana-stack`
  - `docker compose up -d`

4. Kiểm tra target Prometheus:
  - Mở: `http://localhost:9090/targets`
  - Job `ai-learning-backend` cần ở trạng thái `UP`

5. Mở Grafana:
  - URL: `http://localhost:3300`
  - User mặc định: `admin`
  - Password mặc định: `yourpassword123`

### Query gợi ý trong Grafana (Prometheus)
- `up`
- `rate(http_requests_total[5m])`
- `sum(rate(http_requests_total[5m])) by (handler, method, status)`
- `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, handler))`

### Troubleshooting nhanh
- Prometheus target `DOWN`:
  - Đảm bảo backend đang chạy cổng `8000`
  - Kiểm tra lại target trong `prom.yml` theo môi trường Docker/WSL

- Grafana báo `No data`:
  - Vào Explore, chọn datasource Prometheus, thử query `up`
  - Kiểm tra trong Prometheus xem target backend có `UP` chưa

---

## 2) Cloudflare R2

### Mục tiêu
- Tất cả file upload và file generate ưu tiên lưu lên Cloudflare R2
- Nếu upload lỗi thì fallback local để không gián đoạn luồng xử lý

### Biến môi trường backend cần có
- File mẫu: `backend/.env.example`

Bật object storage + R2:
- `USE_OBJECT_STORAGE=true`
- `USE_R2=true`

Thông tin kết nối R2:
- `R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`
- `R2_ACCESS_KEY_ID=<your_access_key>`
- `R2_SECRET_ACCESS_KEY=<your_secret_key>`
- `R2_BUCKET=<your_bucket>`
- `R2_PUBLIC_BASE_URL=<optional_public_base_url>`

### Nguồn lấy thông tin trên Cloudflare
1. `R2_ENDPOINT`:
  - Cloudflare Dashboard -> R2 Object Storage -> API
  - Dạng endpoint: `https://<account_id>.r2.cloudflarestorage.com`

2. Access key / Secret key:
  - R2 Object Storage -> Manage R2 API Tokens
  - Tạo Account API Token (khuyến nghị)
  - Scope theo bucket cụ thể, quyền tối thiểu `Object Read` + `Object Write`

3. `R2_PUBLIC_BASE_URL` (tùy chọn):
  - Public Development URL hoặc custom domain
  - Có thể để trống nếu chỉ dùng backend proxy file

### Hành vi lưu file hiện tại trong project
- Upload học liệu gốc: ưu tiên R2
- Generate slides (`.pptx`): ưu tiên R2
- Generate podcast (`.mp3`): ưu tiên R2
- NotebookLM video/infographic: ưu tiên R2

### Cách kiểm tra file đã lên R2
1. Sau khi upload/generate, kiểm tra trường `storage_type` trong response:
  - Giá trị kỳ vọng: `r2`

2. Kiểm tra `file_url`:
  - Nếu có `R2_PUBLIC_BASE_URL`: thường là URL public
  - Nếu không có public URL: có thể là URL endpoint R2 hoặc URL local fallback

3. Kiểm tra trực tiếp trên dashboard Cloudflare R2:
  - Bucket -> Objects
  - Có object trong các prefix `uploads/...`, `generated/...`

### Bảo mật
- Tuyệt đối không commit secret key lên git
- Nếu key đã lộ, revoke key cũ và tạo key mới ngay
