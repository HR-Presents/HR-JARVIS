"""Allowlist and validation for Windows desktop actions."""
from urllib.parse import urlparse

ALLOWED_APPS = {
    "notepad": "notepad.exe",
    "calculator": "calc.exe",
    "paint": "mspaint.exe",
    "file explorer": "explorer.exe",
}

def validate(action: dict) -> dict:
    if not isinstance(action, dict):
        return {"ok": False, "error": "Invalid action"}

    kind = action.get("type")
    target = action.get("target")
    if not isinstance(target, str) or not target.strip():
        return {"ok": False, "error": "Invalid target"}

    target = target.strip()
    if len(target) > 2048:
        return {"ok": False, "error": "Target too long"}

    if kind == "open_app":
        if target.lower() not in ALLOWED_APPS:
            return {"ok": False, "error": "Application not allowlisted"}
        return {"ok": True, "action": {
            "type": kind, "target": target.lower()
        }}

    if kind == "open_url":
        parsed = urlparse(target)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or any(ord(c) < 32 for c in target)
            or "\\\\" in target
        ):
            return {"ok": False, "error": "Invalid or restricted URL"}
        return {"ok": True, "action": {
            "type": kind, "target": target
        }}

    return {"ok": False, "error": "Unsupported action"}
