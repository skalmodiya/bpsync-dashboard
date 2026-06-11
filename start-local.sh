#!/bin/bash
# ============================================================
# BUPA Sync Automation - Local Development Startup (Native)
# ============================================================
# Prerequisites:
#   - Python 3.11+ installed
#   - Node.js 18+ installed
#   - n8n running at http://localhost:5678
#   - Hyperspace LLM Proxy running at http://localhost:6655
# ============================================================

set -e

echo "============================================================"
echo " BUPA Sync Automation - Starting Local Stack"
echo "============================================================"
echo ""

# Check prerequisites
command -v python3 >/dev/null 2>&1 || { echo "ERROR: Python 3 not found."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: Node.js not found."; exit 1; }

echo "[1/5] Installing dependencies..."

# Backend
(cd backend && pip install -r requirements.txt -q)

# Mock S/4HANA
(cd mock-s4hana && pip install -r requirements.txt -q)

# Agent
(cd assets/bupa-sync-agent && pip install -r requirements.txt -q)

# Dashboard
(cd dashboard && npm install --silent)

echo ""
echo "[2/5] Starting Mock S/4HANA server (port 8090)..."
(cd mock-s4hana && python3 -m uvicorn main:app --host 0.0.0.0 --port 8090) &
PIDS+=($!)
sleep 2

echo "[3/5] Starting Backend API (port 8080)..."
(cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8080 --reload) &
PIDS+=($!)
sleep 2

echo "[4/5] Starting BUPA Sync Agent (port 5000)..."
(cd assets/bupa-sync-agent && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 5000) &
PIDS+=($!)
sleep 2

echo "[5/5] Starting Dashboard (port 3000)..."
(cd dashboard && npm run dev) &
PIDS+=($!)
sleep 3

echo ""
echo "============================================================"
echo " All services started!"
echo "============================================================"
echo ""
echo " Dashboard:       http://localhost:3000"
echo " Backend API:     http://localhost:8080"
echo " Agent:           http://localhost:5000"
echo " Mock S/4HANA:    http://localhost:8090"
echo " n8n:             http://localhost:5678  (must be running)"
echo " LLM Proxy:       http://localhost:6655  (must be running)"
echo ""
echo " Settings: Configure everything from http://localhost:3000/settings"
echo "============================================================"
echo ""
echo "Press Ctrl+C to stop all services..."

# Trap SIGINT to clean up
trap 'echo "Stopping..."; kill ${PIDS[@]} 2>/dev/null; exit 0' SIGINT SIGTERM

# Wait for all background processes
wait
