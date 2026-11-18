"""Static Python code validation without execution."""

import ast
from typing import Any

MAX_SOURCE_CHARS = 100_000


def validate_python_source(source: str) -> dict[str, Any]:
    if not isinstance(source, str):
        return {"valid": False, "error": "Source must be a string"}

    if len(source) > MAX_SOURCE_CHARS:
        return {"valid": False, "error": "Source exceeds validation limit"}

    try:
        tree = ast.parse(source)
        compile(tree, "<proposed-python>", "exec")
    except (SyntaxError, ValueError, TypeError) as exc:
        return {
            "valid": False,
            "error": str(exc),
            "line": getattr(exc, "lineno", None),
            "column": getattr(exc, "offset", None),
        }

    functions = [
        node.name for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    ]
    classes = [
        node.name for node in ast.walk(tree)
        if isinstance(node, ast.ClassDef)
    ]

    return {
        "valid": True,
        "lines": len(source.splitlines()),
        "functions": functions[:100],
        "classes": classes[:100],
        "function_count": len(functions),
        "class_count": len(classes),
        "executed": False,
        "files_modified": False,
    }
