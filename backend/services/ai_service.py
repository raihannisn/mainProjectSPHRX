import os
import json
import logging
from pathlib import Path
from dotenv import load_dotenv

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
FALLBACK_REPLY = "Maaf, Cosmic Guide sedang sibuk. Silakan coba lagi."


def _mask_api_key(text: str, key: str) -> str:
    """Menyensor API key dari pesan log agar tidak pernah tercetak ke layar."""
    if not key:
        return text
    return str(text).replace(key, "[REDACTED_API_KEY]")


async def get_gemini_chat_reply(message: str) -> str:
    """Mengirim prompt pesan ke Google Gemini API (gemini-3.5-flash)
    dan mengembalikan teks respons jawaban.
    Jika terjadi kendala (API Key tidak ada, timeout, 503, dsb),
    mengembalikan pesan fallback yang ramah pengguna.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Coba muat ulang sekali lagi dari candidate paths jika belum termuat
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
        logger.warning("GEMINI_API_KEY belum dikonfigurasi di file .env maupun environment variable.")
        return FALLBACK_REPLY

    clean_message = (message or "").strip()
    if not clean_message:
        return "Halo! Ada yang bisa saya bantu tentang SPHEREx, astronomi, atau eksplorasi kosmik?"

    # 1. URL dengan query parameter ?key=... (bukan di header)
    target_url = f"{GEMINI_ENDPOINT_URL}?key={api_key}"

    # 2. Header Content-Type: application/json
    headers = {
        "Content-Type": "application/json"
    }

    # 3. Format body request sesuai format Gemini: {"contents": [{"parts": [{"text": message}]}]}
    payload = {
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
                if response.status_code != 200:
                    safe_err = _mask_api_key(response.text, api_key)
                    logger.warning(f"Gemini API returned status {response.status_code}: {safe_err}")
                    return FALLBACK_REPLY
                result_json = response.json()
        else:
            # Gunakan requests dengan timeout 60.0 detik agar cukup waktu untuk model generate
            response = requests.post(target_url, json=payload, headers=headers, timeout=60.0)
            if response.status_code != 200:
                safe_err = _mask_api_key(response.text, api_key)
                logger.warning(f"Gemini API returned status {response.status_code}: {safe_err}")
                return FALLBACK_REPLY
            result_json = response.json()

        # 4. Ambil jawaban teks dari response Gemini (biasanya di candidates[0].content.parts[0].text)
        candidates = result_json.get("candidates", [])
        if not candidates:
            return FALLBACK_REPLY

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return FALLBACK_REPLY

        # Ekstrak teks bagian
        text_pieces = []
        for part in parts:
            if isinstance(part, dict):
                t = part.get("text", "")
                if t:
                    text_pieces.append(t)

        if text_pieces:
            return "\n".join(text_pieces).strip()

        # Fallback langsung ke parts[0].text
        direct_text = parts[0].get("text", "")
        if direct_text:
            return direct_text.strip()

        return FALLBACK_REPLY

    except Exception as e:
        safe_msg = _mask_api_key(str(e), api_key)
        logger.error(f"Error during Gemini API call [{type(e).__name__}]: {safe_msg}")
        return FALLBACK_REPLY
