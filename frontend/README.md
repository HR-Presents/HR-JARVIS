# J.A.R.V.I.S. workstation

React 19 + TypeScript + Vite frontend for the existing HR-Presents FastAPI backend. No paid service or frontend AI provider is added.

## Run locally

Start the existing backend separately on port 8100, then:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. With no local environment override, development uses the same-origin `/api` proxy to `http://127.0.0.1:8100` and avoids cross-origin requests. `.env.example` documents the configurable `VITE_API_BASE_URL`. Setting it to an absolute URL sends requests directly and requires the backend to allow the frontend origin. Settings also supports a browser-local URL override, which takes precedence.

```bash
npm run build
npm run lint
```

The root `package.json` forwards development/build/lint and copies the static build into root `dist` for Sites. The original backend is unchanged.

## Workspaces

- Assistant: streamed NDJSON chat, stop generation, optional non-streamed chat, session-only message history, safe Markdown rendering, read-aloud through Piper.
- Voice: MediaRecorder WebM/Ogg, staged multipart transcription → agent reply → Piper speech, shared voice/text session history, minimal dark-glass audio core, interrupt/replay controls behind a single menu, recording/transcribing/thinking/speaking states, separate file transcription.
- Memory: backend SQLite conversation IDs, new conversations, list/open/delete. Ordinary chat and voice history are separate and are not presented as durable memory.
- Coding: project inspection, Python-file diagnosis, code search, agent tool events and isolated Python execution requests. File writes are proposals until explicitly approved.
- Approvals: fetch full details before acting, Python unified-diff preview, full proposed content, explicit approval/rejection, list refresh and backend-confirmed feedback. Non-Python diffs are not supplied by this backend; the complete replacement content remains visible.
- Research: search or cited answer, backend-provided source links/snippets, explicit snippet-only evidence label; no invented citations or full-page verification claims.
- Status: six real endpoint checks every 30 seconds; failed checks are unavailable, never replaced by demo values. Endpoint reachability is distinct from model readiness.

## Architecture

`src/features/presence` contains the minimal voice-first screen, hidden transcript/menu and canvas core; `src/hooks/useAudioReactivity.ts` manages the real microphone/playback analyser graph. `src/services/api.ts` centralizes URL selection, JSON/audio requests, timeouts, NDJSON decoding, cancellation and safe URLs. `src/types/api.ts` contains shared response models. `src/components` provides the error boundary, Markdown and diff/output renderers. Feature modules hold research, approvals, settings and status. `App.tsx` coordinates shared session state, voice recording, shell and conversation views. Strict TypeScript is enabled.

## Integration limits

The hosted Site is the frontend, not a hosted copy of Ollama, Piper, Whisper or the sandbox. A public HTTPS page cannot reliably access an HTTP loopback service because of mixed-content, local-network and CORS restrictions. Run the frontend locally for the full local-first workflow. Do not expose the unauthenticated backend publicly just to connect the hosted UI.

The browser provides click-to-record voice, not the separate Windows wake-word client. Windows automation is not claimed or implemented. Python requests go to the backend agent, never a browser interpreter. Confirm `JARVIS_WORKSPACE` points at the intended checkout before coding operations; the coding API resolves paths relative to its repository root.

See `../docs/FRONTEND_IMPLEMENTATION.md` for verification evidence and the remaining local acceptance checks.
