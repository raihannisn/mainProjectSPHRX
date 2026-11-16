import json
from pathlib import Path

from fastapi import HTTPException


OBJECT_CATALOG_PATH = Path(__file__).resolve().parent.parent / "kamus_object.json"


class ObjectRecordNotFound(HTTPException):
    def __init__(self, object_id: str):
        super().__init__(
            status_code=404,
            detail=f"Object '{object_id}' was not found in the catalog.",
        )


def get_object_record(object_id: str) -> dict:
    if not OBJECT_CATALOG_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Object catalog file '{OBJECT_CATALOG_PATH}' was not found.",
        )

    try:
        with OBJECT_CATALOG_PATH.open(encoding="utf-8") as catalog_file:
            data = json.load(catalog_file)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if not isinstance(data, dict):
        raise HTTPException(status_code=500, detail="Invalid object catalog format.")

    record = data.get(object_id.strip().lower())
    if not isinstance(record, dict):
        raise ObjectRecordNotFound(object_id)
    return record
