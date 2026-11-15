# 3D models in the Cosmic Explorer

Mars, the Moon and Bennu (the AR/VR app's bodies) now render inside the Sky Explorer viewport.
Nothing else on the screen was redesigned.

## How to use it

- **3D** round toggle (under the toolbar) steps through Sky, Mars, Moon, Bennu, Sky. The choice lives in the URL as `?model=mars`, so it can be shared.
- **Hotspot** round toggle (`⦿`, 3D mode only) shows or hides the pins. Tapping a pin fills the object card.
- **Layer** round toggle (`◐`, bodies with NASA layers such as Mars) switches the image layer; the card shows the legend and credit.
- The object card carries **Walk on <site>** and **Enter VR / Enter AR** (VR/AR only on devices that support them).
- Reset, Recenter, ambience, Cosmic Agent, the three action buttons and the bottom dock keep working and keep their places. In 3D mode Reset/Recenter re-frame the model, Ask the Guide sends the body (and the selected pin) to the agent, and "Enter 3D Table (XR)" opens the same body in the XR scene.

All 3D-mode text is English.

## What was not touched

Homepage (Gateway), wormhole, navbar, audio, Comparison, the Cosmic Agent button, the ambience button, the bottom dock and the page layout.
`frontend.css` only gained rules at the end of the file. The new controls sit in their own rail (`.fe-model-rail`) so the four existing toolbar buttons never move.

## Files

- `arvr/src/frontend/components/SkyExplorerScreen.tsx`: model state, rail, 3D cards.
- `arvr/src/frontend/components/ModelViewer3D.tsx`: inline canvas around `BodyExplorer` (no in-world title or object card; the HUD cards carry them).
- `arvr/src/xr/BodyExplorer.tsx`: `showTitle` and `showObjectCard` props (both default to true, so XR is unchanged).
- `arvr/scripts/measure-layout.mjs`: layout fingerprint (bounding boxes at 8 viewports, with `--diff`).

## Verification

- Layout fingerprint of Gateway, Explorer (sky) and Comparison at 8 viewports, before and after: 456 elements identical, 0 moved.
- Playwright at 320x640, 360x800, 390x844, 768x1024, 1024x768, 1280x800, 1440x900, 844x390: toolbar buttons identical between sky and 3D, new buttons inside the viewport, at least 44px on touch, no overlaps, Sky to Mars to Moon to Bennu to Sky cycle works, hotspot and layer toggles engage, no page errors, no non-English text.
- `npm run check:content`, `tsc --noEmit` and `vite build` pass.
