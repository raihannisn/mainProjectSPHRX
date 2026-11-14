# PHASE 2 IMPLEMENTATION REPORT
## Deployment & Routing Integration — Vercel Services
### SPHEREx Cosmic Expedition — NASA Space Apps Challenge 2026

---

## 1. Summary of Implementation

Phase 2 configured the monorepo for single-deployment Vercel Services with three isolated services (`web`, `api`, `xr`), sanitized frontend build output, XR path-prefix deployment (`/xr/`), and Service Worker scoping that excludes the main frontend and API from XR caching.

Key routing decisions (verified against the official Vercel Services documentation, fetched 2026-11-13):
- Top-level rewrites route requests to services; **services receive the original request path** (e.g., `/xr/body/mars` reaches the `xr` service as `/xr/body/mars`).
- Rewrite order matters: most specific rules (`/api/*`, `/mission-control`, `/docs`, `/openapi.json`, `/redoc`, `/xr*`) come before the frontend catch-all.
- `framework` is omitted for `api` and `web` (auto-detection); `xr` sets `framework: "vite"` explicitly to match the previous standalone config.
- Service-level rewrites handle routing **inside** a service: the XR service's own `/xr/(.*)` rewrite maps SPA deep links to `dist/index.html` while static assets resolve directly from `dist/`.

The frontend `index.html` problem was resolved by **renaming at build time**: `frontend/build.mjs` copies `spherex-expedition.html` → `dist/index.html`. This was chosen over a service-level rewrite from `/` because the HTML is fully self-contained (verified: zero external `src=`/`href=` asset references), making a single-file copy safe and avoiding rewrite path-resolution ambiguity.

---

## 2. Modified and Created Files

| File | Status | Purpose |
| :--- | :--- | :--- |
| `vercel.json` (root) | **Created** | Three-service definition (`web`/`api`/`xr`) + ordered top-level rewrites |
| `frontend/build.mjs` | **Created** | Production build: copies `spherex-expedition.html` → `dist/index.html`, excluding design docs and screenshots |
| `frontend/dist/` | **Generated** | Clean runtime-only output (contains only `index.html`) |
| `arvr/vite.config.ts` | **Modified** | Added `base: '/xr/'`; offline-manifest plugin now prefixes all asset URLs with `/xr/` |
| `arvr/vercel.json` | **Modified** | Service-level rewrite `/xr` + `/xr/(.*)` → `/index.html`; `Service-Worker-Allowed: /xr/` header; `/xr/`-scoped cache-control headers |
| `arvr/public/sw.js` | **Modified** | `isXrPath()` guard: fetch handler ignores everything outside `/xr/` (including `/api/*` and main frontend pages); caches `/xr/index.html` as navigation fallback; precache manifest fetched from `/xr/offline-manifest.json` |
| `arvr/src/xr/offline.ts` | **Modified** | `registerServiceWorker()` registers `/xr/sw.js` with `{ scope: '/xr/' }`; manifest fetched from `/xr/offline-manifest.json` |
| `arvr/scripts/smoke-xr.mjs` | **Modified** | Smoke test entry URL updated to `/xr/?emulate` (canonical base-path form) |
| `arvr/dist/` | **Regenerated** | All emitted asset URLs verified as `/xr/assets/...`; manifest paths fully `/xr/`-prefixed |

Not modified: backend (Phase 1 preserved), `frontend/spherex-expedition.html`, AR/VR application logic.

---

## 3. Test Results

### 3.1 Executed and Passed

| Test | Command | Result |
| :--- | :--- | :--- |
| Frontend production build | `node build.mjs` (frontend/) | **PASS** — `dist/index.html` created; no Markdown/screenshots in dist |
| AR/VR content check | `npm run check:content` (arvr/) | **PASS** — "check-content: 54 hotspots OK" |
| AR/VR TypeScript check | `tsc --noEmit` (via `npm run build`) | **PASS** — no type errors |
| AR/VR production build | `npm run build` (arvr/) | **PASS** — built in 28.73s |
| Built asset URLs | Inspected `dist/index.html` | **PASS** — `src="/xr/assets/index-Caw4Rlbw.js"`, `href="/xr/assets/index-BtAtaelb.css"`, `/xr/manifest.webmanifest`, `/xr/icons/icon-192.png` — **no `/xr/xr/` duplication** |
| Offline manifest paths | Inspected `dist/offline-manifest.json` | **PASS** — all 105 file URLs start with `/xr/` (0 un-prefixed paths found) |
| XR root `/xr/` | HTTP request to preview server | **PASS** — 200, serves built `index.html` (71 KB) |
| XR deep link `/xr/body/mars` | HTTP request | **PASS** — 200, returns SPA entry with correct `/xr/assets/` script URL |
| XR deep link `/xr/surface/victoria` | HTTP request | **PASS** — 200 |
| `/xr/sw.js` reachable | HTTP request | **PASS** — 200 (3,722 bytes) |
| `/xr/offline-manifest.json` reachable | HTTP request | **PASS** — 200 (4,266 bytes) |

### 3.2 Executed with Caveats

| Test | Result | Caveat |
| :--- | :--- | :--- |
| Playwright smoke test (`npm run smoke:xr`) | **FAIL** — both VR and AR report toast "Graphics lowered to medium to keep it smooth" | The smoke harness launches Microsoft Edge via `playwright-core` with software/ANGLE GL. The QualityGovernor legitimately steps quality down when FPS drops, and the smoke script treats *any* visible toast as failure. This is an **environment performance limitation** (no GPU-accelerated headless context on this machine), not a routing regression. The same behavior needs re-verification on real hardware. The script change from `/xr?emulate` → `/xr/?emulate` was required because the local vite preview does not apply `vercel.json` rewrites; Vercel will handle `/xr` via the top-level rewrite. |

### 3.3 Not Executable Locally

| Test | Reason |
| :--- | :--- |
| Top-level Vercel Services routing (`/api/*` → FastAPI, `/mission-control`, `/docs`, `/openapi.json`, `/redoc`) | Requires actual deployment; `vercel dev` multi-service emulation was not run (would require Vercel CLI login and project linkage — not permitted to authenticate on the owner's behalf) |
| Service Worker registration scope on deployed domain | Requires HTTPS deployment context |
| Offline navigation on deployed domain | Requires deployed SW + manifest |
| FastAPI endpoint responses through the deployment | Backend not running locally in this phase (Python deps like `astropy` not installed in this environment) |

### 3.4 Environment Note
`XR_HTTP=1` (plain HTTP preview) is required for the smoke test because `playwright-core` + self-signed certs fail TLS in this environment; the preview server was started via `cmd /c "set XR_HTTP=1&& npx vite preview --port 4173 --strictPort"`.

---

## 4. Remaining Blockers

1. **Deployment validation is the primary blocker** — the three-service routing behavior (including FastAPI docs routes and API proxying) can only be confirmed on a real Vercel deployment by the repository owner.
2. **Smoke test environment limitation** — the local software-GL context triggers legitimate quality-governor toasts. Re-run `npm run smoke:xr` on a GPU-capable machine or accept the "Graphics lowered" toast as a non-fatal warning before deploy. (The owner should decide whether to relax the smoke script's toast criterion.)
3. **`/xr` without trailing slash** — handled in production by the XR service rewrite `/xr` → `/index.html`, but not verifiable on the local vite preview server (which does not read `vercel.json`).
4. **`backend/vercel.json`** still exists with a standalone catch-all service config. It is **unused** when the root `vercel.json` is deployed (root config takes precedence), but should be deleted or updated by the owner before the first Services deployment to avoid confusion. Not removed in this phase to avoid touching unrelated configuration without owner sign-off.
5. **Owner actions required for first deploy**:
   - Link the repo root to a Vercel project (Services requires a single project at repo root).
   - Set `NASA_API_KEY` in project environment variables (Phase 1 requirement).
   - Run `npx --yes vercel@latest deploy --prod --yes` per the existing HANDOFF deployment procedure.
   - Execute the deployment validation checklist from `docs/INTEGRATION_ARCHITECTURE.md` §12.

---

**Phase 2 complete. Stopping here per instructions.**
