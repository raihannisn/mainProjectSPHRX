import os
import logging
from fastapi import HTTPException

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    import requests
    HAS_HTTPX = False

from utils.normalizers import normalize_apod, normalize_neows, DUMMY_APOD

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# NASA APOD — WordPress REST endpoint (no API key required).
# Migrated from legacy api.nasa.gov/planetary/apod on 10 Sep 2026.
# Legacy endpoint retires 1 Dec 2026.
# Returns a JSON array; we take the first (most recent) entry.
# ---------------------------------------------------------------------------
NASA_APOD_URL = "https://science.nasa.gov/wp-json/wp/v2/apod-basic?per_page=1"

# ---------------------------------------------------------------------------
# NeoWs — still served from api.nasa.gov and requires an API key.
# NASA_API_KEY must be provided via environment variable.
# If absent, falls back to "DEMO_KEY" (NASA's public rate-limited demo key,
# documented at https://api.nasa.gov/ — 30 req/hr, 50 req/day).
# Never hardcode a real API key in source code.
# ---------------------------------------------------------------------------
_DEMO_KEY = "DEMO_KEY"


def _neows_url() -> str:
    """Build the NeoWs URL at request time so the env var is read after startup."""
    key = os.environ.get("NASA_API_KEY") or _DEMO_KEY
    if not os.environ.get("NASA_API_KEY"):
        logger.warning(
            "NASA_API_KEY environment variable is not set. "
            "Using public DEMO_KEY (rate-limited: 30 req/hr). "
            "Set NASA_API_KEY for production use."
        )
    return f"https://api.nasa.gov/neo/rest/v1/feed?api_key={key}"


async def fetch_apod() -> dict:
    """Fetch the latest Astronomy Picture of the Day from the NASA WordPress REST API.

    The endpoint returns a JSON array. We take the first (most recent) entry and
    normalize it into the application's response contract.

    Falls back to DUMMY_APOD on any network failure, HTTP error, or unexpected
    response structure. The fallback is clearly labeled with status='error' so
    the frontend can distinguish live data from placeholder content.
    """
    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(NASA_APOD_URL)
                if response.status_code == 200:
                    data = response.json()
                    # WordPress endpoint returns a JSON array.
                    if isinstance(data, list) and len(data) > 0:
                        return normalize_apod(data[0])
                    logger.warning("NASA APOD response was empty or not a list: %r", data)
                    return DUMMY_APOD
                logger.warning(
                    "NASA APOD returned HTTP %s", response.status_code
                )
                return DUMMY_APOD
        else:
            response = requests.get(NASA_APOD_URL, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    return normalize_apod(data[0])
                return DUMMY_APOD
            return DUMMY_APOD
    except Exception:
        # Covers connection errors, timeouts, and JSON parse failures.
        logger.exception("Failed to fetch APOD from NASA WordPress endpoint")
        return DUMMY_APOD


async def fetch_neows() -> dict:
    """Fetch and normalize Near-Earth Object data from NASA NeoWs API.

    Raises HTTPException on upstream HTTP errors so the FastAPI route returns
    an appropriate status code to the client. Wraps unexpected exceptions in a
    502 response.
    """
    url = _neows_url()
    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.get(url)
                if response.status_code == 429:
                    raise HTTPException(
                        status_code=429,
                        detail=(
                            "NASA NeoWs rate limit reached. "
                            "Set NASA_API_KEY environment variable for a higher quota."
                        )
                    )
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"NASA NeoWs error: {response.text}"
                    )
                return normalize_neows(response.json())
        else:
            response = requests.get(url, timeout=25.0)
            if response.status_code == 429:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "NASA NeoWs rate limit reached. "
                        "Set NASA_API_KEY environment variable for a higher quota."
                    )
                )
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"NASA NeoWs error: {response.text}"
                )
            return normalize_neows(response.json())
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal menghubungi server NASA NeoWs: {str(exc)}"
        )
