# Wormhole Loading Transition — Implementation Notes

Status: implemented & optimized in `arvr/` (2D frontend). Source visual module: `ax-wormhole-transition.html` (canvas, rings, star streaks, palette).

## Behaviour

| Trigger | Treatment | Files |
|---|---|---|
| Homepage to Cosmic Expedition ("Enter expedition" & "Desktop 3D" cards) | Full-screen wormhole transition: expands from button, transitions cleanly to `/explorer`, snappier floor (~450 ms) without waiting for 3D XR scene | `src/frontend/components/GatewayScreen.tsx`, `src/frontend/components/WormholeOverlay.tsx`, `src/frontend/wormhole.ts` |
| Intentional XR entry (TopBar "3D / WebXR" link, Explorer `Enter 3D Table (XR)` and `Solar System Hub`, Comparison `Inspect in 3D Table`, Guide `Inspect in 3D`) | Full-screen wormhole: portal opens from the pressed control, closes only after the XR scene reports loading complete (or timeout) | `src/frontend/components/WormholeOverlay.tsx`, `src/frontend/wormhole.ts` |
| Explorer / Comparison archive requests | Compact local indicator (16 px double ring) inside the existing status text; never covers the page or navbar | `WormholePulse` in the same file, used in `SkyExplorerScreen.tsx` / `ObservationComparisonScreen.tsx` |

- No artificial progress: the bar is indeterminate, the overlay closes on success **and** error (`finally`), and 2D page transitions use an optimized snappy floor (450 ms desktop / 200 ms reduced-motion).
- `prefers-reduced-motion`: clip-path and canvas animation skipped, a single static frame is painted.
- One runner instance: re-entry returns the in-flight promise instead of stacking transitions.
- Cleanup on unmount cancels the RAF loop, timers, and resize listener.

## Performance Optimizations
- **Offscreen Canvas Caching**: Pre-renders nebula glow clouds and central halo onto offscreen canvases once, eliminating expensive `createRadialGradient` allocations and large `fillRect` draws on every animation frame.
- **Star Streak Batching**: Star paths are grouped by color palette, reducing Canvas 2D draw calls from ~260 individual strokes down to ~5 batched strokes per frame.
- **Streamlined Geometry**: Wavy rings optimized to 8 rings with 30 segments each for smooth 60fps rendering without CPU stalls.
- **DPR Capping**: Capped canvas DPR at 1.25 to prevent massive fill-rate bottlenecks on high-resolution Retina / 4K displays.
- **Hardware Acceleration**: Added `will-change: clip-path, opacity; transform: translateZ(0);` composite isolation in CSS.

## Ambience & Music Integration

- Asset: `public/audio/wormhole-ambience.mp3` (source file untouched; see `public/audio/README.md` for attribution).
- Managed via shared `src/frontend/audio/ambientAudio.ts` singleton with `useAmbientAudio` hook.
- Continuous ambient music playback across the web app with browser autoplay policy handling (unlocks automatically on first user gesture if autoplay was initially blocked).
- Synchronized toggle controls:
  - `♫` icon button in Cosmic Expedition toolbar (`SkyExplorerScreen.tsx`) turns ambient music ON/OFF with live toast notification (`"Musik latar aktif"` / `"Musik latar nonaktif"`).
  - `♪ Ambience · ON/OFF` button in Wormhole overlay label.
- Persistent state: saved in `localStorage['spherex.ambient.music']` (`'on'` / `'off'`).

## Untouched

`TopBar.tsx` (Dynamic Island state, scroll behaviour, menu, spacer, design), routing table, API layer, XR scenes.

## Verification run

- `cd arvr; npm run build` → `check-content: 54 hotspots OK`, `built in 42.77s` (tsc clean).
- Subagent browser verification on `http://localhost:5173`:
  - Homepage navigation to `/explorer` via "Enter expedition ↗" executed smooth wormhole transition.
  - Ambient audio toggle `♫` on `/explorer` verified working with bilingual toasts (`Musik latar aktif` / `Musik latar nonaktif`).
  - Zero console errors or runtime warnings.
