import json
import os
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.inference import PROVIDER, BASE_URL, OLLAMA_URL

def llm_endpoint():
    if PROVIDER == "ollama":
        return OLLAMA_URL + "/api/chat"
    return BASE_URL + "/chat/completions"

def llm_payload(messages, stream=False):
    payload = {
        "model": MODEL,
        "messages": messages,
        "stream": stream,
    }
    if PROVIDER == "ollama":
        payload["think"] = False
    elif PROVIDER == "vllm":
        payload["chat_template_kwargs"] = {
            "enable_thinking": False
        }
    return payload


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
    endpoint = (
        OLLAMA_URL + "/api/tags"
        if PROVIDER == "ollama"
        else BASE_URL + "/models"
    )
    try:
        response = await app.state.http.get(endpoint, timeout=10.0)
        response.raise_for_status()
        data = response.json()
        installed = (
            [m.get("name", "") for m in data.get("models", [])]
            if PROVIDER == "ollama"
            else [m.get("id", "") for m in data.get("data", [])]
        )
        online = True
    except (httpx.HTTPError, ValueError):
        installed = []
        online = False

    return {
        "assistant": "J.A.R.V.I.S.",
        "developer": "HR-Presents",
        "backend": "online",
        "provider": PROVIDER,
        "ollama": "online" if online else "offline"
                  if PROVIDER == "ollama" else "not_selected",
        "inference": "online" if online else "offline",
        "model": MODEL,
        "model_installed": MODEL in installed,
    }

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        response = await app.state.http.post(
            llm_endpoint(),
            json=llm_payload(build_messages(request)),
        )
        response.raise_for_status()
        data = response.json()

        if PROVIDER == "ollama":
            content = data.get("message", {}).get("content", "")
        else:
            choices = data.get("choices") or []
            if not choices:
                raise ValueError("No model response choices")
            content = choices[0].get("message", {}).get("content") or ""

        return {
            "assistant": "J.A.R.V.I.S.",
            "model": MODEL,
            "response": content,
        }
    except (httpx.HTTPError, ValueError, KeyError) as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Local AI connection failed: {exc}",
        )

@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    async def generate():
        completed = False
        try:
            async with app.state.http.stream(
                "POST",
                llm_endpoint(),
                json=llm_payload(build_messages(request), stream=True),
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line:
                        continue

                    if PROVIDER == "ollama":
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        completed = bool(data.get("done"))
                    else:
                        if not line.startswith("data:"):
                            continue
                        raw = line[5:].strip()
                        if raw == "[DONE]":
                            completed = True
                            break
                        data = json.loads(raw)
                        choices = data.get("choices") or []
                        if not choices:
                            continue
                        choice = choices[0]
                        content = (
                            choice.get("delta", {}).get("content") or ""
                        )
                        if choice.get("finish_reason") is not None:
                            completed = True

                    if content:
                        yield json.dumps({
                            "type": "token",
                            "content": content,
                        }) + "\n"

            if completed:
                yield json.dumps({
                    "type": "done",
                    "model": MODEL,
                }) + "\n"
            else:
                yield json.dumps({
                    "type": "error",
                    "message": "Model stream ended unexpectedly",
                }) + "\n"

        except (httpx.HTTPError, ValueError, KeyError) as exc:
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
