# Hướng dẫn Setup Metrics cho AI Education Platform

## Tổng quan

Để các dashboard Grafana hoạt động tốt, bạn cần instrument code để export metrics từ backend FastAPI.

## 1. Cài đặt thư viện

Thêm vào `backend/requirements.txt`:
```txt
prometheus-client>=0.19.0
prometheus-fastapi-instrumentator>=7.0.0
```

Cài đặt:
```bash
cd backend
pip install -r requirements.txt
```

## 2. Instrument FastAPI Application

### Cập nhật `backend/app/main.py`:

```python
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram, Gauge
import time

app = FastAPI()

# Khởi tạo Prometheus Instrumentator
instrumentator = Instrumentator(
    should_group_status_codes=False,
    should_ignore_untemplated=True,
    should_respect_env_var=True,
    should_instrument_requests_inprogress=True,
    excluded_handlers=[".*admin.*", "/metrics"],
    env_var_name="ENABLE_METRICS",
    inprogress_name="http_requests_inprogress",
    inprogress_labels=True,
)

# Custom metrics
ai_generation_requests = Counter(
    'ai_generation_requests_total',
    'Total AI generation requests',
    ['generation_type', 'model', 'status']
)

ai_generation_duration = Histogram(
    'ai_generation_duration_seconds',
    'AI generation duration in seconds',
    ['generation_type', 'model'],
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0)
)

chat_messages = Counter(
    'chat_messages_total',
    'Total chat messages',
    ['user_type']
)

materials_uploaded = Counter(
    'materials_uploaded_total',
    'Total materials uploaded',
    ['file_type']
)

active_users = Gauge(
    'active_users',
    'Number of currently active users'
)

# Instrument app
instrumentator.instrument(app)

@app.on_event("startup")
async def startup():
    # Expose metrics endpoint
    instrumentator.expose(app, endpoint="/metrics", include_in_schema=False)

# ... rest of your app code
```

## 3. Instrument Service Functions

### Trong `backend/app/services/generation_service.py`:

```python
from prometheus_client import Counter, Histogram
import time

# Import metrics từ main
from app.main import (
    ai_generation_requests,
    ai_generation_duration,
)

async def generate_content(generation_type: str, model: str, **kwargs):
    """Generate AI content with metrics tracking"""
    
    start_time = time.time()
    status = "success"
    
    try:
        # Your existing generation logic
        result = await your_ai_generation_function(**kwargs)
        
        return result
        
    except Exception as e:
        status = "error"
        raise
        
    finally:
        # Record metrics
        duration = time.time() - start_time
        
        ai_generation_requests.labels(
            generation_type=generation_type,
            model=model,
            status=status
        ).inc()
        
        ai_generation_duration.labels(
            generation_type=generation_type,
            model=model
        ).observe(duration)
```

### Trong `backend/app/services/chat_service.py`:

```python
from app.main import chat_messages

async def send_chat_message(user_id: str, message: str):
    """Send chat message with metrics"""
    
    # Your existing chat logic
    result = await your_chat_function(user_id, message)
    
    # Track metric
    chat_messages.labels(user_type="student").inc()
    
    return result
```

### Trong `backend/app/services/material_service.py`:

```python
from app.main import materials_uploaded

async def upload_material(file, file_type: str):
    """Upload material with metrics"""
    
    # Your existing upload logic
    result = await your_upload_function(file)
    
    # Track metric
    materials_uploaded.labels(file_type=file_type).inc()
    
    return result
```

## 4. Cấu hình Prometheus để Scrape Metrics

### Cập nhật `prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'backend'
    scrape_interval: 5s
    static_configs:
      - targets: ['backend:8000']  # Adjust port if different
    metrics_path: '/metrics'
```

## 5. Cập nhật docker-compose.yml

Thêm backend vào network và expose metrics:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - ENABLE_METRICS=true
    networks:
      - monitoring

  prometheus:
    # ... existing config
    networks:
      - monitoring
    depends_on:
      - backend

  loki:
    # ... existing config
    networks:
      - monitoring

  grafana:
    # ... existing config
    networks:
      - monitoring

networks:
  monitoring:
    driver: bridge
```

## 6. Test Metrics

### Khởi động stack:
```bash
docker-compose up --build
```

### Kiểm tra metrics endpoint:
```bash
curl http://localhost:8000/metrics
```

Bạn sẽ thấy output như:
```
# HELP ai_generation_requests_total Total AI generation requests
# TYPE ai_generation_requests_total counter
ai_generation_requests_total{generation_type="lesson_plan",model="gemini",status="success"} 42.0

# HELP ai_generation_duration_seconds AI generation duration in seconds
# TYPE ai_generation_duration_seconds histogram
ai_generation_duration_seconds_bucket{generation_type="lesson_plan",model="gemini",le="0.1"} 0.0
ai_generation_duration_seconds_bucket{generation_type="lesson_plan",model="gemini",le="0.5"} 5.0
...
```

### Kiểm tra Prometheus đã scrape được:
1. Mở http://localhost:9090
2. Vào **Status** > **Targets**
3. Verify `backend` target có trạng thái **UP**
4. Query: `ai_generation_requests_total`

## 7. Metrics Naming Convention

Tuân theo [Prometheus best practices](https://prometheus.io/docs/practices/naming/):

- **Counters**: `*_total` (e.g., `http_requests_total`)
- **Histograms**: `*_duration_seconds`, `*_size_bytes`
- **Gauges**: current state (e.g., `active_users`, `memory_usage_bytes`)

### Ví dụ metrics hữu ích:

```python
# Database queries
db_queries_total = Counter('db_queries_total', 'Total database queries', ['operation', 'collection'])
db_query_duration = Histogram('db_query_duration_seconds', 'DB query duration', ['operation'])

# Cache
cache_hits_total = Counter('cache_hits_total', 'Cache hits')
cache_misses_total = Counter('cache_misses_total', 'Cache misses')

# API rate limiting
rate_limit_exceeded_total = Counter('rate_limit_exceeded_total', 'Rate limit exceeded', ['endpoint'])

# Background tasks
background_tasks_total = Counter('background_tasks_total', 'Background tasks', ['task_type', 'status'])
background_task_duration = Histogram('background_task_duration_seconds', 'Task duration', ['task_type'])

# Storage
storage_bytes_total = Gauge('storage_bytes_total', 'Storage used in bytes', ['storage_type'])
file_uploads_bytes = Histogram('file_uploads_bytes', 'File upload sizes', buckets=(1024, 10240, 102400, 1048576, 10485760))
```

## 8. Logs với Structured Format

Để Loki dashboard hoạt động tốt, sử dụng structured logging:

### Cập nhật logging config:

```python
import logging
import json
from pythonjsonlogger import jsonlogger

# Setup JSON logger
logger = logging.getLogger()
handler = logging.StreamHandler()

formatter = jsonlogger.JsonFormatter(
    '%(asctime)s %(name)s %(levelname)s %(message)s',
    rename_fields={"asctime": "timestamp", "levelname": "level"}
)

handler.setFormatter(formatter)
logger.addHandler(handler)
logger.setLevel(logging.INFO)

# Usage
logger.info("User logged in", extra={
    "user_id": user_id,
    "ip_address": request.client.host
})

logger.error("AI generation failed", extra={
    "generation_type": "quiz",
    "model": "gemini",
    "error": str(e)
})
```

## 9. Tracing với Tempo (Optional)

Để sử dụng distributed tracing:

```bash
pip install opentelemetry-api opentelemetry-sdk opentelemetry-instrumentation-fastapi
```

```python
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

# Setup tracing
trace.set_tracer_provider(TracerProvider())
tracer = trace.get_tracer(__name__)

otlp_exporter = OTLPSpanExporter(
    endpoint="http://tempo:4318/v1/traces"
)

trace.get_tracer_provider().add_span_processor(
    BatchSpanProcessor(otlp_exporter)
)

# Instrument FastAPI
FastAPIInstrumentor.instrument_app(app)

# Manual tracing
async def generate_content():
    with tracer.start_as_current_span("ai_generation") as span:
        span.set_attribute("generation_type", "quiz")
        span.set_attribute("model", "gemini")
        
        result = await ai_model.generate()
        
        span.set_attribute("result_length", len(result))
        return result
```

## 10. Troubleshooting

### Metrics không xuất hiện trong Grafana:
1. Check `/metrics` endpoint: `curl http://localhost:8000/metrics`
2. Check Prometheus targets: http://localhost:9090/targets
3. Check Prometheus query: http://localhost:9090/graph
4. Check Grafana datasource connection

### Dashboard không có data:
1. Verify metric names match dashboard queries
2. Check time range trong Grafana
3. Generate some traffic để tạo metrics:
   ```bash
   # Load testing
   for i in {1..100}; do curl http://localhost:8000/api/health; done
   ```

### Logs không hiện:
1. Check logs format (JSON preferred)
2. Verify Loki datasource in Grafana
3. Check Loki targets và labels

## Tham khảo

- [Prometheus Client Python](https://github.com/prometheus/client_python)
- [FastAPI Instrumentator](https://github.com/trallnag/prometheus-fastapi-instrumentator)
- [OpenTelemetry Python](https://opentelemetry.io/docs/instrumentation/python/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
