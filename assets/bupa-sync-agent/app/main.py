"""A2A server entry point for the BUPA Sync Agent."""

import json
import logging
import os
from contextlib import asynccontextmanager


# --- SAP AI Core configuration MUST be set before any AI imports ---
def set_aicore_config():
    """Configure LiteLLM to use SAP AI Core as the LLM backend."""
    os.environ.setdefault("LITELLM_MODEL", "openai/gpt-4")
    deployment_url = os.environ.get("AICORE_LLM_DEPLOYMENT_URL", "")
    if deployment_url:
        os.environ["OPENAI_API_BASE"] = deployment_url
    resource_group = os.environ.get("AICORE_LLM_RESOURCE_GROUP", "default")
    os.environ.setdefault("AICORE_RESOURCE_GROUP", resource_group)


def auto_instrument():
    """Initialize OpenTelemetry auto-instrumentation."""
    from app.instrumentation import setup_telemetry

    setup_telemetry()


# Call configuration FIRST before any AI framework imports
set_aicore_config()
auto_instrument()

# Now safe to import AI-related modules
from app.agent_executor import AgentExecutor  # noqa: E402
from app.util import get_logger  # noqa: E402

logger = get_logger(__name__)

# Agent metadata
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

# Global agent executor instance
_agent_executor: AgentExecutor | None = None


async def get_agent_executor() -> AgentExecutor:
    """Get or create the global AgentExecutor instance."""
    global _agent_executor
    if _agent_executor is None:
        _agent_executor = AgentExecutor()
        await _agent_executor.initialize()
    return _agent_executor


def create_app():
    """Create the A2A HTTP application."""
    try:
        from starlette.applications import Starlette
        from starlette.requests import Request
        from starlette.responses import JSONResponse
        from starlette.routing import Route
    except ImportError:
        # Fallback to a minimal HTTP server if Starlette is not available
        return None

    @asynccontextmanager
    async def lifespan(app):
        """Application lifespan - initialize agent on startup."""
        logger.info(f"Starting {AGENT_TITLE} on port {os.environ.get('PORT', '5000')}")
        yield
        logger.info(f"Shutting down {AGENT_TITLE}")

    async def agent_card_endpoint(request: Request) -> JSONResponse:
        """Serve the agent card at /.well-known/agent.json."""
        return JSONResponse(AGENT_CARD)

    async def invoke_endpoint(request: Request) -> JSONResponse:
        """Handle agent invocation requests."""
        try:
            body = await request.json()
            messages = body.get("messages", [])
            if not messages:
                return JSONResponse({"error": "No messages provided"}, status_code=400)

            executor = await get_agent_executor()
            result = await executor.invoke(messages)

            return JSONResponse(
                {
                    "status": "completed",
                    "result": result,
                }
            )
        except Exception as e:
            import traceback

            error_msg = str(e) or repr(e) or type(e).__name__
            tb = traceback.format_exc()
            logger.exception("Error processing agent invocation")
            return JSONResponse(
                {"error": error_msg, "traceback": tb, "status": "failed"},
                status_code=500,
            )

    async def health_endpoint(request: Request) -> JSONResponse:
        """Health check endpoint."""
        return JSONResponse({"status": "healthy", "agent": AGENT_NAME})

    routes = [
        Route("/.well-known/agent.json", agent_card_endpoint, methods=["GET"]),
        Route("/invoke", invoke_endpoint, methods=["POST"]),
        Route("/health", health_endpoint, methods=["GET"]),
    ]

    app = Starlette(routes=routes, lifespan=lifespan)
    return app


def run_server():
    """Run the A2A agent server."""
    import uvicorn

    port = int(os.environ.get("PORT", "5000"))
    host = os.environ.get("HOST", "0.0.0.0")

    app = create_app()
    if app is None:
        logger.error(
            "Starlette/uvicorn not available. Install with: pip install starlette uvicorn"
        )
        return

    logger.info(f"Agent card available at http://{host}:{port}/.well-known/agent.json")
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    run_server()

# Module-level app instance for uvicorn (e.g., `uvicorn app.main:app`)
app = create_app()
