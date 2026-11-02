from fastapi import APIRouter

router = APIRouter(tags=["System"])


@router.get("/")
def root():
    return {"message": "Welcome to SPHEREx Cosmic Explorer API. Go to /docs for documentation."}


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
            "NASA NeoWs Asteroid Tracker"
        ],
        "message": "Backend siap melayani FE, AI, dan AR!"
    }
