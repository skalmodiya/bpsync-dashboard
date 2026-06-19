"""Audit logging system for BUPA Sync — SQLite backed."""

from typing import Any, Optional

from database import log_audit_event, get_audit_events


def log_event(
    action: str,
    category: str,
    user: str = "system",
    user_name: str = "System",
    user_email: str = "",
    details: Optional[dict[str, Any]] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> dict:
    """Log an audit event. Returns the event dict."""
    return log_audit_event(
        action=action,
        category=category,
        user_id=user,
        user_name=user_name,
        user_email=user_email,
        details=details,
        metadata=metadata,
    )


def get_events(
    limit: int = 100,
    category: Optional[str] = None,
    action: Optional[str] = None,
) -> list[dict]:
    """Read audit events, most recent first."""
    return get_audit_events(limit=limit, category=category)


def clear_events() -> int:
    """Clear all audit events (except protected system.app_reset events). Returns count deleted."""
    from database import get_connection

    with get_connection() as conn:
        row = conn.fetchone(
            "SELECT COUNT(*) as cnt FROM audit_log WHERE NOT (action = 'system.app_reset' AND category = 'system')"
        )
        count = row["cnt"] if row else 0
        conn.execute(
            "DELETE FROM audit_log WHERE NOT (action = 'system.app_reset' AND category = 'system')"
        )
    return count
