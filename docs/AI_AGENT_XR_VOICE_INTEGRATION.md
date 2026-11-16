# AI Agent and XR Object Voice Integration

**Status:** Implemented; local end-to-end voice path verified  
**Last verified:** 2026-11-15  
**Branch at verification:** `integrasi`  
**Deployment:** Not performed

This note documents how an orbit object selection reaches the backend catalog,
Mission Agent, and Gemini text-to-speech (TTS), and how to diagnose failures.

## End-to-end flow

1. Selecting a body in the Solar System hub invokes `selectBody`. The orbit
   object's click handler also unlocks Web Audio playback for the user gesture.
2. [`XRRoot.tsx`](../arvr/src/xr/XRRoot.tsx) renders
   [`BodyExplorer.tsx`](../arvr/src/xr/BodyExplorer.tsx) for the selected body.
   The explorer loads local content from `arvr/content/bodies/<id>.json` and
   passes the title, type, and localized description to the object panel.
3. [`CatalogObjectCard3D.tsx`](../arvr/src/xr/CatalogObjectCard3D.tsx) requests
   `GET /api/objects/{object_id}`. When a catalog record is available, it asks
   `POST /api/agent/chat` for a short record-grounded summary.
4. The panel sends the summary to `POST /api/agent/voiceover/text`. When no
   summary is available, it uses the bundled English object description, if present.
5. The backend returns WAV audio. [`agentSpeech.ts`](../arvr/src/xr/agentSpeech.ts)
   decodes and plays it with Web Audio. After playback, the panel offers a
   replay action. Spoken AI responses and browser-voice fallbacks are always
   English; the interface can still display Indonesian and transcribe Indonesian
   microphone input.

For Mars, the bundled English and Indonesian descriptions live in
[`mars.json`](../arvr/content/bodies/mars.json). The development API client uses
relative `/api/*` URLs by default so Vite can proxy requests to FastAPI; an
explicit `VITE_API_BASE_URL` overrides that behavior.

## API contract

| Endpoint | Use | Request / response |
|---|---|---|
| `GET /api/status` | Check backend readiness | JSON status |
| `GET /api/objects/{object_id}` | Load catalog record | JSON object record, e.g. `mars` |
| `POST /api/agent/chat` | Generate object summary | English-only AI response; `lang` is retained for request compatibility; JSON response with `data.message` and `data.sources` |
| `POST /api/agent/voiceover/text` | Synthesize narration | JSON `{ "text": "...", "language": "en", "voicePreset": "mission-liaison" }`; response is `audio/wav` |

The speech route is implemented in
[`routes/agent.py`](../backend/routes/agent.py). It calls
[`voiceover_service.py`](../backend/services/voiceover_service.py), which
passes the text to [`gemini_tts_provider.py`](../backend/services/gemini_tts_provider.py).
The provider reads `GEMINI_API_KEY` from the backend environment; do not put the
key in browser code, documentation, logs, or Git.

## Local development

Run the backend and AR/VR app in separate terminals:

```powershell
# Terminal 1
cd C:\Users\<you>\OneDrive\Dokumen\mainProjectSPHRX\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```powershell
# Terminal 2
cd C:\Users\<you>\OneDrive\Dokumen\mainProjectSPHRX\arvr
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
| TTS returns HTTP 503 mentioning `GEMINI_API_KEY` | The key is absent from the environment of the running backend process | Set the key in that process's environment and restart Uvicorn. Never paste the key into the browser or a ticket. |
| TTS returns HTTP 429 | Provider or application rate limit | Wait before retrying; avoid repeated auto-reloads while diagnosing. |
| TTS returns HTTP 502 | Provider rejected the request, returned an invalid response, or failed upstream | Inspect sanitized backend logs for the provider status. Do not log request headers or key values. |
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

## Files to maintain

- Frontend request and response parsing: [`api.ts`](../arvr/src/frontend/api.ts)
- Orbit selection and audio unlock: [`SolarSystemHub.tsx`](../arvr/src/xr/SolarSystemHub.tsx)
- Body context and local description: [`BodyExplorer.tsx`](../arvr/src/xr/BodyExplorer.tsx), [`types.ts`](../arvr/src/xr/types.ts), and `arvr/content/bodies/*.json`
- Object panel, Agent summary, and auto TTS: [`CatalogObjectCard3D.tsx`](../arvr/src/xr/CatalogObjectCard3D.tsx)
- Audio decoding and playback lifecycle: [`agentSpeech.ts`](../arvr/src/xr/agentSpeech.ts)
- FastAPI routes and Gemini integration: [`routes/agent.py`](../backend/routes/agent.py), [`voiceover_service.py`](../backend/services/voiceover_service.py), and [`gemini_tts_provider.py`](../backend/services/gemini_tts_provider.py)
