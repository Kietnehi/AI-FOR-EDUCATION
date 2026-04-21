@echo off
echo ========================================
echo  Grafana Dashboards - Quick Start
echo ========================================
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python first.
    echo Download from: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM Check if prometheus-client is installed
python -c "import prometheus_client" >nul 2>&1
if errorlevel 1 (
    echo [STEP 1/3] Installing prometheus-client...
    pip install prometheus-client
) else (
    echo [STEP 1/3] prometheus-client already installed
)

echo.
echo [STEP 2/3] Starting Sample Data Generator...
echo          This will generate fake metrics for testing dashboards
echo          Metrics available at: http://localhost:8001/metrics
echo.

REM Start data generator in new window
start "Sample Data Generator" python sample-data-generator.py

timeout /t 3 /nobreak >nul

echo [STEP 3/3] Starting Grafana Stack...
echo          Please wait, this may take a few minutes...
echo.

REM Start docker-compose
docker-compose up --build

REM Cleanup on exit
taskkill /FI "WINDOWTITLE eq Sample Data Generator*" /F >nul 2>&1
