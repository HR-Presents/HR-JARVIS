
"""J.A.R.V.I.S. V0.6: read-only Python coding intelligence."""

import ast
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/coding", tags=["coding"])

ROOT = Path(__file__).resolve().parent.parent
EXCLUDED = {
    ".git", ".venv", "node_modules", ".backups",
    "__pycache__", ".pytest_cache", ".mypy_cache",
    ".ruff_cache", ".env"
}

class FileRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)

class InspectRequest(BaseModel):
    path: str = Field(default="backend", max_length=500)
    max_files: int = Field(default=50, ge=1, le=100)

def safe_path(raw):
    candidate = Path(raw)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise HTTPException(403, "Absolute and parent paths are prohibited")

    if any(part in EXCLUDED or part.startswith(".") for part in candidate.parts):
        raise HTTPException(403, "Protected path")

    target = ROOT / candidate
    resolved = target.resolve()

    if not resolved.is_relative_to(ROOT):
        raise HTTPException(403, "Path escapes project root")

    if not resolved.exists():
        raise HTTPException(404, "Path does not exist")

    return resolved

def analyze_python(path):
    if path.stat().st_size > 1_000_000:
        raise HTTPException(413, "File exceeds 1 MB limit")

    try:
        content = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        raise HTTPException(422, "Cannot read Python source")

    try:
        tree = ast.parse(content, filename=str(path))
    except SyntaxError as exc:
        return {
            "path": str(path.relative_to(ROOT)),
            "valid_syntax": False,
            "error": {
                "line": exc.lineno,
                "column": exc.offset,
                "message": exc.msg
            },
            "functions": [],
            "classes": []
        }

    functions = []
    classes = []

    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append({
                "name": node.name,
                "line": node.lineno,
                "async": isinstance(node, ast.AsyncFunctionDef)
            })
        elif isinstance(node, ast.ClassDef):
            classes.append({
                "name": node.name,
                "line": node.lineno
            })

    return {
        "path": str(path.relative_to(ROOT)),
        "valid_syntax": True,
        "error": None,
        "functions": functions[:200],
        "classes": classes[:100]
    }

@router.get("/status")
def status():
    return {
        "engine": "J.A.R.V.I.S. Coding V0.6",
        "read_only": True,
        "python_ast": True,
        "shell_execution": False,
        "automatic_changes": False
    }

@router.post("/diagnose")
def diagnose(request: FileRequest):
    path = safe_path(request.path)

    if not path.is_file() or path.suffix != ".py":
        raise HTTPException(422, "Expected a Python file")

    return analyze_python(path)

@router.post("/inspect")
def inspect(request: InspectRequest):
    path = safe_path(request.path)

    if not path.is_dir():
        raise HTTPException(422, "Expected a directory")

    files = []

    for current, dirs, names in os.walk(path, followlinks=False):
        dirs[:] = sorted(
            name for name in dirs
            if name not in EXCLUDED
            and not name.startswith(".")
            and not (Path(current) / name).is_symlink()
        )

        for name in sorted(names):
            if not name.endswith(".py"):
                continue

            candidate = Path(current) / name

            if candidate.is_symlink():
                continue

            try:
                resolved = candidate.resolve()
                if not resolved.is_relative_to(ROOT):
                    continue
                files.append(analyze_python(resolved))
            except (OSError, HTTPException):
                continue

            if len(files) >= request.max_files:
                break

        if len(files) >= request.max_files:
            break

    return {
        "directory": str(path.relative_to(ROOT)),
        "files_analyzed": len(files),
        "files": files
    }


# V0.7 — Read-only code search and change previews

import difflib

class CodeSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    path: str = Field(default="backend", max_length=500)
    max_matches: int = Field(default=30, ge=1, le=100)

class DiffRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    proposed_content: str = Field(max_length=200000)

@router.post("/search")
def search_code(request: CodeSearchRequest):
    directory = safe_path(request.path)
    if not directory.is_dir():
        raise HTTPException(422, "Expected a directory")

    matches = []
    scanned = 0

    for current, dirs, names in os.walk(directory, followlinks=False):
        dirs[:] = sorted(
            name for name in dirs
            if name not in EXCLUDED
            and not name.startswith(".")
            and not (Path(current) / name).is_symlink()
        )

        for name in sorted(names):
            if not name.endswith(".py"):
                continue

            candidate = Path(current) / name
            if candidate.is_symlink():
                continue

            try:
                resolved = candidate.resolve()
                if not resolved.is_relative_to(ROOT):
                    continue
                if resolved.stat().st_size > 1_000_000:
                    continue
                lines = resolved.read_text(encoding="utf-8").splitlines()
            except (OSError, UnicodeError):
                continue

            scanned += 1

            for number, line in enumerate(lines, 1):
                if request.query.casefold() in line.casefold():
                    matches.append({
                        "path": str(resolved.relative_to(ROOT)),
                        "line": number,
                        "text": line[:300],
                    })
                    if len(matches) >= request.max_matches:
                        return {
                            "query": request.query,
                            "matches": matches,
                            "files_scanned": scanned,
                            "truncated": True,
                        }

    return {
        "query": request.query,
        "matches": matches,
        "files_scanned": scanned,
        "truncated": False,
    }

@router.post("/diff")
def preview_diff(request: DiffRequest):
    target = safe_path(request.path)

    if not target.is_file() or target.suffix != ".py":
        raise HTTPException(422, "Expected a Python file")

    if target.stat().st_size > 1_000_000:
        raise HTTPException(413, "File exceeds 1 MB limit")

    try:
        original = target.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        raise HTTPException(422, "Cannot read Python source")

    proposed = request.proposed_content

    try:
        ast.parse(proposed, filename=str(target))
        valid_syntax = True
        syntax_error = None
    except SyntaxError as exc:
        valid_syntax = False
        syntax_error = {
            "line": exc.lineno,
            "column": exc.offset,
            "message": exc.msg,
        }

    relative = str(target.relative_to(ROOT))
    diff = "".join(difflib.unified_diff(
        original.splitlines(keepends=True),
        proposed.splitlines(keepends=True),
        fromfile="a/" + relative,
        tofile="b/" + relative,
    ))

    if len(diff) > 250000:
        raise HTTPException(413, "Diff exceeds preview limit")

    return {
        "path": relative,
        "changed": original != proposed,
        "valid_proposed_syntax": valid_syntax,
        "syntax_error": syntax_error,
        "diff": diff,
        "applied": False,
        "approval_required": True,
    }


# J.A.R.V.I.S. V0.8 — Isolated execution

from backend.sandbox import execute_python


class ExecuteRequest(BaseModel):
    path: str = Field(min_length=1, max_length=500)
    timeout_seconds: int = Field(default=8, ge=1, le=10)


@router.post("/execute")
def execute_code(request: ExecuteRequest):
    # Reject symlinks in every requested path component.
    relative = Path(request.path)

    if relative.is_absolute() or ".." in relative.parts:
        raise HTTPException(403, "Invalid project path")

    current = ROOT
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise HTTPException(403, "Symlinked paths are prohibited")

    target = safe_path(request.path)

    if not target.is_file() or target.suffix != ".py":
        raise HTTPException(422, "Expected a Python file")

    if target.stat().st_size > 256_000:
        raise HTTPException(413, "File exceeds 256 KB limit")

    try:
        source = target.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        raise HTTPException(422, "Cannot read Python source")

    try:
        return {
            "path": str(target.relative_to(ROOT)),
            **execute_python(source, request.timeout_seconds),
        }
    except (RuntimeError, ValueError) as exc:
        raise HTTPException(503, str(exc))
