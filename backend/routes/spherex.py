from fastapi import APIRouter, Query, Response
from typing import Optional
from services.spherex_service import query_spherex_observations, generate_fits_preview

router = APIRouter(prefix="/api/spherex", tags=["SPHEREx"])


@router.get("/observations")
async def get_spherex_observations(
    ra: float = Query(
        ...,
        description="Koordinat Right Ascension (RA) dalam derajat (0.0 sampai 360.0). Contoh: 134.8708"
    ),
    dec: float = Query(
        ...,
        description="Koordinat Declination (DEC) dalam derajat (-90.0 sampai 90.0). Contoh: -43.7533"
    ),
    radius: float = Query(
        0.05,
        description="Radius pencarian sudut dalam derajat (default: 0.05 derajat). Maksimal 10.0 derajat."
    ),
    collection: str = Query(
        "all",
        description="Nama koleksi data IRSA SPHEREx: 'all' (DR1 + QR3), 'spherex_dr1', atau 'spherex_qr3' (default: 'all')."
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
        description="Filter detektor SPHEREx (contoh: 'D1', 'D2', ..., 'D6' atau 'SPHEREx-D4')."
    ),
):
    """Pencarian observasi terpadu SPHEREx (DR1 + QR3) ke IRSA SIA2 berdasarkan koordinat langit (RA, DEC), radius, dan rentang tanggal."""
    return await query_spherex_observations(
        ra=ra,
        dec=dec,
        radius=radius,
        collection=collection,
        start_date=start_date,
        end_date=end_date,
        detector=detector,
    )


@router.get("/preview")
async def get_spherex_preview(
    fits_url: str = Query(
        ...,
        description="URL FITS IRSA yang valid dari host resmi irsa.ipac.caltech.edu."
    ),
    ra: Optional[float] = Query(
        None,
        description="Koordinat Right Ascension target dalam derajat."
    ),
    dec: Optional[float] = Query(
        None,
        description="Koordinat Declination target dalam derajat."
    ),
    size: Optional[float] = Query(
        0.05,
        description="Ukuran cutout sudut dalam derajat (default: 0.05 derajat)."
    ),
):
    """Menghasilkan preview visual PNG dari data FITS Level 2 SPHEREx menggunakan peregangan AsinhStretch terkontrol."""
    png_bytes, meta = await generate_fits_preview(
        fits_url=fits_url,
        ra=ra,
        dec=dec,
        size=size if size is not None else 0.05,
    )
    headers = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Preview-Normalization": meta.get("stretch", "AsinhStretch(a=0.1)"),
        "X-Preview-Stretch-VMin": str(meta.get("vmin", "")),
        "X-Preview-Stretch-VMax": str(meta.get("vmax", "")),
        "X-Preview-Disclaimer": "Visual preview only; not for quantitative photometry",
    }
    return Response(content=png_bytes, media_type="image/png", headers=headers)
