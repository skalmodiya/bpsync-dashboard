"""BTP Destination service client — resolves named destinations from VCAP_SERVICES."""

import json
import logging
import os
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_dest_token_cache: tuple[str, float] = ("", 0.0)


def _get_destination_credentials() -> Optional[dict]:
    """Parse destination service credentials from VCAP_SERVICES."""
    vcap = os.environ.get("VCAP_SERVICES", "")
    if not vcap:
        return None
    try:
        services = json.loads(vcap)
        dest_services = services.get("destination", [])
        if dest_services:
            return dest_services[0]["credentials"]
    except Exception as e:
        logger.warning(f"Failed to parse destination credentials from VCAP_SERVICES: {e}")
    return None


async def _get_destination_service_token() -> Optional[str]:
    """Fetch OAuth2 client_credentials token for the destination service."""
    global _dest_token_cache

    cached_token, expiry = _dest_token_cache
    if cached_token and time.time() < expiry - 60:
        return cached_token

    creds = _get_destination_credentials()
    if not creds:
        return None

    token_url = creds.get("url", "").rstrip("/") + "/oauth/token"
    client_id = creds.get("clientid", "")
    client_secret = creds.get("clientsecret", "")

    if not all([token_url, client_id, client_secret]):
        logger.warning("Destination service credentials incomplete")
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                token_url,
                data={"grant_type": "client_credentials"},
                auth=(client_id, client_secret),
            )
            if resp.status_code != 200:
                logger.warning(f"Destination token request failed: {resp.status_code}")
                return None
            data = resp.json()
            token = data.get("access_token", "")
            expires_in = int(data.get("expires_in", 3600))
            _dest_token_cache = (token, time.time() + expires_in)
            return token
    except Exception as e:
        logger.warning(f"Failed to fetch destination service token: {e}")
        return None


async def resolve_destination(name: str) -> Optional[dict]:
    """Resolve a named destination via the BTP Destination service.

    Returns the destination properties dict, or None if unavailable.
    """
    creds = _get_destination_credentials()
    if not creds:
        return None

    dest_uri = creds.get("uri", "").rstrip("/")
    token = await _get_destination_service_token()
    if not token or not dest_uri:
        return None

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{dest_uri}/destination-configuration/v1/destinations/{name}",
                headers={"Authorization": f"Bearer {token}"},
            )
            if resp.status_code == 200:
                return resp.json()
            logger.warning(f"Destination '{name}' returned {resp.status_code}: {resp.text[:200]}")
            return None
    except Exception as e:
        logger.warning(f"Failed to resolve destination '{name}': {e}")
        return None


async def get_aicore_config() -> dict:
    """Resolve AI Core connection config.

    Resolution order:
    1. BTP Destination service (destination name from AICORE_DESTINATION_NAME env var, default 'aicore')
    2. Direct env vars (AICORE_LLM_DEPLOYMENT_URL, AICORE_LLM_TOKEN_URL, etc.)

    Returns dict with keys: deployment_url, token_url, client_id, client_secret, resource_group
    """
    dest_name = os.environ.get("AICORE_DESTINATION_NAME", "aicore")

    # Try BTP destination first
    dest = await resolve_destination(dest_name)
    if dest:
        props = dest.get("destinationConfiguration", dest)
        url = props.get("URL", "").rstrip("/")
        auth_type = props.get("Authentication", "")

        if auth_type == "OAuth2ClientCredentials":
            return {
                "deployment_url": url,
                "token_url": props.get("tokenServiceURL", ""),
                "client_id": props.get("clientId", ""),
                "client_secret": props.get("clientSecret", ""),
                "resource_group": props.get("HTML5.DynamicDestination.resourceGroup", "default"),
                "source": "destination",
            }
        elif auth_type == "NoAuthentication":
            # Destination service may inject auth headers automatically
            return {
                "deployment_url": url,
                "token_url": "",
                "client_id": "",
                "client_secret": "",
                "resource_group": "default",
                "source": "destination",
            }

    # Fall back to env vars
    deployment_url = os.environ.get("AICORE_LLM_DEPLOYMENT_URL", "")
    if deployment_url:
        return {
            "deployment_url": deployment_url,
            "token_url": os.environ.get("AICORE_LLM_TOKEN_URL", ""),
            "client_id": os.environ.get("AICORE_LLM_CLIENT_ID", ""),
            "client_secret": os.environ.get("AICORE_LLM_CLIENT_SECRET", ""),
            "resource_group": os.environ.get("AICORE_RESOURCE_GROUP", "default"),
            "source": "env",
        }

    return {}


async def get_aicore_token(config: Optional[dict] = None) -> tuple[str, str]:
    """Get an OAuth2 token for SAP AI Core. Returns (token, deployment_url).

    Raises ValueError if credentials are not available.
    """
    if config is None:
        config = await get_aicore_config()

    if not config:
        raise ValueError(
            f"SAP AI Core not configured. Set AICORE_DESTINATION_NAME env var "
            f"pointing to a BTP destination, or set AICORE_LLM_DEPLOYMENT_URL + "
            f"AICORE_LLM_TOKEN_URL + AICORE_LLM_CLIENT_ID + AICORE_LLM_CLIENT_SECRET env vars."
        )

    deployment_url = config.get("deployment_url", "")
    token_url = config.get("token_url", "")
    client_id = config.get("client_id", "")
    client_secret = config.get("client_secret", "")

    if not deployment_url:
        raise ValueError("AI Core deployment URL not found in destination or env vars")

    if not token_url or not client_id:
        raise ValueError("AI Core OAuth credentials not found in destination or env vars")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            token_url,
            data={"grant_type": "client_credentials"},
            auth=(client_id, client_secret),
        )
        if resp.status_code != 200:
            raise ValueError(f"AI Core token request failed: {resp.status_code} {resp.text[:200]}")
        token = resp.json().get("access_token", "")
        if not token:
            raise ValueError("No access_token in AI Core token response")

    return token, deployment_url


async def get_s4_client(destination_name: str, sap_client: str = "500") -> httpx.AsyncClient:
    """Return an httpx AsyncClient pre-configured for S/4HANA via BTP destination.

    Handles both Internet and OnPremise proxy types.
    For OnPremise, routes through the CF Connectivity service proxy.
    """
    creds = _get_destination_credentials()
    dest = await resolve_destination(destination_name)

    if not dest:
        raise ValueError(
            f"Destination '{destination_name}' not found. "
            "Ensure the destination exists in BTP and the destination service is bound."
        )

    props = dest.get("destinationConfiguration", dest)
    dest_url = props.get("URL", "").rstrip("/")
    proxy_type = props.get("ProxyType", "Internet")

    # Build auth header from destination credentials
    auth_type = props.get("Authentication", "NoAuthentication")
    headers = {
        "sap-client": sap_client,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    if auth_type == "BasicAuthentication":
        user = props.get("User", "")
        password = props.get("Password", "")
        # Store for use as httpx auth tuple (handles proxy correctly)
        basic_auth = (user, password)
    else:
        basic_auth = None

    # OnPremise: must route through CF Connectivity proxy
    if proxy_type == "OnPremise":
        conn_creds = json.loads(os.environ.get("VCAP_SERVICES", "{}"))
        conn_list = conn_creds.get("connectivity", [])
        if not conn_list:
            raise ValueError(
                "OnPremise destination requires connectivity service bound to this app. "
                "Run: cf bind-service <app> proj-vector-connectivity-service"
            )
        conn = conn_list[0]["credentials"]
        conn_host = conn.get("onpremise_proxy_host", "connectivityproxy.internal.cf.eu10.hana.ondemand.com")
        conn_port = conn.get("onpremise_proxy_port", "20003")
        proxy_url = f"http://{conn_host}:{conn_port}"

        # Connectivity proxy requires a JWT from the connectivity service's own UAA
        conn_token_url = conn.get("token_service_uri", conn.get("url", "")).rstrip("/") + "/oauth/token"
        conn_client_id = conn.get("clientid", "")
        conn_client_secret = conn.get("clientsecret", "")

        if conn_client_id and conn_client_secret:
            async with httpx.AsyncClient(timeout=15) as tc:
                token_resp = await tc.post(
                    conn_token_url,
                    data={"grant_type": "client_credentials"},
                    auth=(conn_client_id, conn_client_secret),
                )
                if token_resp.status_code == 200:
                    conn_token = token_resp.json().get("access_token", "")
                    headers["Proxy-Authorization"] = f"Bearer {conn_token}"

        location_id = props.get("CloudConnectorLocationId", "")
        if location_id:
            headers["SAP-Connectivity-SCC-Location_ID"] = location_id

        return httpx.AsyncClient(
            base_url=dest_url,
            headers=headers,
            auth=basic_auth,
            proxy=proxy_url,
            timeout=120.0,
            verify=False,
        )

    # Internet proxy type — direct call
    return httpx.AsyncClient(
        base_url=dest_url,
        headers=headers,
        auth=basic_auth,
        timeout=120.0,
    )
