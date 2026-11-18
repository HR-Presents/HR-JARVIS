"""Controlled recovery for approved file changes."""

import os
import tempfile
from pathlib import Path


MAX_BACKUP_BYTES = 1_000_000


def capture_original(path: str) -> dict:
    """Capture existing file bytes without changing the file."""

    target = Path(path)

    if target.is_symlink():
        raise ValueError("Symbolic links are not supported")

    if not target.exists():
        return {
            "existed": False,
            "content": None,
        }

    if not target.is_file():
        raise ValueError("Target is not a regular file")

    if target.stat().st_size > MAX_BACKUP_BYTES:
        raise ValueError("File exceeds backup size limit")

    return {
        "existed": True,
        "content": target.read_bytes(),
    }


def restore_original(path: str, snapshot: dict) -> dict:
    """Restore a previously captured file state."""

    target = Path(path)

    if target.is_symlink():
        raise ValueError("Refusing to restore a symbolic link")

    if snapshot["existed"]:
        content = snapshot["content"]

        if not isinstance(content, bytes):
            raise ValueError("Invalid recovery snapshot")

        if len(content) > MAX_BACKUP_BYTES:
            raise ValueError("Recovery snapshot too large")

        target.parent.mkdir(parents=True, exist_ok=True)

        fd, temporary = tempfile.mkstemp(
            prefix=".jarvis_recovery_",
            dir=str(target.parent),
        )

        try:
            with os.fdopen(fd, "wb") as stream:
                stream.write(content)
                stream.flush()
                os.fsync(stream.fileno())

            os.replace(temporary, target)

        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    else:
        if target.is_file():
            target.unlink()

    return {
        "restored": True,
        "original_existed": snapshot["existed"],
    }
