"""Database layer for BUPA Sync - supports SQLite (local) and PostgreSQL (CF)."""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DATABASE_URL = os.environ.get("DATABASE_URL", "")
_USE_POSTGRES = DATABASE_URL.startswith("postgresql")

DB_PATH = Path(__file__).parent / "data" / "bupa_sync.db"


def get_db_path() -> Path:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    return DB_PATH


@contextmanager
def get_connection():
    if _USE_POSTGRES:
        import psycopg2
        import psycopg2.extras

        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False
        try:
            yield _PgConnectionWrapper(conn)
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
    else:
        conn = sqlite3.connect(str(get_db_path()))
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        try:
            yield _SqliteConnectionWrapper(conn)
            conn.commit()
        finally:
            conn.close()


class _SqliteConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, query: str, params=None):
        if params:
            return self._conn.execute(query, params)
        return self._conn.execute(query)

    def executescript(self, script: str):
        self._conn.executescript(script)

    def fetchone(self, query: str, params=None) -> Optional[dict]:
        row = self.execute(query, params).fetchone()
        return dict(row) if row else None

    def fetchall(self, query: str, params=None) -> list[dict]:
        rows = self.execute(query, params).fetchall()
        return [dict(row) for row in rows]


class _PgConnectionWrapper:
    def __init__(self, conn):
        self._conn = conn

    def execute(self, query: str, params=None):
        import psycopg2.extras

        query = query.replace("?", "%s")
        cur = self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        if params:
            cur.execute(query, params)
        else:
            cur.execute(query)
        return cur

    def executescript(self, script: str):
        script = script.replace("INSERT OR REPLACE", "INSERT")
        cur = self._conn.cursor()
        cur.execute(script)

    def fetchone(self, query: str, params=None) -> Optional[dict]:
        cur = self.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None

    def fetchall(self, query: str, params=None) -> list[dict]:
        cur = self.execute(query, params)
        rows = cur.fetchall()
        return [dict(row) for row in rows]


_SQLITE_SCHEMA = """
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
"""

_POSTGRES_SCHEMA = """
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
"""


def init_db():
    with get_connection() as conn:
        if _USE_POSTGRES:
            conn.executescript(_POSTGRES_SCHEMA)
            for migration in [
                "ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_at TEXT NOT NULL DEFAULT ''",
                "ALTER TABLE settings ADD COLUMN IF NOT EXISTS updated_by TEXT DEFAULT 'system'",
            ]:
                try:
                    conn.execute(migration)
                except Exception:
                    pass
        else:
            conn.executescript(_SQLITE_SCHEMA)


# --- Settings ---
def get_setting(key: str, default: str = "") -> str:
    with get_connection() as conn:
        row = conn.fetchone("SELECT value FROM settings WHERE key = ?", (key,))
        return row["value"] if row else default


def set_setting(key: str, value: str, user: str = "system"):
    with get_connection() as conn:
        if _USE_POSTGRES:
            conn.execute(
                "INSERT INTO settings (key, value, updated_at, updated_by) "
                "VALUES (%s, %s, %s, %s) "
                "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, "
                "updated_at = EXCLUDED.updated_at, updated_by = EXCLUDED.updated_by",
                (key, value, datetime.now(timezone.utc).isoformat(), user),
            )
        else:
            conn.execute(
                "INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)",
                (key, value, datetime.now(timezone.utc).isoformat(), user),
            )


def get_all_settings() -> dict:
    with get_connection() as conn:
        rows = conn.fetchall("SELECT key, value FROM settings")
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
        if _USE_POSTGRES:
            query = "SELECT * FROM audit_log"
            params: list = []
            conditions: list[str] = []
            if category:
                conditions.append("category = %s")
                params.append(category)
            if user_id:
                conditions.append("user_id = %s")
                params.append(user_id)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            query += " ORDER BY timestamp DESC LIMIT %s"
            params.append(limit)
            rows = conn.fetchall(query, params)
        else:
            query = "SELECT * FROM audit_log"
            params = []
            conditions = []
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
            rows = conn.fetchall(query, params)

        return [
            {
                **row,
                "details": json.loads(row["details"])
                if isinstance(row["details"], str)
                else row["details"],
                "metadata": json.loads(row["metadata"])
                if isinstance(row["metadata"], str)
                else row["metadata"],
            }
            for row in rows
        ]


# Initialize on import — non-fatal so app starts even if DB is temporarily down
import logging as _logging
try:
    init_db()
except Exception as _e:
    _logging.getLogger(__name__).warning(f"DB init failed at startup (will retry on first request): {_e}")
