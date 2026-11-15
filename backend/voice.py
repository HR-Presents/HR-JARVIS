
"""Local J.A.R.V.I.S. speech recognition and synthesis."""
import io
import os
import tempfile
import threading
import wave
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/voice", tags=["voice"])

MAX_AUDIO = 15 * 1024 * 1024
WHISPER_NAME = os.getenv("JARVIS_WHISPER_MODEL", "base.en")
PIPER_PATH = os.getenv("JARVIS_PIPER_MODEL", str(Path(__file__).resolve().parents[1] / "assets/models/piper/en_US-lessac-medium.onnx"))

_whisper = None
_piper = None
_whisper_lock = threading.Lock()
_piper_lock = threading.Lock()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


def get_whisper():
    global _whisper
    with _whisper_lock:
        if _whisper is None:
            from faster_whisper import WhisperModel
            _whisper = WhisperModel(
                WHISPER_NAME,
                device="cpu",
                compute_type="int8",
            )
        return _whisper


def get_piper():
    global _piper
    with _piper_lock:
        if _piper is None:
            if not PIPER_PATH:
                raise HTTPException(503, "Piper model not configured")

            path = Path(PIPER_PATH).expanduser()
            if not path.is_file():
                raise HTTPException(503, "Piper model missing")
            if not Path(str(path) + ".json").is_file():
                raise HTTPException(503, "Piper config missing")

            from piper import PiperVoice
            _piper = PiperVoice.load(str(path))

        return _piper


@router.get("/status")
def status():
    path = Path(PIPER_PATH).expanduser() if PIPER_PATH else None
    return {
        "engine": "J.A.R.V.I.S. Voice V1.0",
        "speech_to_text": "faster-whisper",
        "text_to_speech": "piper",
        "whisper_model": WHISPER_NAME,
        "whisper_device": "cpu",
        "piper_configured": bool(
            path and path.is_file()
            and Path(str(path) + ".json").is_file()
        ),
        "local_processing": True,
    }


@router.post("/transcribe")
def transcribe(file: UploadFile = File(...)):
    allowed = {".wav", ".mp3", ".m4a", ".flac", ".ogg", ".webm"}
    suffix = Path(file.filename or "").suffix.lower()

    if suffix not in allowed:
        raise HTTPException(400, "Unsupported audio extension")

    temporary = None

    try:
        with tempfile.NamedTemporaryFile(
            suffix=suffix, prefix="jarvis-", delete=False
        ) as handle:
            temporary = Path(handle.name)
            total = 0

            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_AUDIO:
                    raise HTTPException(413, "Audio exceeds 15 MB")
                handle.write(chunk)

        if total == 0:
            raise HTTPException(400, "Empty audio file")

        try:
            model = get_whisper()
            with _whisper_lock:
                segments, info = model.transcribe(
                    str(temporary),
                    beam_size=3,
                    vad_filter=True,
                )
                text = " ".join(
                    item.text.strip() for item in segments
                ).strip()
        except Exception as exc:
            raise HTTPException(
                503,
                "Transcription unavailable: " + type(exc).__name__,
            )

        return {
            "text": text,
            "language": info.language,
            "engine": "faster-whisper",
        }

    finally:
        if temporary:
            temporary.unlink(missing_ok=True)
        file.file.close()


@router.post("/speak")
def speak(request: SpeakRequest):
    voice = get_piper()
    output = io.BytesIO()

    try:
        with _piper_lock:
            with wave.open(output, "wb") as wav:
                voice.synthesize_wav(request.text, wav)

        return Response(
            output.getvalue(),
            media_type="audio/wav",
            headers={"Cache-Control": "no-store"},
        )

    except Exception as exc:
        raise HTTPException(
            503,
            "Speech synthesis unavailable: " + type(exc).__name__,
        )
