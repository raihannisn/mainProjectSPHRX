# Unified experience: one app, one look (plan and report)

> Branch: `feat/unified-experience` (from `feat/3d-observation`) · Date: 2026-11-15
> Status: **phases 1–3 implemented locally, waiting for owner review.** Not pushed, no PR.
> Follows `docs/WORKFLOW.md` (Phase A → D). Earlier step: [`OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md`](OBSERVATION_3D_MODEL_INTEGRATION_PLAN.md).

## 1. Context

The repository already runs as one React app (`arvr/`), but it looked like two products glued together:

| | 2D screens (`arvr/src/frontend/`) | 3D / AR / VR scenes (`arvr/src/xr/`) |
|---|---|---|
| Brand | SPHEREx / Cosmic Expedition | "AR Cosmic Expedition", own title card |
| Type | Poppins + mono labels | Roboto |
| Colour | glass panels, gold action pills, teal = active | blue and orange buttons |
| Navigation | Dynamic Island nav bar | own bar, one small link back |

Owner request: make the team's SPHEREx app the base, bring the AR/VR features into it without overriding
the team's work, and restyle the AR/VR parts to match. The team's layout is authoritative.

## 2. Scope (implemented)

### Phase 1: one look and one brand for the XR scenes
- `arvr/src/xr/theme.css` (new, loaded after `frontend.css`): re-skins the XR chrome (top bar, buttons,
  chips, info card, layer picker, mission and tour cards, menu, "Ways to explore", time machine, loading,
  title card, kiosk) with the 2D screens' tokens. **No `fe-*` rule is edited**; `styles.css` / `menu.css`
  keep their layout rules.
- Brand: "SPHEREx Cosmic Expedition" in the HUD, title card, kiosk overlay, page title and web manifest.
- The hub bar shows the brand mark as a link to the Gateway (`/`).

### Phase 2: the Gateway is the only front door
- The XR title card no longer opens by itself on a first visit to `/xr`; it remains available with `?intro`.
- Phones: the place name gets its own line (it was clipped to "M…"), the in-scene 3D title that sat under
  the HUD chips is shown only in VR/AR, bar buttons are 44px, the mission card no longer overlaps the
  destination chips or the "Stand on the surface" row.

### Phase 3: AR/VR features inside the Sky Explorer (3D model mode only)
All through the existing toolbar and HUD cards. No new panel; Sky mode is unchanged.
- **NASA image layers**: one toolbar toggle (`◐`, only for bodies with more than one layer, today Mars:
  Viking colour ↔ MOLA elevation). The telemetry card shows the layer name and its colour scale; the Source
  line shows the layer's credit. Shared with the XR scene (`useXRApp().layer`).
- **Walk on the surface**: in 3D model mode the second HUD action becomes "Walk on \<site\>" and opens
  `/xr/surface/<siteId>` through the wormhole. A selected pin that has its own site retargets it. In Sky
  mode the button is the team's "Compare observations", exactly as before.
- **Ask the Guide with context**: in 3D model mode the guide opens with the body as context, or with the
  selected pin's own question (`cosmic:ask-guide`, already handled by `CosmicGuideWindow`).

### Fix found on the way
- `backend/routes/objects.py` read `kamus_object.json` with the platform default codec. On Windows that is
  cp1252, so the Explorer HUD showed `-43Â°45â€²12â€³` instead of `-43°45′12″`. Now opened as UTF-8.
  Linux/Vercel were not affected.

## 3. Out of scope (not touched)

- `TopBar.tsx`, the layouts of Gateway / Sky Explorer (Sky mode) / Comparison / Cosmic Guide.
- Comparison keeps its 2D FITS previews (a 2D astronomical image is never shown as a 3D volume).
- API contract, routing table, `vercel.json`, service worker, dependencies (none added).

## 4. Scientific honesty

- Layer names and credits come from `arvr/src/xr/layers.ts` (NASA Viking mosaic, NASA MGS MOLA, public
  domain). The elevation layer is a data map with its scale shown, not a photograph.
- Hotspot labels stay **Fact / Illustration / Candidate (unconfirmed)**. Surface sites keep their own
  "what is real in this scene" notes.
- The body models are not SPHEREx data; SPHEREx targets and observations stay in Sky mode.

## 5. Testing (actual results, Windows, Edge via `playwright-core`, 2026-11-15)

| Test | Command | Result |
|---|---|---|
| Content + types + build | `npm run build --prefix arvr` | PASS (`check-content: 54 hotspots OK`, `tsc` clean) |
| Legacy frontend build | `node frontend/build.mjs` | PASS |
| Unified look (new) | `node arvr/scripts/smoke-unified-xr.mjs` | All checks passed: 4 scenes × 3 viewports + `?intro` |
| 3D viewport (extended) | `node arvr/scripts/smoke-observation-3d.mjs` | **129/129 PASS** (was 74; adds layers, surface link, guide context) |
| XR emulator | `npm run smoke:xr --prefix arvr` (preview 4173) | 30 PASS, 0 FAIL (the script now requests `?intro`) |
| Team design QA harness | `node arvr/scripts/design-migration-qa.mjs --stub` | 24 screens; after phase 1 the report was **identical** to a run on the unchanged code (0 screens different) |
| Backend | `python -m pytest backend/tests --asyncio-mode=auto` | 7/7 PASS (new `test_objects_encoding.py` fails without the fix) |
| Master integration | `node tests/test-master-integration.mjs` | **Not completed**: stops at `.fe-obs-select` (20 s timeout) because the live NASA IRSA search took about 30 s or returned 502 during this session. The unchanged code (`8e309af`) stops at the same line. Rerun when IRSA responds normally. |

Screenshots: `docs/unified-experience/xr-{hub,mars,spherex,jezero}-{desktop-1280x800,390x844,360x800}.png`,
`docs/observation-3d/explorer-mars-elevation-*.png`.

Not tested here: real Meta Quest 3 / Android AR devices (emulator only).

## 6. Decisions for the owner

- **D1: the 3D Solar System hub.** Kept as a scene opened from "3D / WebXR" and "Solar System Hub",
  restyled. The alternative is to remove it and reach Mars / Moon / Bennu only from the Sky Explorer,
  which drops the real planet positions, the time machine and "Solar System in VR / on your table".
- **D2: base branch.** `origin/main` (Mission Liaison agent) and `origin/integrasi` (wormhole, guide window)
  have diverged. This branch is based on `integrasi`. Merging with `main` will conflict in `TopBar.tsx`,
  `frontend.css`, `SkyExplorerScreen.tsx` and the guide files.

## 7. Deferred

1. EN/ID text for the Sky Explorer's 3D-mode HUD (the XR scenes are already EN/ID).
2. Guided tour and missions entry from the 2D screens.
3. Re-colour the in-world 3D panels (VR wrist menu, 3D buttons) to the gold/teal palette.
4. More bodies in the model switch (needs content files first).

## 8. Agent report

**Status:** PARTIAL (phases 1–3 done; deferred items above) · **Branch:** `feat/unified-experience`

| File | Change | Summary |
|---|---|---|
| `arvr/src/xr/theme.css` | Created | XR chrome in the shared design language |
| `arvr/src/main.tsx` | Modified | Loads the theme after `frontend.css` |
| `arvr/src/xr/Hud.tsx` | Modified | Brand mark link, shared brand, short phone label |
| `arvr/src/xr/Intro.tsx`, `kiosk.tsx`, `arvr/index.html`, `public/manifest.webmanifest` | Modified | Shared brand; title card only with `?intro` |
| `arvr/src/xr/XRRoot.tsx` | Modified | In-scene body title only in VR/AR |
| `arvr/src/xr/i18n.ts` | Modified | ID string for the new link |
| `arvr/src/frontend/components/SkyExplorerScreen.tsx` | Modified | Layer toggle, surface link, guide context (3D mode only) |
| `arvr/src/frontend/styles/frontend.css` | Modified (append) | `.fe-datum-layer`, `.fe-layer-legend` |
| `arvr/scripts/smoke-unified-xr.mjs` | Created | Smoke test + screenshots for the unified look |
| `arvr/scripts/smoke-observation-3d.mjs`, `smoke-xr.mjs` | Modified | New checks; `?intro` |
| `backend/routes/objects.py`, `backend/tests/test_objects_encoding.py` | Modified / Created | UTF-8 catalog read + test |

**Assumptions**
- `ASSUMPTION:` "use only their solar system" means their Gateway is the single landing and the app keeps
  one brand; our interactive hub stays as a scene (decision D1 above).
- `ASSUMPTION:` hiding "Compare observations" in 3D model mode is acceptable, because it compared RCW 36
  while the viewport showed Mars.

**Required owner actions:** review, decide D1 and D2, test VR/AR on real devices after an HTTPS deploy.
