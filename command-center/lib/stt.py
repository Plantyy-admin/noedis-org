#!/usr/bin/env python3
"""Transcribe one audio file with the Whisper build Hermes already ships.

Runs inside Hermes' own virtualenv so the cockpit reuses the same local STT
model as the agent instead of adding a second speech stack. Prints a single
JSON object on stdout: {"text": "...", "language": "...", "seconds": 1.23}

    python stt.py /path/to/audio.webm [language]
"""
import json
import os
import sys
import time


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "usage: stt.py <audio-file> [language]"}))
        return 2

    path = sys.argv[1]
    language = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] not in ("", "auto") else None
    if not os.path.exists(path):
        print(json.dumps({"error": f"no such file: {path}"}))
        return 1

    try:
        from faster_whisper import WhisperModel
    except Exception as exc:  # pragma: no cover - depends on the install
        print(json.dumps({"error": f"faster_whisper unavailable: {exc}"}))
        return 3

    model_name = os.environ.get("HERMES_STT_MODEL", "base")
    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception:
        # some builds have no int8 kernels; fall back to the default quantisation
        model = WhisperModel(model_name, device="cpu")

    started = time.time()
    segments, info = model.transcribe(
        path,
        language=language,
        vad_filter=True,
        beam_size=1,
    )
    text = " ".join(segment.text.strip() for segment in segments).strip()
    print(
        json.dumps(
            {
                "text": text,
                "language": getattr(info, "language", None),
                "seconds": round(time.time() - started, 2),
            },
            ensure_ascii=False,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
