# Wormhole Loading Transition — Implementation Notes

Status: implemented in `arvr/` (2D frontend only). Source visual module: `ax-wormhole-transition.html` (canvas, rings, star streaks, palette).

## Behaviour

| Trigger | Treatment | Files |
|---|---|---|
| Intentional XR entry (TopBar "3D / WebXR" link, Explorer `Enter 3D Table (XR)` and `Solar System Hub`, Comparison `Inspect in 3D Table`, Guide `Inspect in 3D`) | Full-screen wormhole: portal opens from the pressed control, closes only after the XR scene reports loading complete (or 5 s timeout) | `src/frontend/components/WormholeOverlay.tsx`, `src/frontend/wormhole.ts` |
| Explorer / Comparison archive requests | Compact local indicator (16 px double ring) inside the existing status text; never covers the page or navbar | `WormholePulse` in the same file, used in `SkyExplorerScreen.tsx` / `ObservationComparisonScreen.tsx` |

- No artificial progress: the bar is indeterminate, the overlay closes on success **and** error (`finally`), and nothing waits beyond the animation floor (900 ms desktop / 260 ms reduced-motion).
- `prefers-reduced-motion`: clip-path and canvas animation skipped, a single static frame is painted.
- One runner instance: re-entry returns the in-flight promise instead of stacking transitions.
- Cleanup on unmount cancels the RAF loop, timers, resize listener and pauses audio.

## Ambience

- Asset: `public/audio/wormhole-ambience.mp3` (source file untouched; see `public/audio/README.md` for attribution).
- Toggle `♪ Ambience · ON/OFF` inside the overlay label, `aria-pressed`, persisted at `localStorage['spherex.wormhole.ambience']`, enabled by default.
- Volume 0.28, 900 ms fade-in, 500 ms fade-out on close; `play()` rejection (autoplay policy) is swallowed.
- Audio only runs while the full overlay is open — never for data requests.

## Untouched

`TopBar.tsx` (Dynamic Island state, scroll behaviour, menu, spacer, design), routing table, API layer, XR scenes. The overlay simply covers the island for the length of the transition and disappears.

## Verification run

- `cd arvr; npm run build` → `check-content: 54 hotspots OK`, `built in 24.37s` (tsc clean).
- Playwright on the dev server (1280×800): clicking the island XR link opened the overlay at the link's coordinates, then closed after the XR scene settled — resulting URL `/xr`, `aria-hidden="true"`, canvas 1280 px wide, island untouched on 2D routes.
- Same flow with `prefers-reduced-motion: reduce`: overlay still opened/closed, clip path reset to `circle(0px at 50% 50%)`.
- Explorer with a delayed `/api/objects/rcw-36` stub: `.fe-wormhole-pulse` present (16×16) while the heading read "Loading catalog…".
