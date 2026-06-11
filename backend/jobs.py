"""Background job scheduler for async operations."""

import asyncio
import json
import threading
from datetime import datetime, timezone
from typing import Any, Callable, Optional
from uuid import uuid4

from database import get_connection


def _ensure_jobs_table():
    """Create jobs table if not exists."""
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'queued',
                params TEXT DEFAULT '{}',
                result TEXT DEFAULT '{}',
                progress INTEGER DEFAULT 0,
                total INTEGER DEFAULT 0,
                message TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                created_by TEXT DEFAULT 'system',
                error TEXT DEFAULT ''
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_jobs_created ON jobs(created_at DESC)"
        )


_ensure_jobs_table()


def create_job(job_type: str, params: dict, created_by: str = "system") -> str:
    """Create a new job record. Returns job ID."""
    job_id = f"job_{uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO jobs (id, type, status, params, created_at, created_by) VALUES (?, ?, 'queued', ?, ?, ?)",
            (job_id, job_type, json.dumps(params), now, created_by),
        )
    return job_id


def update_job(job_id: str, **kwargs):
    """Update job fields."""
    valid_fields = {
        "status",
        "result",
        "progress",
        "total",
        "message",
        "started_at",
        "completed_at",
        "error",
    }
    updates = {k: v for k, v in kwargs.items() if k in valid_fields}
    if not updates:
        return
    set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
    values = [
        json.dumps(v) if isinstance(v, (dict, list)) else v for v in updates.values()
    ]
    with get_connection() as conn:
        conn.execute(f"UPDATE jobs SET {set_clause} WHERE id = ?", [*values, job_id])


def get_job(job_id: str) -> Optional[dict]:
    """Get a single job by ID."""
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row:
            d = dict(row)
            d["params"] = json.loads(d["params"]) if d["params"] else {}
            d["result"] = json.loads(d["result"]) if d["result"] else {}
            return d
    return None


def list_jobs(
    limit: int = 20, status: Optional[str] = None, job_type: Optional[str] = None
) -> list[dict]:
    """List jobs, most recent first."""
    query = "SELECT * FROM jobs"
    params: list[Any] = []
    conditions: list[str] = []
    if status:
        conditions.append("status = ?")
        params.append(status)
    if job_type:
        conditions.append("type = ?")
        params.append(job_type)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
        results = []
        for row in rows:
            d = dict(row)
            d["params"] = json.loads(d["params"]) if d["params"] else {}
            d["result"] = json.loads(d["result"]) if d["result"] else {}
            results.append(d)
        return results


def run_job_async(job_id: str, func: Callable, *args, **kwargs):
    """Run a job function in a background thread."""

    def _worker():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            update_job(
                job_id,
                status="running",
                started_at=datetime.now(timezone.utc).isoformat(),
            )
            # If func is async, run it in the loop
            if asyncio.iscoroutinefunction(func):
                result = loop.run_until_complete(func(job_id, *args, **kwargs))
            else:
                result = func(job_id, *args, **kwargs)
            update_job(
                job_id,
                status="completed",
                result=result or {},
                completed_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as e:
            update_job(
                job_id,
                status="failed",
                error=str(e),
                completed_at=datetime.now(timezone.utc).isoformat(),
            )
        finally:
            loop.close()

    thread = threading.Thread(target=_worker, daemon=True)
    thread.start()
