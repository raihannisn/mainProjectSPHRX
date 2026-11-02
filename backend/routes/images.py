from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import os

router = APIRouter(prefix="/api/image", tags=["Images"])

BASE_DIR = Path(__file__).resolve().parent.parent
IMAGE_1 = str(BASE_DIR / "hasil_gambar.png")
IMAGE_2 = str(BASE_DIR / "hasil_gambar_2.png")


@router.get("/t1")
def get_image_t1():
    if not os.path.exists(IMAGE_1):
        raise HTTPException(status_code=404, detail="Gambar 1 belum di-generate")
    return FileResponse(IMAGE_1, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})


@router.get("/t2")
def get_image_t2():
    if not os.path.exists(IMAGE_2):
        raise HTTPException(status_code=404, detail="Gambar 2 belum di-generate")
    return FileResponse(IMAGE_2, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})
