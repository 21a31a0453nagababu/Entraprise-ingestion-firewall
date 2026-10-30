from pydantic import ConfigDict

from app.schemas.ingestion import IngestionResult


class AssistantResult(IngestionResult):
    model_config = ConfigDict(extra="forbid")

    session_id: str
    response_markdown: str
