from fastapi import APIRouter, HTTPException
from pathlib import Path
import json
import os

router = APIRouter(prefix="/api/objects", tags=["Objects"])

BASE_DIR = Path(__file__).resolve().parent.parent
JSON_KAMUS = str(BASE_DIR / "kamus_object.json")


@router.get("/{object_id}")
def get_object_info(object_id: str):
    if not os.path.exists(JSON_KAMUS):
        raise HTTPException(status_code=404, detail=f"File database '{JSON_KAMUS}' tidak ditemukan di folder")
        
    try:
        with open(JSON_KAMUS, "r", encoding="utf-8") as file:
            data = json.load(file)
            if object_id.lower() in data:
                return data[object_id.lower()]
            raise HTTPException(status_code=404, detail=f"Objek '{object_id}' tidak ada di database")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
