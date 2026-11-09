from fastapi import APIRouter, Query
from typing import Optional
from services.spherex_service import query_spherex_observations

router = APIRouter(prefix="/api/spherex", tags=["SPHEREx"])


@router.get("/observations")
async def get_spherex_observations(
    ra: float = Query(
        ...,
        description="Koordinat Right Ascension (RA) dalam derajat (0.0 sampai 360.0). Contoh: 85.0556"
    ),
    dec: float = Query(
        ...,
        description="Koordinat Declination (DEC) dalam derajat (-90.0 sampai 90.0). Contoh: -5.6568"
    ),
    radius: float = Query(
        0.05,
        description="Radius pencarian sudut dalam derajat (default: 0.05 derajat). Maksimal 10.0 derajat."
    ),
    collection: str = Query(
        "spherex_qr3",
        description="Nama koleksi data IRSA SPHEREx (default: 'spherex_qr3')."
    ),
    start_date: Optional[str] = Query(
        None,
        description="Filter tanggal mulai observasi (format YYYY-MM-DD)."
    ),
    end_date: Optional[str] = Query(
        None,
        description="Filter tanggal akhir observasi (format YYYY-MM-DD)."
    ),
    detector: Optional[str] = Query(
        None,
        description="Filter detektor SPHEREx (contoh: 'D1', 'D2', ..., 'D6' atau 'SPHEREx-D1')."
    ),
):
    """Pencarian observasi dinamis teleskop SPHEREx ke IRSA SIA2/TAP berdasarkan koordinat langit (RA, DEC), radius, dan rentang tanggal."""
    return await query_spherex_observations(
        ra=ra,
        dec=dec,
        radius=radius,
        collection=collection,
        start_date=start_date,
        end_date=end_date,
        detector=detector,
    )
