"""n8n API proxy routes.

All calls proxy to the n8n instance using the configured URL and API key.
"""

from typing import Any, Optional

import httpx
from fastapi import APIRouter, Depends, Query

from audit import log_event
from config import Settings, get_settings

router = APIRouter()

TIMEOUT = 30.0


def _n8n_headers(settings: Settings) -> dict[str, str]:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if settings.n8n.api_key:
        headers["X-N8N-API-KEY"] = settings.n8n.api_key
    return headers


def _error(message: str, detail: str = "") -> dict:
    return {"error": message, "detail": detail}


@router.get("/workflows")
async def list_workflows(settings: Settings = Depends(get_settings)) -> Any:
    """List all workflows from n8n."""
    url = settings.n8n.url.rstrip("/") + "/api/v1/workflows"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=_n8n_headers(settings))
            if resp.status_code == 200:
                return resp.json()
            return _error(
                "Failed to fetch workflows",
                f"Status {resp.status_code}: {resp.text[:200]}",
            )
    except httpx.ConnectError as e:
        return _error("Cannot reach n8n", str(e))
    except Exception as e:
        return _error("Workflow fetch failed", str(e))


@router.get("/executions")
async def list_executions(
    limit: int = Query(default=20, le=100),
    settings: Settings = Depends(get_settings),
) -> Any:
    """List recent executions from n8n for monitored workflows, enriched with names."""
    url = settings.n8n.url.rstrip("/") + "/api/v1/executions"
    monitored_ids = settings.n8n.monitored_workflow_ids

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            # Fetch workflow names for enrichment
            wf_names: dict[str, str] = {}
            try:
                wf_resp = await client.get(
                    settings.n8n.url.rstrip("/") + "/api/v1/workflows",
                    headers=_n8n_headers(settings),
                )
                if wf_resp.status_code == 200:
                    for wf in wf_resp.json().get("data", []):
                        wf_names[wf["id"]] = wf.get("name", "")
            except Exception:
                pass

            if monitored_ids:
                # Fetch executions for each monitored workflow and merge
                all_executions = []
                for wf_id in monitored_ids:
                    params: dict[str, Any] = {"limit": limit, "workflowId": wf_id}
                    resp = await client.get(
                        url, headers=_n8n_headers(settings), params=params
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        executions = data.get("data", [])
                        all_executions.extend(executions)
                # Sort by startedAt descending and limit
                all_executions.sort(key=lambda x: x.get("startedAt", ""), reverse=True)
                enriched = all_executions[:limit]
            else:
                # No filter configured — show all
                params = {"limit": limit}
                resp = await client.get(
                    url, headers=_n8n_headers(settings), params=params
                )
                if resp.status_code == 200:
                    enriched = resp.json().get("data", [])
                else:
                    return _error(
                        "Failed to fetch executions",
                        f"Status {resp.status_code}: {resp.text[:200]}",
                    )

            # Enrich with workflow names
            for ex in enriched:
                ex["workflowName"] = wf_names.get(ex.get("workflowId", ""), "")

            return {"data": enriched}
    except httpx.ConnectError as e:
        return _error("Cannot reach n8n", str(e))
    except Exception as e:
        return _error("Execution fetch failed", str(e))


@router.get("/executions/{execution_id}")
async def get_execution(
    execution_id: str,
    settings: Settings = Depends(get_settings),
) -> Any:
    """Get details of a specific execution."""
    url = settings.n8n.url.rstrip("/") + f"/api/v1/executions/{execution_id}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.get(url, headers=_n8n_headers(settings))
            if resp.status_code == 200:
                return resp.json()
            return _error(
                "Failed to fetch execution",
                f"Status {resp.status_code}: {resp.text[:200]}",
            )
    except httpx.ConnectError as e:
        return _error("Cannot reach n8n", str(e))
    except Exception as e:
        return _error("Execution fetch failed", str(e))


@router.post("/workflows/{workflow_id}/activate")
async def activate_workflow(
    workflow_id: str,
    settings: Settings = Depends(get_settings),
) -> Any:
    """Activate a workflow in n8n."""
    url = settings.n8n.url.rstrip("/") + f"/api/v1/workflows/{workflow_id}/activate"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            resp = await client.post(url, headers=_n8n_headers(settings))
            if resp.status_code == 200:
                return resp.json()
            return _error(
                "Failed to activate workflow",
                f"Status {resp.status_code}: {resp.text[:200]}",
            )
    except httpx.ConnectError as e:
        return _error("Cannot reach n8n", str(e))
    except Exception as e:
        return _error("Workflow activation failed", str(e))


@router.post("/trigger/bupa-sync")
async def trigger_bupa_sync(
    payload: Optional[dict[str, Any]] = None,
    settings: Settings = Depends(get_settings),
) -> Any:
    """Trigger the BUPA sync workflow via webhook.

    Uses webhook_url from settings if configured (e.g. ngrok tunnel),
    otherwise falls back to n8n url.
    """
    if payload is None:
        payload = {"sync_scope": "all_active", "dry_run": False}

    # Use webhook_url if configured (e.g. ngrok), otherwise n8n base url
    base = (
        settings.n8n.webhook_url.rstrip("/")
        if settings.n8n.webhook_url
        else settings.n8n.url.rstrip("/")
    )

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Try production webhook first (workflow must be active/published)
            prod_url = f"{base}/webhook/bupa-sync"
            resp = await client.post(prod_url, json=payload)
            if resp.status_code in (200, 201):
                log_event(
                    action="workflow.triggered",
                    category="workflow",
                    details={
                        "mode": "production",
                        "url": prod_url,
                        "result": "success",
                    },
                )
                return {
                    "status": "triggered",
                    "mode": "production",
                    "url": prod_url,
                    "response": resp.json(),
                }

            # Fallback: try test webhook (works when workflow is open in n8n editor)
            test_url = f"{base}/webhook-test/bupa-sync"
            resp2 = await client.post(test_url, json=payload)
            if resp2.status_code in (200, 201):
                log_event(
                    action="workflow.triggered",
                    category="workflow",
                    details={"mode": "test", "url": test_url, "result": "success"},
                )
                return {
                    "status": "triggered",
                    "mode": "test",
                    "url": test_url,
                    "response": resp2.json(),
                }

            log_event(
                action="workflow.triggered",
                category="workflow",
                details={
                    "result": "failed",
                    "prod_status": resp.status_code,
                    "test_status": resp2.status_code,
                },
            )
            return _error(
                "Failed to trigger workflow",
                f"Production webhook ({resp.status_code}): {resp.text[:100]}. "
                f"Test webhook ({resp2.status_code}): {resp2.text[:100]}. "
                "Make sure the workflow is active (published) OR open in the n8n editor with 'Listen for test event'.",
            )
    except httpx.ConnectError as e:
        log_event(
            action="workflow.triggered",
            category="workflow",
            details={"result": "connection_error", "error": str(e)},
        )
        return _error("Cannot reach n8n webhook", str(e))
    except Exception as e:
        log_event(
            action="workflow.triggered",
            category="workflow",
            details={"result": "error", "error": str(e)},
        )
        return _error("Trigger failed", str(e))
