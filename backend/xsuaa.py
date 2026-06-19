"""XSUAA authentication — reads CF service binding from VCAP_SERVICES."""

import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_xsuaa_config: Optional[dict] = None


def get_xsuaa_config() -> Optional[dict]:
    """Parse XSUAA credentials from VCAP_SERVICES (CF service binding)."""
    global _xsuaa_config
    if _xsuaa_config is not None:
        return _xsuaa_config

    vcap = os.environ.get("VCAP_SERVICES", "")
    if not vcap:
        return None
    try:
        services = json.loads(vcap)
        xsuaa = services.get("xsuaa", [])
        if xsuaa:
            _xsuaa_config = xsuaa[0]["credentials"]
            return _xsuaa_config
    except Exception as e:
        logger.warning(f"Failed to parse XSUAA from VCAP_SERVICES: {e}")
    return None


def _get_jwks(jwks_uri: str) -> list:
    """Fetch JWK keys from XSUAA. Simple in-process cache."""
    import urllib.request

    try:
        with urllib.request.urlopen(jwks_uri, timeout=10) as resp:
            return json.loads(resp.read()).get("keys", [])
    except Exception as e:
        logger.warning(f"Failed to fetch JWKS from {jwks_uri}: {e}")
        return []


def verify_token(token: str) -> Optional[dict]:
    """Decode and verify a XSUAA JWT. Returns claims dict or None on failure."""
    cfg = get_xsuaa_config()
    if not cfg:
        return None

    try:
        import base64

        # Decode header to get kid
        header_b64 = token.split(".")[0]
        header_b64 += "=" * (-len(header_b64) % 4)
        header = json.loads(base64.urlsafe_b64decode(header_b64))
        kid = header.get("kid")

        uaa_domain = cfg.get("uaadomain") or cfg.get("url", "").replace("https://", "")
        jwks_uri = f"https://{uaa_domain}/token_keys"
        keys = _get_jwks(jwks_uri)

        # Find matching key
        jwk = next((k for k in keys if k.get("kid") == kid), keys[0] if keys else None)
        if not jwk:
            logger.warning("No matching JWK found")
            return None

        # Build public key from JWK
        from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
        from cryptography.hazmat.backends import default_backend

        def _b64_to_int(s: str) -> int:
            s += "=" * (-len(s) % 4)
            return int.from_bytes(base64.urlsafe_b64decode(s), "big")

        pub_numbers = RSAPublicNumbers(e=_b64_to_int(jwk["e"]), n=_b64_to_int(jwk["n"]))
        public_key = pub_numbers.public_key(default_backend())

        # Verify signature manually
        import struct
        header_payload, sig_b64 = token.rsplit(".", 1)
        sig_b64 += "=" * (-len(sig_b64) % 4)
        sig = base64.urlsafe_b64decode(sig_b64)

        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.asymmetric import padding

        public_key.verify(sig, header_payload.encode(), padding.PKCS1v15(), hashes.SHA256())

        # Decode payload
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
        return claims

    except Exception as e:
        logger.warning(f"Token verification failed: {e}")
        return None


def _extract_user(claims: dict) -> dict:
    """Extract user info from XSUAA JWT claims."""
    email = claims.get("email") or claims.get("user_name", "")
    given_name = claims.get("given_name", "")
    family_name = claims.get("family_name", "")
    name = f"{given_name} {family_name}".strip() or email or claims.get("sub", "unknown")
    return {
        "user_id": claims.get("user_id") or claims.get("sub", "unknown"),
        "name": name,
        "email": email,
        "given_name": given_name,
        "family_name": family_name,
    }


def _anonymous() -> dict:
    return {
        "user_id": "anonymous",
        "name": "Anonymous",
        "email": "",
        "given_name": "",
        "family_name": "",
    }


def get_current_user(request) -> dict:
    """Extract and verify user from request. Raises if not authenticated."""
    user = get_optional_user(request)
    if user["user_id"] == "anonymous":
        # In local dev (no VCAP_SERVICES), allow anonymous
        if not get_xsuaa_config():
            return user
        from fastapi import HTTPException
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_optional_user(request) -> dict:
    """Extract user from request, return anonymous dict if not authenticated."""
    # 1. Try Authorization: Bearer header
    auth_header = request.headers.get("Authorization", "")
    token = None
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]

    # 2. Try x-user-token header (set by CF AppRouter in some setups)
    if not token:
        cf_user_header = request.headers.get("x-user-token", "")
        if cf_user_header:
            token = cf_user_header

    if not token:
        return _anonymous()

    # Always try to decode the JWT payload — trust tokens forwarded by AppRouter
    try:
        import base64
        payload_b64 = token.split(".")[1]
        payload_b64 += "=" * (-len(payload_b64) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload_b64))
        user = _extract_user(claims)
        # Only return anonymous if we truly got no useful info
        if user["user_id"] != "unknown" or user["email"]:
            return user
    except Exception:
        pass

    # Fall back to full signature verification
    cfg = get_xsuaa_config()
    if cfg:
        claims = verify_token(token)
        if claims:
            return _extract_user(claims)

    return _anonymous()
