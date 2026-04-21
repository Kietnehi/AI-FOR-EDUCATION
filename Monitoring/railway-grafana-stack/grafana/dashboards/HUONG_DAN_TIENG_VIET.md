# 🎯 Giải pháp "No Data" - Hướng dẫn Tiếng Việt

## ❓ Tại sao dashboard "No Data"?

Dashboard Grafana cần **metrics** (dữ liệu số liệu) từ:
1. **Backend application** - Chưa export metrics
2. **Prometheus** - Chưa có gì để scrape
3. **Loki** - Chưa có logs
4. **Tempo** - Chưa có traces

➡️ **Giải pháp:** Test với data giả HOẶC integrate metrics vào backend thật

---

## 🚀 Cách 1: Test Nhanh với Data Giả (5 phút)

### Bước 1: Chạy Script
Double-click vào file này:
```
start-with-sample-data.bat
```

**Bạn sẽ thấy:**
- Cửa sổ đen hiện lên (data generator)
- Docker containers start
- Chờ khoảng 1-2 phút

### Bước 2: Mở Grafana
Khi mọi thứ đã chạy, double-click:
```
open-dashboards.bat
```

Hoặc mở browser:
- http://localhost:3300
- Login: `admin` / `yourpassword123`

### Bước 3: Xem Dashboard
1. Click vào **☰ Dashboards** (menu bên trái)
2. Bạn sẽ thấy 5 dashboards
3. Click vào **"Monitoring Stack Health"** ← Cái này có data ngay!

**Dashboard có data ngay:**
- ✅ **Monitoring Stack Health** - Monitor Prometheus/Grafana
- ✅ **AI Education Platform** - Metrics giả cho AI platform
- ✅ **Application Metrics** - HTTP requests, response time

---

## 🔧 Cách 2: Integrate vào Backend Thật (30 phút)

### Bước 1: Cài đặt thư viện
```bash
cd D:\DACN\backend
pip install prometheus-client prometheus-fastapi-instrumentator
```

### Bước 2: Sửa file `backend/app/main.py`

Thêm vào đầu file:
```python
from prometheus_fastapi_instrumentator import Instrumentator
```

Sau dòng `app = FastAPI()`, thêm:
```python
# Khởi tạo Prometheus metrics
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
)
instrumentator.instrument(app)

@app.on_event("startup")
async def startup():
    # Expose metrics endpoint
    instrumentator.expose(app, endpoint="/metrics")
    print("✅ Metrics endpoint available at: http://localhost:8000/metrics")
```

### Bước 3: Restart Backend
```bash
# Stop backend container
docker-compose stop backend

# Start lại
docker-compose up backend
```

### Bước 4: Test Metrics
Mở browser: http://localhost:8000/metrics

Bạn sẽ thấy output kiểu:
```
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",path="/api/health"} 123.0
```

### Bước 5: Restart Grafana Stack
```bash
cd D:\DACN\Monitoring\railway-grafana-stack
docker-compose restart prometheus
```

**Xong!** Bây giờ dashboards sẽ có data thật từ backend.

---

## 📊 Kiểm tra Data có đang flow không?

### Test 1: Prometheus Targets
1. Mở: http://localhost:9090/targets
2. Xem status:

| Target | Status | Ý nghĩa |
|--------|--------|---------|
| `prometheus` | 🟢 UP | Prometheus tự monitor |
| `sample-data` | 🟢 UP | Data generator đang chạy |
| `backend` | 🟢 UP | Backend đã có /metrics |
| `backend` | 🔴 DOWN | Backend chưa có /metrics (bình thường) |

### Test 2: Query Metrics
1. Mở: http://localhost:9090/graph
2. Gõ vào ô query: `up`
3. Click **Execute**
4. Thấy kết quả → Metrics đang flow ✅

### Test 3: Grafana Dashboard
1. Mở dashboard bất kỳ
2. Góc phải trên, chọn time range: **Last 5 minutes**
3. Click refresh (icon ↻)
4. Thấy data → Success! 🎉

---

## 🐛 Troubleshooting

### Vấn đề 1: start-with-sample-data.bat báo lỗi Python
**Nguyên nhân:** Chưa cài Python  
**Giải pháp:**
1. Download Python: https://www.python.org/downloads/
2. Khi cài, tick ✅ "Add Python to PATH"
3. Chạy lại script

### Vấn đề 2: Docker báo lỗi "port already in use"
**Nguyên nhân:** Port 3300, 9090 đã bị chiếm  
**Giải pháp:**
```bash
# Check port nào đang dùng
netstat -ano | findstr :3300
netstat -ano | findstr :9090

# Kill process hoặc đổi port trong docker-compose.yml
```

### Vấn đề 3: Dashboard vẫn "No Data"
**Check list:**
- [ ] Sample data generator có đang chạy? (thấy cửa sổ đen)
- [ ] Prometheus targets có UP không? (http://localhost:9090/targets)
- [ ] Time range trong dashboard đúng chưa? (góc phải trên)
- [ ] Đã click refresh chưa? (icon ↻)

**Nếu vẫn lỗi:**
```bash
# Restart toàn bộ
docker-compose down
docker-compose up --build
```

### Vấn đề 4: Không mở được Grafana
**Check:**
```bash
# Xem logs
docker-compose logs grafana

# Check container có chạy không
docker-compose ps

# Restart
docker-compose restart grafana
```

---

## 📁 Files Quan Trọng

| File | Mục đích |
|------|----------|
| `start-with-sample-data.bat` | 🚀 Chạy tất cả (1 click) |
| `open-dashboards.bat` | 🌐 Mở browser |
| `sample-data-generator.py` | 🎲 Tạo data giả |
| `START_HERE.md` | 📖 Đọc đầu tiên (tiếng Anh) |
| `QUICK_START.md` | ⚡ Hướng dẫn nhanh |
| `METRICS_SETUP.md` | 🔧 Setup chi tiết cho backend |

---

## 🎯 Workflow Khuyến Nghị

### Ngày 1: Test (Hôm nay!)
1. ✅ Chạy `start-with-sample-data.bat`
2. ✅ Mở Grafana: http://localhost:3300
3. ✅ Xem dashboard "Monitoring Stack Health"
4. ✅ Hiểu cách metrics hoạt động

### Ngày 2: Integrate Backend
1. ✅ Đọc phần "Cách 2" ở trên
2. ✅ Add Prometheus client vào backend
3. ✅ Test `/metrics` endpoint
4. ✅ Restart và kiểm tra

### Ngày 3: Custom Metrics
1. ✅ Đọc `METRICS_SETUP.md`
2. ✅ Add metrics cho features riêng:
   - AI generation time
   - Chat messages count
   - User activity
   - etc.

### Ngày 4+: Production
1. ✅ Monitor traffic thật
2. ✅ Tune dashboards
3. ✅ Setup alerts (nếu cần)

---

## 💡 Tips

- ⏰ **Time range quan trọng!** Đổi sang "Last 5 minutes" nếu mới test
- 🔄 **Refresh thường xuyên** hoặc bật auto-refresh (góc phải trên)
- 📊 **Prometheus targets** là nơi đầu tiên check khi lỗi
- 🎲 **Sample data** giúp test dashboard trước khi có data thật
- 📖 **Đọc logs** nếu lỗi: `docker-compose logs grafana prometheus`

---

## ❓ FAQ

**Q: Tôi có cần sample data generator mãi không?**  
A: Không! Chỉ dùng để test. Khi backend có metrics thật thì tắt đi.

**Q: Sample data có ảnh hưởng backend thật không?**  
A: Không! Nó chạy riêng trên port 8001, độc lập hoàn toàn.

**Q: Dashboard nào test được ngay?**  
A: "Monitoring Stack Health" - Monitor chính Prometheus/Grafana stack.

**Q: Làm sao biết metrics đang flow?**  
A: Check http://localhost:9090/targets - targets phải UP (xanh).

**Q: Tôi cần setup gì nữa không?**  
A: Không! Dashboards đã sẵn sàng. Chỉ cần data (từ sample hoặc backend thật).

**Q: Backend của tôi đã có metrics endpoint chưa?**  
A: Test bằng: `curl http://localhost:8000/metrics` - nếu có output thì OK!

---

## 🆘 Cần Giúp?

1. ✅ Đọc lại file này
2. ✅ Check Prometheus targets: http://localhost:9090/targets
3. ✅ Check Grafana datasources: Grafana → Configuration → Data Sources
4. ✅ Xem logs: `docker-compose logs grafana prometheus`
5. ✅ Đọc `QUICK_START.md` (tiếng Anh, chi tiết hơn)

---

## ✅ Checklist Thành Công

- [ ] Sample data generator chạy được
- [ ] Grafana mở được (http://localhost:3300)
- [ ] Dashboard "Monitoring Stack Health" có data
- [ ] Prometheus targets UP (http://localhost:9090/targets)
- [ ] Hiểu cách metrics flow: Backend → Prometheus → Grafana
- [ ] (Optional) Backend có /metrics endpoint
- [ ] (Optional) Dashboard có data thật từ backend

---

**🚀 Bắt đầu ngay:** Double-click `start-with-sample-data.bat`!
