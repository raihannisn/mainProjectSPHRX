import base64
import os
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from services.gemini_tts_provider import (
    build_request_payload,
    extract_wav_audio,
    synthesize_speech,
)
from services.voiceover_service import (
    _generate_cached,
    generate_voiceover,
    generate_spoken_text,
    get_script_catalog,
)


class GeminiTtsProviderTests(unittest.TestCase):
    def test_build_request_payload_uses_interactions_tts_contract(self):
        payload = build_request_payload("Hello", "Rasalgethi", "calm narration")

        self.assertEqual(payload["model"], "gemini-3.8-flash-tts")
        self.assertEqual(payload["response_format"], {"type": "audio"})
        self.assertEqual(
            payload["generation_config"]["speech_config"],
            [{"voice": "Rasalgethi"}],
        )
        text_item = payload["input"][0]["content"][0]
        self.assertEqual(text_item["text"], "Hello")
        self.assertEqual(text_item["annotations"][0]["style"], "calm narration")

    def test_extract_wav_audio_from_model_output(self):
        wav_data = b"RIFF\x00\x00\x00\x00WAVE"
        response_data = {
            "steps": [
                {
                    "type": "model_output",
                    "content": [
                        {
                            "type": "audio",
                            "data": base64.b64encode(wav_data).decode("ascii"),
                        }
                    ],
                }
            ]
        }

        self.assertEqual(extract_wav_audio(response_data), wav_data)

    def test_extract_wav_audio_rejects_missing_audio(self):
        with self.assertRaises(HTTPException) as error:
            extract_wav_audio({"steps": []})

        self.assertEqual(error.exception.status_code, 502)

    def test_extract_wav_audio_supports_inline_data_shape(self):
        wav_data = b"RIFF\x00\x00\x00\x00WAVE"
        response_data = {
            "candidates": [
                {
                    "content": {
                        "parts": [
                            {
                                "inlineData": {
                                    "mimeType": "audio/wav",
                                    "data": base64.b64encode(wav_data).decode("ascii"),
                                }
                            }
                        ]
                    }
                }
            ]
        }

        self.assertEqual(extract_wav_audio(response_data), wav_data)

    def test_upstream_error_logs_provider_details_without_api_key(self):
        api_key = "test-gemini-secret"
        response = unittest.mock.Mock()
        response.is_error = True
        response.status_code = 400
        response.json.return_value = {
            "error": {
                "status": "INVALID_ARGUMENT",
                "message": f"Invalid request using {api_key}",
            }
        }

        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": api_key}),
            patch("services.gemini_tts_provider.httpx.Client") as client_class,
            self.assertLogs("services.gemini_tts_provider", level="WARNING") as logs,
        ):
            client_class.return_value.__enter__.return_value.post.return_value = response
            with self.assertRaises(HTTPException) as error:
                synthesize_speech("Hello", "Rasalgethi", "calm narration")

        self.assertEqual(error.exception.status_code, 502)
        self.assertIn("HTTP 400", logs.output[0])
        self.assertIn("INVALID_ARGUMENT", logs.output[0])
        self.assertIn("[REDACTED]", logs.output[0])
        self.assertNotIn(api_key, logs.output[0])


class VoiceoverServiceTests(unittest.TestCase):
    def setUp(self):
        _generate_cached.cache_clear()

    def tearDown(self):
        _generate_cached.cache_clear()

    def test_script_catalog_is_english_even_when_indonesian_is_requested(self):
        catalog = get_script_catalog("id")

        self.assertEqual(len(catalog), 3)
        self.assertIn("Welcome", catalog[0]["text"])
        self.assertNotIn("Selamat datang", catalog[0]["text"])

    def test_voiceover_uses_cached_english_script_even_when_indonesian_is_requested(self):
        with patch("services.voiceover_service.synthesize_speech", return_value=b"wav") as synthesize:
            first = generate_voiceover("welcome", "id", "mission-liaison")
            second = generate_voiceover("welcome", "id", "mission-liaison")

        self.assertEqual(first, b"wav")
        self.assertIs(first, second)
        synthesize.assert_called_once()
        self.assertIn("Welcome", synthesize.call_args.kwargs["text"])

    def test_voiceover_normalizes_input_and_uses_cache(self):
        with patch("services.voiceover_service.synthesize_speech", return_value=b"wav") as synthesize:
            result = generate_voiceover(" WELCOME ", " EN ", " MISSION-LIAISON ")

        self.assertEqual(result, b"wav")
        synthesize.assert_called_once_with(
            text="Welcome to the SPHEREx Explorer. I am a digital guide here to help you understand the information available. I am not an official NASA spokesperson.",
            voice="Kore",
            style="warm, clear, and approachable narration",
        )

    def test_chat_spoken_text_uses_the_supported_kore_voice(self):
        with patch("services.voiceover_service.synthesize_speech", return_value=b"wav") as synthesize:
            result = generate_spoken_text("Hello from Cosmic Guide.", "en", "mission-liaison")

        self.assertEqual(result, b"wav")
        synthesize.assert_called_once_with(
            text="Hello from Cosmic Guide.",
            voice="Kore",
            style="warm, clear, and approachable narration",
        )

    def test_unknown_script_is_rejected(self):
        with self.assertRaises(ValueError):
            generate_voiceover("unapproved", "id", "mission-liaison")


if __name__ == "__main__":
    unittest.main()
