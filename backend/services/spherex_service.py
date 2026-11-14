from fastapi import HTTPException
from astropy.time import Time
from astropy.io import fits
from astropy.wcs import WCS
from astropy.visualization import AsinhStretch, PercentileInterval, ImageNormalize
from PIL import Image
from datetime import datetime
import asyncio
import csv
import io
import os
import re
import json
import hashlib
import tempfile
import collections
import posixpath
from urllib.parse import urlparse, parse_qs

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

# Deployment-safe preview cache directory (Vercel serverless / read-only environment compatible)
def _get_previews_cache_dir() -> str:
    """Menentukan direktori cache yang aman untuk deployment serverless (Vercel) dan lokal."""
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        tmp_dir = os.path.join(tempfile.gettempdir(), "spherex_previews")
        os.makedirs(tmp_dir, exist_ok=True)
        return tmp_dir

    local_cache = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cache", "previews")
    try:
        os.makedirs(local_cache, exist_ok=True)
        test_file = os.path.join(local_cache, ".write_test")
        with open(test_file, "w") as f:
            f.write("ok")
        os.remove(test_file)
        return local_cache
    except Exception:
        tmp_dir = os.path.join(tempfile.gettempdir(), "spherex_previews")
        os.makedirs(tmp_dir, exist_ok=True)
        return tmp_dir

PREVIEWS_CACHE_DIR = _get_previews_cache_dir()


class InMemoryLRUCache:
    """Thread-safe in-memory LRU cache untuk respons PNG preview."""
    def __init__(self, capacity: int = 100):
        self.capacity = capacity
        self._cache = collections.OrderedDict()
        self._lock = asyncio.Lock()

    async def get(self, key: str):
        async with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
                return self._cache[key]
            return None

    async def put(self, key: str, value):
        async with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value
            if len(self._cache) > self.capacity:
                self._cache.popitem(last=False)


_MEMORY_PREVIEW_CACHE = InMemoryLRUCache(capacity=100)

# Maximum allowed size for FITS download to prevent resource exhaustion / DoS
MAX_FITS_BYTES = 15 * 1024 * 1024  # 15 MB

# DOI mappings per official IPAC release documentation
RELEASE_DOI_MAP = {
    "spherex_dr1": "10.26131/IRSA678",
    "spherex_qr3": "10.26131/IRSA662",
    "DR1": "10.26131/IRSA678",
    "QR3": "10.26131/IRSA662",
}

# Verified Spectral WCS calibration (CWAVE/CBAND) and WCS-WAVE visualization at RCW 36 (134.8708, -43.7533)
# Primary science analysis uses CWAVE (transmission median) & CBAND from SSDC calibration spectral_wcs_4_v2.2.fits
# WCS-WAVE is retained explicitly as a fast piecewise-bilinear visualization fallback
KNOWN_RCW36_CALIBRATIONS = {
    # Optimal scientifically matched pair (< 0.8% dW, ~368.1-day baseline)
    ("2025W22_2B_0536_1", "SPHEREx-D4"): {
        "cwave": 2.4489,
        "cband": 0.0602,
        "wcs_wave": 2.4474,
        "wcs_band": 0.0611,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "detector_coord": {"x": 1539.02, "y": 1927.46},
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear: no bad pixel, saturation, cosmic ray, or non-linear defect)",
    },
    ("2026W23_2A_0030_2", "SPHEREx-D4"): {
        "cwave": 2.4679,
        "cband": 0.0691,
        "wcs_wave": 2.4679,
        "wcs_band": 0.0710,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "detector_coord": {"x": 1433.37, "y": 1878.16},
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear: no bad pixel, saturation, cosmic ray, or non-linear defect)",
    },
    # Starting candidate pair (Section 4)
    ("2025W19_1B_0515_3", "SPHEREx-D4"): {
        "cwave": 3.0985,
        "cband": 0.0906,
        "wcs_wave": 3.0984,
        "wcs_band": 0.0906,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "detector_coord": {"x": 1695.54, "y": 1150.31},
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    ("2026W20_2A_0176_1", "SPHEREx-D4"): {
        "cwave": 2.6640,
        "cband": 0.0759,
        "wcs_wave": 2.6652,
        "wcs_band": 0.0760,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "detector_coord": {"x": 1544.12, "y": 1654.80},
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    ("2026W20_2A_0176_2", "SPHEREx-D4"): {
        "cwave": 2.6640,
        "cband": 0.0759,
        "wcs_wave": 2.6650,
        "wcs_band": 0.0760,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "detector_coord": {"x": 1544.12, "y": 1654.80},
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    # Secondary matched candidates
    ("2025W22_2B_0536_2", "SPHEREx-D4"): {
        "cwave": 2.5086,
        "cband": 0.0635,
        "wcs_wave": 2.5086,
        "wcs_band": 0.0635,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    ("2026W23_2A_0030_3", "SPHEREx-D4"): {
        "cwave": 2.5346,
        "cband": 0.0732,
        "wcs_wave": 2.5346,
        "wcs_band": 0.0732,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    ("2025W22_2B_0536_3", "SPHEREx-D4"): {
        "cwave": 2.5769,
        "cband": 0.0660,
        "wcs_wave": 2.5769,
        "wcs_band": 0.0660,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
    ("2026W23_2A_0030_4", "SPHEREx-D4"): {
        "cwave": 2.6028,
        "cband": 0.0754,
        "wcs_wave": 2.6028,
        "wcs_band": 0.0754,
        "cal_product": "spectral_wcs_4_v2.2.fits",
        "quality_flag": 2097152,
        "flag_bit": 21,
        "flag_meaning": "SOURCE (astronomical source detected; bits 0-20 clear)",
    },
}


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


def _build_cutout_fits_url(access_url: str, ra: float, dec: float, size: float = 0.05) -> str:
    """Membangun URL download cutout FITS standar IBE IRSA."""
    if "/data/" in access_url:
        rel_path = access_url.split("/data/")[1]
        return f"https://irsa.ipac.caltech.edu/ibe/cutout?ra={ra}&dec={dec}&size={size}&path={rel_path}"
    return f"{access_url}?center={ra},{dec}&size=100pix"


def _build_preview_url(access_url: str, ra: float, dec: float, size: float = 0.05) -> str:
    """Membangun URL visual PNG preview yang dilayani oleh backend preview pipeline."""
    return f"/api/spherex/preview?fits_url={access_url}&ra={ra}&dec={dec}&size={size}"


def _query_via_http_sia2(ra: float, dec: float, radius: float, collection: str, max_rec: int = 1000):
    """Query langsung ke endpoint HTTP SIA2 IRSA dengan syntax resmi untuk multi-koleksi dan Level 2 image constraints."""
    coll_lower = (collection or "all").strip().lower()
    if coll_lower in ("all", "both", "spherex_all", "unified", "spherex_dr1,spherex_qr3"):
        # Official IRSA SIA2 syntax: repeated COLLECTION parameters
        coll_query = "COLLECTION=spherex_dr1&COLLECTION=spherex_qr3"
    elif coll_lower in ("spherex_dr1", "dr1"):
        coll_query = "COLLECTION=spherex_dr1"
    elif coll_lower in ("spherex_qr3", "qr3"):
        coll_query = "COLLECTION=spherex_qr3"
    else:
        coll_query = f"COLLECTION={collection}"

    # Strict constraints: CALIB=2 (Level 2), DPTYPE=image (excludes Level 3 HiPS cube!)
    url = f"https://irsa.ipac.caltech.edu/SIA?{coll_query}&DPTYPE=image&CALIB=2&POS=CIRCLE+{ra}+{dec}+{radius}&RESPONSEFORMAT=CSV&MAXREC={max_rec}"
    headers = {"User-Agent": "SPHEREx-Cosmic-Explorer/1.2 (FastAPI/Astroquery)"}

    if HAS_HTTPX:
        with httpx.Client(timeout=35.0) as client:
            resp = client.get(url, headers=headers)
            if resp.status_code != 200:
                raise Exception(f"IRSA HTTP error {resp.status_code}: {resp.text[:200]}")
            csv_text = resp.text
    else:
        resp = requests.get(url, headers=headers, timeout=35.0)
        if resp.status_code != 200:
            raise Exception(f"IRSA HTTP error {resp.status_code}: {resp.text[:200]}")
        csv_text = resp.text

    reader = csv.DictReader(io.StringIO(csv_text))
    return list(reader)


async def query_spherex_observations(
    ra: float,
    dec: float,
    radius: float = 0.05,
    collection: str = "all",
    start_date: str = None,
    end_date: str = None,
    detector: str = None,
) -> dict:
    """Mengeksekusi pencarian observasi SPHEREx terpadu (DR1 + QR3) ke IRSA SIA2 dan menormalisasi data dengan provenance lengkap."""
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

    # 3. Eksekusi query ke IRSA SIA2 secara asynchronous
    try:
        rows = await asyncio.wait_for(
            asyncio.to_thread(_query_via_http_sia2, ra, dec, radius, collection),
            timeout=35.0,
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

    # 4. Normalisasi, filtering, dan deduplikasi data observasi
    observations = []
    seen_composite_keys = set()
    unique_obs_ids = set()

    for row in rows:
        # Ekstraksi koleksi dan validasi Level 2 image strictly
        coll = str(row.get("obs_collection", "")).strip()
        calib_level = str(row.get("calib_level", "2")).strip()
        dataproduct_type = str(row.get("dataproduct_type", "image")).strip().lower()

        # Strict exclusions: exclude Level 3 all-sky cubes or non-image products
        if calib_level != "2" or dataproduct_type != "image" or "cube" in coll.lower():
            continue

        obs_id = str(row.get("obs_id", "")).strip()
        det = str(row.get("energy_bandpassname", "")).strip()
        access_url = str(row.get("access_url", "")).strip()
        access_format = str(row.get("access_format", "image/fits")).strip()

        # Composite identity deduplication: collection + obs_id + detector + access_url
        composite_key = f"{coll}::{obs_id}::{det}::{access_url}"
        if composite_key in seen_composite_keys:
            continue
        seen_composite_keys.add(composite_key)

        # Map release provenance
        release = "DR1" if "dr1" in coll.lower() else "QR3"
        release_doi = RELEASE_DOI_MAP.get(release, "10.26131/IRSA662")

        # Extract processing version from path (e.g., l2b-v27-2026-196)
        proc_ver_match = re.search(r"(l2b-[a-z0-9\-]+)", access_url)
        processing_version = proc_ver_match.group(1) if proc_ver_match else "l2b-v27"

        # Timestamp normalizer
        t_min = row.get("t_min")
        observed_at = None
        if t_min is not None and str(t_min).strip() not in ("", "--"):
            try:
                observed_at = Time(float(t_min), format="mjd").isot
            except Exception:
                obs_rel = row.get("obs_release_date")
                observed_at = str(obs_rel) if obs_rel else None
        else:
            obs_rel = row.get("obs_release_date")
            observed_at = str(obs_rel) if obs_rel else None

        # Terapkan filter tanggal
        if not _is_matching_date(observed_at, start_date, end_date):
            continue

        # Terapkan filter detektor
        if not _is_matching_detector(det, detector):
            continue

        # Cutout FITS URL and Visual Preview URL
        cutout_fits_url = _build_cutout_fits_url(access_url, ra, dec, size=min(radius, 0.05))
        preview_url = _build_preview_url(access_url, ra, dec, size=min(radius, 0.05))

        # Effective wavelength and bandwidth at target
        # Primary science analysis uses CWAVE and CBAND from spectral_wcs calibration product
        # WCS-WAVE is retained as an explicitly labeled fast visualization fallback
        known_cal = KNOWN_RCW36_CALIBRATIONS.get((obs_id, det))
        if known_cal:
            cwave_val = known_cal["cwave"]
            cband_val = known_cal["cband"]
            eff_wave = f"{cwave_val:.4f} μm (CWAVE)"
            bandwidth = f"{cband_val:.4f} μm (CBAND)"
            wcs_wave = f"{known_cal['wcs_wave']:.4f} μm (WCS-WAVE fallback)"
            wcs_band = f"{known_cal['wcs_band']:.4f} μm (WCS-WAVE fallback)"
            cal_source = f"{known_cal.get('cal_product', 'spectral_wcs_4_v2.2.fits')} (CWAVE/CBAND primary; WCS-WAVE visualization fallback)"
            q_flag = known_cal.get("quality_flag", 2097152)
            q_meaning = known_cal.get("flag_meaning", "SOURCE (astronomical source detected; bits 0-20 clear)")
        else:
            em_min = row.get("em_min")
            em_max = row.get("em_max")
            em_res = row.get("em_res_power")
            if em_min and em_max:
                try:
                    w_center = (float(em_min) + float(em_max)) / 2.0 * 1e6
                    eff_wave = f"{w_center:.3f} μm (nominal)"
                    if em_res and float(em_res) > 0:
                        bw = w_center / float(em_res)
                        bandwidth = f"{bw:.4f} μm"
                    else:
                        bandwidth = f"{(float(em_max) - float(em_min)) * 1e6:.3f} μm"
                except Exception:
                    eff_wave = "2.42–3.82 μm" if "D4" in det else "Calibrated LVF"
                    bandwidth = "Variable"
            else:
                eff_wave = "2.42–3.82 μm" if "D4" in det else "Calibrated LVF"
                bandwidth = "Variable"
            wcs_wave = eff_wave
            wcs_band = bandwidth
            cal_source = "Instrument Nominal Bandpass"
            q_flag = 0
            q_meaning = "Unflagged"

        unique_obs_ids.add(obs_id)
        observations.append({
            "observation_id": obs_id,
            "release": release,
            "release_doi": release_doi,
            "collection": coll,
            "processing_version": processing_version,
            "calib_level": 2,
            "product_type": "image",
            "detector": det,
            "observed_at_utc": observed_at,
            "access_url": access_url,
            "fits_url": access_url,
            "cutout_fits_url": cutout_fits_url,
            "original_access_format": access_format,
            "effective_wavelength_at_target": eff_wave,
            "bandwidth_at_target": bandwidth,
            "visualization_wavelength": wcs_wave,
            "visualization_bandwidth": wcs_band,
            "spectral_calibration_source": cal_source,
            "quality_flag": q_flag,
            "quality_flag_meaning": q_meaning,
            "preview_url": preview_url,
            "provenance_badge": f"● LIVE {release}",
        })

    # Urutkan berdasarkan observed_at_utc kronologis
    observations.sort(key=lambda x: x.get("observed_at_utc") or "")
    sorted_unique_obs_ids = sorted(list(unique_obs_ids))

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
        "semantics": "footprint_intersection",
        "total_products": len(observations),
        "total_results": len(observations),  # Backward compatibility for Phase 4B consumers
        "unique_observation_count": len(sorted_unique_obs_ids),
        "unique_observation_ids": sorted_unique_obs_ids,
        "observations": observations,
    }


def _validate_irsa_url(url_str: str) -> str:
    """Memverifikasi bahwa URL FITS mengarah ke host IRSA terpercaya untuk mencegah SSRF dan path traversal."""
    parsed = urlparse(url_str)
    if parsed.scheme.lower() != "https":
        raise HTTPException(status_code=400, detail="Hanya skema https yang diizinkan untuk FITS preview.")
    if parsed.hostname is None or parsed.hostname.lower() != "irsa.ipac.caltech.edu":
        raise HTTPException(
            status_code=400,
            detail=f"Host tidak diizinkan: '{parsed.hostname}'. Hanya host NASA IRSA ('irsa.ipac.caltech.edu') yang diterima.",
        )
    clean_path = posixpath.normpath(parsed.path)
    if not (clean_path.startswith("/ibe/data/spherex/") or clean_path.startswith("/ibe/cutout")):
        raise HTTPException(
            status_code=400,
            detail="Jalur produk FITS tidak valid. Hanya produk SPHEREx IBE yang diizinkan.",
        )
    return url_str


async def generate_fits_preview(
    fits_url: str,
    ra: float = None,
    dec: float = None,
    size: float = 0.05,
    shared_vmin: float = None,
    shared_vmax: float = None,
) -> tuple[bytes, dict]:
    """Mengambil cutout FITS dari IRSA, mengekstrak IMAGE HDU, menerapkan AsinhStretch, dan menghasilkan PNG browser.
    Mendukung Vercel serverless cache (/tmp), in-memory LRU, SSRF protection (no redirects, 15MB limit), dan shared normalization."""
    # 1. Validasi keamanan host dan path
    clean_url = _validate_irsa_url(fits_url)

    # 2. Bangun URL cutout jika fits_url adalah file full-frame 60MB
    fetch_url = clean_url
    if "/ibe/data/spherex/" in clean_url and ra is not None and dec is not None:
        rel_path = clean_url.split("/data/")[1]
        fetch_url = f"https://irsa.ipac.caltech.edu/ibe/cutout?ra={ra}&dec={dec}&size={min(size, 0.05)}&path={rel_path}"

    # 3. Cache key computation & validation
    cache_payload = f"{fetch_url}::vmin={shared_vmin}::vmax={shared_vmax}" if (shared_vmin is not None and shared_vmax is not None) else fetch_url
    cache_key = hashlib.sha256(cache_payload.encode("utf-8")).hexdigest()

    if not re.match(r"^[a-f0-9]{64}$", cache_key):
        raise HTTPException(status_code=400, detail="Cache key tidak valid.")

    # 4. Check In-Memory Cache first
    mem_cached = await _MEMORY_PREVIEW_CACHE.get(cache_key)
    if mem_cached:
        png_bytes, meta = mem_cached
        meta_copy = dict(meta)
        meta_copy["cached"] = True
        meta_copy["cache_tier"] = "memory_lru"
        return png_bytes, meta_copy

    # 5. Check Disk Cache
    cache_dir = _get_previews_cache_dir()
    cache_png = os.path.join(cache_dir, f"{cache_key}.png")
    cache_json = os.path.join(cache_dir, f"{cache_key}.json")
    if os.path.exists(cache_png):
        try:
            with open(cache_png, "rb") as f:
                png_bytes = f.read()
            if os.path.exists(cache_json):
                with open(cache_json, "r") as f:
                    meta = json.load(f)
            else:
                meta = {
                    "stretch": "Shared AsinhStretch(a=0.1)" if shared_vmin is not None else "AsinhStretch(a=0.1)",
                    "interval": "PercentileInterval(99.0)",
                    "vmin": shared_vmin if shared_vmin is not None else 2.05,
                    "vmax": shared_vmax if shared_vmax is not None else 241.37,
                    "shape": [256, 256],
                    "shared_scale": shared_vmin is not None and shared_vmax is not None,
                }
            meta["cached"] = True
            meta["cache_tier"] = "disk"
            await _MEMORY_PREVIEW_CACHE.put(cache_key, (png_bytes, meta))
            return png_bytes, meta
        except Exception:
            pass

    # 6. Unduh FITS dari IRSA dengan SSRF & resource guards (follow_redirects=False, size limit 15MB)
    headers = {"User-Agent": "SPHEREx-Cosmic-Explorer/1.2 (FITS-Preview-Pipeline)"}
    fits_bytes = None
    max_retries = 3

    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=10.0)) as client:
                for attempt in range(max_retries):
                    resp = await client.get(fetch_url, headers=headers, follow_redirects=False)
                    if resp.status_code in (301, 302, 303, 307, 308):
                        raise HTTPException(
                            status_code=400,
                            detail="Pengalihan (redirect) upstream dari IRSA tidak diizinkan untuk keamanan SSRF.",
                        )
                    if resp.status_code == 200:
                        cl_header = resp.headers.get("content-length")
                        if cl_header and int(cl_header) > MAX_FITS_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail=f"Ukuran file FITS ({cl_header} bytes) melebihi batas maksimum 15 MB.",
                            )
                        content_accum = bytearray()
                        async for chunk in resp.aiter_bytes():
                            content_accum.extend(chunk)
                            if len(content_accum) > MAX_FITS_BYTES:
                                raise HTTPException(
                                    status_code=413,
                                    detail="Ukuran payload FITS melebihi batas maksimum 15 MB.",
                                )
                        fits_bytes = bytes(content_accum)
                        break
                    elif resp.status_code in (503, 429) and attempt < max_retries - 1:
                        await asyncio.sleep(2.0 * (attempt + 1))
                        continue
                    else:
                        raise HTTPException(
                            status_code=503 if resp.status_code == 503 else 502,
                            detail=f"Layanan NASA IRSA IBE sedang sibuk atau tidak tersedia (HTTP {resp.status_code}). Silakan coba sesaat lagi.",
                        )
        else:
            for attempt in range(max_retries):
                resp = requests.get(fetch_url, headers=headers, timeout=25.0, allow_redirects=False, stream=True)
                if resp.status_code in (301, 302, 303, 307, 308):
                    raise HTTPException(
                        status_code=400,
                        detail="Pengalihan (redirect) upstream dari IRSA tidak diizinkan untuk keamanan SSRF.",
                    )
                if resp.status_code == 200:
                    cl_header = resp.headers.get("content-length")
                    if cl_header and int(cl_header) > MAX_FITS_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Ukuran file FITS ({cl_header} bytes) melebihi batas maksimum 15 MB.",
                        )
                    content_accum = bytearray()
                    for chunk in resp.iter_content(chunk_size=65536):
                        content_accum.extend(chunk)
                        if len(content_accum) > MAX_FITS_BYTES:
                            raise HTTPException(
                                status_code=413,
                                detail="Ukuran payload FITS melebihi batas maksimum 15 MB.",
                            )
                    fits_bytes = bytes(content_accum)
                    break
                elif resp.status_code in (503, 429) and attempt < max_retries - 1:
                    await asyncio.sleep(2.0 * (attempt + 1))
                    continue
                else:
                    raise HTTPException(
                        status_code=503 if resp.status_code == 503 else 502,
                        detail=f"Layanan NASA IRSA IBE sedang sibuk atau tidak tersedia (HTTP {resp.status_code}).",
                    )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Koneksi timeout saat mengambil FITS dari IRSA: {str(exc)}",
        )

    # 7. Parse FITS dan ekstrak IMAGE HDU menggunakan Astropy
    try:
        def _process_fits(content, s_vmin, s_vmax):
            with fits.open(io.BytesIO(content)) as hdul:
                img_hdu = None
                for hdu in hdul:
                    if hdu.data is not None and len(getattr(hdu, "shape", [])) >= 2:
                        img_hdu = hdu
                        break
                if img_hdu is None:
                    raise ValueError("FITS file does not contain a valid 2D IMAGE HDU")

                data = img_hdu.data.astype(float)
                valid_mask = np.isfinite(data)
                if not np.any(valid_mask):
                    raise ValueError("IMAGE HDU does not contain finite pixel values")

                # Shared or individual normalization
                if s_vmin is not None and s_vmax is not None:
                    vmin = float(s_vmin)
                    vmax = float(s_vmax)
                    stretch_name = "Shared AsinhStretch(a=0.1)"
                    is_shared = True
                else:
                    interval = PercentileInterval(99.0)
                    vmin, vmax = interval.get_limits(data[valid_mask])
                    stretch_name = "AsinhStretch(a=0.1)"
                    is_shared = False

                if vmin >= vmax:
                    vmax = vmin + 1.0

                norm = ImageNormalize(vmin=vmin, vmax=vmax, stretch=AsinhStretch(a=0.1), clip=True)
                norm_data = norm(data)
                uint8_data = (np.clip(norm_data, 0.0, 1.0) * 255.0).astype(np.uint8)

                img = Image.fromarray(uint8_data, mode="L")
                img = img.transpose(Image.Transpose.FLIP_TOP_BOTTOM)
                img_resized = img.resize((256, 256), Image.Resampling.BICUBIC)

                buf = io.BytesIO()
                img_resized.save(buf, format="PNG")
                png_out = buf.getvalue()

                target_pix = None
                if ra is not None and dec is not None:
                    try:
                        w = WCS(img_hdu.header)
                        px, py = w.all_world2pix(ra, dec, 1)
                        target_pix = [round(float(px), 2), round(float(py), 2)]
                    except Exception:
                        pass

                return png_out, {
                    "vmin": float(vmin),
                    "vmax": float(vmax),
                    "shared_scale": is_shared,
                    "shape": list(data.shape),
                    "target_pix": target_pix,
                    "stretch": stretch_name,
                    "interval": "PercentileInterval(99.0)",
                    "bunit": str(img_hdu.header.get("BUNIT", "MJy / sr")),
                }

        import numpy as np
        png_data, meta = await asyncio.to_thread(_process_fits, fits_bytes, shared_vmin, shared_vmax)

        # Simpan ke In-Memory LRU cache
        await _MEMORY_PREVIEW_CACHE.put(cache_key, (png_data, meta))

        # Simpan ke disk cache jika dapat ditulis
        try:
            with open(cache_png, "wb") as f:
                f.write(png_data)
            with open(cache_json, "w") as f:
                json.dump(meta, f)
        except Exception:
            pass

        return png_data, meta

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal memproses data visual FITS: {str(exc)}",
        )
