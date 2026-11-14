# SPHEREx Expedition — Task Backlog for Agents

Priority order. Each task is self-contained; pick the top unblocked one.

---

## P1 — Critical / User-Visible

### TASK-01: Wire API endpoints
- Replace static demo objects with live data from:
  - `GET /api/image/t1` → primary sky image
  - `GET /api/image/t2` → comparison image (disable Compare if 404)
  - `GET /api/metadata/fits` → DATE-OBS, TELESCOP, INSTRUME
  - `GET /api/objects/{id}` → object_name, ra, dec, type
- Fallback paths already defined in DESIGN.md §5; implement them.
- Prefix: `api-` or inline in existing JS.

### TASK-02: Backend proxy for CG chatbot
- Endpoint: `POST /api/chat` (to be built in `/server/api/chat.js`)
- Request body: `{ messages, context: CGContext }` — context schema in AGENT_CONTEXT §6
- Response: streaming NDJSON or plain JSON `{ reply }`
- Replace `demoRespond()` mock in CG module with real fetch + streaming render.
- Keep `CG.config.enabled` flag; mock stays as fallback.

---

## P2 — Feature Completion

### TASK-03: ZX texture pipeline
- Create `/assets/zx/data/objects.json` with schema from plan §4 (lqip/mid/full texture paths, hotspots).
- Implement LQIP → mid → full progressive swap in ZX detail view.
- Currently ZX uses CSS gradient spheres as stand-ins.

### TASK-04: i18n wiring
- EN/ID toggle (`#lang` button) already exists; `CG.i18n` and `t()` already exist in CG module.
- Wire toggle to: ZX scene/detail copy, ZX chip labels, Explorer hint toast (ZR module), `notify()` calls.
- Pattern: listen `lang.addEventListener('click', ...)` and call `updateLabels()` equivalent in each module.

### TASK-05: WebXR integration scaffold
- Frames 04/05 from DESIGN.md (AR placement states, VR controller states) are described but not yet wired to real WebXR API.
- Add `if ('xr' in navigator)` detection; on success show AR/VR entry points in CapabilityDock.
- Keep graceful desktop fallback (already works).

---

## P3 — Polish

### TASK-06: Accessibility audit
- Verify all ZX overlay cards have `role="dialog"` or `role="region"` with `aria-label`.
- Verify CG `#cg-window` focus trap on open (already partially implemented).
- Add `aria-live="polite"` to ZX loader status text.
- Verify color contrast for `--muted` (#8A8F9E) on `--surface` (#0D1C33) — may fail AA for small text.

### TASK-07: Performance — pause sky during ZX zoom
- `ZX.hooks.pauseSky` stub already defined.
- Implement: on `ZX.state = ZOOMING_IN`, pause `requestAnimationFrame` loop for `.sky-disc` rotation.
- Resume on `ZX.state = IDLE` or `REVERSING`.

### TASK-08: Tablet layout fine-tuning
- Current ZR tablet rules (768–1023px) add `max-width` guards to prevent card overlap.
- After real device testing, fine-tune card positions and font sizes.
- Do not change desktop (≥1024px) rules.

---

## Completed (do not redo)
- [x] Full UI: Gateway, Explorer, Comparison, XR fallback states
- [x] Animated solar-system centerpiece
- [x] Deep Navy & Gold retheme
- [x] Glassmorphism panels + pill-rounded buttons + gradient-glow hover
- [x] Six floating Explorer HUD cards
- [x] ZX seamless zoom module
- [x] CG Cosmic Guide chatbot (desktop + mobile)
- [x] ZR mobile/tablet responsive (bottom sheet, dock, safe areas)
- [x] QR organic curved hairlines on HUD cards
- [x] Global button animation (gradient-glow → solid gold)
