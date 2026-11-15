"""Local SQLite conversation memory for J.A.R.V.I.S. (explicit conversation IDs)."""
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/memory", tags=["memory"])
DATA_DIR = Path(os.getenv("JARVIS_DATA_DIR", str(Path.home() / ".local/share/hr-jarvis-next"))).expanduser()
DB = DATA_DIR / "conversations.sqlite3"
MODEL = os.getenv("JARVIS_MODEL", "qwen3.5:4b")
OLLAMA = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
SYSTEM = ("You are J.A.R.V.I.S., a private local AI assistant developed by HR-Presents. "
          "Be accurate, helpful, and clear. Do not claim to have taken actions you did not take. "
          "Use the provided conversation history to maintain continuity.")


def connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA busy_timeout=10000")
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)")
    con.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE, role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL, created_at TEXT NOT NULL)")
    con.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, id)")
    con.commit()
    try:
        DB.chmod(0o600)
    except OSError:
        pass
    return con


class MemoryChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=32000)
    conversation_id: str | None = Field(default=None, max_length=64)


def valid_id(value: str):
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(422, "Invalid conversation ID")


@router.get("/status")
def status():
    with connect() as con:
        conversations = con.execute("SELECT COUNT(*) FROM conversations").fetchone()[0]
        messages = con.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
    return {"storage": "sqlite", "persistent": True, "conversations": conversations, "messages": messages}


@router.get("/conversations")
def list_conversations():
    with connect() as con:
        rows = con.execute("SELECT c.id, c.created_at, COUNT(m.id) AS message_count FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100").fetchall()
    return {"conversations": [dict(r) for r in rows]}


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str):
    cid = valid_id(conversation_id)
    with connect() as con:
        if not con.execute("SELECT 1 FROM conversations WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Conversation not found")
        rows = con.execute("SELECT id, role, content, created_at FROM messages WHERE conversation_id=? ORDER BY id", (cid,)).fetchall()
    return {"conversation_id": cid, "messages": [dict(r) for r in rows]}


@router.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str):
    cid = valid_id(conversation_id)
    with connect() as con:
        cur = con.execute("DELETE FROM conversations WHERE id=?", (cid,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Conversation not found")
        con.commit()
    return {"conversation_id": cid, "deleted": True}


@router.post("/chat")
async def memory_chat(request: MemoryChatRequest):
    cid = valid_id(request.conversation_id) if request.conversation_id else str(uuid.uuid4())
    with connect() as con:
        if request.conversation_id and not con.execute("SELECT 1 FROM conversations WHERE id=?", (cid,)).fetchone():
            raise HTTPException(404, "Conversation not found")
        rows = con.execute("SELECT role, content FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT 30", (cid,)).fetchall()
    messages = [{"role": "system", "content": SYSTEM}]
    messages.extend({"role": r["role"], "content": r["content"]} for r in reversed(rows))
    messages.append({"role": "user", "content": request.message})
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=10.0)) as client:
            response = await client.post(f"{OLLAMA}/api/chat", json={"model": MODEL, "messages": messages, "stream": False, "think": False})
            response.raise_for_status()
            answer = response.json().get("message", {}).get("content", "")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, f"Local model unavailable: {exc}")
    if not isinstance(answer, str) or not answer.strip():
        raise HTTPException(502, "Local model returned an empty response")
    now = datetime.now(timezone.utc).isoformat()
    with connect() as con:
        con.execute("INSERT OR IGNORE INTO conversations(id, created_at) VALUES (?, ?)", (cid, now))
        con.execute("INSERT INTO messages(conversation_id, role, content, created_at) VALUES (?, 'user', ?, ?)", (cid, request.message, now))
        con.execute("INSERT INTO messages(conversation_id, role, content, created_at) VALUES (?, 'assistant', ?, ?)", (cid, answer, now))
        con.commit()
    return {"conversation_id": cid, "response": answer, "model": MODEL, "saved": True}
