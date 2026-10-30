from datetime import datetime, timezone
from threading import Lock
from typing import Any

_conversations: dict[str, dict[str, Any]] = {}
_conversations_lock = Lock()


def ensure_conversation(session_id: str, title: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _conversations_lock:
        _conversations.setdefault(
            session_id,
            {
                "session_id": session_id,
                "title": title.strip() or "New analysis",
                "created_at": now,
                "updated_at": now,
                "messages": [],
            },
        )


def add_chat_message(
    session_id: str,
    role: str,
    content: str,
    metadata: dict[str, Any] | None = None,
) -> None:
    now = datetime.now(timezone.utc).isoformat()
    with _conversations_lock:
        conversation = _conversations.get(session_id)
        if conversation is None:
            raise KeyError(f"Conversation {session_id} does not exist.")
        message = {"role": role, "content": content, "created_at": now}
        if metadata is not None:
            message["analysis"] = metadata
        conversation["messages"].append(message)
        conversation["updated_at"] = now


def get_chat_history(session_id: str) -> list[dict[str, Any]]:
    with _conversations_lock:
        conversation = _conversations.get(session_id)
        if conversation is None:
            return []
        return [message.copy() for message in conversation["messages"]]


def get_conversation_messages(session_id: str) -> list[dict[str, Any]]:
    return get_chat_history(session_id)


def list_conversations() -> list[dict[str, str]]:
    with _conversations_lock:
        conversations = [
            {
                key: value
                for key, value in conversation.items()
                if key != "messages"
            }
            for conversation in _conversations.values()
        ]
    return sorted(
        conversations,
        key=lambda conversation: conversation["updated_at"],
        reverse=True,
    )
