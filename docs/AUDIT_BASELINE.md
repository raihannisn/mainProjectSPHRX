# SPHEREx Cosmic Explorer — Audit Baseline

> **Date:** 2026-11-09  
> **Status:** Baseline recorded from read-only audit  
> **Source Evidence:** [`audit-report.md`](file:///C:/Users/ahmad/.gemini/antigravity/brain/8d186933-1bc0-4215-99a4-d43c88435a18/audit-report.md)

---

## 1. Classification Methodology

Evidence is classified according to the following standards:
- **VERIFIED:** Directly confirmed by inspection of existing repository source files, configurations, or disk items.
- **UNKNOWN:** Cannot be determined from the assets and code present in this repository.
- **ASSUMPTION:** A plausible deduction requiring further validation.
- **MISSING:** Expected file, directory, test, or capability that does not exist in this repository.

---

## 2. Existing Repository State & Status

### 2.1 Git Status & Architecture
- **Git Branch:** `chore/repo-baseline-and-security` (created from `main`) — [VERIFIED]
- **Tracking Status:** Upstream remote is `origin/main`. Core documentation (`AGENTS.md`, `PLAN.md`, `API_CONTRACT.md`, `docs/`, `.agents/`) was previously untracked in git history — [VERIFIED]
- **Repository Structure:** Single-project structure containing only `backend/` and untracked root docs — [VERIFIED]

### 2.2 Frontend Implementation Status
- **Status:** [MISSING]
- **Evidence:** No JavaScript, TypeScript, HTML app project, `package.json`, or frontend framework files exist in the repository. The only HTML file present is a backend template at [`backend/templates/mission_control.html`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/templates/mission_control.html).

### 2.3 Backend Implementation Status
- **Status:** [VERIFIED]
- **Framework & Dependencies:** Python, FastAPI, Uvicorn, Astropy, Astroquery, Matplotlib, NumPy, HTTPX, Requests (configured in [`backend/requirements.txt`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/requirements.txt)) — [VERIFIED]
- **Application Entry Point:** [`backend/main.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/main.py) registers routers for `images`, `metadata`, `objects`, `nasa`, and `system` with permissive CORS (`allow_origins=["*"]`) — [VERIFIED]
- **Deployment Config:** [`backend/vercel.json`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/vercel.json) routes traffic to `main.py` — [VERIFIED]

### 2.4 Existing API Endpoints
All endpoints inspected in [`backend/routes/`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes):

| Route | Source File | Existing Behavior | Status |
|---|---|---|---|
| `GET /` | [`routes/system.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/system.py) | Returns introductory JSON payload | VERIFIED |
| `GET /api/status` | [`routes/system.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/system.py) | Returns static service health JSON | VERIFIED |
| `GET /mission-control` | [`routes/system.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/system.py) | Serves HTML file `mission_control.html` | VERIFIED |
| `GET /api/image/t1` | [`routes/images.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/images.py) | Serves static file `backend/hasil_gambar.png` (66,541 bytes) | VERIFIED |
| `GET /api/image/t2` | [`routes/images.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/images.py) | Serves static file `backend/hasil_gambar_2.png` (66,541 bytes) | VERIFIED |
| `GET /api/metadata/fits` | [`routes/metadata.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/metadata.py) | Extracts `TELESCOP`, `DATE-OBS`, `RA`, `DEC` from `level2_2025W36_...cutout.fits` | VERIFIED |
| `GET /api/objects/{object_id}` | [`routes/objects.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/objects.py) | Reads [`backend/kamus_object.json`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/kamus_object.json) (only `mars`, `halley`, `jupiter`) | VERIFIED |
| `GET /api/nasa/apod` | [`routes/nasa.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/nasa.py) | Fetches APOD via [`services/nasa_service.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/services/nasa_service.py) with static fallback | VERIFIED |
| `GET /api/nasa/neows` | [`routes/nasa.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/routes/nasa.py) | Fetches NEO feed via [`services/nasa_service.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/services/nasa_service.py) | VERIFIED |

### 2.5 XR / AR / VR Status
- **Status:** [MISSING] in this repository.
- **Evidence:** Prototype URL exists (`https://nasa-arvr.vercel.app/xr`), but no WebXR, Three.js, A-Frame, or model rendering source code is present in this workspace — [VERIFIED]
- **Handoff Contract & Implementation:** [UNKNOWN]

### 2.6 Data Provenance & Scientific Integrity
- **FITS Data Product:** [`backend/level2_2025W36_2B_0696_1D1_spx_l2b-v20-2025-271-cutout.fits`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/level2_2025W36_2B_0696_1D1_spx_l2b-v20-2025-271-cutout.fits) (5,060,160 bytes) is a valid SPHEREx Level 2 product (QR3) — [VERIFIED]
- **Target Coordinates in Data:** Header coordinates RA ≈ 85.06°, Dec ≈ -5.66° do not match any of the five official challenge targets (e.g. WISE 0855-0714, Barnard's Star) — [VERIFIED]
- **Second Epoch Image (T2):** `hasil_gambar_2.png` has the identical byte size (66,541 bytes) to `hasil_gambar.png`. It is likely a duplicate copy rather than a distinct temporal epoch — [ASSUMPTION]
- **`hasil_gambar_2_cutout.fits`:** Was present on disk with 0 bytes (corrupt/incomplete download) before cleanup — [VERIFIED]
- **Coordinate-Driven Archive Search Endpoint:** [MISSING] (`tarik_data.py` contains standalone script queries using `astroquery.ipac.irsa.Irsa.query_sia`, but no API route exposes this capability).

### 2.7 Testing & Build Verification
- **Unit & Integration Tests:** [MISSING] No test suite (`pytest`, `unittest`, etc.) configured.
- **Dependency Pinning:** Dependencies in `requirements.txt` lack pinned version specifications — [VERIFIED]

---

## 3. Discovered Technical Risks & Gaps

1. **Security Vulnerability:** A NASA API key was committed in [`backend/services/nasa_service.py`](file:///c:/Users/ahmad/OneDrive/Documents/SphereX/mainProjectSPHRX/backend/services/nasa_service.py) as an in-code fallback — [VERIFIED]
2. **Missing Search Parameterization:** No current backend route accepts `ra`, `dec`, `radius`, `collection`, `start_date`, or `end_date` — [VERIFIED]
3. **Target Catalog Incomplete:** Challenge targets (Barnard's Star, WISE 0855-0714, Epsilon Indi B, RW Aurigae, R Draconis) are absent from `kamus_object.json` — [VERIFIED]
4. **Metadata Breadth:** `/api/metadata/fits` only exposes 4 header fields; wavelength, detector band, quality flags, and variance are omitted — [VERIFIED]

---

## 4. Distinct Proposed Improvements (Pending Implementation)

The following items are proposed future additions, separated from verified existing code:

- **Proposal A (Backend):** Implement `GET /api/spherex/observations` wrapping `Irsa.query_sia` to provide coordinate-driven observation discovery.
- **Proposal B (Backend):** Update `/api/metadata/fits` to return detector band (D1–D6), wavelength range, MJD, and release identifiers.
- **Proposal C (Data):** Fetch two authentic, chronologically distinct observation epochs covering a recognized challenge target (e.g. WISE 0855-0714).
- **Proposal D (Frontend):** Scaffold a dedicated 2D web client supporting coordinate entry, timeline navigation, side-by-side inspection, and blink comparison.
- **Proposal E (XR):** Establish a documented state-handoff interface between the 2D viewer and the XR prototype.
