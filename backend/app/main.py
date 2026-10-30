import logging
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError

from app.schemas.assistant import AssistantResult
from app.schemas.ingestion import IngestionRequest
from app.services.conversation_service import (
    add_chat_message,
    ensure_conversation,
    get_conversation_messages,
    list_conversations,
)
from app.services.llm_service import analyze_message
from app.services.response_service import generate_response
from app.utils.token_counter import estimate_tokens

logger = logging.getLogger(__name__)
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"


app = FastAPI(
    title="Enterprise Ingestion Firewall",
    description="AI-powered message analysis and contextual assistance.",
    version="4.0.0",
)
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/", include_in_schema=False)
def frontend() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "message": "Ingestion Firewall API is running",
        "storage": "in-memory",
    }


@app.get("/api/conversations")
def conversations() -> dict[str, list[dict[str, str]]]:
    return {"items": list_conversations()}


@app.get("/api/conversations/{session_id}/messages")
def conversation_messages(session_id: str) -> dict[str, object]:
    try:
        UUID(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid conversation ID.") from exc
    return {
        "session_id": session_id,
        "items": get_conversation_messages(session_id),
    }


@app.post("/api/analyze", response_model=AssistantResult)
def analyze(request: IngestionRequest) -> AssistantResult:
    message = request.message.strip()
    session_id = request.session_id or str(uuid4())
    try:
        UUID(session_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail="session_id must be a valid UUID.",
        ) from exc

    try:
        result = analyze_message(message)
        result.token_metadata.estimated_input_tokens = estimate_tokens(message)
        response_markdown = generate_response()
        ensure_conversation(session_id, message[:70])
        add_chat_message(session_id, "user", message)
        add_chat_message(
            session_id,
            "assistant",
            response_markdown,
            metadata=result.model_dump(),
        )
        return AssistantResult(
            **result.model_dump(),
            session_id=session_id,
            response_markdown=response_markdown,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=502,
            detail={
                "error": "The model response did not pass schema validation.",
                "validation_errors": exc.errors(),
            },
        ) from exc
    except Exception as exc:
        logger.exception("Analysis request failed for session %s", session_id)
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI request failed. Check backend/.env, your network, "
                "database connection, model name, and provider limits."
            ),
        ) from exc
