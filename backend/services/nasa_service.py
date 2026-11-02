from fastapi import HTTPException
import os

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    import requests
    HAS_HTTPX = False

from utils.normalizers import normalize_apod, normalize_neows, DUMMY_APOD

NASA_API_KEY = os.getenv("NASA_API_KEY", "LJTHndTBTkjWpBkFbRQpzWTFPhBKFpnnh8zDtBcD")
NASA_APOD_URL = f"https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}"
NASA_NEOWS_URL = f"https://api.nasa.gov/neo/rest/v1/feed?api_key={NASA_API_KEY}"


async def fetch_apod() -> dict:
    """Mengambil Astronomy Picture of the Day (APOD) dari NASA API.
    Jika API NASA down (Error 500, timeout, dll), mengembalikan JSON statis/dummy.
    """
    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(NASA_APOD_URL)
                if response.status_code == 200:
                    return normalize_apod(response.json())
                return DUMMY_APOD
        else:
            response = requests.get(NASA_APOD_URL, timeout=15.0)
            if response.status_code == 200:
                return normalize_apod(response.json())
            return DUMMY_APOD
    except Exception:
        # Menangani timeout, kegagalan jaringan, atau error lainnya
        return DUMMY_APOD


async def fetch_neows() -> dict:
    """Mengambil data Near Earth Objects (Asteroid Feed) dari NASA NeoWs API dengan data ternormalisasi."""
    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=25.0) as client:
                response = await client.get(NASA_NEOWS_URL)
                if response.status_code != 200:
                    raise HTTPException(
                        status_code=response.status_code,
                        detail=f"NASA NeoWs error: {response.text}"
                    )
                return normalize_neows(response.json())
        else:
            response = requests.get(NASA_NEOWS_URL, timeout=25.0)
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
