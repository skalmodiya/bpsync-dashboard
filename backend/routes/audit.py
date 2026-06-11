"""Audit log API endpoints."""

from typing import Optional

from fastapi import APIRouter, Query, Request

from audit import get_events, clear_events, log_event
from auth import get_optional_user

router = APIRouter()


@router.get("")
async def list_audit_events(
    limit: int = Query(default=100, le=500),
    category: Optional[str] = Query(default=None),
    action: Optional[str] = Query(default=None),
) -> dict:
    """List audit events with optional filters."""
    events = get_events(limit=limit, category=category, action=action)
    return {"events": events, "total": len(events)}


@router.get("/categories")
async def list_categories() -> dict:
    """List available audit categories."""
    return {
        "categories": [
            {"id": "settings", "label": "Settings Changes"},
            {"id": "workflow", "label": "Workflow Actions"},
            {"id": "agent", "label": "Agent Invocations"},
            {"id": "system", "label": "System Events"},
            {"id": "auth", "label": "Authentication"},
        ]
    }


@router.delete("")
async def clear_audit_log(request: Request) -> dict:
    """Clear all audit events."""
    user = get_optional_user(request)
    count = clear_events()
    log_event(
        action="audit.cleared",
        category="system",
        user=user["user_id"],
        user_name=user["name"],
        user_email=user["email"],
        details={"events_deleted": count},
    )
    return {"status": "cleared", "events_deleted": count}
