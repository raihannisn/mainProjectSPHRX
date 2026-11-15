import logging
import os
import re
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException


logger = logging.getLogger(__name__)

GEMINI_FILES_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files"
GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"
GEMINI_FILES_API_URL = "https://generativelanguage.googleapis.com/v1beta"
GEMINI_TRANSCRIPTION_MODEL = "gemini-3.5-transcribe"


def build_transcription_payload(file_uri: str, mime_type: str, language: str) -> dict:
    language_code = "id-ID" if language == "id" else "en-US"
    return {
        "model": GEMINI_TRANSCRIPTION_MODEL,
        "input": [
            {"type": "audio", "uri": file_uri, "mime_type": mime_type}
        ],
        "generation_config": {
            "transcription_config": {"language_codes": [language_code]}
        },
        "store": False,
    }


def extract_transcript(response_data: dict) -> str:
    if not isinstance(response_data, dict):
        raise HTTPException(status_code=502, detail="Gemini mengembalikan respons transkripsi yang tidak valid.")

    output_text = response_data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        text_blocks = [output_text]
    else:
        text_blocks = []
        outputs = response_data.get("outputs")
        if isinstance(outputs, list):
            text_blocks.extend(
                item.get("text")
                for item in outputs
                if isinstance(item, dict)
                and item.get("type") == "text"
                and isinstance(item.get("text"), str)
            )

        steps = response_data.get("steps")
        if not text_blocks and isinstance(steps, list):
            for step in steps:
                if not isinstance(step, dict) or step.get("type") != "model_output":
                    continue
                content = step.get("content")
                if isinstance(content, list):
                    text_blocks.extend(
                        item.get("text")
                        for item in content
                        if isinstance(item, dict)
                        and item.get("type") == "text"
                        and isinstance(item.get("text"), str)
                    )

    transcript = "\n".join(
        text.strip() for text in text_blocks if text and text.strip()
    ).strip()
    if not transcript:
        raise HTTPException(status_code=422, detail="Tidak ada ucapan yang dapat dikenali.")
    if len(transcript) > 500:
        raise HTTPException(
            status_code=422,
            detail="Transkrip melebihi batas 500 karakter. Rekam ucapan yang lebih singkat.",
        )
    return transcript


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
        parts.append(" ".join(message.split())[:400])

    return ": ".join(parts) or "provider returned no error details"


def _raise_provider_error(response: httpx.Response, stage: str) -> None:
    logger.warning(
        "Gemini transcription %s returned HTTP %s; %s",
        stage,
        response.status_code,
        _provider_error_detail(response),
    )
    if response.status_code == 429:
        raise HTTPException(
            status_code=429,
            detail="Batas penggunaan transkripsi Gemini tercapai. Silakan coba kembali nanti.",
        )
    if response.status_code == 403:
        raise HTTPException(
            status_code=503,
            detail="Transkripsi Gemini tidak tersedia untuk project ini. Periksa akses dan billing.",
        )
    raise HTTPException(
        status_code=502,
        detail="Gemini gagal memproses transkripsi. Silakan coba kembali.",
    )


def _response_json(response: httpx.Response) -> dict:
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail="Gemini mengembalikan respons transkripsi yang tidak dapat dibaca.",
        ) from exc
    if not isinstance(data, dict):
        raise HTTPException(
            status_code=502,
            detail="Gemini mengembalikan respons transkripsi yang tidak valid.",
        )
    return data


def transcribe_audio(audio: bytes, mime_type: str, language: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="Transkripsi Gemini belum dikonfigurasi. Atur GEMINI_API_KEY pada environment backend.",
        )

    file_name = None
    try:
        with httpx.Client(timeout=httpx.Timeout(45.0, connect=10.0)) as client:
            upload_start = client.post(
                GEMINI_FILES_URL,
                headers={
                    "x-goog-api-key": api_key,
                    "X-Goog-Upload-Protocol": "resumable",
                    "X-Goog-Upload-Command": "start",
                    "X-Goog-Upload-Header-Content-Length": str(len(audio)),
                    "X-Goog-Upload-Header-Content-Type": mime_type,
                    "Content-Type": "application/json",
                },
                json={"file": {"display_name": "spherex-push-to-talk"}},
            )
            if upload_start.is_error:
                _raise_provider_error(upload_start, "upload initialization")

            upload_url = upload_start.headers.get("x-goog-upload-url")
            parsed_upload_url = urlsplit(upload_url or "")
            if (
                parsed_upload_url.scheme != "https"
                or parsed_upload_url.hostname != "generativelanguage.googleapis.com"
                or not parsed_upload_url.path.startswith("/upload/")
            ):
                raise HTTPException(
                    status_code=502,
                    detail="Gemini mengembalikan alamat unggah yang tidak valid.",
                )

            upload_response = client.post(
                upload_url,
                headers={
                    "X-Goog-Upload-Offset": "0",
                    "X-Goog-Upload-Command": "upload, finalize",
                    "Content-Length": str(len(audio)),
                },
                content=audio,
            )
            if upload_response.is_error:
                _raise_provider_error(upload_response, "audio upload")

            file_info = _response_json(upload_response).get("file")
            if not isinstance(file_info, dict):
                raise HTTPException(
                    status_code=502,
                    detail="Gemini tidak mengonfirmasi unggahan audio.",
                )
            file_name = file_info.get("name")
            file_uri = file_info.get("uri")
            parsed_file_uri = urlsplit(file_uri or "")
            if (
                not isinstance(file_name, str)
                or not re.fullmatch(r"files/[A-Za-z0-9_-]+", file_name)
                or not isinstance(file_uri, str)
                or parsed_file_uri.scheme != "https"
                or parsed_file_uri.hostname != "generativelanguage.googleapis.com"
            ):
                raise HTTPException(
                    status_code=502,
                    detail="Gemini mengembalikan referensi audio yang tidak valid.",
                )

            interaction = client.post(
                GEMINI_INTERACTIONS_URL,
                headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                json=build_transcription_payload(file_uri, mime_type, language),
            )
            if interaction.is_error:
                _raise_provider_error(interaction, "interaction")
            return extract_transcript(_response_json(interaction))
    except httpx.TimeoutException as exc:
        raise HTTPException(
            status_code=504,
            detail="Transkripsi Gemini melewati batas waktu. Silakan coba kembali.",
        ) from exc
    except httpx.RequestError as exc:
        logger.warning("Gemini transcription request failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=502,
            detail="Tidak dapat menghubungi layanan transkripsi Gemini.",
        ) from exc
    finally:
        if file_name:
            try:
                with httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
                    deletion = client.delete(
                        f"{GEMINI_FILES_API_URL}/{file_name}",
                        headers={"x-goog-api-key": api_key},
                    )
                if deletion.is_error:
                    logger.warning(
                        "Gemini transcription file cleanup returned HTTP %s.",
                        deletion.status_code,
                    )
            except httpx.RequestError as exc:
                logger.warning(
                    "Gemini transcription file cleanup failed: %s",
                    type(exc).__name__,
                )
