---
trigger: always_on
---

# SPHEREx Project Context

This workspace is for the SPHEREx NASA Space Apps Challenge project.

## Product Direction
Build a scientific exploration experience that helps users explore SPHEREx observations and understand their astronomical context.

The product has two connected experiences:
1. Scientific Explorer: observation discovery, image visualization, metadata, and temporal comparison.
2. XR Explorer: an immersive representation connected to the same scientific observation data.

## Science and Data Integrity
- Do not invent astronomical observations, coordinates, timestamps, or metadata.
- Clearly distinguish real NASA/archive data from mock or fixture data.
- Preserve data provenance whenever displaying scientific observations.
- Treat FITS data as scientific data, not as ordinary image files.
- Do not imply that a 2D astronomical image represents a physically accurate 3D volume.
- Label illustrative visualizations clearly.

## Engineering Rules
- Inspect the existing frontend, backend API contract, and XR implementation before changing them.
- Reuse existing components and architecture when reasonable.
- Do not replace existing working features without a technical reason.
- Keep frontend, API integration, and XR responsibilities clearly separated.
- Verify actual API responses instead of assuming the OpenAPI schema describes every payload.

## Collaboration
- Work only on the task assigned.
- Do not modify unrelated modules.
- Report assumptions, blockers, and dependencies.
- Do not claim that a feature works unless it has been tested.