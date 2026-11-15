# Continue: 3D Solar System in the Cosmic Explorer

## Where things are

- Repo: `raihannisn/mainProjectSPHRX` (remote `origin`)
- Working copy: `D:\mainProjectSPHRX-integrasi` (worktree)
- Branch: `sebelum-overhaul-3d` (local only, not pushed)
- Latest commit: `5845470`
- Dev server: `http://localhost:5174/explorer` (run from `arvr/` with `npx vite --config vite.worktree.config.ts --port 5174 --strictPort`)
- Backend (agent, voice, catalog): not running. Start it separately or those calls will fail.

## What the Explorer does now

- `/explorer` opens on the 3D Solar System (`?model=solar` by default).
- Tapping a planet opens its 3D body in the same viewport (`?model=<id>`).
- Round `3D` toggle cycles Solar System → Mars → Moon → Bennu → Solar System.
- Hotspot (`⦿`) and NASA-layer (`◐`) toggles appear next to `3D` when a body is open.
- Expedition (homepage) and the navbar "Sky Explorer" both go to `/explorer`.
- `?target=` links (for example from Comparison) still open the old SPHEREx sky view.
- The 3D / WebXR capsule is removed from the navbar.
- The Solar System Hub (`/xr`) is still reachable from "Solar System Hub" in the bottom dock.

## Rules that must not break

- Do not change homepage, wormhole, navbar (except the Sky Explorer link), audio, Cosmic Agent button, ambience button, Comparison, bottom dock buttons, or layout. Only cards may change.
- All new text is English.
- New controls are round toggles and sit in `.fe-model-rail`.
- Text-to-speech on the object card must keep running.
- VR/AR entry (`Enter VR` / `Enter AR`) must keep working on supported devices.
- Do not push or open a PR without the owner's explicit word.
- Commits carry no AI attribution lines.

## Key files

- `arvr/src/frontend/components/SkyExplorerScreen.tsx`: model state, rail, cards, Solar System default
- `arvr/src/frontend/components/ModelViewer3D.tsx`: 3D canvas; `bodyId='solar'` renders the Solar System chart
- `arvr/src/xr/BodyExplorer.tsx`: `showTitle`, `showObjectCard`, `hideObjectCard` props
- `arvr/src/xr/CatalogObjectCard3D.tsx`: `hidden` prop keeps speech running without drawing the panel
- `arvr/src/frontend/components/TopBar.tsx`: navbar items (capsule removed)
- `arvr/src/frontend/components/GatewayScreen.tsx`: Expedition buttons
- `arvr/src/App.tsx`: `/explorer` route
- `arvr/src/frontend/styles/frontend.css`: appended `.fe-model-rail`, `.fe-card-link`, `.fe-layer-legend` rules

## Known gaps / next steps

1. Bodies without hotspot content (for example Saturn) show a plain sphere. Owner said: no rings for now.
2. VR/AR card link is untested (no headset in the test environment).
3. Text-to-speech was checked only with a stubbed audio backend. Re-test with the real backend.
4. Re-run the layout fingerprint (`arvr/scripts/measure-layout.mjs`) and Playwright checks at all 8 viewports after the latest rail change; only the 3D toggle position was checked at 1280 wide.
5. Phone layout of the rail with the Solar System chart still needs a look (the rail is a 2-column grid at 680px and below).
6. Decide whether to delete `arvr/src/frontend/components/SkyScene3D.tsx` if the sky view is retired.

## How to verify

```bash
cd arvr
npm run check:content
npx tsc --noEmit
npx vite build --outDir /tmp/arvr-dist-check --emptyOutDir
node scripts/measure-layout.mjs --base=http://localhost:5174 --out=layout-after.json
node scripts/measure-layout.mjs --diff=layout-before.json,layout-after.json
```
