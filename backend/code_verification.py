"""Read-only verification of approved Python files."""

import ast
import hashlib
from pathlib import Path


MAX_VERIFY_BYTES = 1_000_000


def verify_python_file(
    path: str,
    expected_source: str | None = None,
) -> dict:
    """Verify a Python file without executing its contents."""

    target = Path(path)

    if not target.is_file() or target.is_symlink():
        return {
            "verified": False,
            "error": "File missing or symbolic link",
        }

    if target.stat().st_size > MAX_VERIFY_BYTES:
        return {
            "verified": False,
            "error": "File exceeds verification limit",
        }

    try:
        content = target.read_text(encoding="utf-8")
        tree = ast.parse(content, filename=str(target))
        compile(tree, str(target), "exec")
    except (OSError, UnicodeError, SyntaxError, ValueError) as exc:
        return {
            "verified": False,
            "error": str(exc),
        }

    actual_hash = hashlib.sha256(
        content.encode("utf-8")
    ).hexdigest()

    matches = (
        expected_source is None
        or content == expected_source
    )

    return {
        "verified": matches,
        "syntax_valid": True,
        "content_matches": matches,
        "sha256": actual_hash,
        "lines": len(content.splitlines()),
        "executed": False,
    }
