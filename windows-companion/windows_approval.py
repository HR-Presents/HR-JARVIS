"""Explicit approval gate for J.A.R.V.I.S. Windows actions."""
import json
import secrets
from dataclasses import dataclass
from typing import Optional

from windows_actions import validate


@dataclass
class PendingAction:
    action: dict
    token: str


class ApprovalGate:
    def __init__(self):
        self.pending: dict[str, PendingAction] = {}

    def propose(self, action: dict) -> dict:
        result = validate(action)
        if not result["ok"]:
            return result
        action = result["action"]

        token = secrets.token_urlsafe(24)
        self.pending[token] = PendingAction(dict(action), token)
        return {
            "ok": True,
            "approval_required": True,
            "token": token,
            "action": dict(action),
        }

    def reject(self, token: str) -> dict:
        if self.pending.pop(token, None) is None:
            return {"ok": False, "error": "Unknown or expired approval"}
        return {"ok": True, "message": "Action rejected"}

    def consume(self, token: str) -> dict:
        pending = self.pending.pop(token, None)
        if pending is None:
            return {"ok": False, "error": "Unknown or expired approval"}
        return {"ok": True, "action": pending.action}
