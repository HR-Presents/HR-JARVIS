# J.A.R.V.I.S. Frontend Handoff

## Stack
React 19, TypeScript, Vite, Lucide React and Three.js.

## Start
cd frontend
npm ci
npm run dev

## Build
npm run build

## Backend
http://127.0.0.1:8100

## API groups
- /api/chat
- /api/agent
- /api/memory
- /api/research
- /api/coding
- /api/voice

## API documentation
See API_REFERENCE.md and openapi.json.
Live Swagger: http://127.0.0.1:8100/docs

## Integration rules
- Use configurable API base URLs.
- Use FormData for voice endpoints.
- Preserve supported conversation history.
- Handle loading, errors and timeouts.
- Respect coding approval requirements.
- Do not assume undocumented response formats.
- Coordinate backend contract changes with the backend developer.

Check backend CORS configuration before browser integration.
