import base64
import logging
import os
from typing import Any, Iterable

import httpx
from fastapi import HTTPException


logger = logging.getLogger(__name__)

GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_TTS_MODEL = "gemini-3.8-flash-tts"


def _decode_wav_data(raw_audio: Any) -> bytes:
    if isinstance(raw_audio, bytes):
        audio = raw_audio
    elif isinstance(raw_audio, str):
        encoded_audio = raw_audio.strip()
        if not encoded_audio:
            raise ValueError("Empty audio data.")
        try:
            audio = base64.b64decode(encoded_audio, validate=True)
        except ValueError as exc:
            raise ValueError("Audio data is not valid base64.") from exc
    else:
        raise ValueError("Unsupported audio payload type.")

    if audio.startswith(b"RIFF") and audio[8:12] == b"WAVE":
        return audio
    raise ValueError("Audio payload is not a WAV file.")


def _iter_candidate_audio_payloads(node: Any) -> Iterable[Any]:
    if isinstance(node, dict):
        if node.get("type") == "audio" or node.get("mimeType") == "audio/wav":
            yield node.get("data")
            yield node.get("inlineData", {}).get("data") if isinstance(node.get("inlineData"), dict) else None
        for value in node.values():
            yield from _iter_candidate_audio_payloads(value)
    elif isinstance(node, list):
        for item in node:
            yield from _iter_candidate_audio_payloads(item)


def build_request_payload(text: str, voice: str, style: str) -> dict:
    return {
        "model": GEMINI_TTS_MODEL,
        "input": [
            {
                "type": "user_input",
                "content": [
                    {
                        "type": "text",
                        "text": text,
                        "annotations": [
                            {
                                "type": "speech_metadata",
                                "style": style,
                            }
                        ],
                    }
                ],
            }
        ],
        "response_format": {"type": "audio"},
        "generation_config": {"speech_config": [{"voice": voice}]},
    }


def extract_wav_audio(response_data: dict) -> bytes:
    if not isinstance(response_data, dict):
        raise HTTPException(status_code=502, detail="Gemini TTS tidak mengembalikan audio.")

    audio_candidates = []
    steps = response_data.get("steps")
    if isinstance(steps, list):
        for step in reversed(steps):
            if not isinstance(step, dict) or step.get("type") != "model_output":
                continue
            content = step.get("content")
            if isinstance(content, list):
                audio_candidates.extend(item.get("data") for item in content if isinstance(item, dict))
    audio_candidates.extend(_iter_candidate_audio_payloads(response_data))

    for raw_audio in audio_candidates:
        if raw_audio is None:
            continue
        try:
            audio = _decode_wav_data(raw_audio)
        except ValueError:
            continue
        return audio

    raise HTTPException(status_code=502, detail="Gemini TTS tidak mengembalikan audio WAV yang valid.")


def synthesize_speech(text: str, voice: str, style: str) -> bytes:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini TTS belum dikonfigurasi. Atur GEMINI_API_KEY pada environment backend.",
        )

    try:
        with httpx.Client(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            response = client.post(
                GEMINI_INTERACTIONS_URL,
                headers={"x-goog-api-key": api_key},
                json=build_request_payload(text, voice, style),
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Permintaan ke Gemini TTS melewati batas waktu. Silakan coba kembali.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Gemini TTS request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Tidak dapat menghubungi layanan Gemini TTS.",
        ) from exc

    if response.is_error:
        provider_status = None
        provider_message = None
        try:
            error_data = response.json().get("error")
        except (AttributeError, ValueError):
            error_data = None
        if isinstance(error_data, dict):
            provider_status = error_data.get("status")
            provider_message = error_data.get("message")
        if isinstance(provider_message, str):
            provider_message = " ".join(provider_message.split())
            provider_message = provider_message.replace(api_key, "[REDACTED]")[:300]

        logger.warning(
            "Gemini TTS returned HTTP %s (provider status=%s): %s",
            response.status_code,
            provider_status or "unknown",
            provider_message or "no provider error message",
        )
        if response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Batas penggunaan Gemini TTS tercapai. Silakan coba kembali nanti.",
            )
        raise HTTPException(
            status_code=502,
            detail="Gemini TTS gagal memproses permintaan. Periksa konfigurasi dan coba lagi.",
        )

    try:
        response_data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini TTS mengembalikan respons yang tidak dapat dibaca.",
        ) from exc

    return extract_wav_audio(response_data)
