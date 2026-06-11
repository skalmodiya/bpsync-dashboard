@echo off
REM ============================================================
REM BUPA Sync Automation - Local Development Startup (Native)
REM ============================================================
REM Prerequisites:
REM   - Python 3.11+ installed
REM   - Node.js 18+ installed
REM   - n8n running at http://localhost:5678
REM   - Hyperspace LLM Proxy running at http://localhost:6655
REM ============================================================

echo ============================================================
echo  BUPA Sync Automation - Starting Local Stack
echo ============================================================
echo.

REM Check prerequisites
where python >nul 2>&1 || (echo ERROR: Python not found. Install Python 3.11+ && exit /b 1)
where node >nul 2>&1 || (echo ERROR: Node.js not found. Install Node.js 18+ && exit /b 1)

echo [1/5] Installing dependencies...

REM Backend
cd backend
pip install -r requirements.txt -q
cd ..

REM Mock S/4HANA
cd mock-s4hana
pip install -r requirements.txt -q
cd ..

REM Agent
cd assets\bupa-sync-agent
pip install -r requirements.txt -q
cd ..\..

REM Dashboard
cd dashboard
call npm install --silent
cd ..

echo.
echo [2/5] Starting Mock S/4HANA server (port 8090)...
start "Mock S/4HANA" cmd /c "cd mock-s4hana && python -m uvicorn main:app --host 0.0.0.0 --port 8090"
timeout /t 2 /nobreak >nul

echo [3/5] Starting Backend API (port 8080)...
start "Backend API" cmd /c "cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload"
timeout /t 2 /nobreak >nul

echo [4/5] Starting BUPA Sync Agent (port 5000)...
start "BUPA Sync Agent" cmd /c "cd assets\bupa-sync-agent && python -m uvicorn app.main:app --host 0.0.0.0 --port 5000"
timeout /t 2 /nobreak >nul

echo [5/5] Starting Dashboard (port 3000)...
start "Dashboard" cmd /c "cd dashboard && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo  All services started!
echo ============================================================
echo.
echo  Dashboard:       http://localhost:3000
echo  Backend API:     http://localhost:8080
echo  Agent:           http://localhost:5000
echo  Mock S/4HANA:    http://localhost:8090
echo  n8n:             http://localhost:5678  (must be running)
echo  LLM Proxy:       http://localhost:6655  (must be running)
echo  Mailpit UI:      (run 'docker run -p 1025:1025 -p 8025:8025 axllent/mailpit' for email testing)
echo.
echo  Settings: Configure everything from http://localhost:3000/settings
echo ============================================================
echo.
echo Press any key to stop all services...
pause >nul

REM Kill all started processes
taskkill /FI "WINDOWTITLE eq Mock S/4HANA*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Backend API*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq BUPA Sync Agent*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Dashboard*" /F >nul 2>&1
echo All services stopped.
