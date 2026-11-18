"""Local, terminal-approved Windows launcher for J.A.R.V.I.S."""

import base64
import json
import shutil
import sqlite3
import subprocess
from pathlib import Path
from urllib.parse import urlsplit

from backend.agent import connect

APPS = {
    "calculator": "calc.exe",
    "notepad": "notepad.exe",
    "paint": "mspaint.exe",
    "file explorer": "explorer.exe",
}


def validate(action):
    if not isinstance(action, dict):
        raise ValueError("Invalid action")

    kind = action.get("type")
    target = action.get("target")

    if not isinstance(target, str) or not target:
        raise ValueError("Missing target")

    if kind == "open_app":
        if target not in APPS:
            raise ValueError("Application is not allowlisted")
        return APPS[target]

    if kind == "open_url":
        if len(target) > 2048:
            raise ValueError("URL too long")

        parsed = urlsplit(target)

        if (
            parsed.scheme not in ("http", "https")
            or not parsed.hostname
            or parsed.username is not None
            or parsed.password is not None
            or any(ord(c) < 33 for c in target)
            or "\\" in target
        ):
            raise ValueError("Unsafe URL")

        try:
            _ = parsed.port
        except ValueError:
            raise ValueError("Invalid URL port")

        return target

    raise ValueError("Unsupported action")


def powershell_path():
    candidate = shutil.which("powershell.exe")

    if candidate:
        return candidate

    fallback = Path(
        "/mnt/c/Windows/System32/WindowsPowerShell/"
        "v1.0/powershell.exe"
    )

    if fallback.is_file():
        return str(fallback)

    raise RuntimeError(
        "Windows PowerShell is unavailable from this environment"
    )


def execute(action):
    target = validate(action)

    # Target is inserted only as a quoted PowerShell string.
    # The executable command itself is fixed.
    quoted = "'" + target.replace("'", "''") + "'"

    script = "Start-Process -FilePath " + quoted

    encoded = base64.b64encode(
        script.encode("utf-16-le")
    ).decode("ascii")

    result = subprocess.run(
        [
            powershell_path(),
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            encoded,
        ],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            (result.stderr or result.stdout or "Launch failed")[:500]
        )

    return target


def main():
    with connect() as con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS windows_proposals (
                id TEXT PRIMARY KEY,
                action_json TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
        """)

        rows = con.execute("""
            SELECT id, action_json
            FROM windows_proposals
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT 20
        """).fetchall()

    if not rows:
        print("No pending Windows actions.")
        return

    print("\nJ.A.R.V.I.S. WINDOWS ACTION APPROVAL")
    print("-----------------------------------")

    for index, row in enumerate(rows, 1):
        try:
            action = json.loads(row["action_json"])
            label = (
                f"{action.get('type')}: "
                f"{action.get('target')}"
            )
        except (ValueError, AttributeError):
            label = "Invalid proposal"

        print(f"{index}. {label}")

    choice = input("\nSelect number (Enter to cancel): ").strip()

    if not choice:
        print("Cancelled.")
        return

    if not choice.isdigit() or not 1 <= int(choice) <= len(rows):
        print("Invalid selection.")
        return

    row = rows[int(choice) - 1]

    try:
        action = json.loads(row["action_json"])
        target = validate(action)
    except (ValueError, TypeError) as exc:
        print("Rejected:", exc)
        return

    print(f"\nRequested action: {action['type']}")
    print(f"Target: {target}")

    confirmation = input(
        "Type APPROVE to launch on Windows: "
    ).strip()

    if confirmation != "APPROVE":
        print("Action not approved.")
        return

    # Claim this proposal atomically to prevent duplicate execution.
    with connect() as con:
        cursor = con.execute("""
            UPDATE windows_proposals
            SET status = 'executing'
            WHERE id = ? AND status = 'pending'
        """, (row["id"],))

        if cursor.rowcount != 1:
            print("Proposal already handled.")
            return

    try:
        execute(action)
    except Exception as exc:
        with connect() as con:
            con.execute("""
                UPDATE windows_proposals
                SET status = 'failed'
                WHERE id = ? AND status = 'executing'
            """, (row["id"],))

        print("Launch failed:", exc)
        return

    with connect() as con:
        con.execute("""
            UPDATE windows_proposals
            SET status = 'executed'
            WHERE id = ? AND status = 'executing'
        """, (row["id"],))

    print("Windows launch command completed successfully.")
    print("Note: application readiness is not verified.")


if __name__ == "__main__":
    main()
