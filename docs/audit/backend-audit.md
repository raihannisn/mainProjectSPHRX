# BACKEND AUDIT REPORT — SPHEREx Cosmic Explorer API

## 1. Backend Architecture

The backend is built using **FastAPI** (Python async web framework) structured in a modular architectural pattern:
- **`main.py`**: Application entrypoint configuring FastAPI app metadata, CORS middleware (`allow_origins=["*"]`), root redirection (`/` -> `/mission-control`), and dynamic `sys.path` resolution for package imports.
- **`routes/`**: Modular API routers (`APIRouter`) separated by domain:
  - `system.py`: `/mission-control` dashboard and `/api/status` telemetry.
  - `spherex.py`: `/api/spherex/observations` for IRSA SIA2/TAP spatial queries.
  - `nasa.py`: `/api/nasa/apod` and `/api/nasa/neows` for NASA Open APIs.
  - `images.py`: `/api/image/t1` and `/api/image/t2` for serving FITS-derived cutout image streams.
  - `objects.py`: `/api/objects/{object_id}` for celestial target metadata lookup.
- **`services/`**: External integration and business logic handlers:
  - `spherex_service.py`: Handles Astroquery/HTTP SIA queries to NASA IPAC IRSA, CSV parsing, coordinate validations, and cutout URL reconstruction.
  - `nasa_service.py`: Handles asynchronous fetching for NASA APOD and NeoWs endpoints with fallback error handling.
- **`utils/`**: Data normalization and sanitization helpers (`normalizers.py`).
- **`templates/`**: HTML/CSS SaaS dashboard template (`mission_control.html`).

---

## 2. Existing API Endpoints

| Method | Endpoint | Description | Response Type |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Root redirect to `/mission-control` | HTTP Redirect (307) |
| `GET` | `/mission-control` | Interactive SaaS API docs & dashboard | HTML (`HTMLResponse`) |
| `GET` | `/api/status` | Backend readiness, active engines, IRSA status | JSON |
| `GET` | `/api/spherex/observations` | Dynamic SPHEREx sky observation query (IRSA SIA2) | JSON |
| `GET` | `/api/image/t1` | Infrared cutout image 1 (Time 1) | PNG File (`FileResponse`) |
| `GET` | `/api/image/t2` | Infrared cutout image 2 (Time 2) | PNG File (`FileResponse`) |
| `GET` | `/api/metadata/fits` | FITS header validation & metadata | JSON / File |
| `GET` | `/api/objects/{object_id}` | Celestial body / target metadata lookup | JSON |
| `GET` | `/api/nasa/apod` | NASA Astronomy Picture of the Day | JSON |
| `GET` | `/api/nasa/neows` | NASA Near-Earth Objects asteroid feed | JSON |

---

## 3. Request and Response Structures

### `/api/spherex/observations`
- **Query Parameters:**
  - `ra` (float, required): Right Ascension in degrees (`0.0` - `360.0`).
  - `dec` (float, required): Declination in degrees (`-90.0` - `90.0`).
  - `radius` (float, optional, default: `0.05`): Search radius in degrees (max `10.0`).
  - `collection` (str, optional, default: `'spherex_qr3'`): IRSA data release collection.
  - `start_date` (str, optional): Start date filter (`YYYY-MM-DD`).
  - `end_date` (str, optional): End date filter (`YYYY-MM-DD`).
  - `detector` (str, optional): Spectrometer detector filter (`D1` - `D6`).
- **Response Structure:**
  ```json
  {
    "query": { "ra": 85.0556, "dec": -5.6568, "radius": 0.05, "collection": "spherex_qr3", ... },
    "source": "IRSA",
    "total_results": 2,
    "observations": [
      {
        "observation_id": "PIA26354",
        "observed_at_utc": "2025-07-02T14:22:10Z",
        "detector": "D1",
        "preview_url": "https://irsa.ipac.caltech.edu/ibe/cutout?...",
        "fits_url": "https://irsa.ipac.caltech.edu/data/..."
      }
    ]
  }
  ```

### `/api/objects/{object_id}`
- **Response Structure:** Returns key-value properties from `kamus_object.json` corresponding to target IDs (e.g., `mars`, `halley`, `jupiter`, `rcw-36`).

---

## 4. NASA and SPHEREx Integrations

- **NASA IPAC IRSA (IVOA SIA2 / TAP):**
  - Implemented in `services/spherex_service.py`.
  - Attempts primary query using `astroquery.ipac.irsa.Irsa.query_sia`.
  - Includes robust HTTP fallback (`httpx`/`requests`) querying `https://irsa.ipac.caltech.edu/SIA` with CSV response parsing (`csv.DictReader`).
- **NASA Open APIs (APOD & NeoWs):**
  - Implemented in `services/nasa_service.py`.
  - Fetches from `https://api.nasa.gov/planetary/apod` and `https://api.nasa.gov/neo/rest/v1/feed`.
  - Features graceful degradation: if NASA APIs timeout or return non-200 status codes, the service falls back to static/dummy normalized data (`DUMMY_APOD`).

---

## 5. Environment Variables & Configuration

- **API Key Hardcoding Fallback:**
  - `nasa_service.py` defines: `NASA_API_KEY = os.getenv("NASA_API_KEY", "<REDACTED_COMPROMISED_KEY>")`.
  - While environment variable injection via `os.getenv` is supported, a hardcoded fallback API key was present in source code. This key is compromised and must be rotated by the repository owner.
- **Serverless / Deployment Configuration (`vercel.json`):**
  - Configures ASGI serverless routing targeting `main:app`.
- **Dependencies (`requirements.txt`):**
  - `fastapi`, `uvicorn`, `astropy`, `matplotlib`, `numpy`, `astroquery`, `httpx`, `requests`.

---

## 6. Error Handling

- **FastAPI HTTPExceptions:** Explicit status codes (400, 404, 502, 504) returned for validation failures, missing files (`kamus_object.json`, cutout images), upstream NASA IRSA timeouts, and parsing errors.
- **Async Execution Wrappers:** Blocking Astroquery and network calls are wrapped in `asyncio.to_thread` and guarded with `asyncio.wait_for` timeouts (25s–30s) to prevent event loop starvation.
- **Graceful Degradation:** External API failures in NASA APOD automatically fallback to cached/static structures rather than crashing client requests.

---

## 7. Security Concerns

1. **Hardcoded API Key Fallback:** A default NASA API key string (`<REDACTED_COMPROMISED_KEY>`) was hardcoded directly into `services/nasa_service.py`. This key is compromised and must be rotated.
2. **Permissive CORS Policy:** `allow_origins=["*"]` allows cross-origin requests from any client domain, which is permissive for production deployment but necessary for multi-origin WebXR/frontend clients.
3. **Local File Dependency Checks:** Endpoints serving local files (`hasil_gambar.png`, `kamus_object.json`) rely on relative paths resolved via `Path(__file__)`, which are safe against traversal but require correct file existence checks.

---

## 8. Frontend Integration Readiness

- **CORS Enabled:** Fully prepared to accept asynchronous `fetch()` requests from frontend SPA and WebXR clients running on different ports/domains.
- **JSON Contracts:** Consistent JSON schemas returned across observations, metadata, and object databases.
- **Image Caching Headers:** `/api/image/t1` and `/api/image/t2` include `Cache-Control: public, max-age=3600` headers for optimized static asset delivery.
