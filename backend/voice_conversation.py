"""Local voice conversation with bounded, validated dialogue history."""
import base64
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from backend import agent, voice

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_HISTORY_MESSAGES = 12
MAX_HISTORY_CHARS = 12000

VOICE_INSTRUCTION = "Voice conversation instructions: You are J.A.R.V.I.S., a helpful local AI assistant. Answer the user's current question directly and naturally. Keep responses concise unless detail is requested. Use previous conversation only when relevant. Never confuse a new topic with an earlier topic. If the user shares a fact or project code, acknowledge it without inspecting files or invoking tools. Use tools only when the user explicitly requests an action or information that requires them. Do not invent facts, capabilities, or completed actions. Do not expand the J.A.R.V.I.S. name. Avoid unnecessary statements about being an AI or lacking feelings. Be professional, friendly, accurate, and natural."


def parse_history(raw: str):
    if len(raw) > MAX_HISTORY_CHARS:
        raise HTTPException(413, "Conversation history too large")

    try:
        history = json.loads(raw)
    except (ValueError, TypeError):
        raise HTTPException(422, "Invalid conversation history JSON")

    if not isinstance(history, list):
        raise HTTPException(422, "History must be a list")

    if len(history) > MAX_HISTORY_MESSAGES:
        raise HTTPException(422, "Too many history messages")

    validated = []

    for item in history:
        if not isinstance(item, dict):
            raise HTTPException(422, "Invalid history message")

        role = item.get("role")
        content = item.get("content")

        if role not in ("user", "assistant"):
            raise HTTPException(422, "Invalid history role")

        if not isinstance(content, str) or not content.strip():
            raise HTTPException(422, "Invalid history content")

        if len(content) > 2000:
            raise HTTPException(422, "History message too long")

        validated.append({"role": role, "content": content})

    return validated



def natural_speech_text(text: str) -> str:
    """Convert formatted AI responses into natural speech."""
    import re

    if not isinstance(text, str):
        return ""

    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)
    text = re.sub(r"(?m)^\s{0,3}#{1,6}\s+", "", text)
    text = re.sub(r"(?m)^\s*[-*•]\s+", "", text)
    text = re.sub(r"(?m)^\s*\d+[.)]\s+", "", text)
    text = re.sub(r"[*_`~]", "", text)
    text = re.sub(r"\.{3,}", ".", text)
    text = re.sub(r"\s*\n+\s*", " ", text)
    text = re.sub(r"\s+", " ", text)

    return text.strip()


@router.post("/converse")
async def converse(
    file: UploadFile = File(...),
    history: str = Form("[]"),
    conversation_id: str = Form(""),
):
    previous = parse_history(history)

    transcription = await run_in_threadpool(voice.transcribe, file)
    message = transcription["text"].strip()

    if not message:
        raise HTTPException(422, "No recognizable speech")

    request = agent.AgentRequest(
        message=message,
        history=previous,
        context=VOICE_INSTRUCTION,
        conversation_id=conversation_id or None,
    )

    result = await agent.agent_chat(request)

    if not isinstance(result, dict):
        raise HTTPException(502, "Unexpected agent response")

    answer = result.get("response", "")

    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(502, "Agent returned no response")

    spoken_text = natural_speech_text(answer)[:2000]

    speech = await run_in_threadpool(
        voice.speak,
        voice.SpeakRequest(text=spoken_text),
    )

    updated_history = (
        previous
        + [
            {"role": "user", "content": message},
            {"role": "assistant", "content": answer[:2000]},
        ]
    )[-MAX_HISTORY_MESSAGES:]

    return {
        "transcription": message,
        "response": answer,
        "events": result.get("events", []),
        "model": result.get("model"),
        "conversation_id": result.get("conversation_id"),
        "spoken_text": spoken_text,
        "audio_format": "wav",
        "audio_base64": base64.b64encode(speech.body).decode("ascii"),
        "history": updated_history,
    }
