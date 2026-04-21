# Grafana Dashboards

Các dashboard được tự động provisioned khi khởi động Grafana.

## Dashboards đã tạo

### 1. System Overview (`system-overview`)
Dashboard tổng quan về hệ thống, bao gồm:
- **CPU Usage**: Sử dụng CPU theo thời gian
- **Memory Usage**: Sử dụng RAM theo thời gian
- **Recent Logs**: Logs gần đây từ Loki

### 2. Application Metrics (`application-metrics`)
Dashboard metrics ứng dụng, bao gồm:
- **Request Rate by Service**: Tỷ lệ request theo service
- **Response Time (p95) by Service**: Thời gian phản hồi percentile 95
- **Error Rate (5xx)**: Tỷ lệ lỗi HTTP 5xx
- **HTTP Status Codes Distribution**: Phân bổ mã HTTP status
- **Trace Search**: Tìm kiếm traces từ Tempo

### 3. Logs Dashboard (`logs-dashboard`)
Dashboard phân tích logs, bao gồm:
- **Log Volume Over Time**: Khối lượng log theo thời gian
- **Log Levels Over Time**: Phân bổ log levels (error, warn, info, etc.)
- **Error Count**: Số lượng error trong 5 phút gần nhất
- **Log Explorer**: Tìm kiếm và xem logs (có search filter)

## Cách sử dụng

### Build và chạy stack
```bash
cd D:\DACN\Monitoring\railway-grafana-stack
docker-compose up --build
```

### Truy cập Grafana
1. Mở browser: http://localhost:3300
2. Login:
   - Username: `admin`
   - Password: `yourpassword123` (hoặc giá trị trong docker-compose.yml)

### Xem dashboards
- Vào **Dashboards** menu bên trái
- Chọn một trong các dashboard đã tạo sẵn
- Hoặc search theo tag: `system`, `application`, `logs`

## Datasources

Các datasource được cấu hình tự động:
- **Loki**: http://loki:3100 (logs)
- **Prometheus**: http://prometheus:9090 (metrics)
- **Tempo**: http://tempo:3200 (traces)

## Tùy chỉnh

### Chỉnh sửa dashboard
1. Mở dashboard trong Grafana UI
2. Click **Settings** (⚙️) ở góc trên
3. Chỉnh sửa panels, queries, etc.
4. **Save** (💾) và export JSON nếu muốn lưu vĩnh viễn
5. Copy JSON vào file tương ứng trong `dashboards/`

### Thêm dashboard mới
1. Tạo file `.json` mới trong thư mục `dashboards/`
2. Set `"id": null` để Grafana tự động tạo ID
3. Set `"uid": "unique-dashboard-id"` (unique identifier)
4. Rebuild container: `docker-compose up --build grafana`

## Metrics cần thiết

Để dashboards hoạt động đầy đủ, ứng dụng của bạn cần export các metrics:

### Prometheus metrics
```
# HTTP Request metrics
http_requests_total{service="your-service", status="200"}
http_request_duration_seconds_bucket{service="your-service", le="0.1"}

# System metrics (node_exporter)
node_cpu_seconds_total{mode="idle"}
node_memory_MemAvailable_bytes
node_memory_MemTotal_bytes
```

### Loki logs
Gửi logs đến Loki với format:
```json
{
  "level": "info",
  "message": "Request processed",
  "job": "your-service"
}
```

### Tempo traces
Sử dụng OpenTelemetry để gửi traces đến:
- HTTP: http://tempo:4318/v1/traces
- gRPC: tempo:4317

## Troubleshooting

### Dashboard không hiện dữ liệu
1. Kiểm tra datasources: **Configuration** > **Data Sources**
2. Verify metrics có sẵn trong Prometheus: http://localhost:9090
3. Verify logs có sẵn trong Loki: Grafana > Explore > Loki
4. Check logs của services: `docker-compose logs grafana prometheus loki tempo`

### Dashboard không tự động load
1. Check provisioning config: `dashboards/dashboards.yml`
2. Check Dockerfile đã COPY dashboards chưa
3. Rebuild container: `docker-compose up --build grafana`
4. Check Grafana logs: `docker-compose logs grafana | grep -i provision`

## Tham khảo
- [Grafana Documentation](https://grafana.com/docs/grafana/latest/)
- [Prometheus Query Guide](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [LogQL (Loki Query Language)](https://grafana.com/docs/loki/latest/logql/)
- [TraceQL (Tempo Query Language)](https://grafana.com/docs/tempo/latest/traceql/)
