# API_CONTRACT.md — SPHEREx Cosmic Explorer

> Status: **provisional**. Current route descriptions are transcribed from the OpenAPI 3.1.0 / version 1.1.0 specification supplied by the project owner on 2026-11-09. Successful response schemas were empty (`{}`), so no response field names are confirmed yet.

## 1. Base URL

```text
https://nasa-spherex-backend.vercel.app
```

Swagger UI:

```text
https://nasa-spherex-backend.vercel.app/docs
```

## 2. Existing routes from supplied OpenAPI

| Method | Path | Parameters | Description | Contract status |
|---|---|---|---|---|
| GET | `/api/image/t1` | none documented | Get Image T1 | Unknown response shape; source/time/coordinates unconfirmed |
| GET | `/api/image/t2` | none documented | Get Image T2 | Unknown response shape; source/time/coordinates unconfirmed |
| GET | `/api/metadata/fits` | none documented | Get FITS Metadata | Unknown fields and source FITS file |
| GET | `/api/objects/{object_id}` | required string path parameter `object_id` | Get Object Info | Object catalog/source and returned fields unconfirmed |
| GET | `/api/nasa/apod` | none documented | NASA APOD | Description says static/dummy JSON may be returned when NASA API fails |
| GET | `/api/nasa/neows` | none documented | NASA NeoWs normalized feed | Not SPHEREx image data |
| GET | `/api/status` | none documented | Service status | Unknown response shape |
| GET | `/` | none documented | Root | System route |
| GET | `/mission-control` | none documented | Mission Control & API Test Bench HTML page | Not a JSON data contract |

## 3. What frontend can safely assume today

Only the method, path, and short description above are documented by the provided schema. The frontend cannot safely assume:

- whether an image route returns a URL, base64, binary, or JSON object;
- whether the image is an actual SPHEREx FITS-derived preview;
- whether T1 and T2 refer to chronological epochs;
- whether both images cover the same RA/Dec region;
- which data release, detector, wavelength, observation timestamp, or product ID is used;
- whether metadata are parsed from the same FITS product;
- which catalog backs object lookup;
- whether APOD fallback responses expose a source/status marker.

Do not implement direct property access such as `data.image_url` until an example payload confirms that exact property.

## 4. Contract verification checklist

The API integration agent/backend owner must capture one successful and one failure sample for each relevant route. Remove secrets and huge payloads before committing examples.

### `/api/image/t1` and `/api/image/t2`

Record:
- HTTP status and content type;
- JSON shape or binary image format;
- actual source file/product ID;
- SPHEREx release (QR2/QR3);
- observation ID;
- UTC observation midpoint/time;
- RA/Dec center and footprint/FOV;
- detector/band and wavelength range;
- preview pixel dimensions;
- whether the two observations cover the same region;
- whether WCS alignment has been performed.

### `/api/metadata/fits`

Record:
- which FITS product is being described;
- which headers and extensions are parsed;
- units and coordinate reference system;
- whether flags and variance are represented;
- missing/null behavior.

### `/api/objects/{object_id}`

Record:
- catalog/source name and URL;
- object identifier semantics;
- reference coordinate and reference epoch;
- proper motion/uncertainty if provided;
- whether values are catalog values, predicted values, or values measured in SPHEREx images.

### `/api/nasa/apod` and `/api/nasa/neows`

Record live vs fallback behavior. Do not let APOD or NeoWs data masquerade as a SPHEREx observation. If APOD dummy data are returned, surface that fact in UI or do not show it in a live-data component.

## 5. Required capability assessment

The challenge requires coordinate-driven search and an ordered series of observations. The supplied OpenAPI currently shows no query parameters for RA, Dec, radius, time range, release, or detector/band. Confirm whether this is implemented outside the public schema. If not, the backend needs a coordinate search route or equivalent.

IRSA's primary archive interface is SIA2:

```text
https://irsa.ipac.caltech.edu/SIA?
```

Relevant collections:

- `spherex_qr3`
- `spherex_qr3_deep`
- `spherex_qr2`
- `spherex_qr2_deep`

A normalized search endpoint is recommended:

```http
GET /api/spherex/observations?ra=...&dec=...&radius=...&collection=...&start_date=...&end_date=...&detector=...
```

Suggested response shape (proposal only):

```json
{
  "query": {
    "ra": 133.79513,
    "dec": -7.24515,
    "radius": 0.05,
    "collection": "spherex_qr3"
  },
  "source": "IRSA SIA2",
  "retrieved_at": "2026-11-09T00:00:00Z",
  "observations": [
    {
      "observation_id": "...",
      "product_id": "...",
      "observed_at_utc": "...",
      "mjd": 0,
      "data_release": "QR3",
      "detector": "D1",
      "wavelength_min_um": 0.75,
      "wavelength_max_um": 1.09,
      "preview_url": "https://...",
      "fits_url": "https://...",
      "center_ra_deg": 0,
      "center_dec_deg": 0,
      "flags_available": true,
      "source_archive": "IRSA"
    }
  ]
}
```

The sample values are placeholders, not real observation records.

## 6. Frontend integration rules

- Keep HTTP calls in one API service/module.
- Parse/validate at the API boundary and map to a frontend-owned `SpherexObservation` model.
- Components should not know raw IRSA SIA2/VOTable/FITS field names.
- Handle empty arrays as a normal no-results state.
- Handle upstream timeouts and partial records.
- Preserve timestamps in UTC internally; localize only for display and always identify the timezone.
- Never expose private API keys in browser code.
- Prefer backend-served preview/cutout URLs rather than downloading full MEF FITS into the browser.

## 7. Comparison requirements

Side-by-side and blink can be implemented when the app has at least two previews for the same field and useful metadata.

Difference/addition/stacking requires more:
- compatible sky footprints;
- WCS registration/alignment;
- compatible or deliberately normalized detector/band/wavelength;
- handling of flags, masks, uncertainty, and background;
- a documented processing method.

If those conditions are not met, hide or label the advanced comparison mode as unavailable. Do not subtract arbitrary images and call the result a scientific detection.

## 8. Provenance model

Every image visible in the application should be traceable to:

- archive/provider;
- collection/release;
- observation ID/product ID;
- observation time in UTC;
- detector/band/wavelength, when available;
- preview generation timestamp or processing version, when available.

## 9. Contract change log

| Date | Change | Evidence | Owner |
|---|---|---|---|
| 2026-11-09 | Initial provisional contract from supplied OpenAPI | Project owner-provided OpenAPI 3.1.0, API v1.1.0 | Project owner |
