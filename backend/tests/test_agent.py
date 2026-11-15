import asyncio
import os
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException
import httpx
from starlette.requests import Request

from routes.agent import (
    AgentChatRequest,
    AgentLiveSessionRequest,
    AgentMessage,
    AgentSpeechRequest,
    create_agent_response,
    create_live_voice_session,
    create_spoken_text,
    transcribe_voice_input,
)
from services.agent_service import (
    SYSTEM_INSTRUCTIONS,
    build_agent_system_instruction,
    build_conversation_prompt,
    generate_agent_response,
)
from services.object_service import ObjectRecordNotFound, get_object_record
from services.gemini_transcription_provider import (
    build_transcription_payload,
    extract_transcript,
    transcribe_audio,
)
from services.gemini_live_provider import (
    GEMINI_LIVE_MODEL,
    build_live_token_payload,
    create_live_session_token,
)
from services.gemini_agent_provider import (
    build_request_payload,
    extract_text_response,
    generate_text,
)
from utils.rate_limiter import InMemoryRateLimiter


class GeminiAgentProviderTests(unittest.TestCase):
    def test_build_request_payload_uses_stateless_interactions_contract(self):
        payload = build_request_payload("Pengguna: Halo", "Kamu pemandu.")

        self.assertEqual(payload["model"], "gemini-3.5-flash-lite")
        self.assertEqual(payload["input"], "Pengguna: Halo")
        self.assertEqual(payload["system_instruction"], "Kamu pemandu.")
        self.assertEqual(payload["store"], False)
        self.assertEqual(payload["generation_config"]["max_output_tokens"], 500)

    def test_extract_text_response_uses_model_output_text(self):
        response_data = {
            "steps": [
                {
                    "type": "model_output",
                    "content": [
                        {"type": "text", "text": " Jawaban "},
                        {"type": "text", "text": "ringkas."},
                    ],
                }
            ]
        }

        self.assertEqual(extract_text_response(response_data), "Jawaban\nringkas.")

    def test_extract_text_response_rejects_empty_response(self):
        with self.assertRaises(HTTPException) as error:
            extract_text_response({"steps": []})

        self.assertEqual(error.exception.status_code, 502)

    def test_generate_text_requires_backend_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as error:
                generate_text("Prompt", "Instructions")

        self.assertEqual(error.exception.status_code, 503)


class AgentServiceTests(unittest.TestCase):
    def test_object_service_reads_catalog_and_rejects_unknown_ids(self):
        self.assertEqual(get_object_record("MARS")["name"], "Mars")
        with self.assertRaises(ObjectRecordNotFound):
            get_object_record("unknown-object")

    def test_conversation_prompt_uses_backend_catalog_record(self):
        prompt = build_conversation_prompt(
            [{"role": "user", "content": "Apa objek ini?"}],
            "id",
            "mars",
            {
                "name": "Mars",
                "classification": "planet",
            },
        )

        self.assertIn("Catatan katalog backend", prompt)
        self.assertIn('"object_id": "mars"', prompt)
        self.assertIn("Mars", prompt)
        self.assertNotIn("vela-ridge", prompt)
        self.assertIn("tidak tepercaya", prompt)

    def test_conversation_prompt_marks_unknown_backend_object(self):
        prompt = build_conversation_prompt(
            [{"role": "user", "content": "Apa objek ini?"}],
            "id",
            "rcw-36",
        )

        self.assertIn("tidak ditemukan di katalog backend", prompt)

    def test_agent_service_selects_requested_language_instructions(self):
        messages = [{"role": "user", "content": "Apa itu SPHEREx?"}]

        with patch("services.agent_service.generate_text", return_value="Jawaban") as generate:
            answer = generate_agent_response(messages, "id")

        self.assertEqual(answer, "Jawaban")
        self.assertEqual(generate.call_args.args[1], SYSTEM_INSTRUCTIONS["id"])

    def test_agent_instructions_clarify_a_target_that_conflicts_with_selection(self):
        instruction = build_agent_system_instruction(
            "en",
            "rcw-36",
            {"name": "RCW 36 Emission Nebula"},
        )

        self.assertIn("YouTube 36", instruction)
        self.assertIn("do not silently substitute the selected object", instruction)
        self.assertIn("briefly ask whether they meant that object or another one", instruction)
        self.assertIn("source label is not a verified citation", instruction)

    def test_unknown_object_observation_question_gets_general_only_guidance(self):
        messages = [{"role": "user", "content": "How does SPHEREx observe it?"}]

        with patch("services.agent_service.generate_text", return_value="Answer") as generate:
            generate_agent_response(messages, "en", "rcw-36")

        instructions = generate.call_args.args[1]
        self.assertIn("cannot confirm a target-specific observation", instructions)
        self.assertIn("0.75 to 5.0 micrometers", instructions)
        self.assertIn("not evidence that SPHEREx observed the target", instructions)
        self.assertIn("Do not claim infrared light penetrates dust clouds", instructions)
        self.assertIn("was not found in the backend catalog", instructions)


class AgentRequestTests(unittest.TestCase):
    def test_chat_request_rejects_non_user_final_message(self):
        with self.assertRaises(ValueError):
            AgentChatRequest(
                lang="id",
                messages=[AgentMessage(role="bot", content="Halo")],
            )

    def test_chat_request_rejects_blank_messages(self):
        with self.assertRaises(ValueError):
            AgentMessage(role="user", content="   ")

    def test_chat_request_normalizes_and_validates_object_id(self):
        request = AgentChatRequest(
            objectId="  Mars ",
            lang="id",
            messages=[AgentMessage(role="user", content="Apa ini?")],
        )
        self.assertEqual(request.objectId, "mars")

        with self.assertRaises(ValueError):
            AgentChatRequest(
                objectId="../mars",
                lang="id",
                messages=[AgentMessage(role="user", content="Apa ini?")],
            )

        with self.assertRaises(ValueError):
            AgentChatRequest(
                objectContext={"name": "Untrusted"},
                lang="id",
                messages=[AgentMessage(role="user", content="Apa ini?")],
            )

    def test_chat_route_returns_agent_message_and_sources(self):
        request = AgentChatRequest(
            lang="en",
            messages=[AgentMessage(role="user", content="What is SPHEREx?")],
        )
        with patch("routes.agent.generate_agent_response", return_value="A sky survey mission."):
            result = create_agent_response(request)

        self.assertEqual(
            result,
            {
                "success": True,
                "data": {"message": "A sky survey mission.", "sources": []},
            },
        )

    def test_chat_route_uses_catalog_record_and_returns_its_api_link(self):
        request = AgentChatRequest(
            objectId="mars",
            lang="en",
            messages=[AgentMessage(role="user", content="What is this?")],
        )
        record = {"name": "Mars", "classification": "planet"}
        with (
            patch("routes.agent.get_object_record", return_value=record),
            patch("routes.agent.generate_agent_response", return_value="Catalog entry.") as generate,
        ):
            result = create_agent_response(request)

        self.assertEqual(generate.call_args.kwargs["object_record"], record)
        self.assertEqual(
            result["data"]["sources"],
            [{"title": "Backend object catalog: Mars", "url": "/api/objects/mars"}],
        )

    def test_chat_route_allows_unknown_object_but_does_not_create_source(self):
        request = AgentChatRequest(
            objectId="rcw-36",
            lang="en",
            messages=[AgentMessage(role="user", content="What is this?")],
        )
        with (
            patch("routes.agent.get_object_record", side_effect=ObjectRecordNotFound("rcw-36")),
            patch("routes.agent.generate_agent_response", return_value="No catalog data.") as generate,
        ):
            result = create_agent_response(request)

        self.assertIsNone(generate.call_args.kwargs["object_record"])
        self.assertEqual(result["data"]["sources"], [])

    def test_chat_route_surfaces_catalog_configuration_errors(self):
        request = AgentChatRequest(
            objectId="mars",
            lang="en",
            messages=[AgentMessage(role="user", content="What is this?")],
        )
        with patch(
            "routes.agent.get_object_record",
            side_effect=HTTPException(status_code=500, detail="Invalid catalog."),
        ):
            with self.assertRaises(HTTPException) as error:
                create_agent_response(request)

        self.assertEqual(error.exception.status_code, 500)

    def test_spoken_text_route_returns_wav_response(self):
        request = AgentSpeechRequest(text="Hello", language="en")
        with patch("routes.agent.generate_spoken_text", return_value=b"wav"):
            response = create_spoken_text(request)

        self.assertEqual(response.body, b"wav")
        self.assertEqual(response.media_type, "audio/wav")


class AgentVoiceInputTests(unittest.TestCase):
    def test_transcription_payload_uses_selected_language_and_stateless_input(self):
        payload = build_transcription_payload(
            "https://generativelanguage.googleapis.com/file.wav",
            "audio/wav",
            "id",
        )

        self.assertEqual(payload["model"], "gemini-3.5-transcribe")
        self.assertEqual(
            payload["input"],
            [
                {
                    "type": "audio",
                    "uri": "https://generativelanguage.googleapis.com/file.wav",
                    "mime_type": "audio/wav",
                }
            ],
        )
        self.assertEqual(
            payload["generation_config"]["transcription_config"]["language_codes"],
            ["id-ID"],
        )
        self.assertEqual(payload["store"], False)

    def test_extract_transcript_supports_interactions_output_shapes(self):
        self.assertEqual(
            extract_transcript({"output_text": "  Halo SPHEREx.  ", "outputs": [
                {"type": "text", "text": "duplicate"}
            ]}),
            "Halo SPHEREx.",
        )
        self.assertEqual(
            extract_transcript(
                {
                    "steps": [
                        {
                            "type": "model_output",
                            "content": [{"type": "text", "text": " Transkrip "}],
                        }
                    ]
                }
            ),
            "Transkrip",
        )

    def test_extract_transcript_rejects_empty_or_oversized_text(self):
        with self.assertRaises(HTTPException) as empty_error:
            extract_transcript({"output_text": " "})
        self.assertEqual(empty_error.exception.status_code, 422)

        with self.assertRaises(HTTPException) as long_error:
            extract_transcript({"output_text": "a" * 501})
        self.assertEqual(long_error.exception.status_code, 422)

    def test_transcription_requires_backend_key(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as error:
                transcribe_audio(b"audio", "audio/webm", "en")
        self.assertEqual(error.exception.status_code, 503)

    def test_transcription_uploads_audio_and_deletes_temporary_file(self):
        gemini = MagicMock()
        gemini.__enter__.return_value = gemini
        gemini.post.side_effect = [
            httpx.Response(
                200,
                headers={
                    "x-goog-upload-url":
                        "https://generativelanguage.googleapis.com/upload/v1beta/files/session"
                },
            ),
            httpx.Response(
                200,
                json={
                    "file": {
                        "name": "files/temporary_audio",
                        "uri": "https://generativelanguage.googleapis.com/v1beta/files/temporary_audio",
                    }
                },
            ),
            httpx.Response(200, json={"output_text": "How does SPHEREx work?"}),
        ]
        cleanup = MagicMock()
        cleanup.__enter__.return_value = cleanup
        cleanup.delete.return_value = httpx.Response(200)

        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}),
            patch(
                "services.gemini_transcription_provider.httpx.Client",
                side_effect=[gemini, cleanup],
            ),
        ):
            transcript = transcribe_audio(b"audio", "audio/webm", "en")

        self.assertEqual(transcript, "How does SPHEREx work?")
        self.assertEqual(gemini.post.call_count, 3)
        self.assertTrue(cleanup.delete.called)

    def test_transcription_logs_sanitized_provider_error_and_stage(self):
        gemini = MagicMock()
        gemini.__enter__.return_value = gemini
        gemini.post.side_effect = [
            httpx.Response(
                200,
                headers={
                    "x-goog-upload-url":
                        "https://generativelanguage.googleapis.com/upload/v1beta/files/session"
                },
            ),
            httpx.Response(
                200,
                json={
                    "file": {
                        "name": "files/temporary_audio",
                        "uri": "https://generativelanguage.googleapis.com/v1beta/files/temporary_audio",
                    }
                },
            ),
            httpx.Response(
                400,
                json={
                    "error": {
                        "status": "INVALID_ARGUMENT",
                        "message": "Invalid request test-secret",
                    }
                },
            ),
        ]
        cleanup = MagicMock()
        cleanup.__enter__.return_value = cleanup
        cleanup.delete.return_value = httpx.Response(200)

        with (
            patch.dict(os.environ, {"GEMINI_API_KEY": "test-secret"}),
            patch(
                "services.gemini_transcription_provider.httpx.Client",
                side_effect=[gemini, cleanup],
            ),
            patch("services.gemini_transcription_provider.logger.warning") as warning,
        ):
            with self.assertRaises(HTTPException):
                transcribe_audio(b"audio", "audio/webm", "en")

        log_message = " ".join(str(value) for value in warning.call_args.args)
        self.assertIn("interaction", log_message)
        self.assertIn("INVALID_ARGUMENT", log_message)
        self.assertIn("Invalid request [REDACTED]", log_message)
        self.assertNotIn("test-secret", log_message)

    def test_transcription_route_validates_content_type_and_size(self):
        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        unsupported = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/agent/voice/transcribe",
                "headers": [(b"content-type", b"application/octet-stream")],
            },
            receive,
        )
        with self.assertRaises(HTTPException) as type_error:
            asyncio.run(transcribe_voice_input(unsupported, "en"))
        self.assertEqual(type_error.exception.status_code, 415)

        oversized = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/agent/voice/transcribe",
                "headers": [
                    (b"content-type", b"audio/webm"),
                    (b"content-length", b"8388609"),
                ],
            },
            receive,
        )
        with self.assertRaises(HTTPException) as size_error:
            asyncio.run(transcribe_voice_input(oversized, "en"))
        self.assertEqual(size_error.exception.status_code, 413)

    def test_transcription_route_returns_recognized_text(self):
        async def receive():
            return {"type": "http.request", "body": b"audio", "more_body": False}

        request = Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/api/agent/voice/transcribe",
                "headers": [(b"content-type", b"audio/webm;codecs=opus")],
            },
            receive,
        )
        with patch("routes.agent.transcribe_audio", return_value="Apa itu SPHEREx?"):
            result = asyncio.run(transcribe_voice_input(request, "id"))

        self.assertEqual(
            result,
            {
                "success": True,
                "data": {"transcript": "Apa itu SPHEREx?", "language": "id"},
            },
        )


class AgentLiveVoiceTests(unittest.TestCase):
    def test_live_token_payload_is_one_use_short_lived_and_grounded(self):
        from datetime import datetime, timezone

        payload = build_live_token_payload(
            "en",
            "mars",
            {"name": "Mars"},
            now=datetime(2026, 1, 1, tzinfo=timezone.utc),
        )

        self.assertEqual(payload["uses"], 1)
        self.assertEqual(payload["newSessionExpireTime"], "2026-01-01T00:01:00Z")
        self.assertEqual(payload["expireTime"], "2026-01-01T00:05:00Z")
        self.assertNotIn("liveConnectConstraints", payload)
        self.assertNotIn("config", payload)
        bidi_setup = payload["bidiGenerateContentSetup"]
        self.assertEqual(
            bidi_setup["model"],
            GEMINI_LIVE_MODEL,
        )
        self.assertEqual(
            bidi_setup["generationConfig"]["responseModalities"],
            ["AUDIO"],
        )
        self.assertIn(
            "Backend catalog record",
            bidi_setup["systemInstruction"]["parts"][0]["text"],
        )

    def test_live_session_is_disabled_by_default(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as error:
                create_live_session_token("id")
        self.assertEqual(error.exception.status_code, 503)

    def test_live_session_returns_ephemeral_token_without_api_key(self):
        gemini = MagicMock()
        gemini.__enter__.return_value = gemini
        gemini.post.return_value = httpx.Response(
            200,
            json={"name": "auth_tokens/temporary"},
        )
        with (
            patch.dict(
                os.environ,
                {
                    "GEMINI_LIVE_DEMO_ENABLED": "true",
                    "GEMINI_API_KEY": "test-key",
                },
            ),
            patch("services.gemini_live_provider.httpx.Client", return_value=gemini),
        ):
            result = create_live_session_token("id")

        self.assertEqual(result["token"], "auth_tokens/temporary")
        self.assertEqual(result["model"], GEMINI_LIVE_MODEL)
        self.assertEqual(
            result["config"]["generationConfig"]["responseModalities"],
            ["AUDIO"],
        )
        self.assertNotIn("apiKey", result)

    def test_live_provider_logs_sanitized_google_error_reason(self):
        gemini = MagicMock()
        gemini.__enter__.return_value = gemini
        gemini.post.return_value = httpx.Response(
            400,
            json={
                "error": {
                    "code": 400,
                    "status": "INVALID_ARGUMENT",
                    "message": "Invalid request test-secret",
                }
            },
        )

        with (
            patch.dict(
                os.environ,
                {
                    "GEMINI_LIVE_DEMO_ENABLED": "true",
                    "GEMINI_API_KEY": "test-secret",
                },
            ),
            patch("services.gemini_live_provider.httpx.Client", return_value=gemini),
            patch("services.gemini_live_provider.logger.warning") as warning,
        ):
            with self.assertRaises(HTTPException):
                create_live_session_token("en")

        log_message = " ".join(str(value) for value in warning.call_args.args)
        self.assertIn("INVALID_ARGUMENT", log_message)
        self.assertIn("Invalid request [REDACTED]", log_message)
        self.assertNotIn("test-secret", log_message)

    def test_live_session_request_validates_object_id_and_extra_fields(self):
        request = AgentLiveSessionRequest(
            objectId=" Mars ",
            lang="en",
            messages=[AgentMessage(role="user", content="Tell me about Mars.")],
        )
        self.assertEqual(request.objectId, "mars")

        with self.assertRaises(ValueError):
            AgentLiveSessionRequest(
                objectId="../mars",
                lang="en",
            )
        with self.assertRaises(ValueError):
            AgentLiveSessionRequest(
                objectContext={"name": "Untrusted"},
                lang="en",
            )

    def test_live_session_route_passes_validated_record_and_chat_history(self):
        request = AgentLiveSessionRequest(
            objectId="Mars",
            lang="en",
            messages=[AgentMessage(role="user", content="Tell me about Mars.")],
        )
        session = {
            "token": "auth_tokens/temporary",
            "model": GEMINI_LIVE_MODEL,
            "config": {},
            "expiresAt": "2026-01-01T00:05:00Z",
        }
        record = {"name": "Mars"}

        async def run_route():
            with (
                patch("routes.agent.get_object_record", return_value=record),
                patch("routes.agent.create_live_session_token", return_value=session) as create,
            ):
                result = await create_live_voice_session(request)
            self.assertEqual(create.call_args.args, ("en", "mars", record))
            return result

        result = asyncio.run(run_route())
        self.assertEqual(result["data"]["history"][0]["content"], "Tell me about Mars.")


class RateLimiterTests(unittest.TestCase):
    def test_rate_limit_resets_after_window(self):
        limiter = InMemoryRateLimiter(limit=2, window_seconds=60)

        self.assertTrue(limiter.allow("client", now=100))
        self.assertTrue(limiter.allow("client", now=110))
        self.assertFalse(limiter.allow("client", now=120))
        self.assertTrue(limiter.allow("client", now=161))


if __name__ == "__main__":
    unittest.main()
