from fastapi import APIRouter
from services.nasa_service import fetch_apod, fetch_neows

router = APIRouter(prefix="/api/nasa", tags=["NASA"])


@router.get("/apod")
async def get_nasa_apod():
    """Mengambil Astronomy Picture of the Day (APOD) dari NASA API.
    Jika API NASA down (Error 500, timeout, dll), mengembalikan JSON statis/dummy.
    """
    return await fetch_apod()


@router.get("/neows")
async def get_nasa_neows():
    """Mengambil data Near Earth Objects (Asteroid Feed) dari NASA NeoWs API dengan data ternormalisasi."""
    return await fetch_neows()
