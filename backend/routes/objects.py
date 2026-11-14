from fastapi import APIRouter

from services.object_service import get_object_record


router = APIRouter(prefix="/api/objects", tags=["Objects"])


@router.get("/{object_id}")
def get_object_info(object_id: str):
    return get_object_record(object_id)
