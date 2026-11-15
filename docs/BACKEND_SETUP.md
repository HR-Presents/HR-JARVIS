# Backend Setup

Requirements:
- Python 3.12
- Ollama
- Git

Install:

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

Install and start Ollama separately.
Pull the configured model:

ollama pull qwen3.5:4b

Start backend:

.venv/bin/python -m uvicorn backend.main:app \
  --host 127.0.0.1 --port 8100

Health:
http://127.0.0.1:8100/api/health

Swagger:
http://127.0.0.1:8100/docs

Provision speech models separately.
Downloaded model weights are not included in Git.
