from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from astropy.io import fits
import httpx
import json
import os

app = FastAPI(
    title="SPHEREx Cosmic Explorer API",
    description="Backend engine untuk NASA Space Apps Challenge - Planet X & SPHEREx",
    version="1.1.0"
)

# --- CORS (Biar Vercel & WebXR bisa akses) ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- KONFIGURASI FILE & API KEYS ---
FITS_FILE_1 = "level2_2025W36_2B_0696_1D1_spx_l2b-v20-2025-271-cutout.fits"
IMAGE_1 = "hasil_gambar.png"
IMAGE_2 = "hasil_gambar_2.png"
JSON_KAMUS = "kamus_object.json" 

NASA_API_KEY = os.getenv("NASA_API_KEY", "LJTHndTBTkjWpBkFbRQpzWTFPhBKFpnnh8zDtBcD")
NASA_APOD_URL = f"https://api.nasa.gov/planetary/apod?api_key={NASA_API_KEY}"
NASA_NEOWS_URL = f"https://api.nasa.gov/neo/rest/v1/feed?api_key={NASA_API_KEY}"


# --- HELPER NORMALISASI DATA NASA ---
def normalize_apod(data: dict) -> dict:
    """Mengubah payload NASA APOD menjadi format JSON yang simpel dan konsisten."""
    return {
        "source": "NASA Astronomy Picture of the Day (APOD)",
        "title": data.get("title"),
        "date": data.get("date"),
        "explanation": data.get("explanation"),
        "media_type": data.get("media_type", "image"),
        "image_url": data.get("hdurl") or data.get("url"),
        "thumbnail_url": data.get("url"),
        "copyright": data.get("copyright", "Public Domain")
    }

def safe_float(val, round_digits=2):
    """Helper untuk parsing float yang aman dengan pembulatan."""
    if val is None:
        return None
    try:
        return round(float(val), round_digits)
    except (ValueError, TypeError):
        return None

def normalize_neows(data: dict) -> dict:
    """Mengubah format kompleks NASA NeoWs menjadi array asteroid yang bersih dan terurut."""
    near_earth_objects = data.get("near_earth_objects", {})
    total_count = data.get("element_count", 0)
    asteroids = []
    hazardous_count = 0

    for date_str, items in near_earth_objects.items():
        for item in items:
            is_hazardous = bool(item.get("is_potentially_hazardous_asteroid", False))
            if is_hazardous:
                hazardous_count += 1

            close_list = item.get("close_approach_data", [])
            close_data = close_list[0] if close_list else {}
            vel = close_data.get("relative_velocity", {})
            dist = close_data.get("miss_distance", {})
            est_diam = item.get("estimated_diameter", {})
            meters = est_diam.get("meters", {})
            km = est_diam.get("kilometers", {})

            asteroids.append({
                "id": item.get("id"),
                "name": item.get("name", "").strip("()"),
                "is_potentially_hazardous": is_hazardous,
                "absolute_magnitude_h": item.get("absolute_magnitude_h"),
                "close_approach_date": close_data.get("close_approach_date", date_str),
                "close_approach_date_full": close_data.get("close_approach_date_full"),
                "orbiting_body": close_data.get("orbiting_body", "Earth"),
                "estimated_diameter": {
                    "min_meters": safe_float(meters.get("estimated_diameter_min")),
                    "max_meters": safe_float(meters.get("estimated_diameter_max")),
                    "min_km": safe_float(km.get("estimated_diameter_min"), 4),
                    "max_km": safe_float(km.get("estimated_diameter_max"), 4),
                },
                "relative_velocity": {
                    "km_per_second": safe_float(vel.get("kilometers_per_second")),
                    "km_per_hour": safe_float(vel.get("kilometers_per_hour")),
                },
                "miss_distance": {
                    "kilometers": safe_float(dist.get("kilometers")),
                    "lunar": safe_float(dist.get("lunar")),
                    "astronomical": safe_float(dist.get("astronomical"), 6),
                },
                "nasa_jpl_url": item.get("nasa_jpl_url")
            })

    # Urutkan asteroid berdasarkan tanggal pendekatan terdekat
    asteroids.sort(key=lambda x: x.get("close_approach_date") or "")

    return {
        "source": "NASA Near Earth Object Web Service (NeoWs)",
        "total_asteroids": total_count,
        "hazardous_asteroids_count": hazardous_count,
        "asteroids": asteroids
    }


# 1. ENDPOINT GAMBAR (Dengan Cache biar cepat)
@app.get("/api/image/t1", tags=["Images"])
def get_image_t1():
    if not os.path.exists(IMAGE_1):
        raise HTTPException(status_code=404, detail="Gambar 1 belum di-generate")
    return FileResponse(IMAGE_1, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})

@app.get("/api/image/t2", tags=["Images"])
def get_image_t2():
    if not os.path.exists(IMAGE_2):
        raise HTTPException(status_code=404, detail="Gambar 2 belum di-generate")
    return FileResponse(IMAGE_2, media_type="image/png", headers={"Cache-Control": "public, max-age=3600"})

# 2. ENDPOINT METADATA ASLI DARI FILE FITS
@app.get("/api/metadata/fits", tags=["Metadata"])
def get_fits_metadata():
    if not os.path.exists(FITS_FILE_1):
        raise HTTPException(status_code=404, detail="File FITS asli tidak ditemukan di server")
    
    try:
        hdul = fits.open(FITS_FILE_1)
        header = hdul[0].header
        
        metadata = {
            "telescope": header.get("TELESCOP", "SPHEREx"),
            "observation_date": header.get("DATE-OBS", "Unknown"),
            "right_ascension": header.get("RA", "Unknown"),
            "declination": header.get("DEC", "Unknown"),
            "data_source": "NASA IRSA Caltech (.fits format)",
            "status": "Validated from raw file"
        }
        hdul.close()
        return metadata
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 3. ENDPOINT KAMUS OBJEK
@app.get("/api/objects/{object_id}", tags=["Objects"])
def get_object_info(object_id: str):
    if not os.path.exists(JSON_KAMUS):
        raise HTTPException(status_code=404, detail=f"File database '{JSON_KAMUS}' tidak ditemukan di folder")
        
    try:
        with open(JSON_KAMUS, "r") as file:
            data = json.load(file)
            if object_id.lower() in data:
                return data[object_id.lower()]
            raise HTTPException(status_code=404, detail=f"Objek '{object_id}' tidak ada di database")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- DATA DUMMY / FALLBACK JIKA SERVER NASA DOWN ---
DUMMY_APOD = {
    "status": "error",
    "message": "NASA APOD sedang tidak tersedia, silakan coba lagi nanti",
    "source": "NASA Astronomy Picture of the Day (APOD)",
    "title": "NASA APOD Unavailable",
    "date": None,
    "explanation": "NASA APOD sedang tidak tersedia, silakan coba lagi nanti",
    "media_type": "image",
    "image_url": None,
    "thumbnail_url": None,
    "copyright": "NASA"
}

# 4. ENDPOINT INTEGRASI NASA OPEN APIS
@app.get("/api/nasa/apod", tags=["NASA"])
async def get_nasa_apod():
    """Mengambil Astronomy Picture of the Day (APOD) dari NASA API.
    Jika API NASA down (Error 500, timeout, dll), mengembalikan JSON statis/dummy.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(NASA_APOD_URL)
            if response.status_code == 200:
                raw_data = response.json()
                return normalize_apod(raw_data)
            # Tangani jika NASA mengembalikan status error seperti 500, 502, 503, dll.
            return DUMMY_APOD
    except Exception:
        # Tangani jika gagal koneksi, DNS error, timeout, dsb.
        return DUMMY_APOD

@app.get("/api/nasa/neows", tags=["NASA"])
async def get_nasa_neows():
    """Mengambil data Near Earth Objects (Asteroid Feed) dari NASA NeoWs API dengan data ternormalisasi."""
    try:
        async with httpx.AsyncClient(timeout=25.0) as client:
            response = await client.get(NASA_NEOWS_URL)
            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=f"NASA NeoWs error: {response.text}"
                )
            raw_data = response.json()
            return normalize_neows(raw_data)
    except httpx.RequestError as exc:
        raise HTTPException(status_code=502, detail=f"Gagal menghubungi server NASA NeoWs: {str(exc)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. ENDPOINT STATUS & SISTEM
@app.get("/", tags=["System"])
def root():
    return {"message": "Welcome to SPHEREx Cosmic Explorer API. Go to /docs for documentation."}

@app.get("/api/status", tags=["System"])
def get_status():
    return {
        "status": "Online",
        "data_source": "NASA IRSA SPHEREx Archive & NASA Open APIs",
        "engine": "Python Astropy + FastAPI + HTTPX",
        "capabilities": [
            "FITS Parsing",
            "Image Serving",
            "JSON Database",
            "NASA APOD Integration",
            "NASA NeoWs Asteroid Tracker"
        ],
        "message": "Backend siap melayani FE, AI, dan AR!"
    }
