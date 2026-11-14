# PHASE 1 IMPLEMENTATION REPORT
## Backend Security Hardening & NASA APOD Migration
### SPHEREx Cosmic Expedition — NASA Space Apps Challenge 2026

---

## 1. Root Causes Addressed

| # | Root Cause | Severity |
| :--- | :--- | :--- |
| 1 | NASA API key hardcoded as fallback string in `nasa_service.py` | Critical |
| 2 | Hardcoded key appeared verbatim in `docs/audit/backend-audit.md` | Critical |
| 3 | `backend/.gitignore` did not exclude `.env` files | High |
| 4 | APOD integration targeted the legacy `api.nasa.gov/planetary/apod` endpoint (retires Dec 1, 2026) | High |
| 5 | `normalize_apod()` mapped `url` to `image_url` — legacy API field semantics. WordPress API's `url` is the article permalink, not the image asset | High |
| 6 | APOD `explanation` and `credit` fields returned with embedded HTML from WordPress endpoint (not stripped) | Medium |
| 7 | `DUMMY_APOD` and `normalize_apod()` had divergent key sets (`message` missing from live responses) | Medium |
| 8 | No explicit 429 rate-limit handling for NeoWs | Low |

---

## 2. Security Changes

### 2.1 Hardcoded API Key Removed (`backend/services/nasa_service.py`)
- Removed the `os.getenv("NASA_API_KEY", "<hardcoded_key>")` fallback pattern entirely.
- NeoWs URL is now constructed by `_neows_url()` at request time via `os.environ.get("NASA_API_KEY")`.
- When `NASA_API_KEY` is absent, the function falls back to `DEMO_KEY` (NASA's publicly documented rate-limited demo key: 30 req/hr, 50 req/day) and logs a `WARNING` via Python's `logging` module.
- The key value is never logged, printed, or included in API responses.

### 2.2 Audit Report Redacted (`docs/audit/backend-audit.md`)
- Both occurrences of the compromised key string replaced with `<REDACTED_COMPROMISED_KEY>`.

### 2.3 `.env` Excluded from Git (`backend/.gitignore`)
- Added `.env`, `.env.*`, and `!.env.example` rules.
- Prevents accidental commit of local credential files.

---

## 3. APOD Migration Details

### 3.1 Endpoint Change
| Property | Before | After |
| :--- | :--- | :--- |
| URL | `https://api.nasa.gov/planetary/apod?api_key=...` | `https://science.nasa.gov/wp-json/wp/v2/apod-basic?per_page=1` |
| Auth | NASA API key required | No API key required |
| Response shape | Single JSON object | JSON array; first element is most recent |
| `url` field | Direct image asset URL | Article permalink (NOT image URL) |
| `hdurl` field | High-res image URL | High-res image URL (unchanged) |
| `explanation` | Plain text | HTML markup (stripped by `_strip_html()`) |
| `credit` | Absent | HTML markup (stripped by `_strip_html()`) |
| `alt` | Absent | Plain text image alt description |
| `permalink` | Absent | Same as `url` (article permalink) |

### 3.2 Response Contract Changes
The normalized response now includes two new fields while preserving backward compatibility:

| Field | Before | After | Notes |
| :--- | :--- | :--- | :--- |
| `status` | `"error"` only in DUMMY | `"ok"` or `"error"` | Frontend can reliably distinguish live vs fallback |
| `fallback` | `True` only in DUMMY | `False` (live) / `True` (fallback) | Explicit fallback flag |
| `message` | Only in DUMMY | `None` (live) / error string (fallback) | Parity maintained |
| `image_url` | `hdurl or url` (legacy) | `hdurl` only for image entries, `None` for video | Corrected semantics |
| `thumbnail_url` | `url` (legacy image URL) | `hdurl` for image, `None` for video | Corrected semantics |
| `article_url` | Absent | Article permalink | New field |
| `alt` | Absent | Alt text string or `None` | New field |
| `credit` | Absent | Plain-text attribution or `None` | New field |

---

## 4. Files Modified

| File | Change |
| :--- | :--- |
| `backend/services/nasa_service.py` | Removed hardcoded key; added `_neows_url()` builder; migrated APOD to WordPress endpoint; added 429 handling for NeoWs; added structured logging |
| `backend/utils/normalizers.py` | Added `_strip_html()`; updated `normalize_apod()` for WordPress schema; added `message`, `fallback`, `status`, `article_url`, `alt`, `credit` fields; maintained key parity with `DUMMY_APOD` |
| `backend/.gitignore` | Added `.env`, `.env.*`, `!.env.example` |
| `docs/audit/backend-audit.md` | Redacted both occurrences of the compromised API key |

---

## 5. API Compatibility Assessment

- **`/api/nasa/apod`**: Response gains `article_url`, `alt`, `credit`, `status`, `fallback`, `message`. Existing fields (`source`, `title`, `date`, `explanation`, `media_type`, `image_url`, `thumbnail_url`, `copyright`) preserved. `thumbnail_url` now correctly maps to `hdurl` instead of the legacy `url` (article permalink). Frontends that rendered `thumbnail_url` as an image src will continue to work correctly.
- **`/api/nasa/neows`**: No change to response structure. Added explicit 429 handling.
- **All other endpoints**: Unmodified.

---

## 6. Testing Commands Executed

```
python -m py_compile backend/services/nasa_service.py
python -m py_compile backend/utils/normalizers.py
python test_phase1.py   # (temp file, deleted after run)
```

---

## 7. Actual Test Results

```
Test 1 PASSED: DUMMY_APOD structure correct
Test 2 PASSED: normalize_apod image entry correct
Test 3 PASSED: normalize_apod video entry correct
Test 4 PASSED: normalize_apod missing fields handled gracefully
Test 5 PASSED: _strip_html correct
Test 6 PASSED: DUMMY_APOD and normalize_apod have identical key sets
Test 7 PASSED: normalize_neows regression correct
Test 8 PASSED: missing NASA_API_KEY falls back to DEMO_KEY
Test 9 PASSED: NASA_API_KEY env var correctly used in NeoWs URL

All 9 tests PASSED.
```

The logger warning on Test 8 (`NASA_API_KEY environment variable is not set...`) is correct and expected behavior.

---

## 8. Remaining Limitations

| Limitation | Notes |
| :--- | :--- |
| Live APOD endpoint not tested end-to-end | No backend server running locally; normalization tested against real live response schema fetched during audit |
| `astropy` not installed in test environment | `spherex_service.py` imports blocked; isolated via `importlib` for `nasa_service` tests |
| NeoWs 429 path not live-tested | Rate-limit path verified by code inspection only |
| `DEMO_KEY` rate limit applies without `NASA_API_KEY` | 30 req/hr — insufficient for production traffic |

---

## 9. Required Environment Variables for Deployment

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `NASA_API_KEY` | Required for production | Must be set in Vercel project settings or deployment environment. The previous key is **compromised and must be rotated**. |

---

## 10. Manual Actions Required from Repository Owner

1. **Rotate the NASA API key**: The key previously hardcoded in `nasa_service.py` has appeared in source code and audit reports. It must be invalidated at [https://api.nasa.gov/](https://api.nasa.gov/) and replaced with a new key.
2. **Configure `NASA_API_KEY` in deployment environment**: Set the new key as an environment variable in Vercel project settings (or equivalent) before deploying. Do not commit it to any file.
3. **Create a local `.env` file** (not committed) for local development:
   ```
   NASA_API_KEY=your_new_key_here
   ```
4. **Review frontend consumers of `/api/nasa/apod`**: The response now includes `article_url`, `alt`, `credit` and the `status`/`fallback` fields. Any frontend code that renders `image_url` or `thumbnail_url` will continue to work. Frontends that previously relied on `thumbnail_url` pointing to the legacy image URL are now correctly served `hdurl` instead.
