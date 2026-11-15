"""J.A.R.V.I.S. isolated Python execution engine."""

import os
import resource
import shutil
import subprocess
import tempfile
import time
from pathlib import Path


def execute_python(source: str, timeout_seconds: int = 8) -> dict:
    """Execute one Python script in a restricted Bubblewrap workspace."""

    if not shutil.which("bwrap"):
        raise RuntimeError("Bubblewrap is not installed")

    if not Path("/usr/bin/python3").exists():
        raise RuntimeError("Sandbox Python interpreter unavailable")

    if len(source.encode("utf-8")) > 256_000:
        raise ValueError("Source exceeds 256 KB")

    timeout_seconds = max(1, min(timeout_seconds, 10))

    with tempfile.TemporaryDirectory(
        prefix="jarvis-sandbox-"
    ) as directory:

        workspace = Path(directory)
        script = workspace / "main.py"
        stdout_file = workspace / "stdout.txt"
        stderr_file = workspace / "stderr.txt"

        script.write_text(source, encoding="utf-8")
        stdout_file.touch()
        stderr_file.touch()

        def limits():
            resource.setrlimit(
                resource.RLIMIT_CPU,
                (5, 6)
            )
            resource.setrlimit(
                resource.RLIMIT_AS,
                (1024**3, 1024**3)
            )
            resource.setrlimit(
                resource.RLIMIT_FSIZE,
                (1024**2, 1024**2)
            )
            resource.setrlimit(
                resource.RLIMIT_CORE,
                (0, 0)
            )

        command = [
            "bwrap",
            "--unshare-user",
            "--unshare-pid",
            "--unshare-net",
            "--die-with-parent",
        ]

        for mount in ("/usr", "/bin", "/lib", "/lib64"):
            if Path(mount).exists():
                command += [
                    "--ro-bind", mount, mount
                ]

        command += [
            "--proc", "/proc",
            "--dev", "/dev",
            "--tmpfs", "/tmp",
            "--bind", directory, "/workspace",
            "--chdir", "/workspace",
            "--clearenv",
            "--setenv", "PATH", "/usr/bin:/bin",
            "--setenv", "HOME", "/tmp",
            "--setenv", "PYTHONNOUSERSITE", "1",
            "--setenv", "PYTHONDONTWRITEBYTECODE", "1",
            "/usr/bin/python3",
            "-I", "-S",
            "/workspace/main.py",
        ]

        started = time.monotonic()
        timed_out = False

        with stdout_file.open("wb") as stdout, \
             stderr_file.open("wb") as stderr:

            try:
                result = subprocess.run(
                    command,
                    stdin=subprocess.DEVNULL,
                    stdout=stdout,
                    stderr=stderr,
                    timeout=timeout_seconds + 2,
                    check=False,
                    preexec_fn=limits,
                )
                exit_code = result.returncode

            except subprocess.TimeoutExpired:
                timed_out = True
                exit_code = None

        duration = round(time.monotonic() - started, 3)

        return {
            "exit_code": exit_code,
            "timed_out": timed_out,
            "duration_seconds": duration,
            "stdout": stdout_file.read_text(
                encoding="utf-8", errors="replace"
            )[:16000],
            "stderr": stderr_file.read_text(
                encoding="utf-8", errors="replace"
            )[:16000],
            "sandboxed": True,
            "network_disabled": True,
            "original_modified": False,
        }
