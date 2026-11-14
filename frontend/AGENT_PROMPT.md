# SPHEREx Expedition — Ready-to-Paste Agent Prompt
# Copy everything below the dashed line and paste at the start of any new agent session.

---

## Project: SPHEREx Cosmic Expedition

You are continuing work on a single-file XR web UI: `spherex-expedition.html`.

**Rules:**
- Additive only — never edit existing lines. Append new `<style>` / `<script>` / HTML before `</body>`.
- No `prototype.md`. No git commands (not a git repo).
- Desktop layout (≥768 px) must stay pixel-identical.
- Respond to user in Indonesian.
- Ship-on-write: no post-edit preview or tests.

**Design tokens:**
`--bg:#061020` `--surface:#0D1C33` `--gold:#D4AF37` `--gold-hi:#E5C07B`
`--text:#E2E4E9` `--muted:#8A8F9E` `--teal:#4FE3D6` `--violet:#B18CFF` `--amber:#F59E0B`

Buttons: glass pill, gold border `rgba(212,175,55,.38)`, hover → gradient-glow → solid gold fill.

**Active modules (do not conflict):**
- `zx-` / `ZX` — seamless zoom (All-Sky → Scene → Detail), flag: `ZX.config.enabled`
- `cg-` / `CG` — Cosmic Guide chatbot (desktop float + mobile full-page `#/guide/{id}`), flag: `CG.config.enabled`
- `zr-` / `ZR` — mobile/tablet responsive (bottom sheet 3 snaps, icon dock, rail), flag: `ZR.config.enabled`
- `qr-` — organic curved SVG hairlines on Explorer HUD cards (always on)

**Next available prefix:** `ax-` (or any unused two-letter prefix).

**Key selectors:**
```
#explorer .hud, .hud-head, #statusTag, #objectName, #objectDescription
.data-grid, .source-line, .hud-actions, .dock
.marker[data-object][data-zx-id], #viewport .sky-disc
#zx-root (z-index 200), #cg-root (z-index 300), #cg-fab
showScreen(), notify(), objects map
```

**Event bridge:**
```js
window.dispatchEvent(new CustomEvent('cosmic:ask-guide', { detail: { body, hotspotId, guidePrompt } }))
window.dispatchEvent(new CustomEvent('cosmic:back-to-source', { detail: { body, hotspotId, observation } }))
```

**Media query breakpoints already in use (do not duplicate):**
`max-width: 900px` / `680px` / `767px` / `768–1023px` / `390px` / `360px` / `max-height:500px landscape`

**Current backlog (pick top unblocked):**
1. Wire `/api/image/t1`, `/api/image/t2`, `/api/metadata/fits`, `/api/objects/{id}`
2. Backend proxy for CG chatbot at `POST /api/chat` (replace `demoRespond()` mock)
3. ZX texture pipeline: `objects.json` + LQIP→full progressive swap
4. i18n: wire `#lang` toggle to ZX copy and ZR toast
5. WebXR detection + AR/VR entry points in CapabilityDock
6. Accessibility: focus traps, `aria-live`, contrast check for `--muted` on `--surface`
7. Performance: implement `ZX.hooks.pauseSky()` stub to pause sky RAF during zoom

**To jump to a module:** search `<!-- ZX`, `<!-- CG`, `<!-- ZR`, `<!-- QR` in the file.
All modules are appended sequentially before `</body>`.

For full DOM map, token list, breakpoint registry, and task detail, read:
- `AGENT_CONTEXT.md` — complete reference (~1500 tokens)
- `AGENT_TASKS.md` — ordered backlog with implementation notes
