import asyncio
from pathlib import Path
import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field, validator

from services.agent_service import generate_agent_response
from services.gemini_live_provider import create_live_session_token
from services.object_service import ObjectRecordNotFound, get_object_record
from services.gemini_transcription_provider import transcribe_audio
from services.voiceover_service import (
    generate_spoken_text,
    generate_voiceover,
    get_script_catalog,
)
from utils.rate_limiter import InMemoryRateLimiter


router = APIRouter(prefix="/api/agent", tags=["Mission Agent"])
demo_router = APIRouter(tags=["Mission Agent Demo"])
agent_rate_limiter = InMemoryRateLimiter(limit=20, window_seconds=60)
live_session_rate_limiter = InMemoryRateLimiter(limit=1, window_seconds=60)
MAX_VOICE_CLIP_BYTES = 8 * 1024 * 1024
SUPPORTED_VOICE_MIME_TYPES = {
    "audio/mp4",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
}

VOICEOVER_TEST_HTML = (
    Path(__file__).resolve().parent.parent / "templates" / "voiceover_test.html"
)


class AgentMessage(BaseModel):
    role: Literal["user", "bot"]
    content: str = Field(..., min_length=1, max_length=500)

    @validator("content")
    def content_must_not_be_blank(cls, value):
        if not value.strip():
            raise ValueError("Message cannot be blank.")
        return value

    class Config:
        extra = "forbid"


class AgentChatRequest(BaseModel):
    objectId: Optional[str] = Field(None, max_length=80)
    lang: Literal["id", "en"] = "en"
    messages: List[AgentMessage] = Field(..., min_items=1, max_items=10)

    @validator("objectId")
    def object_id_must_be_a_safe_identifier(cls, value):
        if value is None:
            return None
        normalized = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", normalized):
            raise ValueError("Invalid object ID.")
        return normalized

    @validator("messages")
    def final_message_must_be_from_user(cls, messages):
        if messages[-1].role != "user":
            raise ValueError("The last chat message must be from the user.")
        return messages

    class Config:
        extra = "forbid"


class AgentLiveSessionRequest(BaseModel):
    objectId: Optional[str] = Field(None, max_length=80)
    lang: Literal["id", "en"] = "en"
    messages: List[AgentMessage] = Field(default_factory=list, max_items=10)

    @validator("objectId")
    def object_id_must_be_a_safe_identifier(cls, value):
        if value is None:
            return None
        normalized = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9][a-z0-9_-]{0,79}", normalized):
            raise ValueError("Invalid object ID.")
        return normalized

    class Config:
        extra = "forbid"


class VoiceoverRequest(BaseModel):
    scriptId: Literal["welcome", "mission-introduction", "exploration-guidance"]
    language: Literal["en"] = "en"
    voicePreset: Literal["mission-liaison", "warm-guide"] = "mission-liaison"


class AgentSpeechRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: Literal["en"] = "en"
    voicePreset: Literal["mission-liaison", "warm-guide"] = "mission-liaison"

    @validator("text")
    def text_must_not_be_blank(cls, value):
        if not value.strip():
            raise ValueError("Speech text cannot be blank.")
        return value

    class Config:
        extra = "forbid"


def _check_agent_rate_limit(request: Request):
    client_key = request.client.host if request.client else "unknown"
    if not agent_rate_limiter.allow(client_key):
        raise HTTPException(
            status_code=429,
            detail="The Agent request limit has been reached. Please try again in one minute.",
        )


def _check_live_session_rate_limit(request: Request):
    client_key = request.client.host if request.client else "unknown"
    if not live_session_rate_limiter.allow(client_key):
        raise HTTPException(
            status_code=429,
            detail="The voice session creation limit has been reached. Wait one minute before trying again.",
        )


@router.get("/voiceover/scripts")
def list_voiceover_scripts(
    language: Literal["en"] = Query("en"),
):
    return {
        "success": True,
        "data": {"scripts": get_script_catalog(language)},
    }


@router.post("/chat", dependencies=[Depends(_check_agent_rate_limit)])
def create_agent_response(request: AgentChatRequest):
    object_record = None
    if request.objectId:
        try:
            object_record = get_object_record(request.objectId)
        except ObjectRecordNotFound:
            pass

    message = generate_agent_response(
        messages=[item.model_dump() for item in request.messages],
        language="en",
        object_id=request.objectId,
        object_record=object_record,
    )
    sources = []
    if object_record is not None:
        object_name = object_record.get("name", request.objectId)
        sources.append(
            {
                "title": f"Backend object catalog: {object_name}",
                "url": f"/api/objects/{request.objectId}",
            }
        )
    return {
        "success": True,
        "data": {
            "message": message,
            "sources": sources,
        },
    }


@router.post("/voice/transcribe", dependencies=[Depends(_check_agent_rate_limit)])
async def transcribe_voice_input(
    request: Request,
    language: Literal["id", "en"] = Query("id"),
):
    mime_type = request.headers.get("content-type", "").split(";", 1)[0].strip().lower()
    if mime_type not in SUPPORTED_VOICE_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail="Unsupported audio format. Use WebM, MP4, OGG, or WAV.",
        )

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_VOICE_CLIP_BYTES:
                raise HTTPException(status_code=413, detail="Audio is too large. The maximum size is 8 MB.")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid audio content-length header.") from exc

    audio = bytearray()
    async for chunk in request.stream():
        audio.extend(chunk)
        if len(audio) > MAX_VOICE_CLIP_BYTES:
            raise HTTPException(status_code=413, detail="Audio is too large. The maximum size is 8 MB.")
    if not audio:
        raise HTTPException(status_code=400, detail="Audio is empty. Please record again.")

    transcript = await asyncio.to_thread(
        transcribe_audio,
        bytes(audio),
        mime_type,
        language,
    )
    return {
        "success": True,
        "data": {"transcript": transcript, "language": language},
    }


@router.post(
    "/voice/session",
    dependencies=[
        Depends(_check_agent_rate_limit),
        Depends(_check_live_session_rate_limit),
    ],
)
async def create_live_voice_session(request: AgentLiveSessionRequest):
    object_record = None
    if request.objectId:
        try:
            object_record = get_object_record(request.objectId)
        except ObjectRecordNotFound:
            pass

    session = await asyncio.to_thread(
        create_live_session_token,
        "en",
        request.objectId,
        object_record,
    )
    session["history"] = [
        {"role": message.role, "content": message.content}
        for message in request.messages
    ]
    session["sources"] = (
        [
            {
                "title": f"Backend object catalog: {object_record.get('name', request.objectId)}",
                "url": f"/api/objects/{request.objectId}",
            }
        ]
        if object_record is not None
        else []
    )
    return {"success": True, "data": session}


@router.post("/voiceover", dependencies=[Depends(_check_agent_rate_limit)])
def create_voiceover(request: VoiceoverRequest):
    audio = generate_voiceover(
        script_id=request.scriptId,
        language=request.language,
        voice_preset=request.voicePreset,
    )
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={
            "Cache-Control": "private, max-age=3600",
            "X-Voiceover-Script": request.scriptId,
            "X-Voiceover-Language": request.language,
            "X-Voiceover-Preset": request.voicePreset,
        },
    )


@router.post("/voiceover/text", dependencies=[Depends(_check_agent_rate_limit)])
def create_spoken_text(request: AgentSpeechRequest):
    audio = generate_spoken_text(
        text=request.text,
        language=request.language,
        voice_preset=request.voicePreset,
    )
    return Response(
        content=audio,
        media_type="audio/wav",
        headers={"Cache-Control": "no-store"},
    )


@demo_router.get("/voiceover-test", response_class=FileResponse)
def get_voiceover_test_page():
    return FileResponse(str(VOICEOVER_TEST_HTML), media_type="text/html")
