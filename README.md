# HR-Presents J.A.R.V.I.S.

A local-first AI assistant developed by HR-Presents.

## Technology
- Python 3.12
- FastAPI
- Ollama / Qwen 3.5 4B
- Faster Whisper
- Piper TTS
- DDGS web search
- React
- TypeScript
- Vite

## Capabilities under development
- Voice interaction
- Conversational AI
- Conversation memory
- Coding assistance
- Internet research
- Approval-controlled code changes

## Repository structure

backend/    Python API and AI services
frontend/   React application
docs/       API and development documentation
tests/      Test fixtures
assets/     Project assets

## Documentation

- docs/API_REFERENCE.md
- docs/FRONTEND_HANDOFF.md
- docs/BACKEND_SETUP.md
- docs/openapi.json

## Frontend

cd frontend
npm ci
npm run dev

## Development status

The project is under active development.
Not every planned capability is production-ready.

## Security

Never commit credentials, .env files, recordings,
local backups or downloaded model weights.
