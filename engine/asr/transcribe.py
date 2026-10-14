"""Local speech-to-text with word timestamps (faster-whisper, runs on CPU).

Usage: python transcribe.py <audio> [language|auto] > words.json
Prints {"language": "...", "words": [{"text","startMs","endMs"}]}.
"""
import json
import os
import sys

from faster_whisper import WhisperModel


def main() -> None:
    audio = sys.argv[1]
    lang = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "auto" else None
    # Whisper knows Arabic as one language; dialect codes map to "ar".
    if lang and lang.startswith("ar"):
        lang = "ar"
    model_name = os.environ.get("WHISPER_MODEL", "large-v3-turbo")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio,
        language=lang,
        word_timestamps=True,
        vad_filter=True,
        beam_size=5,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append({"text": text, "startMs": int(w.start * 1000), "endMs": int(w.end * 1000)})
    json.dump({"language": info.language, "words": words}, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
