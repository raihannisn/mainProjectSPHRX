from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.agent_service import generate_agent_response

router = APIRouter(prefix="/api/ai", tags=["AI"])


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str


@router.post("/chat", response_model=ChatResponse, summary="Cosmic Guide AI Chat")
def chat_with_gemini(request: ChatRequest):
    """Answer a standalone Cosmic Guide question using the shared English-only agent."""
    message = request.message.strip()
    if not message:
        raise HTTPException(status_code=422, detail="Message must not be blank.")

    reply = generate_agent_response(
        messages=[{"role": "user", "content": message}],
        language="en",
    )
    return {"reply": reply}
