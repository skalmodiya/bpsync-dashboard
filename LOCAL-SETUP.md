# BUPA Sync Automation - Local Setup Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR MACHINE                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Dashboard   │    │  Backend API │    │  BUPA Sync   │  │
│  │  (React)     │───▶│  (FastAPI)   │───▶│  Agent       │  │
│  │  :3000       │    │  :8080       │    │  :5000       │  │
│  └──────────────┘    └──────┬───────┘    └──────┬───────┘  │
│                             │                    │           │
│  ┌──────────────┐    ┌──────▼───────┐    ┌──────▼───────┐  │
│  │  n8n         │    │ Mock S/4HANA │    │  LLM Proxy   │  │
│  │  (yours)     │    │  (FastAPI)   │    │ (Hyperspace) │  │
│  │  :5678       │    │  :8090       │    │  :6655       │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────┐                                           │
│  │  Mailpit     │  (optional - for email testing)           │
│  │  :8025/:1025 │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Python | 3.11+ | `python --version` |
| Node.js | 18+ | `node --version` |
| n8n | Running | Open http://localhost:5678 |
| Hyperspace LLM Proxy | Running | `curl http://localhost:6655/litellm/v1/models` |

## Quick Start

### Option A: Native Processes (Recommended for Development)

```bash
# Windows
start-local.bat

# macOS/Linux
chmod +x start-local.sh
./start-local.sh
```

This starts all services and opens them in separate terminal windows.

### Option B: Docker Compose

```bash
docker-compose up --build
```

Note: With Docker, the n8n and LLM Proxy URLs need to use `host.docker.internal` instead of `localhost`. Configure this in the Settings page after startup.

## Step-by-Step Manual Setup

### 1. Install Dependencies

```bash
# Backend API
cd backend
pip install -r requirements.txt

# Mock S/4HANA
cd ../mock-s4hana
pip install -r requirements.txt

# BUPA Sync Agent
cd ../assets/bupa-sync-agent
pip install -r requirements.txt

# Dashboard
cd ../../dashboard
npm install
```

### 2. Start Services (in separate terminals)

**Terminal 1 - Mock S/4HANA:**
```bash
cd mock-s4hana
uvicorn main:app --host 0.0.0.0 --port 8090
```

**Terminal 2 - Backend API:**
```bash
cd backend
uvicorn main:app --host 0.0.0.0 --port 8080 --reload
```

**Terminal 3 - BUPA Sync Agent:**
```bash
cd assets/bupa-sync-agent
uvicorn app.main:app --host 0.0.0.0 --port 5000
```

**Terminal 4 - Dashboard:**
```bash
cd dashboard
npm run dev
```

### 3. Configure Settings

1. Open **http://localhost:3000/settings**
2. Configure LLM:
   - Provider: `Local Proxy`
   - Base URL: `http://localhost:6655/litellm/v1`
   - Model: `anthropic--claude-4.6-sonnet` (or any model from your proxy)
   - Click "Test Connection" to verify
3. Configure n8n:
   - URL: `http://localhost:5678`
   - API Key: (your n8n API key)
   - Click "Test Connection" to verify
4. Click **Save Settings**

### 4. Import n8n Workflow

1. Open n8n at http://localhost:5678
2. Go to Workflows → Import from file
3. Select `assets/n8n/workflows/bupa-sync-orchestration.n8n.json`
4. Update the workflow's SAP MCP Client nodes to point to Mock S/4HANA:
   - Change the MCP server URL to `http://localhost:8090`
5. Update the "Invoke BUPA Sync Agent" node:
   - Set agent URL to `http://localhost:5000`
6. Activate the workflow

### 5. Test the Flow

1. From the Dashboard (http://localhost:3000):
   - Go to **Workflows** page
   - Click **"Trigger Sync"**
   - Watch the execution progress in the table below
2. Or trigger directly from n8n UI:
   - Open the workflow → Click "Execute Workflow"

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | http://localhost:3000 | UI for monitoring and settings |
| Backend API | http://localhost:8080 | Config management, proxying |
| Agent | http://localhost:5000 | AI error analysis agent |
| Mock S/4HANA | http://localhost:8090 | Simulated SAP backend |
| n8n | http://localhost:5678 | Workflow orchestration |
| LLM Proxy | http://localhost:6655 | AI model access |
| Mailpit UI | http://localhost:8025 | Email testing (if running) |
| Mock S/4 Docs | http://localhost:8090/docs | API documentation |

## Available LLM Models (via Hyperspace Proxy)

| Model | ID for Settings | Provider |
|-------|-----------------|----------|
| Claude 4.6 Sonnet | `anthropic--claude-4.6-sonnet` | Anthropic |
| Claude 4.6 Opus | `anthropic--claude-4.6-opus` | Anthropic |
| GPT-4.1 | `gpt-4.1` | OpenAI |
| GPT-4.1 Mini | `gpt-4.1-mini` | OpenAI |
| Gemini 2.5 Pro | `gemini-2.5-pro` | Google |

## Configuration Modes

| Mode | Settings Source | n8n URL | S/4HANA | LLM |
|------|----------------|---------|---------|-----|
| **Local** | `backend/data/settings.json` | `localhost:5678` | Mock `:8090` | Proxy `:6655` |
| **Docker** | Mounted volume `settings.json` | `host.docker.internal:5678` | Container `:8090` | `host.docker.internal:6655` |
| **Production** | Env vars (fallback) | BTP n8n instance | Real S/4HANA via Cloud Connector | SAP AI Core |

## Troubleshooting

### Agent can't connect to LLM
- Check LLM Proxy is running: `curl http://localhost:6655/litellm/v1/models`
- Verify model name in Settings matches an available model
- Check Settings page → LLM → "Test Connection"

### n8n workflow fails
- Ensure mock S/4HANA is running: `curl http://localhost:8090/api/pa0000`
- Check n8n workflow nodes point to correct URLs
- View execution logs in n8n UI

### Dashboard shows "Connection Failed"
- Verify backend is running: `curl http://localhost:8080/health`
- Check browser console for CORS errors
- Ensure Vite proxy config points to correct backend port

### Docker: Services can't reach host services
- Use `host.docker.internal` instead of `localhost` in Settings
- Ensure Docker Desktop has host networking enabled
- On Linux, use `--network host` or configure `extra_hosts`

## Email Testing (Optional)

For testing email notifications without a real SMTP server:

```bash
docker run -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Then configure in Settings:
- SMTP Host: `localhost`
- SMTP Port: `1025`
- View emails at http://localhost:8025
