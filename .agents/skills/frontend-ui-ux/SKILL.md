---
name: frontend-ui-ux
description: Expert guidelines and instructions for designing and implementing the SPHEREx Frontend, UX hierarchy, timeline controls, metadata inspector, and XR handoff.
---

# Skill: SPHEREx Frontend & UX Lead

## Mission

Design and implement the public-facing SPHEREx observation explorer. Your job is to turn complicated archive data into a clear, fast, trustworthy interface. You are not building a generic NASA landing page, a static image gallery, or an unrelated 3D universe.

Read `PLAN.md`, `AGENTS.md`, and `API_CONTRACT.md` before starting.

## 1. Product outcome

A first-time user should be able to:

1. choose a known target or enter RA/Dec;
2. understand which sky region and date range they queried;
3. browse available SPHEREx observations in chronological order;
4. compare at least two observation times using side-by-side or blink mode;
5. inspect the metadata and source of each image;
6. enter XR with the exact same observation state, if supported;
7. share a reproducible URL.

## 2. UX hierarchy

Use this hierarchy unless existing product evidence justifies a change:

1. **Sky image / observation viewer** — the main content.
2. **Time navigation** — make observation chronology obvious.
3. **Search context** — target name, RA/Dec, radius/FOV, date range.
4. **Comparison controls** — side-by-side, blink, selected epochs.
5. **Metadata inspector** — release, observation ID, timestamp, detector/band, wavelength, flags, source.
6. **XR launch** — a meaningful continuation of the same investigation.

Avoid making a dashboard full of charts the user cannot interpret before they have seen the image.

## 3. Recommended screen composition

### Explore screen

- Compact top navigation and project identity.
- Clear one-line explanation of the tool.
- Search area with sample-target shortcuts.
- Main viewer occupying the largest area.
- Timeline directly below or beside viewer, not buried in a separate route.
- Metadata inspector as a collapsible side panel/drawer.
- XR button contextual to the selected observation.

### Search form

- Support named presets before requiring coordinate entry.
- Accept decimal degrees first; optionally support sexagesimal input with explicit parsing feedback.
- Validate RA in `[0, 360)` degrees and Dec in `[-90, +90]` degrees.
- Display coordinate labels and units.
- Explain FOV/radius in plain language.
- Do not silently clamp invalid values; show a clear validation message.
- Preserve search state in the URL when possible.

### Timeline

Each item should show:
- actual observation date/time (UTC or explicitly labelled local rendering);
- release and detector/band if known;
- preview availability state;
- selected/unselected state.

Sort by observation time. Never sort by filename unless a backend contract explicitly guarantees chronological encoding.

### Comparison

MVP controls:
- select first/second observation;
- side-by-side view;
- blink play/pause;
- previous/next;
- playback speed;
- clear time-difference label.

Advanced controls should be disabled with an explanation unless the backend confirms valid aligned/normalized inputs.

### Metadata panel

Show only confirmed data. Good fields include:
- observation/product ID;
- observation midpoint in UTC;
- RA/Dec and footprint;
- release QR2/QR3;
- detector D1–D6;
- wavelength range in microns;
- image units;
- quality/contamination flag summary;
- original archive/product link.

Do not invent signal-to-noise, magnitude, confidence, or object classification if the API does not provide it.

## 4. Design direction

Aim for a calm scientific instrument rather than a sci-fi game HUD.

- Dark, high-contrast canvas is appropriate for astronomical imagery, but text and controls must remain easy to read.
- Use restrained accent colors for selected observation, warning, and candidate states.
- Do not use glow/neon effects on every element.
- Use consistent spacing, type scale, border radius, and focus states.
- Keep data labels compact but legible.
- Let the scientific image own the visual focus.
- Avoid decorative charts that imply data the backend does not provide.
- Make “live”, “cached”, “sample”, and “fallback” states visually distinct.

Do not assume a CSS framework or component library. Inspect the repository and use the existing stack.

## 5. Interaction and state model

Maintain a single canonical explorer state, conceptually:

```ts
type ExplorerState = {
  targetId?: string;
  targetName?: string;
  raDeg?: number;
  decDeg?: number;
  radiusDeg?: number;
  startDate?: string;
  endDate?: string;
  collection?: string;
  detector?: string;
  selectedObservationIds: string[];
  activeObservationId?: string;
  compareMode: "single" | "side-by-side" | "blink";
};