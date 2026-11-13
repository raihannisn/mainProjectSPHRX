# AR/VR MODULE TECHNICAL AUDIT REPORT — SPHEREx Cosmic Expedition

## 1. Executive Summary
This technical audit inspects the standalone React 19 + Vite 6 + TypeScript AR/VR module (`arvr/`) of the NASA Space Apps Challenge 2026 entry. The module delivers an immersive 3D Solar System hub, planetary orbit views (Mars, Moon, Bennu), walkable NASA-derived surface terrains (Victoria, Gale, Jezero, Apollo 11, etc.), and a SPHEREx infrared blink-comparator game. While the architecture successfully leverages `@react-three/fiber`, `@react-three/xr`, and Zustand with robust quality governance (`QualityGovernor.tsx`) and offline caching (`sw.js`), several integration risks, missing backend ties, and lifecycle nuances must be addressed before final monorepo integration.

---

## 2. Verified Application Architecture
- **Entrypoint**: `src/main.tsx` (mounted via React Router in `src/App.tsx`).
- **XR Core & Canvas**: `src/xr/XRRoot.tsx` hosts the Three.js `<Canvas>`, `<XR>` provider from `@react-three/xr`, camera rigs (`PlayerOrigin`, `CameraRig`), and synchronization components (`ModeSync`, `ExposureSync`).
- **State Management**: Zustand store (`src/xr/store.ts` - `useXRApp`) tracks `bodyId`, `siteId`, `band`, `observation`, `mode` (`desktop`, `gyro`, `ar`, `vr`), and user settings.
- **Scene Routing**:
  - `/xr`: Solar System hub (`SolarSystemHub.tsx`).
  - `/xr/body/:id`: Orbit / body explorer (`BodyExplorer.tsx`).
  - `/xr/surface/:siteId`: Walkable surface simulation (`SurfaceScene.tsx`).
  - SPHEREx interactive plate (`SpherexTable.tsx`).
- **Localization**: English + Indonesian translation dictionary (`src/xr/i18n.ts`) accessed via `t()`.

---

## 3. Feature Inventory
- **Solar System Hub**: Ephemeris-driven heliocentric planetary positions (`ephemeris.ts`) with time-machine slider (`TimePanel.tsx`, `TimeVR.tsx`).
- **Body Explorer**: Orbit views of Mars, Moon, Bennu with NASA textured spheres and hotspot pins.
- **Walkable Surface Sites**: 8 NASA 3D-print STL derived heightmap terrains with PBR ground shaders, rover models, sun shadows, and dust particles.
- **SPHEREx Blink Comparator**: Real cutout image pair analysis (A vs. T1 and B vs. T2) with asteroid movement detection.
- **XR Support**: Native WebXR VR (Quest controllers, hand tracking, teleport arc) and WebXR AR (tabletop hit-test placement) with `iwer` emulation (`?emulate`).

---

## 4. Desktop 3D Audit
- **Status**: Fully functional.
- **Controls**: Mouse orbit controls (`OrbitControls`), keyboard movement (`WASD`) on surface scenes.
- **Lighting & Assets**: Procedural starmap, animated Sun with corona, PBR rock/dust textures, and glTF NASA models (`opportunity.glb`, `perseverance.glb`, etc.).
- **Performance**: High fidelity on desktop GPUs with automatic dynamic quality tiering.

---

## 5. Mobile Gyroscope Audit
- **Status**: Supported via `DeviceOrientation` sensors (`GyroControls.tsx`).
- **Considerations**: Requires explicit browser permission on iOS Safari. On Android (e.g., Galaxy A16), sensor permission prompts and WebGL context limits must be handled gracefully.

---

## 6. WebXR AR Audit
- **Status**: Functional via `@react-three/xr` and `xrStore.ts`.
- **Initialization**: `enterImmersive('ar')` tries progressive feature presets (plane detection, depth sensing, hit-test) to prevent `NotSupportedError` crashes on restrictive mobile browsers.
- **Fallback**: Gracefully falls back to desktop 3D or gyro view with clear error messages (`xrErrorMessage()`).

---

## 7. WebXR VR Audit
- **Status**: Functional for Quest 3 and compatible headsets.
- **Target Refresh Rate**: Explicitly requests 72 Hz (`TARGET_HZ = 72`) with maximum foveation (`foveation: 1`) to ensure stable frame rates and prevent motion sickness.
- **Interactions**: Controller raycast, hand tracking touch pointer, and 1.5s Gaze Dwell (`GazeDwell.tsx`).

---

## 8. Scientific Content Audit
- **Sources**: NASA/JPL/USGS public domain imagery, MOLA topography, and Minor Planet Center orbital data.
- **Honesty Guardrails**: Strict labeling distinguishing *Fact*, *Illustration*, and *Candidate (unconfirmed)*. No unverified user findings are claimed as official discoveries.

---

## 9. Performance and Asset Audit
- **Quality Governor**: `QualityGovernor.tsx` automatically steps down rendering quality tiers (`ultra` -> `high` -> `medium` -> `low`) if FPS drops below 80% of target for 4 seconds.
- **Asset Size Risk**: High-resolution textures (4K starmaps, 2K surface maps) and GLB rover models require careful preloading to ensure fast initial mobile load times.

---

## 10. Localization and Accessibility Audit
- **Localization**: Comprehensive EN/ID support via `src/xr/i18n.ts`. All UI strings are keyed by English text.
- **Accessibility**: Respects `prefers-reduced-motion` (disabling animated particles and smooth camera fly-ins) and provides focus-visible states and ARIA labels.

---

## 11. Backend and Frontend Integration Readiness
- **Backend Communication**: Currently operates primarily on static JSON content (`content/bodies/`, `content/sites/`) and local FITS assets without direct live calls to the FastAPI backend (`/api/...`).
- **Integration Bridge**: Listens to custom window events (`cosmic:ask-guide` and `cosmic:back-to-source`) for interoperability with the SPHEREx HTML prototype.
- **Routing Coexistence**: React Router operates within the `/xr` subpath (`arvr/`), avoiding route collisions with FastAPI or the HTML frontend.

---

## 12. Security and Deployment Risks
- **HTTPS Requirement**: WebXR and DeviceOrientation require secure HTTPS contexts (handled in dev via `@vitejs/plugin-basic-ssl`).
- **Manual Deploys**: Vercel deployments are manual without automated Git hooks (`arvr/HANDOFF.md`).

---

## 13. Known Technical Debt
- HMR in Vite can occasionally leave a stale WebXR store instance ("not connected to three.js").
- Approximate orientation of certain asteroid meshes (Bennu) requires ongoing validation against official OSIRIS-REx maps.

---

## 14. Prioritized Recommendations
1. **Connect FastAPI Endpoints**: Wire up the SPHEREx blink comparator and object detail panels to live FastAPI backend endpoints (`/api/spherex/observations`, `/api/objects/{object_id}`).
2. **Preload Optimization**: Implement aggressive lazy loading and KTX2 texture compression for mobile AR/VR asset delivery.
3. **Automated Smoke Testing**: Extend Playwright smoke tests (`smoke-xr.mjs`) to cover mobile device profiles and multilingual switching.

---

## 15. Summary of Exact File Locations
- **XR Root & State**: `src/xr/XRRoot.tsx`, `src/xr/xrStore.ts`, `src/xr/store.ts`
- **Quality Governor**: `src/xr/QualityGovernor.tsx`, `src/xr/quality.ts`
- **Localization**: `src/xr/i18n.ts`
- **Content Schemas**: `content/bodies/`, `content/sites/`
