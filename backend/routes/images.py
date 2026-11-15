from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os

router = APIRouter(prefix="/api/image", tags=["Images"])

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGE_1 = str(BASE_DIR / "hasil_gambar.png")
IMAGE_2 = str(BASE_DIR / "hasil_gambar_2.png")
FALLBACK_1 = str(BASE_DIR.parent / "arvr" / "public" / "spherex" / "blink-a.png")
FALLBACK_2 = str(BASE_DIR.parent / "arvr" / "public" / "spherex" / "blink-b.png")


@router.get("/t1")
def get_image_t1():
    if os.path.exists(IMAGE_1):
        return FileResponse(IMAGE_1, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
    if os.path.exists(FALLBACK_1):
        return FileResponse(FALLBACK_1, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
    raise HTTPException(status_code=404, detail="Gambar T1 tidak ditemukan")


@router.get("/t2")
def get_image_t2():
    if os.path.exists(IMAGE_2):
        return FileResponse(IMAGE_2, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
    if os.path.exists(FALLBACK_2):
        return FileResponse(FALLBACK_2, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
    raise HTTPException(status_code=404, detail="Gambar T2 tidak ditemukan")
