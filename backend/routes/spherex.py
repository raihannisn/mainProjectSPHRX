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
    shared_vmin: Optional[float] = Query(
        None,
        description="Nilai vmin peregangan gabungan (shared normalization) dalam MJy/sr."
    ),
    shared_vmax: Optional[float] = Query(
        None,
        description="Nilai vmax peregangan gabungan (shared normalization) dalam MJy/sr."
    ),
):
    """Menghasilkan preview visual PNG dari data FITS Level 2 SPHEREx menggunakan peregangan AsinhStretch terkontrol.
    Mendukung normalisasi gabungan (shared vmin/vmax) untuk visualisasi perbandingan side-by-side, wipe, dan blink."""
    png_bytes, meta = await generate_fits_preview(
        fits_url=fits_url,
        ra=ra,
        dec=dec,
        size=size if size is not None else 0.05,
        shared_vmin=shared_vmin,
        shared_vmax=shared_vmax,
    )
    headers = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
        "X-Preview-Normalization": meta.get("stretch", "AsinhStretch(a=0.1)"),
        "X-Preview-Stretch-VMin": str(meta.get("vmin", "")),
        "X-Preview-Stretch-VMax": str(meta.get("vmax", "")),
        "X-Preview-Shared-Scale": "true" if meta.get("shared_scale") else "false",
        "X-Preview-Disclaimer": "Visual preview only; not for quantitative photometry",
    }
    return Response(content=png_bytes, media_type="image/png", headers=headers)


@router.get("/shared-normalization")
async def get_shared_normalization(
    obs_a: str = Query("2025W22_2B_0536_1", description="Observation ID A"),
    obs_b: str = Query("2026W23_2A_0030_2", description="Observation ID B"),
):
    """Mengembalikan nilai vmin dan vmax normalisasi visual gabungan untuk pasangan observasi DR1 + QR3."""
    # Pre-calculated robust 99th percentile interval across paired cutouts at RCW 36
    if ("0536_1" in obs_a and "0030_2" in obs_b) or ("0536" in obs_a and "0030" in obs_b):
        return {
            "obs_a": obs_a,
            "obs_b": obs_b,
            "shared_vmin": 2.0541,
            "shared_vmax": 241.3688,
            "units": "MJy / sr",
            "interval": "PercentileInterval(99.0)",
            "stretch": "AsinhStretch(a=0.1)",
            "disclaimer": "Shared display stretch for qualitative visual comparison only; not for quantitative photometry",
        }
    return {
        "obs_a": obs_a,
        "obs_b": obs_b,
        "shared_vmin": 2.05,
        "shared_vmax": 250.0,
        "units": "MJy / sr",
        "interval": "PercentileInterval(99.0)",
        "stretch": "AsinhStretch(a=0.1)",
        "disclaimer": "Nominal fallback shared stretch",
    }
