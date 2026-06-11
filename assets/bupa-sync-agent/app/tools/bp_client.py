"""Business Partner MCP tool client wrapper."""

import asyncio
import logging
import os
from typing import Any, Optional

import httpx

from app.util import get_logger

logger = get_logger(__name__)

# Configuration
AGENT_GATEWAY_URL = os.environ.get("AGENT_GATEWAY_URL", "http://localhost:8000")
MCP_SERVER_NAME = os.environ.get("MCP_SERVER_NAME", "business-partner-mcp")
MAX_RETRIES = int(os.environ.get("BP_CLIENT_MAX_RETRIES", "3"))
BASE_DELAY = float(os.environ.get("BP_CLIENT_BASE_DELAY", "1.0"))
DEFAULT_PAGE_SIZE = 50


class BPToolClient:
    """High-level client for Business Partner MCP tools.

    Wraps the low-level MCP tool invocations with:
    - Retry logic with exponential backoff
    - Pagination helpers for large result sets
    - Structured response parsing
    """

    def __init__(
        self,
        gateway_url: Optional[str] = None,
        server_name: Optional[str] = None,
        max_retries: int = MAX_RETRIES,
        base_delay: float = BASE_DELAY,
    ):
        """Initialize the BP tool client.

        Args:
            gateway_url: Agent Gateway URL override.
            server_name: MCP server name override.
            max_retries: Maximum retry attempts for failed requests.
            base_delay: Base delay in seconds for exponential backoff.
        """
        self._gateway_url = gateway_url or AGENT_GATEWAY_URL
        self._server_name = server_name or MCP_SERVER_NAME
        self._max_retries = max_retries
        self._base_delay = base_delay

    async def list_partners(
        self,
        filter: str = "",
        select: str = "",
        top: int = DEFAULT_PAGE_SIZE,
    ) -> dict[str, Any]:
        """List business partners with OData query options.

        Wraps the list_business_partner MCP tool with retry logic.

        Args:
            filter: OData $filter expression (e.g. "BusinessPartner eq '0000001234'")
            select: Comma-separated fields to return
            top: Maximum number of results (default 50)

        Returns:
            Dict with 'results' list and 'count' field.
        """
        params = {}
        if filter:
            params["$filter"] = filter
        if select:
            params["$select"] = select
        params["$top"] = str(top)

        response = await self._invoke_tool("list_business_partner", params)
        return response

    async def get_partner(
        self,
        bp_id: str,
        expand: str = "",
    ) -> dict[str, Any]:
        """Get a single business partner by ID.

        Wraps the get_business_partner MCP tool with retry logic.

        Args:
            bp_id: Business Partner ID (e.g. '0000001234')
            expand: Comma-separated navigation properties to expand
                   (e.g. 'to_BusinessPartnerAddress,to_BusinessPartnerBank')

        Returns:
            Dict with the business partner data.
        """
        params = {"BusinessPartner": bp_id}
        if expand:
            params["$expand"] = expand

        response = await self._invoke_tool("get_business_partner", params)
        return response

    async def get_address(
        self,
        bp_id: str,
        address_id: str = "",
    ) -> dict[str, Any]:
        """Get address data for a business partner.

        Wraps the get_business_partner_address MCP tool with retry logic.

        Args:
            bp_id: Business Partner ID
            address_id: Specific address ID (returns all addresses if empty)

        Returns:
            Dict with address data.
        """
        params = {"BusinessPartner": bp_id}
        if address_id:
            params["AddressID"] = address_id

        response = await self._invoke_tool("get_business_partner_address", params)
        return response

    async def list_all_partners(
        self,
        filter: str = "",
        select: str = "",
        max_results: int = 500,
    ) -> list[dict[str, Any]]:
        """Paginate through all matching business partners.

        Fetches results in pages until all matching records are retrieved
        or max_results is reached.

        Args:
            filter: OData $filter expression
            select: Comma-separated fields to return
            max_results: Maximum total results to fetch

        Returns:
            List of all matching business partner records.
        """
        all_results = []
        skip = 0

        while len(all_results) < max_results:
            page_size = min(DEFAULT_PAGE_SIZE, max_results - len(all_results))
            params = {"$top": str(page_size), "$skip": str(skip)}
            if filter:
                params["$filter"] = filter
            if select:
                params["$select"] = select

            response = await self._invoke_tool("list_business_partner", params)
            results = response.get("results", response.get("d", {}).get("results", []))

            if not results:
                break

            all_results.extend(results)
            skip += page_size

            # Check if we've received fewer results than requested (last page)
            if len(results) < page_size:
                break

        return all_results[:max_results]

    async def _invoke_tool(
        self, tool_name: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Invoke an MCP tool with retry logic and exponential backoff.

        Args:
            tool_name: Name of the MCP tool to invoke.
            params: Parameters to pass to the tool.

        Returns:
            Parsed JSON response from the tool.

        Raises:
            httpx.HTTPStatusError: If all retries are exhausted.
        """
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    url = (
                        f"{self._gateway_url}/mcp/{self._server_name}"
                        f"/tools/{tool_name}/invoke"
                    )
                    response = await client.post(url, json=params)
                    response.raise_for_status()
                    return response.json()

            except httpx.ConnectError as e:
                last_error = e
                logger.warning(
                    f"Connection error on attempt {attempt + 1}/{self._max_retries} "
                    f"for {tool_name}: {e}"
                )
            except httpx.HTTPStatusError as e:
                last_error = e
                # Don't retry client errors (4xx)
                if 400 <= e.response.status_code < 500:
                    logger.error(f"Client error for {tool_name}: {e}")
                    raise
                logger.warning(
                    f"Server error on attempt {attempt + 1}/{self._max_retries} "
                    f"for {tool_name}: {e}"
                )
            except httpx.TimeoutException as e:
                last_error = e
                logger.warning(
                    f"Timeout on attempt {attempt + 1}/{self._max_retries} "
                    f"for {tool_name}: {e}"
                )

            # Exponential backoff
            if attempt < self._max_retries - 1:
                delay = self._base_delay * (2**attempt)
                logger.debug(f"Retrying in {delay}s...")
                await asyncio.sleep(delay)

        # All retries exhausted
        logger.error(f"All {self._max_retries} retries exhausted for {tool_name}")
        if last_error:
            raise last_error
        raise RuntimeError(
            f"Failed to invoke {tool_name} after {self._max_retries} retries"
        )
