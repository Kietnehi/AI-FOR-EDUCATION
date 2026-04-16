@echo off
echo ========================================
echo  Testing Grafana Dashboards
echo ========================================
echo.

echo Opening important URLs in your browser...
timeout /t 2 /nobreak >nul

REM Open Grafana
start http://localhost:3300

REM Wait a bit
timeout /t 2 /nobreak >nul

REM Open Prometheus
start http://localhost:9090/targets

echo.
echo ========================================
echo  URLs Opened:
echo ========================================
echo  - Grafana:    http://localhost:3300
echo    Login: admin / yourpassword123
echo.
echo  - Prometheus: http://localhost:9090/targets
echo    Check if targets are UP
echo.
echo ========================================
echo  Quick Guide:
echo ========================================
echo  1. Login to Grafana
echo  2. Go to Dashboards (left menu)
echo  3. Try these dashboards:
echo     - Monitoring Stack Health (has data!)
echo     - AI Education Platform (sample data)
echo     - Application Metrics (sample data)
echo.
echo  4. Check Prometheus Targets:
echo     - 'prometheus' should be UP
echo     - 'sample-data' should be UP
echo     - 'backend' may be DOWN (normal)
echo.
pause
