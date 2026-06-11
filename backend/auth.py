"""SAP IAS (Identity Authentication Service) OIDC integration."""

import secrets

import httpx
import jwt
from datetime import datetime, timezone
from typing import Optional
from fastapi import Request, HTTPException, Depends
from fastapi.responses import RedirectResponse

from config import load_settings
from database import create_session, get_session, delete_session

# IAS Configuration stored in settings (under the "auth" section)

_jwks_cache: dict = {}


async def get_jwks(ias_url: str) -> dict:
    """Fetch and cache JWKS from IAS."""
    global _jwks_cache
    if ias_url in _jwks_cache:
        return _jwks_cache[ias_url]
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{ias_url}/oauth2/certs")
        if resp.status_code == 200:
            _jwks_cache[ias_url] = resp.json()
            return _jwks_cache[ias_url]
    return {}


def decode_token(token: str, ias_url: str, client_id: str) -> dict:
    """Decode and validate an IAS JWT token."""
    # For local dev, we can skip validation if IAS is not configured
    if not ias_url:
        return {
            "sub": "local-user",
            "name": "Local Developer",
            "email": "dev@local.test",
        }

    try:
        # Get JWKS
        import requests

        jwks_resp = requests.get(f"{ias_url}/oauth2/certs", timeout=5)
        jwks = jwks_resp.json()

        # Decode header to get kid
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        # Find the matching key
        rsa_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(key)
                break

        if not rsa_key:
            raise HTTPException(status_code=401, detail="Invalid token key")

        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=ias_url,
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


def get_current_user(request: Request) -> dict:
    """Extract current user from session cookie or return anonymous for local dev."""
    settings = load_settings()

    # If IAS is not configured, allow anonymous access (local dev without IAS)
    if not settings.auth.ias_url:
        return {
            "user_id": "local-dev",
            "name": "Local Developer",
            "email": "dev@local.test",
        }

    session_id = request.cookies.get("session_id")
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated. Please login.")

    session = get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=401, detail="Session expired. Please login again."
        )

    return {
        "user_id": session["user_id"],
        "name": session["user_name"],
        "email": session["user_email"],
    }


def get_optional_user(request: Request) -> dict:
    """Get current user or return anonymous (never raises)."""
    try:
        return get_current_user(request)
    except HTTPException:
        return {"user_id": "anonymous", "name": "Anonymous", "email": ""}
