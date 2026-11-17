"""Local approval-controlled Windows automation service."""
import os
import secrets
import time
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

from windows_actions import ALLOWED_APPS, validate
from windows_approval import ApprovalGate

app = FastAPI(
    title="HR-Presents J.A.R.V.I.S. Windows Automation",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

class LocalSecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        from starlette.responses import JSONResponse

        headers = {
            k.decode("latin1").lower(): v.decode("latin1")
            for k, v in scope.get("headers", [])
        }
        path = scope.get("path", "")
        propose_token = os.environ.get("JARVIS_WINDOWS_PROPOSE_TOKEN", "")
        approve_token = os.environ.get("JARVIS_WINDOWS_APPROVE_TOKEN", "")
        supplied = headers.get("x-jarvis-token", "")

        if (
            not propose_token
            or not approve_token
            or secrets.compare_digest(propose_token, approve_token)
        ):
            response = JSONResponse(
                {"detail": "Windows service credentials not configured"},
                status_code=503,
            )
            await response(scope, receive, send)
            return

        token = (
            propose_token if path == "/propose"
            else approve_token
        )
        origin = headers.get("origin", "")
        host = headers.get("host", "")

        if not token or not secrets.compare_digest(token, supplied):
            response = JSONResponse(
                {"detail": "Unauthorized"}, status_code=401
            )
            await response(scope, receive, send)
            return

        allowed_hosts = {
            "127.0.0.1:8766",
            "localhost:8766",
        }

        if host not in allowed_hosts:
            response = JSONResponse(
                {"detail": "Invalid host"}, status_code=403
            )
            await response(scope, receive, send)
            return

        if origin:
            response = JSONResponse(
                {"detail": "Browser-origin requests are disabled"},
                status_code=403,
            )
            await response(scope, receive, send)
            return

        await self.app(scope, receive, send)


app.add_middleware(LocalSecurityMiddleware)

gate = ApprovalGate()
lock = Lock()
created = {}
TTL = 120
MAX_PENDING = 20


class ActionRequest(BaseModel):
    type: str
    target: str = Field(min_length=1, max_length=2048)


class ApprovalRequest(BaseModel):
    token: str = Field(min_length=1, max_length=256)


def expire():
    now = time.monotonic()
    for token, started in list(created.items()):
        if now - started > TTL:
            gate.reject(token)
            created.pop(token, None)


def _execute_approved(action: dict) -> dict:
    """Called only after the service consumes a valid approval."""
    import subprocess
    import webbrowser

    if os.name != "nt":
        return {"ok": False, "error": "Windows required"}

    checked = validate(action)
    if not checked["ok"]:
        return checked

    action = checked["action"]
    if action["type"] == "open_app":
        subprocess.Popen(
            [ALLOWED_APPS[action["target"]]],
            shell=False,
        )
        return {"ok": True, "message": "Application launch requested"}

    if action["type"] == "open_url":
        opened = webbrowser.open(action["target"])
        return {
            "ok": bool(opened),
            "message": "Browser launch requested" if opened else "Browser launch failed",
        }

    return {"ok": False, "error": "Unsupported action"}


@app.get("/health")
def health():
    return {
        "status": "ready",
        "platform": os.name,
        "execution_available": os.name == "nt",
    }


@app.post("/propose")
def propose(action: ActionRequest):
    with lock:
        expire()
        if len(created) >= MAX_PENDING:
            raise HTTPException(429, "Too many pending actions")
        result = gate.propose(action.model_dump())
        if not result["ok"]:
            raise HTTPException(400, result["error"])
        created[result["token"]] = time.monotonic()
        return result


@app.post("/reject")
def reject(request: ApprovalRequest):
    with lock:
        expire()
        created.pop(request.token, None)
        result = gate.reject(request.token)
        if not result["ok"]:
            raise HTTPException(404, result["error"])
        return result


@app.post("/approve")
def approve(request: ApprovalRequest):
    with lock:
        expire()
        if request.token not in created:
            raise HTTPException(404, "Unknown or expired approval")
        created.pop(request.token, None)

        if os.name != "nt":
            gate.reject(request.token)
            raise HTTPException(
                503, "Execution requires Windows Python"
            )

        consumed = gate.consume(request.token)
        if not consumed["ok"]:
            raise HTTPException(404, consumed["error"])
        result = _execute_approved(consumed["action"])
        if not result["ok"]:
            raise HTTPException(400, result["error"])
        return result
