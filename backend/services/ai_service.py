import os
import logging
from pathlib import Path
from dotenv import load_dotenv
from fastapi import HTTPException

# 1. Pastikan file .env dibaca dari berbagai kemungkinan lokasi (backend/.env, .env root, atau CWD)
_SERVICES_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SERVICES_DIR.parent
_ROOT_DIR = _BACKEND_DIR.parent

for candidate_env in [
    _BACKEND_DIR / ".env",
    _ROOT_DIR / ".env",
    Path.cwd() / "backend" / ".env",
    Path.cwd() / ".env",
]:
    if candidate_env.is_file():
        load_dotenv(dotenv_path=candidate_env, override=False)

try:
    import httpx
    HAS_HTTPX = True
except ImportError:
    import requests
    HAS_HTTPX = False

logger = logging.getLogger(__name__)

# Konfigurasi URL Gemini sesuai spesifikasi
GEMINI_ENDPOINT_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
if HAS_HTTPX:
    TIMEOUT_ERRORS = (httpx.TimeoutException,)
    REQUEST_ERRORS = (httpx.RequestError,)
else:
    TIMEOUT_ERRORS = (requests.Timeout,)
    REQUEST_ERRORS = (requests.RequestException,)


def _mask_api_key(text: str, key: str) -> str:
    """Menyensor API key dari pesan log agar tidak pernah tercetak ke layar."""
    if not key:
        return text
    return str(text).replace(key, "[REDACTED_API_KEY]")


async def get_gemini_chat_reply(message: str) -> str:
    """Send an English-only SPHEREx chat request to Google Gemini."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        for candidate_env in [
            _BACKEND_DIR / ".env",
            _ROOT_DIR / ".env",
            Path.cwd() / "backend" / ".env",
            Path.cwd() / ".env",
        ]:
            if candidate_env.is_file():
                load_dotenv(dotenv_path=candidate_env, override=True)
                api_key = os.getenv("GEMINI_API_KEY")
                if api_key:
                    break

    if not api_key:
        logger.warning("GEMINI_API_KEY is not configured in the environment.")
        raise HTTPException(
            status_code=503,
            detail="Cosmic Guide is not configured. Set GEMINI_API_KEY in the backend environment.",
        )

    clean_message = (message or "").strip()
    if not clean_message:
        raise HTTPException(status_code=422, detail="Message must not be blank.")

    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": api_key,
    }

    target_url = GEMINI_ENDPOINT_URL
    payload = {
        "systemInstruction": {
            "parts": [{
                "text": (
                    "You are Cosmic Guide for the SPHEREx mission. Always answer in English, "
                    "answer the user's latest question directly, and do not invent observations, "
                    "measurements, or target-specific facts."
                )
            }]
        },
        "contents": [
            {
                "parts": [
                    {"text": clean_message}
                ]
            }
        ]
    }

    try:
        if HAS_HTTPX:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(target_url, json=payload, headers=headers)
        else:
            response = requests.post(target_url, json=payload, headers=headers, timeout=60.0)
    except TIMEOUT_ERRORS as exc:
        logger.warning("Gemini chat request timed out.")
        raise HTTPException(status_code=504, detail="The Gemini chat request timed out.") from exc
    except REQUEST_ERRORS as exc:
        safe_msg = _mask_api_key(str(exc), api_key)
        logger.error(f"Gemini chat connection error [{type(exc).__name__}]: {safe_msg}")
        raise HTTPException(status_code=502, detail="Could not connect to the Gemini chat service.") from exc

    if response.status_code != 200:
        safe_err = _mask_api_key(response.text, api_key)
        logger.warning(f"Gemini API returned status {response.status_code}: {safe_err}")
        raise HTTPException(status_code=502, detail="Gemini returned an error response.")

    try:
        result_json = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Gemini returned an unreadable response.") from exc

    if not isinstance(result_json, dict):
        raise HTTPException(status_code=502, detail="Gemini returned an invalid response.")
    candidates = result_json.get("candidates", [])
    if not isinstance(candidates, list) or not candidates or not isinstance(candidates[0], dict):
        raise HTTPException(status_code=502, detail="Gemini did not return a text answer.")
    content = candidates[0].get("content", {})
    parts = content.get("parts", []) if isinstance(content, dict) else []
    if not isinstance(parts, list):
        raise HTTPException(status_code=502, detail="Gemini did not return a text answer.")
    text_pieces = [
        part["text"]
        for part in parts
        if isinstance(part, dict) and isinstance(part.get("text"), str) and part["text"].strip()
    ]
    if not text_pieces:
        raise HTTPException(status_code=502, detail="Gemini did not return a text answer.")
    return "\n".join(text_pieces).strip()
