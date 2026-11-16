import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Optional

import httpx
from fastapi import HTTPException

from services.agent_service import build_agent_system_instruction


logger = logging.getLogger(__name__)

GEMINI_LIVE_TOKEN_URL = "https://generativelanguage.googleapis.com/v1beta/auth_tokens"
GEMINI_LIVE_MODEL = "models/gemini-3.8-live"


def _provider_error_detail(response: httpx.Response) -> str:
    try:
        response_data = response.json()
    except ValueError:
        return "provider error response was not valid JSON"

    error = response_data.get("error") if isinstance(response_data, dict) else None
    if not isinstance(error, dict):
        return "provider error response did not include error details"

    parts = []
    status = error.get("status")
    if isinstance(status, str) and status:
        parts.append(status)

    message = error.get("message")
    if isinstance(message, str) and message:
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            message = message.replace(api_key, "[REDACTED]")
        message = " ".join(message.split())
        parts.append(message[:400])

    return ": ".join(parts) or "provider returned no error details"


def build_live_token_payload(
    language: str,
    object_id: Optional[str] = None,
    object_record: Optional[Dict[str, object]] = None,
    now: Optional[datetime] = None,
) -> dict:
    current_time = now or datetime.now(timezone.utc)
    if current_time.tzinfo is None:
        current_time = current_time.replace(tzinfo=timezone.utc)
    live_config = {
        "generationConfig": {"responseModalities": ["AUDIO"]},
        "systemInstruction": {
            "parts": [
                {
                    "text": build_agent_system_instruction(
                        language,
                        object_id,
                        object_record,
                    )
                }
            ]
        },
        "inputAudioTranscription": {},
        "outputAudioTranscription": {},
    }
    bidi_setup = {
        "model": GEMINI_LIVE_MODEL,
        **live_config,
    }
    return {
        "uses": 1,
        "expireTime": (current_time + timedelta(minutes=5)).isoformat().replace("+00:00", "Z"),
        "newSessionExpireTime": (current_time + timedelta(minutes=1)).isoformat().replace("+00:00", "Z"),
        "bidiGenerateContentSetup": bidi_setup,
    }


def create_live_session_token(
    language: str,
    object_id: Optional[str] = None,
    object_record: Optional[Dict[str, object]] = None,
) -> dict:
    if os.getenv("GEMINI_LIVE_DEMO_ENABLED", "").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="Continuous Voice demo is disabled. Set GEMINI_LIVE_DEMO_ENABLED=true on the backend to enable it.",
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini Live is not configured. Set GEMINI_API_KEY in the backend environment.",
        )

    payload = build_live_token_payload(language, object_id, object_record)
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0)) as client:
            response = client.post(
                GEMINI_LIVE_TOKEN_URL,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="The Gemini Live session request timed out.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Gemini Live token request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the Gemini Live service.",
        ) from exc

    if response.is_error:
        logger.warning(
            "Gemini Live token request returned HTTP %s; %s",
            response.status_code,
            _provider_error_detail(response),
        )
        if response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="The Gemini Live session usage limit has been reached. Please try again later.",
            )
        if response.status_code == 403:
            raise HTTPException(
                status_code=503,
                detail="Gemini Live is unavailable for this project. Check access and billing.",
            )
        raise HTTPException(
            status_code=502,
            detail="Gemini could not create a real-time voice session.",
        )

    try:
        response_data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini Live returned an unreadable session response.",
        ) from exc

    token = response_data.get("name") if isinstance(response_data, dict) else None
    if not isinstance(token, str) or not token:
        raise HTTPException(
            status_code=502,
            detail="Gemini Live did not return a session token.",
        )

    return {
        "token": token,
        "model": GEMINI_LIVE_MODEL,
        "config": {
            key: value
            for key, value in payload["bidiGenerateContentSetup"].items()
            if key != "model"
        },
        "expiresAt": payload["expireTime"],
    }
