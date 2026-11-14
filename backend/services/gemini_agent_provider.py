import logging
import os

import httpx
from fastapi import HTTPException


logger = logging.getLogger(__name__)

GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_AGENT_MODEL = "gemini-3.5-flash-lite"


def build_request_payload(prompt: str, system_instruction: str) -> dict:
    return {
        "model": GEMINI_AGENT_MODEL,
        "system_instruction": system_instruction,
        "input": prompt,
        "generation_config": {"max_output_tokens": 500},
        "store": False,
    }


def extract_text_response(response_data: dict) -> str:
    if not isinstance(response_data, dict):
        raise HTTPException(status_code=502, detail="Gemini Agent mengembalikan respons yang tidak valid.")

    text_blocks = []
    steps = response_data.get("steps")
    if isinstance(steps, list):
        for step in steps:
            if not isinstance(step, dict) or step.get("type") != "model_output":
                continue
            content = step.get("content")
            if not isinstance(content, list):
                continue
            text_blocks.extend(
                item.get("text")
                for item in content
                if isinstance(item, dict)
                and item.get("type") == "text"
                and isinstance(item.get("text"), str)
            )

    result = "\n".join(block.strip() for block in text_blocks if block.strip()).strip()
    if not result:
        raise HTTPException(status_code=502, detail="Gemini Agent tidak mengembalikan jawaban teks.")
    return result


def generate_text(prompt: str, system_instruction: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Gemini Agent belum dikonfigurasi. Atur GEMINI_API_KEY pada environment backend.",
        )

    try:
        with httpx.Client(timeout=httpx.Timeout(35.0, connect=10.0)) as client:
            response = client.post(
                GEMINI_INTERACTIONS_URL,
                headers={"x-goog-api-key": api_key},
                json=build_request_payload(prompt, system_instruction),
            )
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Permintaan ke Gemini Agent melewati batas waktu. Silakan coba kembali.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Gemini Agent request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Tidak dapat menghubungi layanan Gemini Agent.",
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
            "Gemini Agent returned HTTP %s (provider status=%s): %s",
            response.status_code,
            provider_status or "unknown",
            provider_message or "no provider error message",
        )
        if response.status_code == 429:
            raise HTTPException(
                status_code=429,
                detail="Batas penggunaan Gemini Agent tercapai. Silakan coba kembali nanti.",
            )
        if response.status_code == 403:
            raise HTTPException(
                status_code=503,
                detail="Gemini Agent tidak tersedia untuk project ini. Periksa akses dan billing Gemini.",
            )
        raise HTTPException(
            status_code=502,
            detail="Gemini Agent gagal memproses permintaan. Silakan coba kembali.",
        )

    try:
        response_data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini Agent mengembalikan respons yang tidak dapat dibaca.",
        ) from exc

    return extract_text_response(response_data)
