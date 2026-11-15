import json
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
MODEL = os.getenv("JARVIS_MODEL", "qwen3.5:4b")

SYSTEM_PROMPT = """
You are J.A.R.V.I.S., a private AI assistant developed by HR-Presents.
You run using a locally hosted AI model.

Your personality is intelligent, professional, calm, precise,
and helpful. Speak naturally and clearly.

Your name is J.A.R.V.I.S.
Your developer is HR-Presents.

Never pretend to have executed computer actions.
Only report actions that actually succeeded.
Be transparent about your capabilities and limitations.
"""

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(
        timeout=httpx.Timeout(180.0, connect=10.0)
    )
    yield
    await app.state.http.aclose()

app = FastAPI(
    title="HR-Presents J.A.R.V.I.S.",
    version="0.1.0",
    lifespan=lifespan,
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32000)
    history: list[Message] = Field(default_factory=list)

def build_messages(request: ChatRequest):
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for item in request.history[-30:]:
        if item.role in ("user", "assistant"):
            messages.append({
                "role": item.role,
                "content": item.content,
            })
    messages.append({
        "role": "user",
        "content": request.message,
    })
    return messages

@app.get("/api/health")
async def health():
    try:
        response = await app.state.http.get(
            f"{OLLAMA_URL}/api/tags",
            timeout=5.0,
        )
        response.raise_for_status()
        models = response.json().get("models", [])
        installed = [
            m.get("name", "") for m in models
        ]
        return {
            "assistant": "J.A.R.V.I.S.",
            "developer": "HR-Presents",
            "backend": "online",
            "ollama": "online",
            "model": MODEL,
            "model_installed": MODEL in installed,
        }
    except (httpx.HTTPError, ValueError):
        return {
            "assistant": "J.A.R.V.I.S.",
            "backend": "online",
            "ollama": "offline",
            "model": MODEL,
        }

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        response = await app.state.http.post(
            f"{OLLAMA_URL}/api/chat",
            json={
                "model": MODEL,
                "messages": build_messages(request),
                "stream": False,
                "think": False,
            },
        )
        response.raise_for_status()
        data = response.json()
        return {
            "assistant": "J.A.R.V.I.S.",
            "model": MODEL,
            "response": data.get("message", {}).get("content", ""),
        }
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Local AI connection failed: {exc}",
        )

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        try:
            async with app.state.http.stream(
                "POST",
                f"{OLLAMA_URL}/api/chat",
                json={
                    "model": MODEL,
                    "messages": build_messages(request),
                    "stream": True,
                    "think": False,
                },
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield json.dumps({
                            "type": "token",
                            "content": content,
                        }) + "\n"
                    if data.get("done"):
                        yield json.dumps({
                            "type": "done",
                            "model": MODEL,
                        }) + "\n"
        except (httpx.HTTPError, ValueError) as exc:
            yield json.dumps({
                "type": "error",
                "message": str(exc),
            }) + "\n"

    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={"X-Accel-Buffering": "no"},
    )


# HR-Presents independent agent router
from backend import agent
app.include_router(agent.router)


# HR-Presents persistent memory router V0.4
from backend import memory
app.include_router(memory.router)


# J.A.R.V.I.S. Research V0.5
from backend import research
app.include_router(research.router)


# J.A.R.V.I.S. Coding V0.6
from backend import coding
app.include_router(coding.router)

# J.A.R.V.I.S. Voice API V1.0
from backend import voice
app.include_router(voice.router)

# Conversational voice V1.1
from backend import voice_conversation
app.include_router(voice_conversation.router)
