# Quick Start Guide - Testing Grafana Dashboards

## Vấn đề: Dashboard hiển thị "No Data"

Đây là điều bình thường! Dashboards cần data từ các nguồn sau:
- **Prometheus**: Metrics từ backend application
- **Loki**: Logs từ services  
- **Tempo**: Distributed traces

## ✅ Giải pháp 1: Test với Sample Data (Recommended)

### Bước 1: Cài đặt dependencies
```bash
pip install prometheus-client
```

### Bước 2: Chạy Sample Data Generator
```bash
# Trong terminal riêng
cd D:\DACN\Monitoring\railway-grafana-stack
python sample-data-generator.py
```

Bạn sẽ thấy:
```
🚀 Starting Sample Data Generator...
📊 Metrics will be available at: http://localhost:8001/metrics
⏱️  Generating data continuously...
```

### Bước 3: Khởi động Grafana Stack
```bash
# Trong terminal khác
cd D:\DACN\Monitoring\railway-grafana-stack
docker-compose up --build
```

### Bước 4: Xem Dashboards
1. Mở http://localhost:3300
2. Login: `admin` / `yourpassword123`
3. Đi đến **Dashboards**
4. Chọn **Monitoring Stack Health** (dashboard mới - có data ngay!)
5. Chọn **AI Education Platform** (sẽ có sample data)
6. Chọn **Application Metrics** (sẽ có sample data)

**Dashboard có data ngay:**
- ✅ **Monitoring Stack Health** - Monitoring chính Prometheus/Grafana stack
- ✅ **AI Education Platform** - Với sample data generator
- ✅ **Application Metrics** - Với sample data generator

**Dashboard cần logs/traces:**
- ⚠️ **Logs Dashboard** - Cần Loki logs (xem phần 2)
- ⚠️ **System Overview** - Một số panel cần node_exporter

---

## ✅ Giải pháp 2: Integrate vào Backend Thực (Production)

### Bước 1: Install Prometheus Client
```bash
cd D:\DACN\backend
pip install prometheus-client prometheus-fastapi-instrumentator
```

### Bước 2: Update `backend/app/main.py`
```python
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

# Initialize Prometheus
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
)

instrumentator.instrument(app)

@app.on_event("startup")
async def startup():
    # Expose /metrics endpoint
    instrumentator.expose(app, endpoint="/metrics")
```

### Bước 3: Custom Metrics
Xem file `METRICS_SETUP.md` để thêm custom metrics như:
- AI generation requests
- Chat messages
- Material uploads
- etc.

### Bước 4: Test Metrics Endpoint
```bash
curl http://localhost:8000/metrics
```

### Bước 5: Restart Backend
```bash
docker-compose restart backend
```

---

## 🔍 Troubleshooting

### Dashboard vẫn "No Data"?

**Kiểm tra 1: Prometheus Targets**
1. Mở http://localhost:9090/targets
2. Xem status của các targets:
   - `prometheus` → Should be **UP** (green)
   - `sample-data` → Should be **UP** nếu chạy generator
   - `backend` → Sẽ **DOWN** nếu chưa có /metrics endpoint

**Kiểm tra 2: Query trực tiếp trong Prometheus**
1. Mở http://localhost:9090/graph
2. Thử query: `up`
3. Thử query: `http_requests_total`
4. Nếu có kết quả → Prometheus đang nhận metrics

**Kiểm tra 3: Datasource trong Grafana**
1. Grafana → Configuration → Data Sources
2. Click **Prometheus**
3. Scroll xuống → Click **Save & Test**
4. Should see "Data source is working"

**Kiểm tra 4: Time Range**
- Trong dashboard, kiểm tra time range ở góc phải trên
- Thử đổi sang "Last 5 minutes" hoặc "Last 15 minutes"
- Click **Refresh** icon

### Sample Data Generator không chạy?

```bash
# Check port 8001 available
netstat -ano | findstr :8001

# Try different port
# Edit sample-data-generator.py line: start_http_server(8002)
# Then update prom.yml: targets: ['host.docker.internal:8002']
```

### Backend /metrics không hoạt động?

```bash
# Test from inside Docker network
docker-compose exec prometheus wget -O- http://host.docker.internal:8000/metrics

# Or từ host machine
curl http://localhost:8000/metrics

# Should see Prometheus format output:
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
# http_requests_total{method="GET"} 123.0
```

---

## 📊 Dashboard Recommendations

**Để test ngay:**
1. **Monitoring Stack Health** - Monitor Prometheus, Grafana stack itself
   - ✅ Có data ngay khi Prometheus chạy
   - Shows: Prometheus status, memory, request rate, targets

**Với sample data generator:**
2. **AI Education Platform** - AI application metrics
3. **Application Metrics** - HTTP requests, response time

**Khi backend có metrics:**
4. All dashboards sẽ hoạt động đầy đủ

**Cho logs (optional):**
5. **Logs Dashboard** - Cần config log shipping đến Loki

---

## 🎯 Next Steps

### Quick Test (5 minutes):
1. ✅ Chạy `sample-data-generator.py`
2. ✅ Chạy `docker-compose up`
3. ✅ Xem **Monitoring Stack Health** dashboard
4. ✅ Xem **AI Education Platform** với sample data

### Production Setup (30 minutes):
1. ✅ Đọc `METRICS_SETUP.md`
2. ✅ Add Prometheus client vào backend
3. ✅ Instrument key endpoints
4. ✅ Test metrics endpoint
5. ✅ Deploy và monitor!

---

## 📚 Files Reference

- `sample-data-generator.py` - Generates fake metrics for testing
- `METRICS_SETUP.md` - Chi tiết setup metrics cho backend
- `README.md` - Dashboard overview
- `dashboards/*.json` - Dashboard definitions
- `prometheus/prom.yml` - Prometheus config

---

## ❓ FAQ

**Q: Tại sao không có data?**
A: Dashboards cần metrics từ backend. Chạy sample-data-generator.py để test hoặc integrate metrics vào backend thực.

**Q: Dashboard nào có data ngay?**
A: "Monitoring Stack Health" - monitor chính Prometheus/Grafana stack.

**Q: Làm sao có data thật?**
A: Follow METRICS_SETUP.md để instrument backend code.

**Q: Sample data generator an toàn không?**
A: Có! Nó chỉ generate metrics giả trên port 8001, không ảnh hưởng backend thật.

**Q: Prometheus không scrape được backend?**
A: Check backend có expose /metrics endpoint chưa. Xem METRICS_SETUP.md.
