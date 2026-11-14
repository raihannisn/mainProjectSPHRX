# PLAN.md — SPHEREx Cosmic Explorer

> **Project context / single source of truth for all AI agents**  
> Last reviewed: 2026-11-09  
> Challenge: NASA Space Apps Challenge 2026 — *Planet X and SPHEREx*  
> Existing deployments:  
> - Backend Swagger: https://nasa-spherex-backend.vercel.app/docs  
> - AR/VR prototype: https://nasa-arvr.vercel.app/xr

---

## 0. Mission in one paragraph

We are building a public-facing SPHEREx observation explorer that helps a non-specialist user inspect the **same patch of sky across multiple observation times**, compare the images, and investigate possible moving or variable sources. The product combines a scientifically grounded 2D observation workflow with an optional immersive AR/VR presentation layer. The main value is not “space-themed 3D”; it is making real astronomical observations easier to search, compare, interpret, and share.

**Product principle:** evidence first, immersion second. The XR experience must visualize the same real observation data as the web explorer, not become a disconnected 3D demo.

## 1. Challenge understanding

The challenge asks for a public-facing web tool that displays SPHEREx sky images and makes temporal changes easy to inspect. A user supplies a sky position using **Right Ascension (RA)** and **Declination (Dec)**. The application retrieves a sequence of observations covering that area and presents them in time order, so the user can inspect movement or brightness changes.

The challenge's named test targets are:

- Barnard's Star
- Epsilon Indi B
- WISE 0855−0714
- RW Aurigae
- R Draconis

The challenge brief gives WISE 0855 coordinates as RA `08h55m10.831s`, Dec `−07°14′42.53″` (approximately RA `133.79513°`, Dec `−7.24515°`). Keep the original sexagesimal values in scientific references; use decimal degrees for API requests if required.

### 1.1 The scientific user journey

1. **Choose a target or enter coordinates.** The user selects a sample target or enters RA/Dec for a patch of sky.
2. **Define the search region.** The user chooses a field of view/radius and, where available, a time range and data release.
3. **Find available observations.** The system queries the SPHEREx archive and returns observations that cover the requested sky region.
4. **Build a chronological sequence.** Sort observations by their observation midpoint/time, not by filename or an arbitrary T1/T2 label.
5. **Inspect each observation.** Render a preview and expose its timestamp, detector/band, observation ID, release, and quality context.
6. **Compare time.** Provide side-by-side comparison and blink playback. Difference/addition views are advanced features that require compatible, aligned data.
7. **Investigate a source.** Show the selected target's reference position and catalog context separately from any measured position in an image.
8. **Explore in XR.** Open the selected observation or comparison in the existing XR experience, preserving the same target, epoch, band, and provenance.
9. **Share the investigation.** Encode the search state in a URL so another person can reproduce the view.

### 1.2 What a change in an image does and does not mean

A changed pixel or shifted point of light is a **candidate signal**, not automatically a confirmed moving object, discovery, or Planet X. It can be caused by source motion, brightness variability, noise, image registration differences, detector artifacts, saturation, contamination, or other processing effects.

Two observations can suggest a change; they do not by themselves establish a trajectory or orbit. UI language must use terms such as `candidate`, `possible motion`, `observed change`, and `needs verification`. Never label an object `Planet X`, `new planet`, or `confirmed discovery` without an independently supported scientific result.

## 2. SPHEREx data model and terminology

### 2.1 Mission facts used by this project

- SPHEREx is a NASA infrared all-sky survey mission.
- Its spectral coverage is approximately **0.75–5.0 microns**.
- NASA describes the survey in terms of **102 infrared wavelengths / spectral bands** across the sky.
- IRSA's instrument/archive documentation also describes **six detector bands**, D1–D6, each covering a wavelength interval. These terms refer to different levels of the instrument/data representation and must not be casually conflated in UI copy.
- The survey revisits sky regions over time; the repeated observations are what make temporal comparison useful.
- As of this plan's review date, IRSA has begun distributing **Quick Release 3 (QR3)** in September 2026. QR2 remains available. QR1 was retired in February 2026.

### 2.2 Release policy

- Prefer QR3 for newly retrieved data when compatible with the target/search.
- Permit QR2 where useful for comparison, compatibility, or broader historical coverage.
- Store/display the exact release and processing metadata with every observation.
- Never hard-code the assumption that QR3 is the final or only release. New data products are released over time.
- If the backend only has a static QR2/QR3 sample, say so visibly rather than calling it live all-sky search.

### 2.3 Important instrument caveat

SPHEREx uses a linear variable filter. Full wavelength coverage at a sky position is accumulated over time; the detector arrays do not all image the exact same sky patch at the same instant. IRSA documents six detector bands and paired simultaneous observations (D1/D4, D2/D5, D3/D6) for the same sky region. Therefore:

- Do not create RGB composites by blindly combining any three detector bands.
- Do not imply all 102 wavelength samples were captured simultaneously at one sky position.
- Label detector band, wavelength interval, observation time, and release when those values are available.
- A “spectrum” view must be based on valid wavelength/flux association and real measurements, not an aesthetic color gradient.

### 2.4 SPHEREx product format

IRSA distributes calibrated spectral images as multi-extension FITS (MEF) products. Depending on release/product, useful extensions include:

- `IMAGE`: calibrated per-pixel flux / surface brightness (commonly MJy/sr).
- `FLAGS`: pixel-level quality and contamination/status flags.
- `VARIANCE`: per-pixel uncertainty estimate.
- `PSF`: point-spread-function information.
- Other product-specific extensions or metadata may be present.

FITS is not a normal browser image format. The backend should expose a browser-ready preview/cutout (PNG, WebP, or a supported tiled format) plus metadata, while keeping access to the original FITS product and provenance where practical.

## 3. NASA data source: what to use

### 3.1 Primary source: NASA/IPAC IRSA SPHEREx archive

The primary source for this challenge is **IRSA (NASA/IPAC Infrared Science Archive)**, not the generic NASA APOD API.

Useful official services:

- IRSA SPHEREx overview: https://irsa.ipac.caltech.edu/Missions/spherex.html
- SPHEREx Quick Release overview: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html
- SPHEREx archive data access: https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/
- Generic SIA2 endpoint: `https://irsa.ipac.caltech.edu/SIA?`

Relevant SIA2 collections:

- `spherex_qr3`: QR3 Wide Survey
- `spherex_qr3_deep`: QR3 Deep Survey
- `spherex_qr2`: QR2 Wide Survey
- `spherex_qr2_deep`: QR2 Deep Survey

SIA2 can search SPHEREx image products based on sky position, time, band, ID, and instrument. Results include data access URLs such as `access_url`; cloud-hosted access information may also be present. The backend should query/parse this service and return a normalized JSON contract to the frontend.

An example shape of an IRSA SIA2 query is conceptually:

```text
GET https://irsa.ipac.caltech.edu/SIA
  ?COLLECTION=spherex_qr3
  &POS=circle <ra_deg> <dec_deg> <radius_deg>
```

This is a conceptual example from the archive documentation, not the contract of our deployed backend.

### 3.2 Other services: optional enrichment only

- **JPL Horizons**: useful for ephemerides/predicted positions of known solar-system objects, if the team implements a real ephemeris workflow.
- **JPL Small-Body Database (SBDB)**: useful for known asteroid/comet properties and orbit elements.
- **WISE/AllWISE or Gaia catalogs**: optional reference overlays/cross-identification, with catalog epoch and astrometric uncertainty shown.
- **IRSA MOST (Moving Object Search Tool)**: an existing archive tool that can compute object ephemerides and find IRSA images covering predicted positions. Treat it as a reference/integration option, not as an endpoint already implemented by our backend.

### 3.3 APIs that are not the primary SPHEREx image source

- NASA APOD gives an Astronomy Picture of the Day, not a coordinate/time search of SPHEREx observations.
- NASA NeoWs gives Near-Earth Object feed data, not SPHEREx spectral image cutouts or repeat visits.

These can be supplementary educational/context modules, but they must not be presented as the underlying SPHEREx observation dataset.

## 4. Existing project assets and verified state

### 4.1 Backend deployment

Base URL: `https://nasa-spherex-backend.vercel.app`

OpenAPI supplied by the project owner:

- OpenAPI version: `3.1.0`
- API title: `SPHEREx Cosmic Explorer API`
- API version: `1.1.0`

Documented routes:

| Method | Route | Documented purpose | Current limitation from supplied OpenAPI |
|---|---|---|---|
| GET | `/api/image/t1` | Get image T1 | No query parameters; response schema unspecified |
| GET | `/api/image/t2` | Get image T2 | No query parameters; response schema unspecified |
| GET | `/api/metadata/fits` | Get FITS metadata | Response schema unspecified |
| GET | `/api/objects/{object_id}` | Get object information | Only path parameter documented; source and response shape unspecified |
| GET | `/api/nasa/apod` | NASA APOD; description says static/dummy JSON may be returned if upstream fails | Must identify live-vs-fallback status |
| GET | `/api/nasa/neows` | Normalized NASA NeoWs feed | Supporting data, not SPHEREx image search |
| GET | `/api/status` | Service status | Response schema unspecified |
| GET | `/` | Root | System route |
| GET | `/mission-control` | Mission Control & API Test Bench page | HTML page, not an application data endpoint |

**Critical API gap:** the supplied OpenAPI does not expose RA, Dec, radius/FOV, start/end date, collection/release, detector, band, or pagination parameters for the image endpoints. It therefore does not yet prove that the app can search the SPHEREx archive for arbitrary sky coordinates or build a real observation timeline. The fixed T1/T2 endpoints may be a demo/sample workflow; confirm what they actually return.

The supplied schemas use `{}` for successful JSON responses. This means field names and payload structure cannot safely be inferred. Do not invent fields in frontend code.

### 4.2 AR/VR deployment

Current route: `https://nasa-arvr.vercel.app/xr`

The live route was supplied for inspection, but automated page extraction did not expose readable UI/source content. Therefore this plan intentionally does **not** claim to have verified its framework, components, interaction model, device support, or exact visual design.

Every agent working on XR must first inspect the actual project source and current deployed behavior. Preserve the working scaffold and extend it; do not rebuild the app based solely on the URL or assumptions.

### 4.3 What is verified vs. what still needs evidence

**Verified from supplied OpenAPI:** the route names and short endpoint descriptions above.  
**Verified from IRSA documentation:** archive source, data collections, SIA2 search capability, QR3 availability, FITS product format and broad scientific caveats.  
**Not yet verified:** live JSON payloads returned by our backend, whether T1 and T2 are real SPHEREx files, whether both images cover the same sky coordinates, the observation timestamps/releases/detectors, frontend framework, XR browser/device compatibility, and existing state management.

## 5. Product positioning and UX goal

Working product descriptor: **SPHEREx Cosmic Explorer**.

One-line value proposition:

> Explore the same region of the infrared sky across real SPHEREx observations, compare how it changes over time, and investigate the evidence through an accessible web and immersive experience.

### 5.1 Primary user types

1. **Curious public / student:** wants to explore a target without knowing FITS, RA/Dec conventions, or astronomy jargon.
2. **Citizen-science explorer:** wants to inspect repeated observations and identify possible changes.
3. **Educator / presenter:** wants a reproducible visual story and a shareable target view.
4. **Technical astronomy user:** wants timestamps, detector/band, coordinates, data-release details, flags, uncertainty context, and raw-product links.

### 5.2 UX rules

- Put the sky image and temporal comparison at the center of the experience.
- Let users start from a named sample target before asking them to understand RA/Dec.
- Keep advanced parameters available without making the first screen look like a control-room cockpit designed by someone who discovered gradients yesterday.
- Explain units inline: degrees, microns, UTC, MJy/sr, etc.
- Make the observation date/time impossible to miss.
- Distinguish **catalog/reference position** from **measured or predicted position**.
- Show data source, release, detector/band, observation ID, and quality state near the image or in an inspectable details panel.
- Provide empty, loading, partial, error, offline, and no-results states.
- Do not hide scientific caveats in a tiny footer.
- Provide a 2D fallback when WebXR is unavailable or permission is denied.

## 6. Proposed application information architecture

This is a recommended product structure, not a statement about the current routes already implemented.

### A. Explore / Home

- concise product explanation and “how it works” visual
- target search/autocomplete
- sample target shortcuts
- coordinate input (RA/Dec)
- optional FOV/radius and date filters
- current data-release indicator
- link to methodology/data provenance

### B. Observation Explorer

- main image viewer
- observation timeline/gallery sorted by UTC time
- previous/next observation controls
- play/pause blink mode and playback speed
- detector/band or wavelength selector where the data supports it
- FOV/zoom controls
- metadata inspector
- quality/flag overlay toggle when flag data are available

### C. Compare

MVP:
- side-by-side T1/T2 (or selected observations)
- synchronized zoom/pan if practical
- blink playback
- time delta label

Advanced, only when backend/data preparation supports it:
- aligned difference image
- normalized stack/addition
- source marker overlay
- spectral plot

### D. Object / Target Inspector

- target designation and type, when verified
- reference RA/Dec and reference epoch
- observation-specific time and image coordinates
- catalog source and cross-match status
- proper motion/ephemeris information only when sourced
- candidate status and confidence/limitations

### E. XR Explorer

- launch from a selected observation or comparison, not as a disconnected home screen
- show the image as a scientifically faithful sky-plane/spherical-sky presentation
- preserve target, timestamp, detector/band, and data source
- allow selection/inspection of a source marker
- show labels, scale, orientation, and coordinate conventions
- include a persistent “2D view” escape route

**Important:** a FITS sky image is a projection of observed light, not a 3D model of the universe. Do not turn pixels into real spatial distances or claim a measured orbit in VR. Any decorative depth, star field, or object model must be labelled illustrative/not to scale unless it is derived from real coordinates and a defined projection.

### F. About / Methodology

- what SPHEREx measures
- how repeated observations work
- how to interpret infrared images
- limitations of candidate identification
- sources, release IDs, data citations, acknowledgement

## 7. Frontend and backend architecture boundaries

### 7.1 Frontend responsibilities

- user inputs and validation
- route state / shareable URL state
- rendering previews and metadata
- timeline, blink, side-by-side comparison
- loading/error/empty states
- accessibility and responsive behavior
- XR entry point and graceful fallback
- no direct parsing of large raw FITS files unless deliberately benchmarked and approved

### 7.2 Backend responsibilities

- proxy and query IRSA SIA2 or an approved archive access layer
- normalize archive responses into stable JSON
- resolve and retrieve FITS products
- generate small browser-ready previews/cutouts
- parse metadata and expose timestamps, release, detector/band, coordinates, and product IDs
- preserve provenance and upstream errors
- optionally produce aligned comparisons/difference products after scientific validation
- cache expensive archive queries and image previews

### 7.3 Suggested normalized observation object

The following is a **proposed frontend-facing model**, not a claim that the deployed backend already returns it:

```ts
type SpherexObservation = {
  observationId: string;
  productId?: string;
  observedAtUtc: string;       // ISO-8601 UTC
  mjd?: number;
  dataRelease: "QR2" | "QR3" | string;
  detector?: "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | string;
  wavelengthMinUm?: number;
  wavelengthMaxUm?: number;
  previewUrl: string;
  fitsUrl?: string;
  metadataUrl?: string;
  centerRaDeg?: number;
  centerDecDeg?: number;
  fieldOfViewDeg?: number;
  qualitySummary?: string;
  flagsAvailable: boolean;
  sourceArchive: "IRSA" | string;
  retrievedAtUtc?: string;
};
```

Frontend must adapt this model only after the backend owner confirms the contract and example payload. Keep a mapper/adapter at the API boundary rather than spreading backend field names throughout UI components.

### 7.4 Proposed missing search endpoint

If no current endpoint supports coordinate-based archive search, propose a backend route such as:

```http
GET /api/spherex/observations
  ?ra=133.79513
  &dec=-7.24515
  &radius=0.05
  &collection=spherex_qr3
  &start_date=2025-01-01
  &end_date=2026-11-09
  &detector=D1
```

Recommended response:

```json
{
  "query": {
    "ra": 133.79513,
    "dec": -7.24515,
    "radius": 0.05,
    "collection": "spherex_qr3"
  },
  "source": "IRSA SIA2",
  "retrieved_at": "2026-11-09T00:00:00Z",
  "observations": []
}
```

The empty `observations` array above is a schema illustration, not live data. Backend team must finalize naming, error shape, pagination, result limits, and validation.

Potential supporting endpoints, if needed:

- `GET /api/spherex/observations/{observation_id}`: normalized metadata.
- `GET /api/spherex/observations/{observation_id}/preview`: cutout/preview image.
- `POST /api/spherex/compare`: comparison product from two or more compatible observation IDs.
- `GET /api/targets`: curated challenge targets and their reference metadata.

Do not demand all these endpoints if existing routes already satisfy the same requirement. Confirm behavior first; keep backend changes minimal.

## 8. MVP scope and priorities

### P0 — required for a credible challenge submission

1. Clear public-facing explanation of the SPHEREx temporal observation problem.
2. At least one real SPHEREx example target/sky patch with source provenance.
3. Two or more genuine observations of the **same sky area**, with actual observation timestamps.
4. Chronological timeline.
5. Side-by-side and blink comparison.
6. Visible metadata for each frame.
7. Responsive 2D experience with clear loading/error states.
8. A working link into the existing XR experience using the same selected dataset, or a clearly labelled XR prototype if data handoff is not ready.
9. Source citations and scientific caveats.

### P1 — high-value if time allows

- target presets for all five challenge examples
- arbitrary RA/Dec search
- selectable field of view
- QR2/QR3 collection selection
- detector/band filters
- contamination/quality flag visualization
- URL-based sharing/deep links
- image difference view, only after registration/normalization is validated

### P2 — stretch goals

- spectral plot / on-the-fly spectrum
- multi-epoch image stacking
- Gaia/WISE overlay with epoch-aware matching
- candidate-source annotations and review workflow
- XR source inspection and synchronized multi-epoch transition
- export/share of a reproducible observation set

Do not sacrifice P0 reliability for P2 visual spectacle.

## 9. Work plan and ownership

| Workstream | Primary owner | Agent role | Deliverable |
|---|---|---|---|
| Product + UX direction | Project owner / frontend lead | Product UX agent | Flows, screen hierarchy, design decisions |
| Frontend implementation | Frontend lead | Frontend engineer agent | Explorer, timeline, comparison, responsive states |
| API integration | Backend owner + integration agent | API contract agent | Confirmed payloads, adapter, integration tests |
| Science/data validation | Science/data teammate | Scientific reviewer agent | Target references, metadata semantics, caveats |
| AR/VR | XR teammate | XR integration agent | Reuse current scaffold, consume same selected data |
| Quality review | Shared | QA / skeptical reviewer | Acceptance checklist and bug list |

### Recommended execution sequence

**Phase 0 — Contract verification**
- Call every deployed backend route and save sanitized sample responses.
- Verify T1/T2 provenance: actual source files, observation IDs, observation dates, same sky patch, release, detector/band.
- Inspect existing frontend and XR source; record framework, route map, state flow, and device support.
- Decide whether coordinate search exists or is a backend gap.

**Phase 1 — UX skeleton**
- Map the user journey and page states.
- Build the explorer shell using mock data only for layout development; mark fixtures clearly.
- Establish one observation data model and URL query-state model.

**Phase 2 — Real data integration**
- Connect confirmed endpoints through a single API service/adapter.
- Render genuine previews and timestamps.
- Implement timeline, side-by-side, and blink.

**Phase 3 — XR data handoff**
- Pass the selected observation/target state into `/xr` through a typed route/query contract or shared application state.
- Keep 2D fallback and show the observation provenance in XR.

**Phase 4 — Validation and polish**
- Test the named target examples.
- Validate coordinate input, time ordering, missing epochs, image failures, and no-result cases.
- Run desktop/mobile checks and supported XR device checks.
- Prepare a concise demo narrative backed by real data.

## 10. Definition of Done

A feature is not done merely because it renders once on the developer's laptop. It is done when:

- it uses the confirmed API contract or is visibly labelled as a fixture;
- the user can understand what data they are seeing and when it was observed;
- the UI has loading, empty, error, and partial-result states;
- it works at common desktop and mobile widths;
- keyboard focus and readable contrast are preserved;
- no false scientific claim is made;
- links/URL state reproduce the selected target and observation parameters;
- integration errors are surfaced in a useful way;
- a reviewer can trace an image back to its data source/product ID.

## 11. Risks and explicit open questions

| Risk / unknown | Why it matters | Required resolution |
|---|---|---|
| T1/T2 are fixed endpoints | May only support a static demo, not the challenge's coordinate search | Confirm real source files and whether arbitrary positions can be queried |
| Response JSON schemas are empty in OpenAPI | Frontend field names cannot be inferred | Capture actual sample payloads and publish response models |
| FITS is not browser-native | The image viewer needs a preview/cutout pipeline | Confirm backend preview format, dimensions, URL lifetime, and caching |
| QR3 and QR2 coexist | Release metadata affects reproducibility | Carry release identifiers through API and UI |
| Image epochs may not align | False motion signals can appear | Confirm WCS registration and compatible detector/band before difference imaging |
| XR deployment cannot be inspected from crawler output | Existing behavior and framework are unknown | Inspect code/repo or provide screenshots/video for human review |
| WebXR/device/browser support varies | XR may not work on every judge's device | Provide 2D fallback and a tested device matrix |
| Candidate vs confirmed source ambiguity | Overstated results undermine scientific credibility | Use cautious labels and explain limitations |

### Critical questions for the team to resolve internally

1. What exactly does `/api/image/t1` and `/api/image/t2` return: direct image URL, base64, binary, metadata JSON, or something else?
2. Are T1 and T2 real SPHEREx products? What are their observation IDs, dates, sky centers, detector bands, and releases?
3. Do T1 and T2 cover the same sky patch and are they image-registered?
4. Does `/api/metadata/fits` return header metadata only, or parsed image/quality information too?
5. What catalog/source powers `/api/objects/{object_id}`?
6. Does the deployed XR route already accept an observation ID or image URL, or is its data currently hard-coded?
7. Who owns the canonical typed API schema and where is it versioned?

Until these questions are answered, frontend agents must not claim full coordinate-driven SPHEREx search is complete.

## 12. Agent coordination protocol

- `AGENTS.md` is the global operating contract. Every agent reads it before changing code.
- This `PLAN.md` is the product/science source of truth.
- `API_CONTRACT.md` is the integration source of truth; update it when backend payloads are confirmed.
- `docs/DECISIONS.md` records decisions that affect multiple workstreams.
- `skills/frontend-ui-ux/SKILL.md` governs the frontend/UX workstream.
- Agents must inspect existing code before proposing rewrites.
- One agent owns one bounded task at a time. Avoid simultaneous edits to the same files.
- Each agent reports: files changed, behavior added, API fields used, assumptions, tests run, unresolved risks.
- If an assumption is unverified, label it `ASSUMPTION` and do not silently promote it to fact.
- Any change to scientific interpretation, API contract, route structure, or XR handoff must be recorded in `docs/DECISIONS.md`.
- Do not commit secrets, API keys, or private tokens. Do not put NASA credentials in frontend code.

## 13. Demo story

A judge should be able to understand the project within roughly one minute:

1. Start with a known test target such as WISE 0855.
2. Show the sky coordinates and explain that the application searches real SPHEREx observations around that position.
3. Show the observation timeline and actual dates.
4. Blink between two epochs to make the apparent change visible.
5. Open the metadata panel to prove these are real, traceable archive products.
6. Explain that a change is a candidate requiring verification, not an automatic discovery.
7. Transition into XR using the same observation state, then return to 2D.

The strongest demonstration is a scientifically honest workflow that functions end-to-end, not the largest number of animated stars.

## 14. Sources and references

Use these as the primary reference set. The official challenge portal remains authoritative; the local mirror below reproduces the challenge statement and considerations and explicitly points back to the official portal.

1. NASA Space Apps 2026 challenge portal: https://www.spaceappschallenge.org/2026/challenges/planet-x-and-spherex
2. Challenge statement mirror (includes objectives and considerations): https://hackathlone.com/challenges/planet-x-and-spherex
3. NASA SPHEREx mission: https://science.nasa.gov/mission/spherex/
4. NASA SPHEREx by the numbers: https://science.nasa.gov/blogs/spherex/2025/03/11/nasas-spherex-by-the-numbers/
5. IRSA SPHEREx mission/archive landing page: https://irsa.ipac.caltech.edu/Missions/spherex.html
6. IRSA SPHEREx Quick Release overview: https://irsa.ipac.caltech.edu/data/SPHEREx/docs/overview_qr.html
7. Caltech/IPAC IRSA SPHEREx archive data access (SIA2, collections, cutouts): https://caltech-ipac.github.io/spherex-archive-documentation/spherex-data-access/
8. IRSA SPHEREx Data Explorer overview: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/overview.html
9. IRSA SPHEREx Moving Object Search Tool (MOST): https://irsa.ipac.caltech.edu/applications/MOST/instructions.html
10. IRSA SPHEREx spectral photometry input/products: https://irsa.ipac.caltech.edu/onlinehelp/spherex/spherex/sp.html

---

**Non-negotiable:** build an observation explorer first. XR is the differentiating presentation layer, not a substitute for coordinate search, time comparison, metadata, and scientific provenance.
