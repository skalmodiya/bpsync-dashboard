"""SQLite database for BUPA Sync - settings, audit, sessions."""

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).parent / "data" / "bupa_sync.db"


def get_db_path() -> Path:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return DB_PATH


@contextmanager
def get_connection():
    """Get a SQLite connection with row_factory."""
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    """Initialize database tables."""
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                updated_by TEXT DEFAULT 'system'
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id TEXT PRIMARY KEY,
                timestamp TEXT NOT NULL,
                action TEXT NOT NULL,
                category TEXT NOT NULL,
                user_id TEXT DEFAULT 'anonymous',
                user_name TEXT DEFAULT 'Anonymous',
                user_email TEXT DEFAULT '',
                details TEXT DEFAULT '{}',
                metadata TEXT DEFAULT '{}'
            );

            CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_audit_category ON audit_log(category);
            CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);

            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                user_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                access_token TEXT,
                refresh_token TEXT,
                expires_at TEXT,
                created_at TEXT NOT NULL
            );
        """)


# --- Settings ---
def get_setting(key: str, default: str = "") -> str:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default


def set_setting(key: str, value: str, user: str = "system"):
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)",
            (key, value, datetime.now(timezone.utc).isoformat(), user),
        )


def get_all_settings() -> dict:
    with get_connection() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {row["key"]: row["value"] for row in rows}


# --- Audit ---
def log_audit_event(
    action: str,
    category: str,
    user_id: str = "anonymous",
    user_name: str = "Anonymous",
    user_email: str = "",
    details: Optional[dict] = None,
    metadata: Optional[dict] = None,
) -> dict:
    event_id = f"evt_{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}"
    timestamp = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO audit_log (id, timestamp, action, category, user_id, user_name, user_email, details, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                event_id,
                timestamp,
                action,
                category,
                user_id,
                user_name,
                user_email,
                json.dumps(details or {}),
                json.dumps(metadata or {}),
            ),
        )
    return {
        "id": event_id,
        "timestamp": timestamp,
        "action": action,
        "category": category,
        "user_id": user_id,
        "user_name": user_name,
        "details": details or {},
    }


def get_audit_events(
    limit: int = 100, category: Optional[str] = None, user_id: Optional[str] = None
) -> list[dict]:
    with get_connection() as conn:
        query = "SELECT * FROM audit_log"
        params: list = []
        conditions: list[str] = []
        if category:
            conditions.append("category = ?")
            params.append(category)
        if user_id:
            conditions.append("user_id = ?")
            params.append(user_id)
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)
        rows = conn.execute(query, params).fetchall()
        return [
            {
                **dict(row),
                "details": json.loads(row["details"]),
                "metadata": json.loads(row["metadata"]),
            }
            for row in rows
        ]


# --- Sessions ---
def create_session(
    session_id: str,
    user_id: str,
    user_name: str,
    user_email: str,
    access_token: str = "",
    refresh_token: str = "",
    expires_at: str = "",
):
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sessions (session_id, user_id, user_name, user_email, access_token, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                session_id,
                user_id,
                user_name,
                user_email,
                access_token,
                refresh_token,
                expires_at,
                datetime.now(timezone.utc).isoformat(),
            ),
        )


def get_session(session_id: str) -> Optional[dict]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM sessions WHERE session_id = ?", (session_id,)
        ).fetchone()
        return dict(row) if row else None


def delete_session(session_id: str):
    with get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))


# Initialize on import
init_db()
