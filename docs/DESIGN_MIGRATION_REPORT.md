# DESIGN MIGRATION — LEGACY `frontend/spherex-expedition.html` → `arvr/src/frontend/`

**Repository:** `mainProjectSPHRX`
**Date:** November 2026
**Scope:** Visual language + responsive behaviour only. No backend, routing, API/store flow, XR scene, or Dynamic Island changes.
**Status:** Implemented and measured with `arvr/scripts/design-migration-qa.mjs` (`docs/design-migration/before|after/`).

---

## 1. Phase 0 inventory (what already existed vs. what was missing)

| Area | Already in `arvr` | Gap found in the baseline run |
|---|---|---|
| Foundations | `fe-*` token set (`--teal`, `--soft`, `--muted`, `--panel-glass`, `--radius-*`, `--mono`), reduced-motion blocks | `--hit-target` not applied to icon buttons, tabs and epoch download links (126 sub-44px records in the baseline run) |
| Gateway | Hero, 3-step journey, APOD flow, honest "illustrative" labels | No capability **markup** at all (the `.fe-cap*` rules already in CSS were dead code, a 4-column grid nothing rendered); "Explore capabilities" was toast-only |
| Sky Explorer | Sky viewport + 3 HUD cards + dock, URL-backed selection | HUD cards used fixed pixel offsets; 2 real overlaps at 768/1280 |
| Explorer detail (mobile) | HUD reflows under the sky | Only via one `max-width: 980px` rule; the 681–1279 band still floated cards over the sky |
| Comparison | A/B cards, 3 modes, honesty banner, integrity notes | Integrity block was inline-styled (10 properties); A/B header collapsed to 4-line titles at 320px |
| Cosmic Guide | Head, topic switcher, chips, chat, form | Head/topic row inline-styled; topic chips reused `.fe-tab` (wrong affordance, no `aria-pressed`) |
| Scroll owner | `window` for Gateway/Comparison/Guide, fixed-height `.fe-explorer` | Explorer still scrolled 260px at 844×390 because the layout exceeded the viewport |

## 2. Changes per file

### `arvr/src/frontend/styles/frontend.css`
- **Touch targets:** `.fe-icon-btn`, `.fe-tab` (now `inline-flex` centred), `.fe-epoch-downloads a`, `.fe-obs-select`, `.fe-dock button`, `.fe-topic` → `min-height: var(--hit-target)` (44px, declared at `:root` line 32). Sky `.fe-marker` keeps its 26px visual ring but now sits inside a 44×44px pointer target.
- **Gateway capabilities:** the dead `.fe-cap*` rules (a 4-column grid nothing rendered) became a real 3-up block: `.fe-capabilities` (`grid-column: 1 / -1`, 3 equal columns, `max-width: 780px`, `scroll-margin-block: 96px`, `:focus-visible` outline) plus hardened `.fe-cap` children (`min-width: 0`, `overflow-wrap: anywhere`) so long device strings never overflow at 320px.
- **Comparison integrity notes:** `.fe-sci-notes` / `.fe-sci-notes-title` replace 10 inline declarations, token-based (`--line`, `--teal`, `--radius-card`), with a `@media (max-width: 420px)` variant.
- **Comparison A/B cards:** `@media (max-width: 680px)` stacks `.fe-epoch-card` to one column and left-aligns the archive-id/µm block (previously squeezed the release title to 4 lines at 320px).
- **Explorer observation picker:** `.fe-obs-select` (+`:focus-visible`) replaces the inline-styled `<select>`.
- **Explorer layout bands (root-cause fix for the 768/980/1024 overlaps):**
  - `@media (min-width: 681px) and (max-width: 1279px)` — HUD cards return to a single reading column under a `56vh`/`min 380px` sky viewport (`max-width: 720px`, wrapped actions, wrapped dock).
  - `@media (min-width: 1280px)` — the floating HUD rail (right edge, `top: 96px`, `max-height: calc(100% - 120px)`, internal scroll + thin scrollbar, glass panel) is **desktop only**.
  - `@media (min-width: 681px) and (max-width: 1279px) and (max-height: 560px)` — landscape phones keep the sky on the left and a scrollable 320px HUD rail on the right, `height: calc(100dvh - 76px)` so the page itself does not scroll.
  - `@media (max-height: 560px) and (min-width: 1280px)` — reduced rail height for short desktops.
- **Cosmic Guide extraction:** `.fe-guide-title`, `.fe-guide-sub`, `.fe-guide-actions`, `.fe-topic-row`, `.fe-topic-label`, `.fe-topic` (+`.active`, `:hover`) replace inline styles; `.fe-topic` is a 44px pill with an affordance distinct from `.fe-tab`.

### `arvr/src/frontend/components/GatewayScreen.tsx`
- Adds the curated **3-card capability grid** (`Desktop 3D`, `WebXR AR`, `WebXR VR`) — Gyroscope intentionally omitted.
- AR/VR lines are driven by the existing `caps` device-capability state, never hardcoded as available.
- `handleCapabilities()` scrolls the block into view and focuses it (`ref` + `tabIndex={-1}`) **before** the existing `notify(...)` toast, so the toast and the highlighted panel agree.

### `arvr/src/frontend/components/SkyExplorerScreen.tsx`
- Inline `style` on the observation `<select>` removed in favour of `.fe-obs-select`. `searchParams`, selection, and XR handoff untouched.

### `arvr/src/frontend/components/ObservationComparisonScreen.tsx`
- Integrity disclosure block re-expressed with `fe-sci-notes` classes. Copy, caveats, and mode logic untouched.

### `arvr/src/frontend/components/CosmicGuideScreen.tsx`
- Head/topic-row inline styles replaced with `fe-guide-*` / `fe-topic-*` classes.
- Topic buttons use `.fe-topic` with `aria-pressed`, so the switcher is no longer visually identical to the comparison tabs. `#/guide/:key` routing, messages, and form behaviour unchanged.

### `arvr/scripts/design-migration-qa.mjs` (new, evidence tool)
- Playwright harness: 4 screens × 6 viewports × `top` / `scrolled` / `menu` phases → screenshots plus `report.json` (overlaps, obstructed-vs-island, truncations, sub-44px targets, horizontal overflow, first-content scroll delta, island `data-state`, mobile menu panel).

---

## 3. Deliberate non-migrations

- **Gyroscope card** — excluded by the curation note even though the reference lists it.
- **`hc-` holographic treatment** (scan line, per-card accent, hover glow, shimmer, entrance stagger) — not applied to the capability row. In the reference, `hc-` glass cards belong to the Solar System module while the *capability* row is a plain hairline 3-up grid; continuous shimmer also conflicts with `prefers-reduced-motion` and mobile battery. The hairline grid is what ships.
- **Legacy `window.ZR` / `adoptNodes()` detail sheet** — not ported: imperatively moving React-owned DOM is what the contract forbids. Responsive detail access is delivered by CSS bands instead (stacked column at 681–1279, side rail in short landscape, in-flow cards on phones).
- **Absolute/fixed pixel offsets and `100vh` from the legacy file** — replaced by flow layout, `clamp()`, and `100dvh` with `100vh` fallback.
- **No new dependencies, no backend/API changes, no route changes, no XR scene edits, `TopBar.tsx` untouched.**
- **Pre-existing duplicate "Phase 6.3 Mobile UI/UX" block** (`@media (pointer: coarse)`, `≤767px`, `768–1023px`, `≤360px`, reduced-motion) already exists twice in `HEAD`; it was left as-is (same values, so later duplicates win harmlessly). Deduplicating it is a separate cleanup, not part of this migration.

---

## 4. Dynamic Island evidence

`TopBar.tsx` was **not edited**. Island states recorded by the QA run (`top` phase, post-scroll phase, menu phase) with matching screenshots:

| Screen / viewport | `data-state` (top → scrolled → menu) | Mobile menu |
|---|---|---|
| `comparison-320x640` | `top` → `island` → `island-open` | opens, `menuOk: true` |
| `gateway-390x844` | `top` → `island` → `island-open` | opens, `menuOk: true` |
| `explorer-320x640` | `top` → `island` → `island-open` | opens, `menuOk: true` |
| `guide-1280x800` | `top` → `island` → n/a | desktop, no menu button |
| `explorer-844x390-landscape` | `top` → `top` → n/a | landscape row layout does not scroll |

Screenshots: `docs/design-migration/after/<screen>-<viewport>-{top,scrolled,menu}.png`; raw data in `docs/design-migration/after/report.json`.

Intentional differences versus the baseline: at 768×1024 the pages can finally scroll (`gateway` 153px, `explorer` 140px, `comparison` 260px of first-content shift, all `0` before), so they now reach `island` after scrolling. `guide-768x1024` still fits one viewport and correctly stays `top`. Escape closes the mobile panel and returns focus to the trigger on every phone viewport.

---

## 5. Verification results (honest)

From `arvr/` (log files are gitignored; every command below is reproducible as written):

- `npm run build` (= `check:content` → `tsc --noEmit` → `vite build`, so a type error or a content regression fails the chain) → `check-content: 54 hotspots OK`, **built in 25.27s** (`arvr/build-v2.log`).
- `node scripts/design-migration-qa.mjs --phase=after --stub` → `docs/design-migration/after/report.json`, `generatedAt: 2026-11-14T19:40:09Z` (24 screens = 4 routes × 6 viewports); raw console table in `arvr/qa-after6.log`.
- `npm run smoke:xr` → **all PASS, 0 FAIL** (34 result lines), after starting the documented prerequisite server (`XR_HTTP=1 npx vite preview --port 4173`). Covers VR and AR entry plus every destination in both modes. Log: `arvr/smoke-xr3.log`. It ran against the `dist/` build of 02:15; the only CSS change after that point is the frontend `.fe-dock` hit target, which no XR surface touches.

| Metric (24 screens × `top` + `scrolled`) | Before | After |
|---|---|---|
| Bounding-box overlaps | **5 records / 3 Explorer screens** — `.fe-hud-telemetry` × `.fe-hud-actions` at 768, 1280 (both phases) and 844×390 landscape (scrolled) | **0** |
| Controls under 44px | **126 records** — Explorer 22 per desktop screen, Guide 12–14 per screen | **0** |
| Horizontal overflow | **2 records** — `guide-320x640`, both phases | **0** |
| Truncated text (`scrollWidth > clientWidth`) | 0 | **0** |
| Explorer 844×390 first-content shift (page scroll) | **260px** | **0px** |

Residual `obstructed` entries exist **only in the `scrolled` phase**: they are page content passing under the fixed floating island pill (`explorer-320` sky markers, `explorer-390` catalog marker, `comparison-390` header buttons, `guide-320/390/1280/landscape` topic chips and head buttons). They stay reachable by scrolling, are not clipped or disabled, and the island is a translucent overlay by design — so they are recorded, not "fixed".

Not executed / not proven in this pass:
- **Harness coverage caveat:** `design-migration-qa.mjs` checks a fixed selector list, so a control outside it can be under 44px and still score 0. A manual probe found exactly that: `.fe-dock button` rendered 109×**33**px at 320/680px. It was fixed at the source (`min-height: var(--hit-target)` on the base `.fe-dock button`) and re-measured 109×44 / 121×44 / 344×44 at 320/680/1024. Everything else in the table is harness-measured, not hand-audited.
- Manual keyboard tab-order walkthrough and a `prefers-reduced-motion: reduce` render check — focus styles and reduced-motion blocks exist in CSS, but no separate browser pass was recorded.
- Real-device WebXR handoff (emulated only via `smoke:xr`).
- Explorer loading / empty / error states: only the stubbed data path was exercised by the QA harness.

---

## 6. Open questions for Rafli

1. Explorer mobile detail stays an in-flow stacked HUD; a collapsible `peek/expanded` sheet was intentionally skipped for scope and risk. Do you want it as a follow-up phase?
2. The `Sample · illustrative` marker label can clip at the sky/rail boundary in short landscape (marker sits at 70% of a ~520px-wide sky). Acceptable, or should illustrative markers get per-breakpoint positions?
3. Capability cards ship as the reference's plain hairline grid rather than the `hc-` holographic treatment. If holographic styling is wanted, it should be a separate phase with reduced-motion and mobile-cost review.
4. `docs/DESIGN_MIGRATION_REPORT.md` + `arvr/scripts/design-migration-qa.mjs` + `docs/design-migration/` are new untracked files; commit them with the source changes or keep them local?
