# 🎯 Grafana Dashboards - Setup Complete!

## ⚡ Quick Start (Recommended)

### Option 1: One-Click Start (Windows)
```batch
start-with-sample-data.bat
```
Sau khi stack chạy, mở terminal mới và chạy:
```batch
open-dashboards.bat
```

### Option 2: Manual Start
```bash
# Terminal 1: Start sample data generator
python sample-data-generator.py

# Terminal 2: Start Grafana stack
docker-compose up --build

# Then open: http://localhost:3300
# Login: admin / yourpassword123
```

---

## 📊 Dashboards Created

### ✅ 1. Monitoring Stack Health
**Status:** ✅ Has data immediately!  
**Purpose:** Monitor Prometheus, Grafana, and the monitoring stack itself

**Panels:**
- Prometheus Status
- Number of Series/Targets
- Storage Size
- Request Rate
- Memory Usage
- Target Status Table

**Use when:** You want to ensure the monitoring infrastructure is healthy

---

### 🎓 2. AI Education Platform
**Status:** ✅ Works with sample data  
**Purpose:** Monitor your AI Learning Platform application

**Panels:**
- Active Users (requests/min)
- AI Generations count (1h)
- Chat Messages (1h)
- Materials Uploaded (1h)
- AI Generation Latency by Model (p50, p95)
- API Endpoint Usage
- Generation Types Distribution (pie chart)
- AI Model Usage (pie chart)
- API Success Rate (gauge)
- Application Logs

**Use when:** Monitoring production AI platform with real metrics

---

### 📈 3. Application Metrics
**Status:** ✅ Works with sample data  
**Purpose:** General application performance monitoring

**Panels:**
- Request Rate by Service
- Response Time (p95) by Service
- Error Rate (5xx)
- HTTP Status Code Distribution
- Trace Search (Tempo integration)

**Use when:** General HTTP API monitoring

---

### 📝 4. Logs Dashboard
**Status:** ⚠️ Needs Loki logs  
**Purpose:** Log aggregation and analysis

**Panels:**
- Log Volume Over Time
- Log Levels (error, warn, info, debug)
- Error Count gauge
- Log Explorer with search filter

**Use when:** You have logs flowing to Loki

---

### 🖥️ 5. System Overview
**Status:** ⚠️ Needs system metrics  
**Purpose:** System-level monitoring (CPU, RAM, etc.)

**Panels:**
- CPU Usage
- Memory Usage
- Recent Logs

**Use when:** You have node_exporter running

---

## 🔧 Current Status

### ✅ Working Now
- **Monitoring Stack Health** - Self-monitoring dashboard
- **Sample Data Generator** - Fake data for testing
- **Grafana + Prometheus + Loki + Tempo** - All services configured

### ⏳ Next Steps for Full Integration
1. Add Prometheus metrics to backend (see `METRICS_SETUP.md`)
2. Configure log shipping to Loki (optional)
3. Add distributed tracing with Tempo (optional)

---

## 🎮 How to Use

### Test with Sample Data (Now)
1. Run `start-with-sample-data.bat` OR `python sample-data-generator.py`
2. Wait for Grafana to start
3. Open http://localhost:3300 (admin/yourpassword123)
4. Go to **Dashboards** → Try these:
   - **Monitoring Stack Health** ← Start here!
   - **AI Education Platform**
   - **Application Metrics**

### Integrate with Real Backend
See detailed guide in: `METRICS_SETUP.md`

Quick version:
```bash
cd backend
pip install prometheus-client prometheus-fastapi-instrumentator

# Add to backend/app/main.py
from prometheus_fastapi_instrumentator import Instrumentator
instrumentator = Instrumentator()
instrumentator.instrument(app)
instrumentator.expose(app, endpoint="/metrics")
```

---

## 🌐 Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| **Grafana** | http://localhost:3300 | admin / yourpassword123 |
| **Prometheus** | http://localhost:9090 | - |
| **Loki** | http://localhost:3100 | - |
| **Tempo** | http://localhost:3200 | - |
| **Sample Metrics** | http://localhost:8001/metrics | - |

---

## 🐛 Troubleshooting

### "No Data" in Dashboards?

**Check 1: Is sample data generator running?**
```bash
# Should see output in terminal:
🚀 Starting Sample Data Generator...
📊 Metrics available at: http://localhost:8001/metrics
```

**Check 2: Prometheus scraping metrics?**
1. Go to http://localhost:9090/targets
2. Look for these targets:
   - `prometheus` → Should be **UP** ✅
   - `sample-data` → Should be **UP** ✅ (if generator running)
   - `backend` → May be **DOWN** ⚠️ (normal if no /metrics endpoint)

**Check 3: Query metrics directly**
1. Go to http://localhost:9090/graph
2. Try query: `up`
3. Try query: `http_requests_total`
4. Should see results!

**Check 4: Time range in Grafana**
- Top-right corner of dashboard
- Try "Last 5 minutes" or "Last 15 minutes"
- Click refresh icon

### Docker Issues?

```bash
# Rebuild everything
docker-compose down -v
docker-compose up --build

# Check logs
docker-compose logs grafana
docker-compose logs prometheus
```

### Port Already in Use?

```bash
# Check what's using ports
netstat -ano | findstr :3300
netstat -ano | findstr :9090
netstat -ano | findstr :8001

# Kill process or change port in docker-compose.yml
```

---

## 📁 File Structure

```
railway-grafana-stack/
├── grafana/
│   ├── dashboards/
│   │   ├── dashboards.yml                    # Provisioning config
│   │   ├── monitoring-stack-health.json      # ✅ Self-monitoring
│   │   ├── ai-education-platform.json        # 🎓 AI platform
│   │   ├── application-metrics.json          # 📈 General metrics
│   │   ├── logs-dashboard.json               # 📝 Logs
│   │   ├── system-overview.json              # 🖥️ System
│   │   ├── README.md                         # Dashboard docs
│   │   ├── METRICS_SETUP.md                  # Backend integration
│   │   └── QUICK_START.md                    # Quick guide
│   ├── datasources/
│   │   └── datasources.yml                   # Loki, Prometheus, Tempo
│   └── dockerfile                            # Grafana container
├── prometheus/
│   └── prom.yml                              # Prometheus config
├── loki/
├── tempo/
├── sample-data-generator.py                  # 🎲 Test data
├── start-with-sample-data.bat                # 🚀 One-click start
├── open-dashboards.bat                       # 🌐 Open URLs
└── docker-compose.yml                        # Stack definition
```

---

## 📚 Documentation

- **QUICK_START.md** - Fast testing guide (read this first!)
- **METRICS_SETUP.md** - Integrate with real backend (detailed)
- **README.md** - Dashboard overview (this file)
- **dashboards/README.md** - Dashboard details

---

## 🎯 Recommended Workflow

### Day 1: Test with Sample Data
1. ✅ Run `start-with-sample-data.bat`
2. ✅ Explore dashboards
3. ✅ Understand metrics structure

### Day 2: Integrate Backend
1. ✅ Read `METRICS_SETUP.md`
2. ✅ Add Prometheus client to backend
3. ✅ Expose `/metrics` endpoint
4. ✅ Test with: `curl http://localhost:8000/metrics`

### Day 3: Custom Metrics
1. ✅ Add custom metrics for your features
2. ✅ Create custom dashboards if needed
3. ✅ Set up alerts (optional)

### Day 4+: Production
1. ✅ Monitor real traffic
2. ✅ Tune dashboards
3. ✅ Add logging to Loki (optional)
4. ✅ Add tracing with Tempo (optional)

---

## 💡 Tips

- **Start simple**: Use sample data generator first
- **Monitor the monitor**: Check "Monitoring Stack Health" dashboard
- **Check Prometheus targets**: http://localhost:9090/targets
- **Query directly**: Use Prometheus UI to test queries
- **Time range matters**: Adjust in top-right of dashboards
- **Refresh often**: Click refresh icon or enable auto-refresh

---

## 🆘 Need Help?

1. Check `QUICK_START.md` for common issues
2. Check Prometheus targets: http://localhost:9090/targets
3. Check Grafana datasources: Grafana → Configuration → Data Sources
4. Check Docker logs: `docker-compose logs grafana prometheus`
5. Test metrics endpoint: `curl http://localhost:8001/metrics`

---

## 🎉 Success Checklist

- [x] Created 5 comprehensive dashboards
- [x] Set up Prometheus + Loki + Tempo + Grafana
- [x] Created sample data generator for testing
- [x] Documented everything
- [x] One-click start scripts
- [ ] Integrate with real backend (your turn!)
- [ ] Add custom metrics
- [ ] Deploy to production

---

**Ready to start?** Run `start-with-sample-data.bat` and explore! 🚀
