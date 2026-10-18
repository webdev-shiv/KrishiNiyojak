"""Minimal Sarvam AI Speech-to-Text Test Script for NITI Platform.

This script tests the Sarvam AI STT connection using the official Python SDK.
It reads SARVAM_API_KEY securely from the environment (.env) and transcribes
an input audio file in Hindi / Code-mixed Hindi-English using the saaras:v4 model.

Usage:
    python scripts/test_sarvam_stt.py <path_to_audio_file>
"""

import argparse
import os
import sys
from pathlib import Path

# Load environment variables securely from .env if present
try:
    from dotenv import load_dotenv

    # Locate root .env relative to this script
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    else:
        load_dotenv()
except ImportError:
    pass


# Ensure proper UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe an audio file using Sarvam AI saaras:v4 Speech-to-Text API."
    )
    parser.add_argument(
        "audio_path",
        type=str,
        help="Path to the audio file to transcribe (e.g., .wav, .mp3, .m4a)",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="hi-IN",
        help="Language code (default: hi-IN for Hindi / Hinglish)",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="saaras:v4",
        help="Sarvam STT model (default: saaras:v4)",
    )

    args = parser.parse_args()

    # 1. Retrieve API key securely
    api_key = os.getenv("SARVAM_API_KEY")
    if not api_key or not api_key.strip():
        print(
            "Error: SARVAM_API_KEY is not set. Please add your key to .env before running this script.",
            file=sys.stderr,
        )
        sys.exit(1)

    # 2. Validate input audio file path
    audio_path = Path(args.audio_path)
    if not audio_path.exists() or not audio_path.is_file():
        print(f"Error: Audio file not found at '{audio_path}'.", file=sys.stderr)
        sys.exit(1)

    # 3. Initialize Sarvam AI client and perform transcription
    try:
        from sarvamai import SarvamAI

        client = SarvamAI(api_subscription_key=api_key.strip())

        with open(audio_path, "rb") as audio_file:
            response = client.speech_to_text.transcribe(
                file=audio_file,
                model=args.model,
                language_code=args.language,
                mode="codemix",
            )

        # 4. Print only the transcription output
        print("--- Sarvam AI Transcription Output ---")
        if hasattr(response, "transcript") and response.transcript:
            print(response.transcript)
        else:
            print("[No speech detected in audio file]")

        if hasattr(response, "language_code") and response.language_code:
            print(f"Language: {response.language_code}")

    except Exception as exc:
        # Sanitize any accidental key leak in exception string
        error_msg = str(exc)
        if api_key and api_key in error_msg:
            error_msg = error_msg.replace(api_key, "[REDACTED_API_KEY]")
        print(f"Transcription failed: {error_msg}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
