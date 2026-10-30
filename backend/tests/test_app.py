from uuid import uuid4

from fastapi.testclient import TestClient

from app import main
from app.schemas.ingestion import IngestionResult


def test_frontend_and_health_are_served() -> None:
    with TestClient(main.app) as client:
        page = client.get("/")
        health = client.get("/health")

    assert page.status_code == 200
    assert "Every message" in page.text
    assert health.json()["status"] == "ok"
    assert health.json()["storage"] == "in-memory"


def test_analyze_returns_result_and_keeps_session_history(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "analyze_message",
        lambda _: IngestionResult(
            intent="payment_issue",
            risk_profile="medium",
            priority="high",
            required_action=True,
            summary="The customer reports a duplicate payment.",
        ),
    )
    session_id = str(uuid4())

    with TestClient(main.app) as client:
        response = client.post(
            "/api/analyze",
            json={
                "message": "I was charged twice.",
                "session_id": session_id,
            },
        )
        history = client.get(f"/api/conversations/{session_id}/messages")
        conversations = client.get("/api/conversations")

    assert response.status_code == 200
    assert response.json()["session_id"] == session_id
    assert response.json()["token_metadata"]["estimated_input_tokens"] > 0
    assert len(history.json()["items"]) == 2
    assistant_message = history.json()["items"][1]
    assert assistant_message["analysis"]["intent"] == "payment_issue"
    assert any(item["session_id"] == session_id for item in conversations.json()["items"])


def test_blank_message_is_rejected() -> None:
    with TestClient(main.app) as client:
        response = client.post("/api/analyze", json={"message": "   "})

    assert response.status_code == 422
