from functools import lru_cache

from services.gemini_tts_provider import synthesize_speech


SCRIPTS = {
    "welcome": {
        "label": "Welcome",
        "en": (
            "Welcome to the SPHEREx Explorer. I am a digital guide here to help you "
            "understand the information available. I am not an official NASA spokesperson."
        ),
    },
    "mission-introduction": {
        "label": "Mission introduction",
        "en": (
            "SPHEREx is a space-based infrared sky survey mission. It observes the sky "
            "in many spectral bands to help study the universe, galaxies, and icy "
            "materials in the Milky Way."
        ),
    },
    "exploration-guidance": {
        "label": "Exploration guidance",
        "en": (
            "As you explore the data, use the information and sources provided by the "
            "backend. If a value or result is not available, we will say so clearly."
        ),
    },
}

VOICE_PRESETS = {
    "mission-liaison": {
        "voice": "Nika",
        "style": "warm, clear, and approachable narration",
        "label": "Mission Liaison",
    },
    "warm-guide": {
        "voice": "Sulafat",
        "style": "warm, patient, clear narration",
        "label": "Warm Guide",
    },
}


def get_script_catalog(language: str) -> list:
    normalized_language = language.strip().lower()
    if normalized_language not in ("id", "en"):
        raise ValueError("Unsupported voice-over language.")
    return [
        {"id": script_id, "label": script["label"], "text": script["en"]}
        for script_id, script in SCRIPTS.items()
    ]


@lru_cache(maxsize=12)
def _generate_cached(script_id: str, language: str, voice_preset: str) -> bytes:
    text = SCRIPTS[script_id][language]
    preset = VOICE_PRESETS[voice_preset]
    return synthesize_speech(text=text, voice=preset["voice"], style=preset["style"])


def generate_voiceover(script_id: str, language: str, voice_preset: str) -> bytes:
    normalized_script_id = script_id.strip().lower()
    normalized_language = language.strip().lower()
    normalized_voice_preset = voice_preset.strip().lower()

    if normalized_script_id not in SCRIPTS:
        raise ValueError("Unknown voice-over script.")
    if normalized_language not in ("id", "en"):
        raise ValueError("Unsupported voice-over language.")
    if normalized_voice_preset not in VOICE_PRESETS:
        raise ValueError("Unknown voice preset.")
    return _generate_cached(normalized_script_id, "en", normalized_voice_preset)


def generate_spoken_text(text: str, language: str, voice_preset: str) -> bytes:
    normalized_text = text.strip()
    normalized_language = language.strip().lower()
    normalized_voice_preset = voice_preset.strip().lower()

    if not normalized_text:
        raise ValueError("Speech text cannot be blank.")
    if len(normalized_text) > 500:
        raise ValueError("Speech text exceeds the supported length.")
    if normalized_language not in ("id", "en"):
        raise ValueError("Unsupported voice-over language.")
    if normalized_voice_preset not in VOICE_PRESETS:
        raise ValueError("Unknown voice preset.")

    preset = VOICE_PRESETS[normalized_voice_preset]
    return synthesize_speech(
        text=normalized_text,
        voice=preset["voice"],
        style=preset["style"],
    )
