# AI Agent and XR Object Voice Integration

**Status:** Implemented; generated-audio and browser-fallback paths locally verified

**Last source/build verification:** 2026-11-16

**Branch at verification:** `integrasi`  

**Deployment:** Not performed

This note documents how an orbit object selection reaches the backend catalog,
Mission Agent, and Gemini text-to-speech (TTS), and how to diagnose failures.

## End-to-end flow

1. Selecting a body in the Solar System hub invokes `selectBody`. The orbit
   object's click handler also unlocks Web Audio playback for the user gesture.
2. [`XRRoot.tsx`](../arvr/src/xr/XRRoot.tsx) renders
   [`BodyExplorer.tsx`](../arvr/src/xr/BodyExplorer.tsx) for the selected body.
   The explorer loads sourced local content from `arvr/content/bodies/<id>.json`
   and passes the title, type, and description to the object panel. Every
   selectable ID in `bodies.ts` must have a matching content file; build-time
   `check:content` enforces coverage, both language descriptions, and sources.
3. [`CatalogObjectCard3D.tsx`](../arvr/src/xr/CatalogObjectCard3D.tsx) requests
   `GET /api/objects/{object_id}`. When a catalog record is available, it asks
   `POST /api/agent/chat` for a short record-grounded summary.
4. The panel sends the summary to `POST /api/agent/voiceover/text`. When no
   summary is available, it uses the bundled English object description.
   Catalog 404/unavailability does not block the local overview or narration.
5. The backend returns WAV audio. [`agentSpeech.ts`](../arvr/src/xr/agentSpeech.ts)
   decodes and plays it with Web Audio. If the TTS request or playback fails,
   [`browserVoice.ts`](../arvr/src/xr/browserVoice.ts) uses browser speech and
   the UI labels the engine and error. If local narration text is also absent,
   the UI reports that narration is unavailable. Both speech engines currently
   speak English; the interface may display Indonesian text and transcribe
   Indonesian microphone input.

Bundled descriptions and sources cover every selectable Solar System hub body
(Sun, Mercury, Venus, Earth, Moon, Bennu, Mars, Jupiter, Saturn, Uranus, and
Neptune). A body may have zero hotspots: this means no hotspot content is
mapped, not that its overview description or narration is missing. The API
client uses same-origin `/api/*` URLs by default so Vite can proxy requests to
FastAPI during development and the root Vercel service can route them to its
API service in production. Set `VITE_API_BASE_URL` only when the XR app is
deployed separately from an API that provides the required Agent routes.

## API contract

| Endpoint | Use | Request / response |
|---|---|---|
| `GET /api/status` | Check backend readiness | JSON status |
| `GET /api/objects/{object_id}` | Load catalog record | JSON object record, e.g. `mars` |
| `POST /api/agent/chat` | Generate object summary | Optional `objectId`; `lang` accepts `id`/`en` but generation is currently English-only; 1–10 messages with the last from `user`; JSON response with `data.message` and `data.sources` |
| `POST /api/agent/voiceover/text` | Synthesize narration | Nonblank English text up to 500 characters; preset `mission-liaison` or `warm-guide`; response is `audio/wav` |

Cosmic Guide treats the selected object as context, not a whitelist. It can
answer general astronomy questions about another recognizable body even when
that body is absent from the backend catalog; common localized names such as
Indonesian “Neptunus” should resolve to Neptune. The catalog is for
application-specific records and verified SPHEREx claims, not a prerequisite
for ordinary planetary facts.

The speech route is implemented in
[`routes/agent.py`](../backend/routes/agent.py). It calls
[`voiceover_service.py`](../backend/services/voiceover_service.py), which
passes the text to [`gemini_tts_provider.py`](../backend/services/gemini_tts_provider.py).
The provider reads `GEMINI_API_KEY` from the backend environment; do not put the
key in browser code, documentation, logs, or Git.

Chat and TTS share an in-memory limit of 20 requests per client IP per 60
seconds. Gemini can apply independent usage limits. A provider quota response
is not a missing-content error: local body descriptions remain available, and
the frontend attempts labeled browser speech. This limiter is per process and
is not a distributed production quota guarantee.

## Local development

Run the backend and AR/VR app in separate terminals:

```powershell
# Terminal 1
Set-Location "C:\path\to\mainProjectSPHRX\backend"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
# Terminal 2
Set-Location "C:\path\to\mainProjectSPHRX\arvr"
npm run dev
```

The Vite development server listens on port `5173` and proxies `/api/*` to
`http://127.0.0.1:8000` as configured in
[`vite.config.ts`](../arvr/vite.config.ts). For headset testing over a LAN,
open the Vite host address from the headset; do not configure the browser to
call the headset's own `127.0.0.1`.

Set `GEMINI_API_KEY` in the backend process environment before starting Uvicorn.
To check whether it is present without displaying its value:

```powershell
if ($env:GEMINI_API_KEY) { "GEMINI_API_KEY is set" } else { "GEMINI_API_KEY is not set" }
```

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| `/api/status` cannot connect, or browser shows HTTP 500 for `/api/*` | FastAPI is stopped, or the Vite proxy cannot reach port `8000` | Start Uvicorn and retry. A Vite proxy error is not by itself evidence that Gemini TTS is broken. |
| Catalog panel says live data is unavailable | The catalog request failed or the object has no backend record | Confirm `/api/objects/mars` returns HTTP 200. Bundled Mars details remain visible when the live catalog is unavailable. |
| Body shows “no hotspot content” | No surface/site hotspots are mapped for that body | This is independent of its overview. Confirm the body's JSON description and source; do not invent hotspots to silence the empty state. |
| TTS returns HTTP 503 mentioning `GEMINI_API_KEY` | The key is absent from the environment of the running backend process | Set the key in that process's environment and restart Uvicorn. Never paste the key into the browser or a ticket. |
| TTS returns HTTP 429 and the panel says browser voice is being used | Agent's 20-per-minute process-local limit or Gemini usage limit | Read the user-safe error text, wait before retrying, and avoid repeated reloads. A 429 does not imply missing body data; browser speech is an explicitly labeled fallback. |
| TTS returns HTTP 502 | Provider rejected the request, returned an invalid response, or failed upstream | Inspect sanitized backend logs for the provider status. Do not log request headers or key values. |
| TTS returns HTTP 504 | Gemini request timed out | Retry later; local text remains available and browser speech should be used by the UI. |
| TTS request returns HTTP 200 but there is no audible output | Browser audio policy, muted tab/device, or output-device selection | Select an orbit object from the app to provide a user gesture, check volume/output, then use **Replay AI Voice** in the object panel. |

The backend's chat and TTS routes share the Agent rate limiter. Repeated page
reloads can consume the available requests.

## Verification record

Verified on 2026-11-15 in the local development setup:

- `GET /api/objects/mars` returned HTTP 200 with the Mars record.
- `POST /api/agent/chat` returned HTTP 200.
- The browser's proxied `POST /api/agent/voiceover/text` returned HTTP 200 with
  an audio response of approximately 841 KB.
- The object panel reached its **Replay AI Voice** state after playback.
- `npm run build` passed, including `check:content` (54 hotspots).
- Backend `python -m unittest discover -s tests -v`: 43 tests passed.

The backend was initially stopped during diagnosis. Starting it resolved the
proxy failures; the live Gemini TTS request then succeeded. These checks were
local and do not certify a production deployment or every browser/headset audio
configuration.

On 2026-11-16, `npm run build` passed, including content coverage (54 hotspots),
TypeScript checking, and Vite production bundling. Existing mixed dynamic/static
import warnings for `store.ts` and `loading.ts` remain non-blocking.

In the later Neptune runtime check, `/api/objects/neptune` returned 404 because
the backend has no Neptune catalog record. The bundled Neptune description and
NASA source still appeared. Gemini TTS returned 429 because the configured
provider usage limit was reached; the panel identified the browser-voice
fallback and exposed replay. This confirms that catalog coverage and TTS quota
are separate from local body-content coverage. Provider quotas can change and
must not be treated as a permanent fixed limit.

## Files to maintain

- Frontend request and response parsing: [`api.ts`](../arvr/src/frontend/api.ts)
- Orbit selection and audio unlock: [`SolarSystemHub.tsx`](../arvr/src/xr/SolarSystemHub.tsx)
- Body context, local description, and coverage guard: [`BodyExplorer.tsx`](../arvr/src/xr/BodyExplorer.tsx), [`types.ts`](../arvr/src/xr/types.ts), [`bodies.ts`](../arvr/src/xr/bodies.ts), `arvr/content/bodies/*.json`, and [`check-content.mjs`](../arvr/scripts/check-content.mjs)
- Object panel, Agent summary, and auto TTS: [`CatalogObjectCard3D.tsx`](../arvr/src/xr/CatalogObjectCard3D.tsx)
- Audio decoding and playback lifecycle: [`agentSpeech.ts`](../arvr/src/xr/agentSpeech.ts)
- FastAPI routes and Gemini integration: [`routes/agent.py`](../backend/routes/agent.py), [`voiceover_service.py`](../backend/services/voiceover_service.py), and [`gemini_tts_provider.py`](../backend/services/gemini_tts_provider.py)
