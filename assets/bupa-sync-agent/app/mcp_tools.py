"""MCP tool loader for the BUPA Sync Agent."""

import logging
import os
from typing import Sequence

from langchain_core.tools import BaseTool, tool

from app.util import get_logger

logger = get_logger(__name__)

# Agent Gateway configuration
AGENT_GATEWAY_URL = os.environ.get("AGENT_GATEWAY_URL", "http://localhost:8000")
MCP_SERVER_NAME = os.environ.get("MCP_SERVER_NAME", "business-partner-mcp")


async def get_mcp_tools() -> Sequence[BaseTool]:
    """Load MCP tools from the Agent Gateway.

    Attempts to connect to the SAP Agent Gateway and discover available
    MCP tools for Business Partner operations. Falls back to local
    placeholder tools if the gateway is unavailable.

    Returns:
        Sequence of LangChain-compatible tools.
    """
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Discover available tools from the MCP server via Agent Gateway
            discovery_url = f"{AGENT_GATEWAY_URL}/mcp/{MCP_SERVER_NAME}/tools"
            response = await client.get(discovery_url)

            if response.status_code == 200:
                tool_definitions = response.json()
                tools = _convert_mcp_tools(tool_definitions)
                logger.info(f"Loaded {len(tools)} tools from Agent Gateway")
                return tools
            else:
                logger.warning(
                    f"Agent Gateway returned {response.status_code}, "
                    f"falling back to local tools"
                )
                return _get_fallback_tools()

    except httpx.ConnectError:
        logger.warning(
            f"Cannot connect to Agent Gateway at {AGENT_GATEWAY_URL}. "
            f"Using fallback tools for local development."
        )
        return _get_fallback_tools()
    except Exception as e:
        logger.warning(f"Error loading MCP tools: {e}. Using fallback tools.")
        return _get_fallback_tools()


def _convert_mcp_tools(tool_definitions: list[dict]) -> list[BaseTool]:
    """Convert MCP tool definitions to LangChain tools.

    Args:
        tool_definitions: List of MCP tool schema definitions.

    Returns:
        List of LangChain BaseTool instances.
    """
    tools = []
    for tool_def in tool_definitions:
        name = tool_def.get("name", "unknown_tool")
        description = tool_def.get("description", "")
        input_schema = tool_def.get("inputSchema", {})

        # Create a dynamic LangChain tool from the MCP definition
        from langchain_core.tools import StructuredTool
        from pydantic import create_model, Field
        import httpx

        # Build a Pydantic model from the JSON schema
        fields = {}
        properties = input_schema.get("properties", {})
        required = input_schema.get("required", [])

        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get("type", "string")
            prop_desc = prop_def.get("description", "")
            py_type = _json_type_to_python(prop_type)

            if prop_name in required:
                fields[prop_name] = (py_type, Field(description=prop_desc))
            else:
                fields[prop_name] = (
                    py_type | None,
                    Field(default=None, description=prop_desc),
                )

        if fields:
            model = create_model(f"{name}_input", **fields)
        else:
            model = None

        async def _invoke_mcp_tool(tool_name=name, **kwargs):
            async with httpx.AsyncClient(timeout=60.0) as client:
                invoke_url = f"{AGENT_GATEWAY_URL}/mcp/{MCP_SERVER_NAME}/tools/{tool_name}/invoke"
                resp = await client.post(invoke_url, json=kwargs)
                resp.raise_for_status()
                return resp.json()

        structured_tool = StructuredTool.from_function(
            func=None,
            coroutine=lambda **kw: _invoke_mcp_tool(**kw),
            name=name,
            description=description,
            args_schema=model,
        )
        tools.append(structured_tool)

    return tools


def _json_type_to_python(json_type: str) -> type:
    """Map JSON Schema types to Python types."""
    mapping = {
        "string": str,
        "integer": int,
        "number": float,
        "boolean": bool,
        "array": list,
        "object": dict,
    }
    return mapping.get(json_type, str)


def _get_fallback_tools() -> list[BaseTool]:
    """Return local fallback tools for development without Agent Gateway."""

    @tool
    def list_business_partners(
        filter: str = "",
        select: str = "",
        top: int = 10,
    ) -> str:
        """List business partners from S/4HANA with optional OData filter and select.

        Args:
            filter: OData $filter expression (e.g. "BusinessPartner eq '0000001234'")
            select: Comma-separated fields to select
            top: Maximum number of results to return
        """
        return (
            f"[Fallback] Would query business partners with "
            f"filter='{filter}', select='{select}', top={top}. "
            f"Connect to Agent Gateway for live data."
        )

    @tool
    def get_business_partner(
        business_partner_id: str,
        expand: str = "",
    ) -> str:
        """Get a specific business partner by ID with optional expand.

        Args:
            business_partner_id: The BP number (e.g. '0000001234')
            expand: Comma-separated navigation properties to expand
        """
        return (
            f"[Fallback] Would retrieve BP {business_partner_id} "
            f"with expand='{expand}'. Connect to Agent Gateway for live data."
        )

    @tool
    def get_business_partner_address(
        business_partner_id: str,
        address_id: str = "",
    ) -> str:
        """Get address data for a business partner.

        Args:
            business_partner_id: The BP number
            address_id: Specific address ID (optional, returns all if omitted)
        """
        return (
            f"[Fallback] Would retrieve address for BP {business_partner_id} "
            f"(address_id='{address_id}'). Connect to Agent Gateway for live data."
        )

    return [list_business_partners, get_business_partner, get_business_partner_address]
