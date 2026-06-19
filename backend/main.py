"""BUPA Sync Backend — Configuration management and orchestration layer."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routes.settings import router as settings_router
from routes.n8n_proxy import router as n8n_router
from routes.agent_proxy import router as agent_router
from routes.sync_status import router as sync_router
from routes.audit import router as audit_router
from xsuaa import get_optional_user


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio
    import logging

    logger = logging.getLogger(__name__)

    try:
        from config import load_settings
        load_settings()
    except Exception as e:
        logger.warning(f"Settings load failed at startup (DB may be down): {e}")

    # Keepalive: ping Neon every 3 minutes to prevent free-tier suspension
    async def _keepalive():
        from database import _USE_POSTGRES, DATABASE_URL
        if not _USE_POSTGRES:
            return
        import psycopg2
        while True:
            await asyncio.sleep(180)
            try:
                conn = psycopg2.connect(DATABASE_URL, connect_timeout=10)
                conn.cursor().execute("SELECT 1")
                conn.close()
            except Exception as e:
                logger.debug(f"DB keepalive ping failed: {e}")

    task = asyncio.create_task(_keepalive())
    yield
    task.cancel()


app = FastAPI(
    title="BUPA Sync Backend",
    version="1.0.0",
    lifespan=lifespan,
)

import os as _os
_extra_origins = [o for o in _os.environ.get("ALLOWED_ORIGINS", "").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://bpsync-dashboard.cfapps.us10.hana.ondemand.com",
        "https://bpsync-approuter.cfapps.us10.hana.ondemand.com",
        *_extra_origins,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(n8n_router, prefix="/api/n8n", tags=["n8n"])
app.include_router(agent_router, prefix="/api/agent", tags=["agent"])
app.include_router(sync_router, prefix="/api/sync", tags=["sync"])
app.include_router(audit_router, prefix="/api/audit", tags=["audit"])


@app.get("/api/me")
async def get_me(request: Request):
    """Return current user info from XSUAA JWT claims."""
    from xsuaa import verify_token, get_xsuaa_config
    user = get_optional_user(request)
    # Enrich with extra JWT claims if available
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        cfg = get_xsuaa_config()
        if cfg:
            from xsuaa import verify_token
            claims = verify_token(token)
        else:
            import base64, json as _json
            try:
                p = token.split(".")[1] + "=="
                claims = _json.loads(base64.urlsafe_b64decode(p))
            except Exception:
                claims = {}
        if claims:
            user["scopes"] = claims.get("scope", [])
            user["zone_id"] = claims.get("zid") or claims.get("zone_id", "")
            user["client_id"] = claims.get("client_id", "")
            user["iat"] = claims.get("iat")
            user["exp"] = claims.get("exp")
    return user


@app.get("/health")
async def health():
    return {"status": "ok", "service": "bupa-sync-backend"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8080, reload=True)
