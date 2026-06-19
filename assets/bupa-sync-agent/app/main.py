"""A2A server entry point for the BUPA Sync Agent."""

import json
import logging
import os
import time
from contextlib import asynccontextmanager


# --- SAP AI Core configuration MUST be set before any AI imports ---

_aicore_token_cache: tuple[str, float] = ("", 0.0)


def fetch_aicore_token(force: bool = False) -> str:
    """Fetch an OAuth token for SAP AI Core.

    Resolution order:
    1. BTP Destination service (VCAP_SERVICES destination binding)
    2. Direct env vars (AICORE_LLM_TOKEN_URL, AICORE_LLM_CLIENT_ID, etc.)

    Token is cached and refreshed 5 minutes before expiry.
    """
    import base64
    import urllib.parse
    import urllib.request

    global _aicore_token_cache

    cached_token, expiry = _aicore_token_cache
    if not force and cached_token and time.time() < expiry - 300:
        return cached_token

    # Try BTP destination service first
    token = _fetch_token_from_destination()
    if token:
        # Destination tokens typically expire in 3600s; cache for 55 min
        _aicore_token_cache = (token, time.time() + 3300)
        os.environ["OPENAI_API_KEY"] = token
        os.environ["LLM_API_KEY"] = token
        logging.getLogger(__name__).info("SAP AI Core token fetched from BTP destination")
        return token

    # Fall back to direct env vars
    token_url = os.environ.get("AICORE_LLM_TOKEN_URL", "")
    client_id = os.environ.get("AICORE_LLM_CLIENT_ID", "")
    client_secret = os.environ.get("AICORE_LLM_CLIENT_SECRET", "")
    deployment_url = os.environ.get("AICORE_LLM_DEPLOYMENT_URL", "")

    if not (token_url and client_id and client_secret and deployment_url):
        logging.getLogger(__name__).warning(
            "SAP AI Core credentials not found in destination or env vars"
        )
        return cached_token  # return stale token as last resort

    try:
        credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
        req = urllib.request.Request(
            token_url,
            data=data,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            token_data = json.loads(resp.read())
            token = token_data.get("access_token", "")
            expires_in = int(token_data.get("expires_in", 43200))
            if token:
                _aicore_token_cache = (token, time.time() + expires_in)
                os.environ["OPENAI_API_KEY"] = token
                os.environ["LLM_API_KEY"] = token
                logging.getLogger(__name__).info(
                    f"SAP AI Core OAuth token fetched from env vars (expires in {expires_in}s)"
                )
                return token
    except Exception as e:
        logging.getLogger(__name__).warning(f"Failed to fetch SAP AI Core token from env vars: {e}")

    return cached_token


def _fetch_token_from_destination() -> str:
    """Synchronously resolve AI Core token via BTP destination service."""
    import base64
    import urllib.parse
    import urllib.request

    vcap = os.environ.get("VCAP_SERVICES", "")
    if not vcap:
        return ""

    try:
        services = json.loads(vcap)
        dest_services = services.get("destination", [])
        if not dest_services:
            return ""
        creds = dest_services[0]["credentials"]
    except Exception:
        return ""

    dest_name = os.environ.get("AICORE_DESTINATION_NAME", "aicore")
    dest_uri = creds.get("uri", "").rstrip("/")
    token_url = creds.get("url", "").rstrip("/") + "/oauth/token"
    client_id = creds.get("clientid", "")
    client_secret = creds.get("clientsecret", "")

    if not all([dest_uri, client_id, client_secret]):
        return ""

    try:
        # Fetch destination service token
        credentials = base64.b64encode(f"{client_id}:{client_secret}".encode()).decode()
        data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
        req = urllib.request.Request(
            token_url,
            data=data,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            dest_token = json.loads(resp.read()).get("access_token", "")

        if not dest_token:
            return ""

        # Resolve destination
        req2 = urllib.request.Request(
            f"{dest_uri}/destination-configuration/v1/destinations/{dest_name}",
            headers={"Authorization": f"Bearer {dest_token}"},
        )
        with urllib.request.urlopen(req2, timeout=10) as resp2:
            dest_data = json.loads(resp2.read())

        props = dest_data.get("destinationConfiguration", dest_data)
        url = props.get("URL", "").rstrip("/")
        auth_token_url = props.get("tokenServiceURL", "")
        ai_client_id = props.get("clientId", "")
        ai_client_secret = props.get("clientSecret", "")

        if url:
            os.environ["AICORE_LLM_DEPLOYMENT_URL"] = url
            os.environ["OPENAI_API_BASE"] = url

        if not (auth_token_url and ai_client_id and ai_client_secret):
            return ""

        # Fetch AI Core token
        ai_creds = base64.b64encode(f"{ai_client_id}:{ai_client_secret}".encode()).decode()
        ai_data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
        req3 = urllib.request.Request(
            auth_token_url,
            data=ai_data,
            headers={
                "Authorization": f"Basic {ai_creds}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
        )
        with urllib.request.urlopen(req3, timeout=10) as resp3:
            return json.loads(resp3.read()).get("access_token", "")

    except Exception as e:
        logging.getLogger(__name__).warning(f"Failed to resolve AI Core via destination: {e}")
        return ""


def set_aicore_config():
    """Configure AI Core credentials at startup."""
    os.environ.setdefault("LITELLM_MODEL", "openai/gpt-4")
    deployment_url = os.environ.get("AICORE_LLM_DEPLOYMENT_URL", "")
    if deployment_url:
        os.environ["OPENAI_API_BASE"] = deployment_url
    resource_group = os.environ.get("AICORE_LLM_RESOURCE_GROUP", "default")
    os.environ.setdefault("AICORE_RESOURCE_GROUP", resource_group)
    fetch_aicore_token()


def auto_instrument():
    from app.instrumentation import setup_telemetry
    setup_telemetry()


set_aicore_config()
auto_instrument()

from app.agent_executor import AgentExecutor  # noqa: E402
from app.util import get_logger  # noqa: E402

logger = get_logger(__name__)

AGENT_NAME = "bupa-sync-agent"
AGENT_TITLE = "BUPA Sync Agent"
AGENT_DESCRIPTION = (
    "An AI agent that analyzes BUPA synchronization errors, classifies them by type, "
    "and proposes contextual fixes with confidence scores for consultant approval."
)
AGENT_VERSION = "1.0.0"
AGENT_TAGS = ["bupa", "sync", "s4hana", "agent", "error-resolution"]

AGENT_SKILL = {
    "id": "bupa-sync-error-analysis",
    "name": "BUPA Sync Error Analysis",
    "description": (
        "Analyzes BUPA synchronization errors post S/4HANA conversion, classifies them "
        "by type, cross-references employee and business partner data, and proposes "
        "contextual fixes with confidence scores for consultant approval."
    ),
    "tags": AGENT_TAGS,
    "examples": [
        "Analyze these BUPA sync errors and propose fixes",
        "What are the common error patterns in this sync batch?",
    ],
}

AGENT_CARD = {
    "name": AGENT_NAME,
    "title": AGENT_TITLE,
    "description": AGENT_DESCRIPTION,
    "version": AGENT_VERSION,
    "url": f"http://localhost:{os.environ.get('PORT', '5000')}",
    "capabilities": {
        "streaming": False,
        "pushNotifications": False,
        "stateTransitionHistory": False,
    },
    "skills": [AGENT_SKILL],
    "defaultInputModes": ["text/plain"],
    "defaultOutputModes": ["text/plain"],
}

_agent_executor: AgentExecutor | None = None


async def get_agent_executor() -> AgentExecutor:
    global _agent_executor
    if _agent_executor is None:
        _agent_executor = AgentExecutor()
        await _agent_executor.initialize()
    return _agent_executor


def create_app():
    try:
        from starlette.applications import Starlette
        from starlette.middleware.cors import CORSMiddleware
        from starlette.requests import Request
        from starlette.responses import JSONResponse
        from starlette.routing import Route
    except ImportError:
        return None

    @asynccontextmanager
    async def lifespan(app):
        logger.info(f"Starting {AGENT_TITLE} on port {os.environ.get('PORT', '5000')}")
        yield
        logger.info(f"Shutting down {AGENT_TITLE}")

    async def agent_card_endpoint(request: Request) -> JSONResponse:
        return JSONResponse(AGENT_CARD)

    async def invoke_endpoint(request: Request) -> JSONResponse:
        try:
            body = await request.json()
            messages = body.get("messages", [])
            if not messages:
                return JSONResponse({"error": "No messages provided"}, status_code=400)
            executor = await get_agent_executor()
            result = await executor.invoke(messages)
            return JSONResponse({"status": "completed", "result": result})
        except Exception as e:
            import traceback
            error_msg = str(e) or repr(e) or type(e).__name__
            tb = traceback.format_exc()
            logger.exception("Error processing agent invocation")
            return JSONResponse(
                {"error": error_msg, "traceback": tb, "status": "failed"}, status_code=500
            )

    async def health_endpoint(request: Request) -> JSONResponse:
        return JSONResponse({"status": "healthy", "agent": AGENT_NAME})

    routes = [
        Route("/.well-known/agent.json", agent_card_endpoint, methods=["GET"]),
        Route("/invoke", invoke_endpoint, methods=["POST"]),
        Route("/health", health_endpoint, methods=["GET"]),
    ]
    app = Starlette(routes=routes, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    return app


def run_server():
    import uvicorn
    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")
    app = create_app()
    if app is None:
        logger.error("Starlette/uvicorn not available.")
        return
    logger.info(f"Agent card available at http://{host}:{port}/.well-known/agent.json")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()

app = create_app()
