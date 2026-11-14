# DECISIONS.md — Project decision log

Record decisions that affect more than one workstream. Newest decisions go first.

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
