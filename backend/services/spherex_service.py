from fastapi import HTTPException
from astropy.time import Time
from datetime import datetime
import asyncio
import csv
import io
import re

try:
    from astroquery.ipac.irsa import Irsa
    from astropy.coordinates import SkyCoord
    import astropy.units as u
    HAS_ASTROQUERY = True
except ImportError:
    HAS_ASTROQUERY = False

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    import requests
    HAS_HTTPX = False


def _is_matching_date(observed_iso: str, start_date: str, end_date: str) -> bool:
    """Memeriksa apakah timestamp ISO observasi berada dalam rentang start_date dan end_date."""
    if not observed_iso:
        return True
    obs_date = observed_iso[:10]  # Format: YYYY-MM-DD
    if start_date and obs_date < start_date:
        return False
    if end_date and obs_date > end_date:
        return False
    return True


def _is_matching_detector(detector_val: str, filter_str: str) -> bool:
    """Memeriksa apakah nama detektor cocok dengan filter yang diberikan (contoh: D1, SPHEREx-D1, 1)."""
    if not filter_str:
        return True
    det = str(detector_val).strip().upper()
    filt = filter_str.strip().upper()
    if filt == det:
        return True
    if filt in det:
        return True
    if filt.isdigit() and f"D{filt}" in det:
        return True
    return False


def _build_preview_url(access_url: str, ra: float, dec: float, size: float = 0.02) -> str:
    """Membangun URL cutout visual dari IBE (Image Back End) IRSA."""
    if "/data/" in access_url:
        rel_path = access_url.split("/data/")[1]
        return f"https://irsa.ipac.caltech.edu/ibe/cutout?ra={ra}&dec={dec}&size={size}&path={rel_path}"
    return f"{access_url}?center={ra},{dec}&size=100pix"


def _query_via_astroquery(ra: float, dec: float, radius: float, collection: str, time_param=None):
    """Query IRSA SIA2 menggunakan pustaka astroquery."""
    coord = SkyCoord(ra=ra, dec=dec, unit="deg")
    kwargs = {
        "pos": (coord, radius * u.deg),
        "collection": collection,
    }
    if time_param:
        kwargs["time"] = time_param
    return Irsa.query_sia(**kwargs)


def _query_via_http_fallback(ra: float, dec: float, radius: float, collection: str):
    """Fallback query langsung ke endpoint HTTP SIA2 IRSA jika astroquery tidak tersedia."""
    url = f"https://irsa.ipac.caltech.edu/SIA?COLLECTION={collection}&POS=CIRCLE+{ra}+{dec}+{radius}&RESPONSEFORMAT=CSV"
    headers = {"User-Agent": "SPHEREx-Cosmic-Explorer/1.1 (FastAPI/Astroquery)"}
    
    if HAS_HTTPX:
        with httpx.Client(timeout=25.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"IRSA HTTP error {resp.status_code}: {resp.text}")
            csv_text = resp.text
    else:
        resp = requests.get(url, headers=headers, timeout=25.0)
        if resp.status_code != 200:
            raise Exception(f"IRSA HTTP error {resp.status_code}: {resp.text}")
        csv_text = resp.text

    reader = csv.DictReader(io.StringIO(csv_text))
    return list(reader)


async def query_spherex_observations(
    ra: float,
    dec: float,
    radius: float = 0.05,
    collection: str = "spherex_qr3",
    start_date: str = None,
    end_date: str = None,
    detector: str = None,
) -> dict:
    """Mengeksekusi pencarian observasi SPHEREx dinamis ke IRSA SIA2 / TAP dan mengembalikan data ternormalisasi."""
    # 1. Validasi input koordinat
    if not (0.0 <= ra <= 360.0):
        raise HTTPException(
            status_code=400,
            detail="Parameter 'ra' (Right Ascension) harus bernilai antara 0.0 dan 360.0 derajat.",
        )
    if not (-90.0 <= dec <= 90.0):
        raise HTTPException(
            status_code=400,
            detail="Parameter 'dec' (Declination) harus bernilai antara -90.0 dan 90.0 derajat.",
        )
    if radius <= 0.0 or radius > 10.0:
        raise HTTPException(
            status_code=400,
            detail="Parameter 'radius' harus lebih besar dari 0 dan maksimal 10.0 derajat.",
        )

    # 2. Validasi format tanggal
    date_regex = re.compile(r"^\d{4}-\d{2}-\d{2}$")
    if start_date:
        if not date_regex.match(start_date):
            raise HTTPException(status_code=400, detail="Format 'start_date' harus YYYY-MM-DD.")
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Nilai 'start_date' bukan tanggal kalender yang valid.")

    if end_date:
        if not date_regex.match(end_date):
            raise HTTPException(status_code=400, detail="Format 'end_date' harus YYYY-MM-DD.")
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Nilai 'end_date' bukan tanggal kalender yang valid.")

    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="'start_date' tidak boleh lebih besar dari 'end_date'.")

    # Siapkan interval waktu untuk SIA jika kedua batas diberikan
    time_param = None
    if start_date and end_date:
        time_param = (start_date, end_date)

    # 3. Eksekusi query ke IRSA dalam thread asynchronous agar tidak memblokir event loop
    try:
        if HAS_ASTROQUERY:
            try:
                table_result = await asyncio.wait_for(
                    asyncio.to_thread(_query_via_astroquery, ra, dec, radius, collection, time_param),
                    timeout=30.0,
                )
                rows = list(table_result) if table_result is not None else []
            except Exception as e:
                # Fallback ke HTTP SIA query jika astroquery mengalami galat parsing
                rows = await asyncio.wait_for(
                    asyncio.to_thread(_query_via_http_fallback, ra, dec, radius, collection),
                    timeout=30.0,
                )
        else:
            rows = await asyncio.wait_for(
                asyncio.to_thread(_query_via_http_fallback, ra, dec, radius, collection),
                timeout=30.0,
            )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Koneksi ke layanan NASA IRSA SIA2 mengalami timeout. Silakan coba kembali beberapa saat lagi.",
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Gagal melakukan query ke layanan NASA IRSA: {str(exc)}",
        )

    # 4. Normalisasi dan filtering data hasil observasi
    observations = []
    for row in rows:
        # Ekstraksi URL FITS dan URL cutout
        access_url = str(row.get("access_url") if isinstance(row, dict) else row["access_url"])
        preview_url = _build_preview_url(access_url, ra, dec, size=min(radius, 0.05))

        # Ekstraksi timestamp observasi dalam format UTC ISO
        t_min = row.get("t_min") if isinstance(row, dict) else row["t_min"]
        observed_at = None
        if t_min is not None and str(t_min).strip() not in ("", "--"):
            try:
                observed_at = Time(float(t_min), format="mjd").isot
            except Exception:
                obs_rel = row.get("obs_release_date") if isinstance(row, dict) else row.get("obs_release_date")
                observed_at = str(obs_rel) if obs_rel else None
        else:
            obs_rel = row.get("obs_release_date") if isinstance(row, dict) else row.get("obs_release_date")
            observed_at = str(obs_rel) if obs_rel else None

        # Ekstraksi detektor dan ID observasi
        det = str(row.get("energy_bandpassname", "") if isinstance(row, dict) else row["energy_bandpassname"]).strip()
        obs_id = str(row.get("obs_id", "") if isinstance(row, dict) else row["obs_id"]).strip()

        # Terapkan filter tanggal (start_date / end_date)
        if not _is_matching_date(observed_at, start_date, end_date):
            continue

        # Terapkan filter detektor
        if not _is_matching_detector(det, detector):
            continue

        observations.append({
            "observation_id": obs_id,
            "observed_at_utc": observed_at,
            "detector": det,
            "preview_url": preview_url,
            "fits_url": access_url,
        })

    # Urutkan berdasarkan observed_at_utc kronologis
    observations.sort(key=lambda x: x.get("observed_at_utc") or "")

    return {
        "query": {
            "ra": ra,
            "dec": dec,
            "radius": radius,
            "collection": collection,
            "start_date": start_date,
            "end_date": end_date,
            "detector": detector,
        },
        "source": "IRSA",
        "total_results": len(observations),
        "observations": observations,
    }
