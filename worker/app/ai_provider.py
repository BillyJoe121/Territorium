import asyncio
import hashlib
import json
import time
from typing import Any

from openai import (
    APIConnectionError,
    APITimeoutError,
    InternalServerError,
    OpenAI,
    RateLimitError,
)

from .contracts import (
    AiExecutionResult,
    ExtractionEnvelope,
    ExtractorConfig,
    ExtractorKey,
)
from .settings import Settings


EXTRACTION_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["records"],
    "properties": {
        "records": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["canonical_name", "folio", "municipality", "confidence", "attributes", "review_reasons"],
                "properties": {
                    "canonical_name": {"type": "string"},
                    "folio": {"type": ["string", "null"]},
                    "municipality": {"type": ["string", "null"]},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "attributes": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["key", "value", "confidence", "evidence"],
                            "properties": {
                                "key": {"type": "string"},
                                "value": {"type": ["string", "null"]},
                                "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                                "evidence": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "additionalProperties": False,
                                        "required": ["source", "page", "quote"],
                                        "properties": {
                                            "source": {"type": "string"},
                                            "page": {"type": ["string", "null"]},
                                            "quote": {"type": ["string", "null"]},
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "review_reasons": {"type": "array", "items": {"type": "string"}},
                },
            },
        }
    },
}


class OpenAIExtractionProvider:
    def __init__(self, settings: Settings) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key, timeout=180, max_retries=1)
        self.model = settings.ai_model

    async def extract(
        self,
        *,
        content: bytes,
        filename: str,
        prompt: str,
        extractor: ExtractorKey,
        run_id: str,
        config: ExtractorConfig | None = None,
    ) -> AiExecutionResult:
        return await asyncio.to_thread(
            self._extract_sync,
            content=content,
            filename=filename,
            prompt=prompt,
            extractor=extractor,
            run_id=run_id,
            config=config,
        )

    def _is_transient_error(self, exc: Exception) -> bool:
        if isinstance(exc, (RateLimitError, APITimeoutError, InternalServerError, APIConnectionError)):
            return True
        msg = str(exc).lower()
        return any(code in msg for code in ["429", "rate_limit", "500", "502", "503", "504", "timeout", "econnreset"])

    def _extract_sync(
        self,
        *,
        content: bytes,
        filename: str,
        prompt: str,
        extractor: ExtractorKey,
        run_id: str,
        config: ExtractorConfig | None = None,
    ) -> AiExecutionResult:
        start_time = time.monotonic()
        requested_model = config.primary_model if config else self.model
        fallback_model = config.fallback_model if config else None
        timeout = config.timeout_seconds if config else 180

        uploaded = self.client.files.create(file=(filename, content), purpose="user_data")
        used_model = requested_model
        fallback_triggered = False
        fallback_reason = None

        try:
            try:
                response = self._call_model(
                    model=requested_model,
                    file_id=uploaded.id,
                    prompt=prompt,
                    extractor=extractor,
                    run_id=run_id,
                    content_hash=hashlib.sha256(content).hexdigest()[:24],
                    timeout=timeout,
                )
            except Exception as exc:
                if self._is_transient_error(exc) and fallback_model:
                    fallback_triggered = True
                    fallback_reason = f"Transient error on {requested_model}: {exc}"
                    used_model = fallback_model
                    response = self._call_model(
                        model=fallback_model,
                        file_id=uploaded.id,
                        prompt=prompt,
                        extractor=extractor,
                        run_id=run_id,
                        content_hash=hashlib.sha256(content).hexdigest()[:24],
                        timeout=timeout,
                    )
                else:
                    raise

            if response.status != "completed" or not response.output_text:
                raise RuntimeError(f"AI_RESPONSE_{response.status.upper()}")

            envelope = ExtractionEnvelope.model_validate(json.loads(response.output_text))
            latency_ms = int((time.monotonic() - start_time) * 1000)

            # Extraer uso de tokens si el SDK lo expone
            prompt_tokens = getattr(getattr(response, "usage", None), "input_tokens", 0) or 0
            completion_tokens = getattr(getattr(response, "usage", None), "output_tokens", 0) or 0
            total_tokens = getattr(getattr(response, "usage", None), "total_tokens", 0) or (prompt_tokens + completion_tokens)

            return AiExecutionResult(
                envelope=envelope,
                requested_model=requested_model,
                used_model=used_model,
                fallback_triggered=fallback_triggered,
                fallback_reason=fallback_reason,
                prompt_tokens=prompt_tokens,
                completion_tokens=completion_tokens,
                total_tokens=total_tokens,
                latency_ms=latency_ms,
            )
        finally:
            self.client.files.delete(uploaded.id)

    def _call_model(
        self,
        *,
        model: str,
        file_id: str,
        prompt: str,
        extractor: ExtractorKey,
        run_id: str,
        content_hash: str,
        timeout: int,
    ) -> Any:
        return self.client.responses.create(
            model=model,
            store=False,
            instructions=prompt,
            input=[{
                "role": "user",
                "content": [
                    {"type": "input_file", "file_id": file_id},
                    {"type": "input_text", "text": "Extrae los registros del archivo. Devuelve null cuando el documento no contenga un dato. Toda afirmación debe incluir evidencia verificable."},
                ],
            }],
            text={"format": {"type": "json_schema", "name": "territorium_extraction", "strict": True, "schema": EXTRACTION_SCHEMA}},
            metadata={"run_id": run_id, "extractor": extractor.value, "document_hash": content_hash},
            timeout=timeout,
        )

