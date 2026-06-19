"""Settings CRUD, connectivity test, and dynamic dropdown endpoints."""

import json
import os
import smtplib
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends, Request

from audit import log_event
from xsuaa import get_optional_user
from config import Settings, get_settings, load_settings, mask_settings, save_settings
from database import get_setting, set_setting
from destination import get_aicore_config, get_aicore_token

router = APIRouter()

TIMEOUT = 30.0


def _error(message: str, detail: str = "") -> dict:
    return {"error": message, "detail": detail}


@router.get("")
async def get_all_settings(settings: Settings = Depends(get_settings)) -> dict:
    return mask_settings(settings)


@router.put("/secrets")
async def update_secrets(payload: dict, request: Request) -> dict:
    """Update only secret/key fields directly."""
    current = load_settings()
    if "n8n_api_key" in payload and payload["n8n_api_key"] and not payload["n8n_api_key"].startswith("*"):
        current.n8n.api_key = payload["n8n_api_key"]
    if "llm_api_key" in payload and payload["llm_api_key"] and not payload["llm_api_key"].startswith("*"):
        current.llm.api_key = payload["llm_api_key"]
    if "smtp_password" in payload and payload["smtp_password"] and not payload["smtp_password"].startswith("*"):
        current.smtp.password = payload["smtp_password"]
    save_settings(current)
    return {"status": "saved"}


@router.put("")
async def update_settings(payload: Settings, request: Request) -> dict:
    """Save all settings. Preserves existing API keys if masked values submitted."""
    user = get_optional_user(request)
    current = load_settings()

    def preserve_if_masked(new_val: str, old_val: str) -> str:
        if not new_val:
            return ""
        if new_val.startswith("*") and len(new_val) > 4:
            return old_val
        return new_val

    payload.llm.api_key = preserve_if_masked(payload.llm.api_key, current.llm.api_key)
    payload.n8n.api_key = preserve_if_masked(payload.n8n.api_key, current.n8n.api_key)
    payload.smtp.password = preserve_if_masked(payload.smtp.password, current.smtp.password)

    save_settings(payload, user=user["user_id"])
    log_event(
        action="settings.updated",
        category="settings",
        user=user["user_id"],
        user_name=user["name"],
        user_email=user["email"],
        details={"sections_changed": ["llm", "n8n", "smtp", "mock_s4", "agent"]},
    )
    return {"status": "saved"}


@router.post("/test-llm")
async def test_llm_connection(request: Request, payload: Settings | None = None) -> dict:
    """Test LLM connection — handles both local proxy and SAP AI Core (via BTP destination)."""
    user = get_optional_user(request)
    saved = load_settings()
    settings = payload or saved
    if settings.llm.api_key and settings.llm.api_key.startswith("*"):
        settings.llm.api_key = saved.llm.api_key

    try:
        if settings.llm.provider == "sap_ai_core":
            try:
                token, ai_api_url = await get_aicore_token()
            except ValueError as e:
                return _error(str(e))
            url = f"{ai_api_url}/v2/lm/deployments"
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(
                    url,
                    headers={"Authorization": f"Bearer {token}", "AI-Resource-Group": "default"},
                )
            if resp.status_code == 200:
                deployments = resp.json().get("resources", [])
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"], {"type": "llm", "result": "success"})
                return {"status": "connected", "deployments": len(deployments)}
            return _error("SAP AI Core connection failed", f"Status {resp.status_code}: {resp.text[:200]}")
        else:
            url = settings.llm.base_url.rstrip("/") + "/models"
            headers: dict[str, str] = {}
            if settings.llm.api_key and not settings.llm.api_key.startswith("*"):
                headers["Authorization"] = f"Bearer {settings.llm.api_key}"
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"], {"type": "llm", "result": "success"})
                return {"status": "connected", "models": len(resp.json().get("data", []))}
            return _error("LLM connection failed", f"Status {resp.status_code}: {resp.text[:200]}")
    except httpx.ConnectError as e:
        return _error("Cannot reach LLM endpoint", str(e))
    except Exception as e:
        return _error("LLM test failed", str(e))


@router.post("/test-n8n")
async def test_n8n_connection(request: Request, payload: Settings | None = None) -> dict:
    user = get_optional_user(request)
    saved = load_settings()
    settings = payload or saved
    if settings.n8n.api_key and settings.n8n.api_key.startswith("*"):
        settings.n8n.api_key = saved.n8n.api_key
    url = settings.n8n.url.rstrip("/") + "/api/v1/workflows"
    headers: dict[str, str] = {}
    if settings.n8n.api_key and not settings.n8n.api_key.startswith("*"):
        headers["X-N8N-API-KEY"] = settings.n8n.api_key
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                count = len(resp.json().get("data", []))
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"],
                          {"type": "n8n", "result": "success", "workflow_count": count})
                return {"status": "connected", "workflow_count": count}
            return _error("n8n connection failed", f"Status {resp.status_code}: {resp.text[:200]}")
    except httpx.ConnectError as e:
        return _error("Cannot reach n8n", str(e))
    except Exception as e:
        return _error("n8n test failed", str(e))


@router.post("/test-s4")
async def test_s4_connection(request: Request, payload: Settings | None = None) -> dict:
    user = get_optional_user(request)
    settings = payload or load_settings()

    try:
        if settings.s4_source.source == "real":
            from destination import get_s4_client
            async with await get_s4_client(
                settings.s4_source.destination_name,
                settings.s4_source.sap_client,
            ) as client:
                # Try /sap/bc/ping — lightweight connectivity check that returns 200 with valid credentials
                resp = await client.get("/sap/bc/ping")
                if resp.status_code == 200:
                    label = "connected"
                elif resp.status_code in (401, 403):
                    # Reached S/4 but auth needs adjustment — still proves connectivity
                    label = "reachable (auth check needed)"
                elif resp.status_code == 404:
                    # /sap/bc/ping not active, try metadata
                    resp2 = await client.get("/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata")
                    label = "connected" if resp2.status_code == 200 else f"reachable (HTTP {resp2.status_code})"
                    resp = resp2
                else:
                    label = f"reachable (HTTP {resp.status_code})"
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"],
                          {"type": "s4_real", "result": label, "destination": settings.s4_source.destination_name})
                return {"status": label, "http_status": resp.status_code}
        else:
            url = settings.mock_s4.url.rstrip("/") + "/api/pa0000"
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                count = len(data) if isinstance(data, list) else data.get("count", "unknown")
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"],
                          {"type": "s4_mock", "result": "success", "record_count": count})
                return {"status": "connected", "record_count": count}
            return _error("Mock S/4 connection failed", f"Status {resp.status_code}: {resp.text[:200]}")
    except httpx.ConnectError as e:
        return _error("Cannot reach S/4HANA", str(e))
    except ValueError as e:
        return _error("S/4HANA configuration error", str(e))
    except Exception as e:
        src = "Real S/4HANA" if (settings.s4_source.source == "real") else "Mock S/4"
        return _error(f"{src} test failed", str(e))
        return _error("Mock S/4 test failed", str(e))


@router.post("/test-agent")
async def test_agent_connection(request: Request, payload: Settings | None = None) -> dict:
    user = get_optional_user(request)
    settings = payload or load_settings()
    agent_url = settings.agent.url.rstrip("/")
    if os.environ.get("DEPLOYMENT_MODE") == "docker":
        agent_url = agent_url.replace("http://localhost:5000", "http://bupa-sync-agent:5000")
    url = agent_url + "/health"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                log_event("settings.test_connection", "settings", user["user_id"],
                          user["name"], user["email"], {"type": "agent", "result": "success"})
                return {"status": "connected", "agent_response": resp.json()}
            return _error("Agent connection failed", f"Status {resp.status_code}: {resp.text[:200]}")
    except httpx.ConnectError as e:
        return _error("Cannot reach agent", str(e))
    except Exception as e:
        return _error("Agent test failed", str(e))


@router.post("/test-smtp")
async def test_smtp_connection(request: Request, payload: Settings | None = None) -> dict:
    import asyncio

    user = get_optional_user(request)
    saved = load_settings()
    settings = payload or saved
    if settings.smtp.password and settings.smtp.password.startswith("*"):
        settings.smtp.password = saved.smtp.password

    def _test_smtp():
        smtp = smtplib.SMTP(settings.smtp.host, settings.smtp.port, timeout=5)
        smtp.ehlo()
        smtp.starttls()
        smtp.ehlo()
        if settings.smtp.username and settings.smtp.password:
            smtp.login(settings.smtp.username, settings.smtp.password)
        smtp.quit()

    try:
        await asyncio.to_thread(_test_smtp)
        log_event("settings.test_connection", "settings", user["user_id"],
                  user["name"], user["email"], {"type": "smtp", "result": "success"})
        return {"status": "connected"}
    except smtplib.SMTPAuthenticationError as e:
        return _error("SMTP authentication failed", str(e))
    except (ConnectionRefusedError, OSError, TimeoutError) as e:
        return _error("Cannot reach SMTP server", str(e))
    except Exception as e:
        return _error("SMTP test failed", str(e))


@router.post("/send-test-email")
async def send_test_email(request: Request, payload: Settings | None = None) -> dict:
    import asyncio
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from datetime import datetime

    saved = load_settings()
    settings = payload or saved
    if settings.smtp.password and settings.smtp.password.startswith("*"):
        settings.smtp.password = saved.smtp.password

    recipients = settings.smtp.notification_emails or []
    if not recipients:
        return _error("No recipient emails configured")

    from_addr = settings.smtp.from_email or settings.smtp.username or "bupa-sync@noreply.local"

    def _send():
        msg = MIMEMultipart()
        msg["From"] = from_addr
        msg["To"] = ", ".join(recipients)
        msg["Subject"] = f"BUPA Sync - Test Email ({datetime.now().strftime('%H:%M:%S')})"
        body = f"""
        <h2>BUPA Sync Automation - Test Email</h2>
        <p>Your email configuration is working.</p>
        <hr>
        <p><strong>SMTP Host:</strong> {settings.smtp.host}:{settings.smtp.port}</p>
        <p><strong>Recipients:</strong> {", ".join(recipients)}</p>
        <p><strong>Sent at:</strong> {datetime.now().isoformat()}</p>
        """
        msg.attach(MIMEText(body, "html"))
        smtp = smtplib.SMTP(settings.smtp.host, settings.smtp.port, timeout=10)
        smtp.ehlo()
        if settings.smtp.username and settings.smtp.password:
            smtp.starttls()
            smtp.login(settings.smtp.username, settings.smtp.password)
        smtp.sendmail(from_addr, recipients, msg.as_string())
        smtp.quit()

    try:
        await asyncio.to_thread(_send)
        return {"status": "sent", "message": f"Test email sent to: {', '.join(recipients)}"}
    except Exception as e:
        return _error("Failed to send test email", str(e))


@router.get("/notification-emails")
async def get_notification_emails() -> dict:
    settings = load_settings()
    return {
        "emails": settings.smtp.notification_emails or [],
        "from_email": settings.smtp.from_email or settings.smtp.username or "",
    }


# --- Dynamic Dropdown Endpoints ---

@router.post("/fetch-n8n-workflows")
async def fetch_n8n_workflows(request: Request, payload: Settings | None = None) -> dict:
    saved = load_settings()
    settings = (
        payload
        if (payload and payload.n8n.api_key and not payload.n8n.api_key.startswith("*"))
        else saved
    )
    if not settings.n8n.api_key or settings.n8n.api_key.startswith("*"):
        return _error("n8n API key required")
    url = settings.n8n.url.rstrip("/") + "/api/v1/workflows"
    headers = {"X-N8N-API-KEY": settings.n8n.api_key}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                workflows = resp.json().get("data", [])
                return {
                    "workflows": [
                        {"id": w["id"], "name": w["name"], "active": w.get("active", False)}
                        for w in workflows
                    ]
                }
            return _error("Failed to fetch workflows", f"Status {resp.status_code}")
    except Exception as e:
        return _error("Cannot reach n8n", str(e))


@router.post("/fetch-llm-models")
async def fetch_llm_models(request: Request, payload: Settings | None = None) -> dict:
    saved = load_settings()
    settings = (
        payload
        if (payload and payload.llm.api_key and not payload.llm.api_key.startswith("*"))
        else saved
    )
    url = settings.llm.base_url.rstrip("/") + "/models"
    headers: dict[str, str] = {}
    if settings.llm.api_key and not settings.llm.api_key.startswith("*"):
        headers["Authorization"] = f"Bearer {settings.llm.api_key}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                models = resp.json().get("data", [])
                return {"models": [{"id": m.get("id", ""), "name": m.get("id", "Unknown")} for m in models]}
            return _error("Failed to fetch models", f"Status {resp.status_code}")
    except Exception as e:
        return _error("Cannot reach LLM", str(e))


@router.post("/fetch-aicore-deployments")
async def fetch_aicore_deployments(request: Request) -> dict:
    """Fetch active deployments from SAP AI Core via BTP destination."""
    try:
        token, ai_api_url = await get_aicore_token()
    except ValueError as e:
        return _error(str(e))
    except Exception as e:
        return _error("Failed to get AI Core credentials", str(e))

    dest_name = os.environ.get("AICORE_DESTINATION_NAME", "aicore")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(
                f"{ai_api_url}/v2/lm/deployments",
                headers={"Authorization": f"Bearer {token}", "AI-Resource-Group": "default"},
            )
        if resp.status_code != 200:
            return _error("Failed to fetch deployments", f"Status {resp.status_code}: {resp.text[:300]}")

        resources = resp.json().get("resources", [])
        deployments = [
            {
                "id": d.get("id", ""),
                "name": (
                    d.get("details", {}).get("resources", {}).get("backendDetails", {})
                     .get("model", {}).get("name")
                    or d.get("configurationName", "")
                    or d.get("id", "")
                ),
                "model_name": (
                    d.get("details", {}).get("resources", {}).get("backendDetails", {})
                     .get("model", {}).get("name", "")
                ),
                "scenario": d.get("scenarioId", ""),
                "status": d.get("status", ""),
                "deployment_url": d.get("deploymentUrl", ""),
            }
            for d in resources
            if d.get("status") == "RUNNING"
        ]
        return {"deployments": deployments, "destination": dest_name}
    except Exception as e:
        return _error("Failed to fetch AI Core deployments", str(e))


# --- Dashboard Configuration ---

DASHBOARD_CONFIG_KEY = "dashboard_config"


@router.get("/dashboard")
async def get_dashboard_config() -> dict:
    raw = get_setting(DASHBOARD_CONFIG_KEY, "")
    if raw:
        try:
            return json.loads(raw)
        except (json.JSONDecodeError, ValueError):
            return {}
    return {}


@router.put("/dashboard")
async def save_dashboard_config(request: Request, config: Any = Body(...)) -> dict:
    user = get_optional_user(request)
    set_setting(DASHBOARD_CONFIG_KEY, json.dumps(config), user=user["user_id"])
    log_event("settings.dashboard_updated", "settings", user["user_id"],
              user["name"], user["email"], {"action": "dashboard_config_saved"})
    return {"status": "saved"}


@router.post("/reset-app")
async def reset_app(request: Request, payload: dict = Body(...)) -> dict:
    from database import get_connection

    user = get_optional_user(request)
    confirmation = payload.get("confirmation", "")
    purpose = payload.get("purpose", "")
    targets = payload.get("targets", [])

    if confirmation != "DELETE":
        return {"error": "Invalid confirmation", "detail": "Type DELETE to confirm reset"}
    if not purpose or len(purpose) < 10:
        return {"error": "Purpose required", "detail": "Provide a reason (minimum 10 characters)"}
    if not targets:
        return {"error": "No targets selected"}

    valid_targets = ["audit_log", "agent_logs", "sync_history", "settings"]
    invalid = [t for t in targets if t not in valid_targets]
    if invalid:
        return {"error": f"Invalid targets: {invalid}", "detail": f"Valid targets: {valid_targets}"}

    reset_event = log_event(
        action="system.app_reset",
        category="system",
        user=user["user_id"],
        user_name=user["name"],
        user_email=user.get("email", ""),
        details={"targets": targets, "purpose": purpose, "protected": True},
    )

    results = {}

    with get_connection() as conn:
        if "audit_log" in targets:
            cursor = conn.execute(
                "DELETE FROM audit_log WHERE NOT (action = 'system.app_reset' AND category = 'system')"
            )
            results["audit_log"] = f"{cursor.rowcount} events deleted (reset events preserved)"

        if "settings" in targets:
            save_settings(Settings(), user=user["user_id"])
            results["settings"] = "Settings reset to defaults"

        if "sync_history" in targets:
            from pathlib import Path
            history_file = Path(__file__).parent.parent / "data" / "sync_history.json"
            if history_file.exists():
                history_file.unlink()
            results["sync_history"] = "Sync history cleared"

        if "agent_logs" in targets:
            import shutil
            from pathlib import Path
            logs_dir = Path(__file__).parent.parent / "data" / "agent_logs"
            if logs_dir.exists():
                count = len(list(logs_dir.glob("*.json")))
                shutil.rmtree(logs_dir)
                logs_dir.mkdir(parents=True, exist_ok=True)
                results["agent_logs"] = f"{count} invocation logs deleted"
            else:
                results["agent_logs"] = "No logs to delete"

    return {"status": "reset_complete", "results": results, "reset_event_id": reset_event.get("id", "")}


@router.post("/debug-destination")
async def debug_destination(request: Request) -> dict:
    """Debug: show what the destination service returns for S4 destination."""
    from destination import resolve_destination
    dest = await resolve_destination("S4_SIA_I577956")
    if not dest:
        return {"error": "Destination not found"}
    props = dest.get("destinationConfiguration", dest)
    # Show all keys except Password
    safe = {k: v for k, v in props.items() if "password" not in k.lower() and "Password" not in k}
    return {"keys": list(props.keys()), "safe_props": safe, "has_password": "Password" in props}


@router.post("/probe-s4")
async def probe_s4_paths(request: Request) -> dict:
    """Probe common S/4HANA OData paths to discover available services."""
    from destination import get_s4_client
    settings = load_settings()
    results = {}
    paths = [
        "/sap/bc/ping",
        "/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata",
        "/sap/opu/odata/sap/HCM_PAOMCE_SRV/$metadata",
        "/sap/opu/odata/sap/ZHCM_PA0000_SRV/$metadata",
        "/sap/opu/odata/sap/PA0000_SRV/$metadata",
        "/api/pa0000",
        "/api/bupa/sync/log",
        "/sap/bc/adt/discovery",
    ]
    try:
        async with await get_s4_client(
            settings.s4_source.destination_name,
            settings.s4_source.sap_client,
        ) as client:
            for path in paths:
                try:
                    r = await client.get(path, follow_redirects=False)
                    results[path] = r.status_code
                except Exception as e:
                    results[path] = str(e)[:50]
    except Exception as e:
        return {"error": str(e)[:200]}
    return results
