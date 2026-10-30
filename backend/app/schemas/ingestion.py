from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Intent = Literal[
    "greeting",
    "order_tracking",
    "payment_issue",
    "current_time",
    "general_question",
    "unknown",
]
RiskProfile = Literal["low", "medium", "high", "unknown"]
Priority = Literal["low", "medium", "high", "urgent", "unknown"]


class IngestionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(
        min_length=1,
        max_length=5000,
        description="The user's original message.",
        examples=["Where is my order?"],
    )
    session_id: str | None = None

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("message must not be blank")
        return value


class TokenMetaData(BaseModel):
    estimated_input_tokens: int = Field(default=0, ge=0)
    note: str = "Approximate token count for the input message."


class IngestionResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Intent
    risk_profile: RiskProfile
    priority: Priority
    required_action: bool
    summary: str = Field(min_length=1, max_length=5000)
    token_metadata: TokenMetaData = Field(default_factory=TokenMetaData)
