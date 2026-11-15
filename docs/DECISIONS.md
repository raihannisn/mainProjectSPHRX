# DECISIONS.md — Project decision log

Record decisions that affect more than one workstream. Newest decisions go first.

## 2026-11-15 — Inline 3D body models in the Sky Explorer viewport (proposed, PR review)

- **Decision:** The Sky Explorer viewport gets a compact model switch (Sky · Mars · Moon · Bennu, URL `?model=`). Body modes render the XR module's `BodyExplorer` + `Hotspots` in a separate `<Canvas>` (no WebXR session on 2D pages). One toolbar toggle shows/hides hotspots (shared `settings.pins`); a VR/AR toggle, shown only when WebXR is supported, opens `/xr/body/<id>?intent=vr|ar`, and `ModePicker` now honours `intent` on every scene, not only the hub. Default stays `Sky`.
- **Reason:** Team request to show the AR/VR 3D models in the observation view without changing the tuned 2D layout; reusing the existing XR components avoids a second copy of the 3D code or assets.
- **Alternatives considered:** Embedding the full `XRRoot` inline (brings its own HUD, intro and session handling; too heavy for a viewport); replacing the Comparison FITS previews with 3D (rejected: a 2D astronomical image must not be presented as a 3D volume).
- **Impact:** 2D→XR handoff gains `?intent=` on body routes. No API, routing table, deployment or dependency changes. Details and test evidence: `docs/OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md`.
- **Owner:** Adnaan (approval via PR review)

## Integration phase — Single React application shell

- **Decision:** Use the `arvr/` React/Vite app as the single client-side application host for Gateway, Explorer, Comparison, Cosmic Guide, and the existing XR routes. Keep FastAPI on `/api/*`; preserve the XR app's `/xr/` asset base and service-worker scope.
- **Reason:** A single `BrowserRouter` enables direct links and carries available target/observation context between 2D and XR screens without an iframe or separate frontend deployment.
- **Alternatives considered:** Keep the vanilla frontend on `/` and link to a second React app under `/xr`; this keeps two independent navigation systems and complicates state handoff.
- **Impact:** Root Vercel rewrites route app paths to the `xr` service, while API and documentation paths continue to route to FastAPI. Vite development proxies `/api/*` to local FastAPI on port 8000.

## 2026-11-09 — Initial project baseline

- **Decision:** Treat the IRSA SPHEREx archive as the primary source for SPHEREx images. NASA APOD and NeoWs remain optional supporting modules only.
- **Reason:** The challenge is about SPHEREx observations by position and time; IRSA documents the SPHEREx SIA2 archive interface and QR2/QR3 collections.
- **Impact:** Backend/API agents must verify that image endpoints resolve to IRSA SPHEREx products and preserve provenance.

## 2026-11-09 — Backend OpenAPI is provisional for frontend integration

- **Decision:** Do not infer successful response fields from the supplied OpenAPI because success schemas are `{}`.
- **Reason:** The route names alone do not establish the payload shape or image provenance.
- **Impact:** Capture example payloads and update `API_CONTRACT.md` before component-level integration.

## 2026-11-09 — Coordinate search is a capability gap until proven otherwise

- **Decision:** Treat arbitrary RA/Dec + FOV + time-range search as unverified.
- **Reason:** The supplied OpenAPI only documents fixed T1/T2 endpoints and no query parameters for coordinates, radius, date, release, or detector/band.
- **Impact:** Verify backend behavior; if absent, add a backend coordinate-search route or document a deliberately limited fixed-target MVP.

## 2026-11-09 — XR is a linked presentation layer

- **Decision:** XR must receive the same observation/target context as the 2D explorer.
- **Reason:** A separate static 3D scene would not demonstrate the core SPHEREx temporal-comparison workflow.
- **Impact:** XR integration depends on a stable observation ID/state handoff and must have a 2D fallback.

## Template for future decisions

```md
## YYYY-MM-DD — Decision title
- **Decision:**
- **Reason:**
- **Alternatives considered:**
- **Impact:**
- **Owner:**
```
