# Frontend implementation and verification

## Delivered

A minimal, cinematic blue intelligence core with subtle procedural light motion and actual microphone/playback analyser reactivity. One compact menu exposes chat, memory, coding, research, approvals, system status and settings. The main screen contains one microphone control and an optional text composer. Conversation and tool-event history open on demand.

Agent chat is enabled by default, preserving the latest backend tool integration. Ordinary chat can be selected by disabling agent tools; NDJSON streaming remains available for ordinary chat. Persistent-memory conversations retain their backend IDs and remain separate. Browser voice uses MediaRecorder, multipart transcription, agent response and sequential Piper speech chunks without truncating long answers. Stop, replay, cancellation, deadlines and partial-result errors are handled. Browser wake-word listening is not claimed.

Coding inspection, search, diagnosis, agent-driven isolated Python execution requests and tool output use existing APIs. File changes require explicit approval/rejection. Windows proposals remain read-only: the current backend exposes no browser execution/approval route. No operation is reported as executed merely because it was proposed.

API requests are centralized, typed and configurable through VITE_API_BASE_URL. Transport validates JSON/audio responses, rejects HTML fallbacks and combines cancellation with request deadlines. Research shows backend sources with safe links and preserves snippet evidence labels. Service endpoint reachability is distinct from model/Piper readiness.

Backend source matches main at 9c9ea5cab9c4505559fb415f6f172a62fca3ee10. No Python backend or API contracts were changed.

## Verification

- npm run build: strict TypeScript and production Vite build pass.
- npm run lint: passes without warnings.
- npm run test: five Node tests pass, covering fragmented Unicode NDJSON, stream errors, source URL safety, real HTTP transport/error/cancellation and complete long-answer speech chunking.
- python tests/frontend_contracts.py: 26 real FastAPI checks pass using temporary workspace/database fixtures. Checks cover service endpoints, coding inspection/search/diagnosis/diff, approval actions and conflict handling, memory retrieval/deletion, Windows proposal/confirmation behavior, voice validation and invalid requests. No model successes are mocked.
- Browser checked against actual FastAPI through the development proxy: agent calculator request produces a pending proposal, review accurately states no execution, service status shows backend reachability with model unverified, main screen/navigation/composer work.

## Local acceptance still required

Real model generation/streaming, microphone hardware, Whisper recognition, Piper audio, live DDGS research and Bubblewrap execution need the local services/models and target hardware. These successes were not fabricated in this environment. The health endpoint currently verifies Ollama, so it cannot establish readiness of alternate inference providers by itself.

The private Sites deployment serves the frontend. The Python backend remains local and must be running/configured. This delivery does not package a Windows executable or enable unsupported Windows automation.

## Run

Install existing dependencies using npm --prefix frontend install. Start the existing Python backend on port 8100 following its README, then npm run dev. Development uses the Vite /api proxy. For a hosted frontend, configure the backend URL in Settings and ensure the backend permits that origin and browser network policy allows access. Never commit local secrets.
