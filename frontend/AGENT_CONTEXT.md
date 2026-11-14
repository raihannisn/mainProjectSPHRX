# SPHEREx Cosmic Expedition — Agentic Context Kit
_Paste this file into any agent at session start. Keeps context under ~1500 tokens._

---

## 1. Project Identity
- **Product:** SPHEREx Cosmic Expedition — single-file XR-first web UI.
- **Deliverable:** one file → `spherex-expedition.html` (project root).
- **Stack:** pure HTML/CSS/JS, no build step, no framework, no npm.
- **Status:** feature-complete UI prototype; endpoint integration pending.

---

## 2. Golden Rules (never break)
1. All changes **additive only** — never alter existing markup, CSS, or JS.
2. New selectors get a module prefix (see §4). No global selectors (`body`, `*`, `button`).
3. No `prototype.md` reads; no production Skill loading.
4. Ship-on-write: no post-edit preview, screenshots, or tests.
5. Desktop layout (≥768 px) must remain **pixel-identical** after any mobile fix.
6. Project dir is **not a git repo** — `git diff` unavailable.
7. Respond to user in **Indonesian**.

---

## 3. Design Tokens (locked)
```css
--bg:          #061020;   /* deep cosmos */
--surface:     #0D1C33;   /* glass panel base */
--gold:        #D4AF37;   /* primary accent / buttons */
--gold-hi:     #E5C07B;   /* selected / highlight */
--text:        #E2E4E9;   /* body */
--muted:       #8A8F9E;   /* secondary */
--teal:        #4FE3D6;   /* fact marker / active state */
--violet:      #B18CFF;   /* candidate marker */
--amber:       #F59E0B;   /* demo / warning */
```
Buttons: glass pill, 1 px border `rgba(212,175,55,.38)`, hover → animated gradient-glow → solid gold fill. `prefers-reduced-motion` respected everywhere.

---

## 4. Module Registry
| Prefix | Module | Feature flag |
|--------|--------|--------------|
| `zx-` / `ZX` | Seamless zoom (All-Sky → Object Scene → Detail) | `ZX.config.enabled` |
| `cg-` / `CG` | Cosmic Guide chatbot (desktop float + mobile full-page) | `CG.config.enabled` |
| `zr-` / `ZR` | Mobile/tablet responsive (bottom sheet, dock, rail) | `ZR.config.enabled` |
| `qr-` | Organic curved SVG hairlines on HUD cards | always on |

**Next prefix to use:** `ax-` (or any unused two-letter prefix).

All modules are appended inline before `</body>`, in order: ZX → CG → ZR → QR.

---

## 5. Key DOM Selectors
```
main.app
  header.topbar
    .brand / .brand-mark / .top-actions
    button.lang#lang           ← EN/ID toggle
    .connection span           ← "LOCAL DEMO" badge

  section.screen#gateway[data-screen]   ← active class = visible
  section.screen#explorer[data-screen]
    .viewport#viewport
      .sky-disc                ← CSS transform rotates on drag
      .toolbar                 ← #reset, #recenter, #audio buttons
      .marker[data-object][data-zx-id]  ← rcw / candidate / demo
      .view-hint               ← bottom-left drag hint
    .hud
      .hud-head                ← #statusTag, #objectName
      #objectDescription
      .data-grid               ← #objectId, coords, epoch
      .source-line
      .hud-actions             ← Ask the Guide, Compare, Back to source
      .dock                    ← Reset/Recenter/Audio/Exit buttons

  section.screen#comparison[data-screen]

#modal / #modalContinue / #closeModal
#toast                         ← notify() helper
#loader
#zx-root                       ← ZX overlay (z-index 200)
#cg-root                       ← CG overlay (z-index 300)
  #cg-fab                      ← robot button, inserted into .toolbar
  #cg-window                   ← desktop floating chat
  #cg-page                     ← mobile full-page chat
```

---

## 6. JS API Surface
```js
// Navigation
showScreen('explorer' | 'gateway' | 'comparison')
notify('message text')   // toast

// Object data
objects = { rcw: {...}, candidate: {...}, demo: {...} }
// each has: id, name, ra, dec, type, status, description, source

// ZX module
ZX.open(objectId, { origin: {x,y} })   // trigger zoom from click point
ZX.config.enabled = true|false

// CG chatbot
CG.config.enabled = true|false
// listens for window event 'cosmic:ask-guide'

// Event bridge (existing)
window.dispatchEvent(new CustomEvent('cosmic:ask-guide', { detail: { body, hotspotId, guidePrompt } }))
window.dispatchEvent(new CustomEvent('cosmic:back-to-source', { detail: { body, hotspotId, observation } }))

// ZR responsive
ZR.config.enabled = true|false
ZR.getState()   // 'hidden'|'peek'|'half'|'full'
```

---

## 7. Media Query Layers (existing, do not conflict)
| Breakpoint | Purpose |
|---|---|
| `max-width: 900px` | early tablet adjustments |
| `max-width: 680px` | first mobile pass |
| `max-width: 767px` | ZR mobile layout (bottom sheet, etc.) |
| `768px–1023px` | ZR tablet overlap fixes |
| `max-width: 390px` | compact pass |
| `max-width: 360px` | ZR extra-compact |
| `max-height: 500px, orientation: landscape` | ZR landscape side panel |

---

## 8. Known Pending Work (backlog)
- [ ] Connect real API endpoints (`GET /api/image/t1`, `/api/image/t2`, `/api/metadata/fits`, `/api/objects/{id}`)
- [ ] Replace CG mock responses with real backend proxy (`POST /api/chat`)
- [ ] ZX: replace DOM-only zoom simulation with actual Three.js camera flyTo when renderer is added
- [ ] ZX: LQIP → mid → full progressive texture loading per objects.json
- [ ] Add `objects.json` data file + asset textures for ZX detail views
- [ ] VR/AR state overlays (Frames 04/05 from DESIGN.md) — scaffolded in HTML, not wired to WebXR yet
- [ ] i18n: wire existing EN/ID toggle to ZX scene/detail copy and CG chat chips
- [ ] Accessibility audit: ensure all new floating cards have correct ARIA roles/live regions
- [ ] Performance: pause sky render during ZX zoom (`ZX.hooks.pauseSky()` stub exists)

---

## 9. Info Architecture (screens)
```
Gateway (/xr)
  → Enter Expedition → Explorer (/xr/body/:id)
      → Click hotspot → ZX zoom → Object Scene → Object Detail
      → Ask the Guide → CG chatbot (float / mobile full-page #/guide/{id})
      → Compare → Comparison screen
          → Return to Sky Explorer
```

---

## 10. File Structure (all inline, single HTML)
```
spherex-expedition.html
  <head>  tokens, fonts (Poppins/Mona Sans stack)
  <style> base layout + tokens (~line 1–570)
  <body>
    header.topbar
    main.app
      #gateway  (screen 1)
      #explorer (screen 2)  ← primary working area
      #comparison (screen 3)
    #modal
    <!-- ZX module  (HTML + <style> + <script>) -->
    <!-- CG module  (HTML + <style> + <script>) -->
    <!-- ZR module  (<style> + <script>)        -->
    <!-- QR module  (<style> + <script>)        -->
  </body>
```

---

## 11. How to Continue Work Efficiently
1. **Read only the relevant module** — if fixing mobile layout, search `<!-- ZR` to jump to that block.
2. **Append at the end** before `</body>` — never edit existing lines.
3. **Pick the next unused prefix** from §4 for any new module.
4. **Check §7** before adding a media query — avoid duplicate breakpoints.
5. **Reference §5** for exact selectors; do not guess class names.
6. **Close with an Indonesian delivery note** naming the file and any disclosed gaps.
