from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ExtractorKey(StrEnum):
    TITLE_STUDY = "title_study"
    PLAN = "plan"
    NEGOTIATION = "negotiation"


class Evidence(BaseModel):
    source: str
    page: str | None = None
    quote: str | None = None


class ExtractedAttribute(BaseModel):
    key: str = Field(min_length=1, max_length=120)
    value: str | None
    confidence: float = Field(ge=0, le=1)
    evidence: list[Evidence]


class ExtractedRecord(BaseModel):
    canonical_name: str = Field(min_length=1, max_length=240)
    folio: str | None
    municipality: str | None
    confidence: float = Field(ge=0, le=1)
    attributes: list[ExtractedAttribute]
    review_reasons: list[str]


class ExtractionEnvelope(BaseModel):
    records: list[ExtractedRecord]


class Job(BaseModel):
    id: str
    project_id: str
    batch_id: str
    run_id: str
    attempt_count: int
    max_attempts: int


class SourceDocument(BaseModel):
    id: str
    project_id: str
    batch_id: str
    storage_path: str
    original_name: str
    mime_type: str
    kind: str
    sha256: str | None = None
    page_count: int | None = None
    is_scanned: bool | None = None
    needs_ocr: bool | None = None
    ocr_applied: bool | None = None
    text_origin: str | None = None
    is_encrypted: bool | None = None
    working_text: str | None = None
    preprocessing_status: str | None = None
    exception_reason: str | None = None


class PromptVersion(BaseModel):
    id: str
    extractor_key: ExtractorKey
    version: int
    prompt: str
    output_schema: dict[str, Any]


class DocumentTask(BaseModel):
    id: str
    job_id: str | None = None
    batch_id: str
    project_id: str
    source_document_id: str
    property_code: str | None = None
    extractor_key: str
    status: str = "queued"
    dependency_status: str = "ready"
    depends_on_extractors: list[str] = []
    attempt_count: int = 0
    max_attempts: int = 3
    error_code: str | None = None
    error_message: str | None = None
    exception_category: str | None = None
    suggested_action: str | None = None
    tokens_used: int = 0


class ExtractorConfig(BaseModel):
    extractor_key: ExtractorKey
    provider: str = "openai"
    primary_model: str = "gpt-4o"
    fallback_model: str | None = "gpt-4o-mini"
    fallback_provider: str | None = "openai"
    temperature: float = 0.0
    max_tokens: int = 4096
    timeout_seconds: int = 120
    is_enabled: bool = True


class AiExecutionResult(BaseModel):
    envelope: ExtractionEnvelope
    requested_model: str
    used_model: str
    fallback_triggered: bool = False
    fallback_reason: str | None = None
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    latency_ms: int = 0

