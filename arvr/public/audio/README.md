# Wormhole ambience audio

- File: `wormhole-ambience.mp3` (copied on 15 Nov 2026 from the local source the team supplied; the source file itself was not modified).
- Source label supplied with the file: "Hans Zimmer (Interstellar Main Theme) - Space 4k - no copyright Interstaller inspired Music".
- The repository owner stated that permission for this track was verified before it was added here.
- Used only by the XR wormhole transition (`src/frontend/components/WormholeOverlay.tsx`): low volume (0.28), fade-in/out tied to the overlay lifecycle, autoplay-policy safe, toggle persisted at `localStorage['spherex.wormhole.ambience']`, and it never plays for Explorer/Comparison data requests.

To swap the track, replace this MP3 at the same path — no code change is needed. Keep the licence/attribution note accurate for whatever file is used.
