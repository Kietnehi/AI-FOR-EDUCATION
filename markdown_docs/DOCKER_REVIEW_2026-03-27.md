# Docker Review (2026-03-27)

## Phạm vi
- `docker-compose.yml`
- `backend/Dockerfile`
- `frontend/Dockerfile`
- `frontend/Dockerfile.dev`
- `frontend/scripts/warmup-routes.mjs`

## Cập nhật (2026-03-29) - MongoDB Atlas & Hot-Reload Optimization

### 🛠️ Thay đổi chính:
1.  **Mongo container là optional:** Sử dụng profile `local-db`. Mặc định dùng MongoDB Atlas qua `.env`.
2.  **Tối ưu Hot-Reload (Windows/WSL2):** 
    - Kích hoạt **Polling** cho cả Backend và Frontend để đảm bảo nhận diện thay đổi file ngay lập tức trên hệ thống file NTFS của Windows.
    - Cấu hình `CHOKIDAR_USEPOLLING=true` và `WATCHPACK_POLLING=true` cho Frontend.
    - Cấu hình `WATCHFILES_FORCE_POLLING=true` cho Backend.
    - Mở rộng `--reload-dir` của uvicorn sang toàn bộ thư mục `/app`.
3.  **Tắt chế độ `--turbo` ở dev:** Tạm thời tắt để đảm bảo tính ổn định của Hot-reload trong môi trường Docker trên Windows.

### 📝 Cấu hình trong `.env`:
```env
# Atlas URI (Khuyến nghị dùng Atlas để tiết kiệm RAM container)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority&appName=<app-name>

# Polling configuration (Mặc định là true trong docker-compose)
CHOKIDAR_USEPOLLING=true
WATCHFILES_FORCE_POLLING=true
```

---

## Cách chạy Docker

### 1. Chạy với MongoDB Atlas (Mặc định - Khuyến nghị)

**Không chạy container MongoDB local**, tiết kiệm RAM (~500MB):

```bash
# Start tất cả (chỉ backend + frontend)
docker-compose up

# Hoặc chạy detached mode (chạy nền)
docker-compose up -d

# Xem logs
docker-compose logs -f

# Dừng
docker-compose down
```

**Yêu cầu:** File `.env` phải có `MONGO_URI` kết nối Atlas.

---

### 2. Chạy với Local MongoDB (Khi cần test local)

**Có chạy container MongoDB** local:

```bash
# Start với profile local-db
docker-compose --profile local-db up

# Hoặc detached mode
docker-compose --profile local-db up -d

# Xem logs tất cả containers
docker-compose logs -f

# Xem logs từng service
docker-compose logs -f mongo
docker-compose logs -f backend
docker-compose logs -f frontend

# Dừng
docker-compose --profile local-db down
```

**Lưu ý:** Khi dùng local MongoDB, backend sẽ connect tới `mongodb://mongo:27017`.

---

### 3. Chạy từng service riêng lẻ

```bash
# Chỉ backend (dùng Atlas)
docker-compose up backend

# Chỉ frontend
docker-compose up frontend

# Chỉ MongoDB (khi cần debug)
docker-compose --profile local-db up mongo
```

---

### 4. Build lại từ đầu (khi có thay đổi code/Dockerfile)

```bash
# Build lại không dùng cache
docker-compose build --no-cache

# Build với profile
docker-compose --profile local-db build --no-cache

# Sau đó start
docker-compose up -d
```

---

### 5. Một số lệnh hữu ích khác

```bash
# Xem trạng thái containers
docker-compose ps

# Xem danh sách profiles
docker-compose config --profiles

# Truy cập vào container
docker-compose exec backend bash
docker-compose exec frontend bash
docker-compose --profile local-db exec mongo mongosh

# Xem biến môi trường
docker-compose config
```

---

## Troubleshooting

### Backend không connect được MongoDB

**Kiểm tra `.env`:**
```bash
# Nếu dùng Atlas:
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname

# Nếu dùng local:
MONGO_URI=mongodb://mongo:27017
```

### Container mongo vẫn chạy dù không muốn

```bash
# Dừng container
docker-compose stop mongo
docker rm any2-mongo

# Hoặc down toàn bộ
docker-compose down
```

### Port bị chiếm (3000, 8000, 27017)

```bash
# Windows: Tìm process đang chiếm port
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :27017

# Dừng process (thay PID)
taskkill /PID <PID> /F
```

---

## Findings (ưu tiên theo mức độ nghiêm trọng)

### 1) Critical - Script warm-up có lỗi cú pháp JavaScript
- Vị trí: `frontend/scripts/warmup-routes.mjs:64`
- Chi tiết: Dòng `return first ? .id || first ? ._id || null;` có khoảng trắng sai trong optional chaining (`?.`).
- Tác động:
  - Warm-up route có thể không chạy đúng hoặc crash ngay khi parse.
  - Mục tiêu "compile sẵn để mượt" bị suy giảm.
- Khuyến nghị:
  - Sửa thành: `return first?.id || first?._id || null;`
  - Thêm kiểm tra nhanh bằng `node frontend/scripts/warmup-routes.mjs` trong CI/dev check.

### 2) Medium - Backend dev đang force polling watcher, có thể gây tốn CPU trên máy yếu
- Vị trí: `docker-compose.yml:44`
- Chi tiết: `WATCHFILES_FORCE_POLLING: "true"` giúp ổn định watch trên Windows nhưng tăng tài nguyên.
- Tác động:
  - CPU cao, phản hồi chậm hơn khi chạy song song frontend + backend.
- Khuyến nghị:
  - Cho phép cấu hình theo env thay vì hard-code:
    - `WATCHFILES_FORCE_POLLING: ${WATCHFILES_FORCE_POLLING:-true}`
  - Với môi trường không cần polling, đặt `false` để giảm tải.

### 3) Medium - Runtime image backend chưa tối ưu kích thước (đang giữ tool build trong image chạy)
- Vị trí: `backend/Dockerfile:14`
- Chi tiết: `build-essential` được cài trong image runtime.
- Tác động:
  - Image lớn hơn cần thiết, startup/pull chậm hơn.
- Khuyến nghị:
  - Tách builder/runtime multi-stage cho backend (đặc biệt khi build production image).

### 4) Mức thấp - Compose chính hiện thiên về chế độ phát triển, có thể gây nhầm lẫn khi triển khai
- Vị trí: 
  - `docker-compose.yml:60` (`frontend` dùng `Dockerfile.dev`)
  - `docker-compose.yml:46` (`./backend:/app` bind mount + reload)
- Chi tiết: Cấu hình hiện tại rất phù hợp local dev/hot reload, nhưng không phù hợp production.
- Tác động:
  - Dễ vô tình mang cấu hình dev sang môi trường cần ổn định.
- Khuyến nghị:
  - Tạo file tách biệt:
    - `docker-compose.yml` cho production-safe
    - `docker-compose.dev.yml` cho hot reload
  - Hoặc dùng profile rõ ràng `dev`/`prod`.

## Open Questions / Assumptions
- Có muốn giữ mặc định compose hiện tại là dev-first hay tách hẳn 2 luồng dev/prod?
- Backend có thực sự cần `WATCHFILES_FORCE_POLLING=true` trên máy đang dùng không (để giảm lag)?

## Tóm tắt
- Hướng đi hiện tại (hot reload + warm-up) là đúng để cải thiện độ mượt khi điều hướng lần đầu.
- Điểm chặn lớn nhất hiện tại là lỗi cú pháp ở script warm-up (`frontend/scripts/warmup-routes.mjs:64`), cần sửa ngay.
- Sau khi sửa, nên tinh chỉnh watcher và tách dev/prod để cân bằng giữa trải nghiệm phát triển và tính ổn định triển khai.
