from fastapi import APIRouter
from pydantic import BaseModel
from services.ai_service import get_gemini_chat_reply, FALLBACK_REPLY

router = APIRouter(prefix="/api/ai", tags=["AI"])


class ChatRequest(BaseModel):
    message: str = ""


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse, summary="Cosmic Guide AI Chat")
async def chat_with_gemini(request: ChatRequest):
    """Menerima input pesan dari Frontend dan mengembalikan respons teks dari Gemini 3.5 Flash.
    Jika terjadi error atau API key belum diset, mengembalikan fallback status code 200.
    """
    try:
        reply = await get_gemini_chat_reply(request.message)
        return {"reply": reply}
    except Exception:
        return {"reply": FALLBACK_REPLY}
