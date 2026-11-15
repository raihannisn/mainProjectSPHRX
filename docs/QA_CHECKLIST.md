# QA_CHECKLIST.md — Release readiness

## Scientific data
- [ ] At least two observations belong to the same sky region.
- [ ] Actual observation timestamps are displayed and sorted chronologically.
- [ ] Every image has a traceable archive/product or observation ID.
- [ ] QR release and detector/band are displayed when known.
- [ ] Reference/catalog position is distinguished from measured/predicted position.
- [ ] No unverified source is labelled as a confirmed discovery or Planet X.
- [ ] No arbitrary detector bands are merged into misleading RGB composites.
- [ ] Difference/stacking mode is only enabled after image alignment and normalization are validated.

## API
- [ ] Success payloads match `API_CONTRACT.md`.
- [ ] No-results response is handled.
- [ ] Timeout/upstream failure is handled.
- [ ] Partial metadata is handled.
- [ ] APOD fallback/dummy data cannot appear as live SPHEREx imagery.
- [ ] No secrets or API keys are bundled in frontend assets.

## UX
- [ ] A new user can start from a named sample target.
- [ ] RA/Dec validation is clear.
- [ ] Search context remains visible.
- [ ] Timeline labels show actual UTC observation times.
- [ ] Side-by-side and blink controls are discoverable and keyboard accessible.
- [ ] Loading, empty, error, partial, stale, and missing-preview states exist.
- [ ] URL can reproduce the search and selected observation state.

## XR
- [ ] XR opens the selected observation, not a hard-coded unrelated scene.
- [ ] Timestamp and provenance remain available in XR.
- [ ] XR unsupported/denied case has a useful fallback.
- [ ] User can return to 2D explorer.
- [ ] Decorative 3D content is labelled illustrative/not to scale where relevant.

## Quality
- [ ] Desktop layout checked.
- [ ] Mobile layout checked.
- [ ] Keyboard navigation checked.
- [ ] Focus and contrast checked.
- [ ] Reduced-motion behavior checked.
- [ ] Demo tested on the exact deployed build.
