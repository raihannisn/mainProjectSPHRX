from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os

router = APIRouter(tags=["System"])

BASE_DIR = Path(__file__).resolve().parent.parent
MISSION_CONTROL_HTML = BASE_DIR / "templates" / "mission_control.html"


@router.get("/")
def root():
    return {
        "message": "Welcome to SPHEREx Cosmic Explorer API.",
        "mission_control": "/mission-control",
        "docs": "/docs"
    }


@router.get("/mission-control", response_class=FileResponse)
def get_mission_control():
    """Mengembalikan halaman interaktif Mission Control & API Test Bench."""
    if not os.path.exists(MISSION_CONTROL_HTML):
        raise HTTPException(
            status_code=404,
            detail=f"File mission_control.html tidak ditemukan di {MISSION_CONTROL_HTML}"
        )
    return FileResponse(str(MISSION_CONTROL_HTML), media_type="text/html")


@router.get("/api/status")
def get_status():
    return {
        "status": "Online",
        "data_source": "NASA IRSA SPHEREx Archive & NASA Open APIs",
        "engine": "Python Astropy + FastAPI + HTTPX",
        "capabilities": [
            "FITS Parsing",
            "Image Serving",
            "JSON Database",
            "NASA APOD Integration",
            "NASA NeoWs Asteroid Tracker",
            "SPHEREx Dynamic Observations Search (IRSA SIA2)",
            "Interactive Mission Control Dashboard"
        ],
        "message": "Backend siap melayani FE, AI, dan AR!"
    }
