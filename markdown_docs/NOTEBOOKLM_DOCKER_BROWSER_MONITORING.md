# NotebookLM Docker Browser Monitoring

## Mục tiêu

Tài liệu này mô tả cách theo dõi trình duyệt Chrome của luồng NotebookLM khi backend chạy trong Docker.

Trong môi trường local, Playwright có thể mở trực tiếp cửa sổ Chrome trên máy đang dùng. Trong Docker thì backend không có desktop thật của host, nên dự án dùng màn hình ảo để giữ hành vi gần với local nhất:

- `Xvfb` tạo display ảo
- `openbox` cung cấp window manager tối thiểu
- `x11vnc` xuất display thành VNC server
- `noVNC` cho phép xem VNC ngay trong trình duyệt web
- Playwright vẫn chạy với `channel="chrome"` như logic hiện tại

## Kiến trúc đang dùng

Luồng backend Docker hiện tại:

1. Backend container khởi động script `start-backend-with-gui.sh`
2. Script mở `Xvfb` trên `DISPLAY=:99`
3. Script khởi động `openbox`, `x11vnc`, `websockify/noVNC`
4. Sau đó mới chạy `uvicorn`
5. Khi workflow NotebookLM được gọi, Playwright mở Chrome bên trong display ảo này
6. Người dùng theo dõi Chrome qua giao diện noVNC

## Cổng sử dụng

- Backend API: `http://localhost:8000`
- noVNC: `http://localhost:6080/vnc.html`
- VNC raw: `localhost:5900`

## Cách sử dụng

### 1. Build và chạy backend

```bash
docker compose build backend
docker compose up -d backend
```

Nếu toàn bộ stack cần khởi động lại:

```bash
docker compose up -d --build
```

### 2. Xác nhận backend đã lên

```bash
docker compose ps
docker compose logs backend --tail=200
```

Dấu hiệu đúng:

- backend ở trạng thái `healthy`
- log có `Uvicorn running on http://0.0.0.0:8000`
- truy cập `http://localhost:8000/health` trả `200`

### 3. Mở màn hình trình duyệt của container

Mở:

```text
http://localhost:6080/vnc.html
```

Sau đó bấm `Connect`.

Khi bạn kích hoạt workflow NotebookLM từ frontend hoặc API, Chrome sẽ mở bên trong màn hình này.

## Ý nghĩa của noVNC

`noVNC` không phải là Chrome native của máy host. Đây là màn hình của Chrome đang chạy trong container.

Điểm giống local:

- vẫn dùng đúng Chrome thay vì Chromium
- vẫn giữ được profile tại `NOTEBOOKLM_USER_DATA_DIR`
- vẫn có thể quan sát thao tác browser

Điểm khác local:

- bạn xem trình duyệt qua tab web `6080`, không phải cửa sổ desktop thật của Windows/macOS/Linux host

## Trường hợp màn hình đen

Đây là lỗi vận hành thường gặp nhất.

Nguyên nhân phổ biến:

- tab noVNC mất kết nối websocket
- bạn đang đứng ở desktop ảo trống, chưa có cửa sổ Chrome mở
- giao diện noVNC chưa refresh sau khi thao tác nhầm
- workflow NotebookLM chưa thực sự launch browser

Cách xử lý nhanh:

1. Reload lại `http://localhost:6080/vnc.html`
2. Bấm `Connect` lại
3. Nếu vẫn đen, đóng tab rồi mở lại
4. Chạy lại action NotebookLM để Chrome bật lại
5. Nếu vẫn không lên, restart riêng backend:

```bash
docker compose restart backend
```

## Các lệnh kiểm tra hữu ích

### Xem log backend

```bash
docker compose logs backend --tail=250
```

### Kiểm tra health endpoint

```bash
curl http://localhost:8000/health
```

### Kiểm tra noVNC có phục vụ web hay không

```bash
curl http://localhost:6080/vnc.html
```

### Kiểm tra container đang publish port

```bash
docker compose ps
```

## Dấu hiệu cấu hình đúng

Nếu cấu hình Docker GUI đúng, bạn sẽ có:

- port `8000`, `6080`, `5900` được publish ở service `backend`
- `http://localhost:6080/vnc.html` mở được trang noVNC
- workflow NotebookLM không còn lỗi `Chromium distribution 'chrome' is not found`

## File liên quan

- `backend/Dockerfile`
- `backend/start-backend-with-gui.sh`
- `docker-compose.yml`
- `backend/app/services/notebooklm_service.py`
- `backend/app/services/notebooklm_worker.py`

## Giới hạn hiện tại

- Đây là GUI trong container, không phải tích hợp desktop native của host
- Nếu Google yêu cầu đăng nhập lại, bạn phải thao tác qua noVNC
- Nếu backend restart, session browser đang mở sẽ bị reset theo trạng thái của container/process

## Ghi chú vận hành

- Nếu chỉ cần backend chạy được mà không cần quan sát UI, có thể cân nhắc chế độ headless riêng cho Docker
- Với yêu cầu hiện tại của dự án, hướng GUI qua noVNC phù hợp hơn vì gần với workflow local
