from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote

import httpx

from .contracts import (
    AiExecutionResult,
    DocumentTask,
    ExtractedRecord,
    ExtractorConfig,
    ExtractorKey,
    Job,
    PromptVersion,
    SourceDocument,
)
from .settings import Settings


class SupabaseGateway:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.headers = {
            "apikey": settings.supabase_secret_key,
            "Authorization": f"Bearer {settings.supabase_secret_key}",
            "Content-Type": "application/json",
        }
        self.client = httpx.AsyncClient(timeout=httpx.Timeout(180, connect=20), headers=self.headers)

    async def close(self) -> None:
        await self.client.aclose()

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        response = await self.client.request(method, f"{self.settings.supabase_url}{path}", **kwargs)
        response.raise_for_status()
        return response

    async def claim(self) -> Job | None:
        response = await self._request("POST", "/rest/v1/rpc/claim_next_job", json={"worker_name": self.settings.worker_name})
        rows = response.json()
        return Job.model_validate(rows[0]) if rows else None

    async def documents(self, batch_id: str) -> list[SourceDocument]:
        response = await self._request("GET", "/rest/v1/source_documents", params={"batch_id": f"eq.{batch_id}", "select": "*", "order": "created_at.asc"})
        priority = {"title_study": 0, "plan": 1, "negotiation": 2, "unclassified": 3, "support": 4}
        return sorted((SourceDocument.model_validate(row) for row in response.json()), key=lambda row: priority.get(row.kind, 9))

    async def download(self, storage_path: str) -> bytes:
        response = await self._request("GET", f"/storage/v1/object/authenticated/source-documents/{quote(storage_path, safe='/')}")
        return response.content

    async def prompt(self, extractor: ExtractorKey) -> PromptVersion:
        response = await self._request("GET", "/rest/v1/prompt_versions", params={"extractor_key": f"eq.{extractor.value}", "is_active": "eq.true", "select": "*", "limit": "1"})
        rows = response.json()
        if not rows:
            raise RuntimeError(f"PROMPT_NOT_CONFIGURED:{extractor.value}")
        return PromptVersion.model_validate(rows[0])

    async def job_status(self, job_id: str) -> str:
        response = await self._request("GET", "/rest/v1/jobs", params={"id": f"eq.{job_id}", "select": "status", "limit": "1"})
        rows = response.json()
        return rows[0]["status"] if rows else "cancelled"

    async def patch_job(self, job_id: str, **values: Any) -> None:
        values.setdefault("last_heartbeat_at", datetime.now(UTC).isoformat())
        values.setdefault("lease_expires_at", (datetime.now(UTC) + timedelta(seconds=self.settings.lease_seconds)).isoformat())
        await self._request("PATCH", "/rest/v1/jobs", params={"id": f"eq.{job_id}"}, json=values, headers={**self.headers, "Prefer": "return=minimal"})

    async def patch_batch(self, batch_id: str, status: str) -> None:
        await self._request("PATCH", "/rest/v1/batches", params={"id": f"eq.{batch_id}"}, json={"status": status}, headers={**self.headers, "Prefer": "return=minimal"})

    async def begin_attempt(self, job: Job) -> None:
        await self._request("POST", "/rest/v1/job_attempts", json={"job_id": job.id, "attempt_number": job.attempt_count, "status": "running"}, headers={**self.headers, "Prefer": "return=minimal"})

    async def finish_attempt(self, job: Job, status: str, error_code: str | None = None, error_message: str | None = None) -> None:
        await self._request("PATCH", "/rest/v1/job_attempts", params={"job_id": f"eq.{job.id}", "attempt_number": f"eq.{job.attempt_count}"}, json={"status": status, "error_code": error_code, "error_message": error_message, "completed_at": datetime.now(UTC).isoformat()}, headers={**self.headers, "Prefer": "return=minimal"})

    async def save_record(self, *, job: Job, document: SourceDocument, extractor: ExtractorKey, record: ExtractedRecord) -> str:
        match_params = {"project_id": f"eq.{job.project_id}", "select": "id", "limit": "1"}
        match_params["folio"] = f"eq.{record.folio}" if record.folio else None
        if not record.folio:
            match_params["canonical_name"] = f"eq.{record.canonical_name}"
        match_params = {key: value for key, value in match_params.items() if value is not None}
        existing = (await self._request("GET", "/rest/v1/property_records", params=match_params)).json()
        payload = {"project_id": job.project_id, "source_document_id": document.id, "canonical_name": record.canonical_name, "folio": record.folio, "municipality": record.municipality, "confidence": record.confidence, "review_status": "pending"}
        if existing:
            record_id = existing[0]["id"]
            await self._request("PATCH", "/rest/v1/property_records", params={"id": f"eq.{record_id}"}, json=payload, headers={**self.headers, "Prefer": "return=minimal"})
        else:
            created = await self._request("POST", "/rest/v1/property_records", json=payload, headers={**self.headers, "Prefer": "return=representation"})
            record_id = created.json()[0]["id"]
        await self._request("POST", "/rest/v1/property_record_documents", json={"property_record_id": record_id, "source_document_id": document.id, "extractor_key": extractor.value}, headers={**self.headers, "Prefer": "resolution=ignore-duplicates,return=minimal"})
        if record.attributes:
            attributes = [{"property_record_id": record_id, "source_document_id": document.id, "extractor_key": extractor.value, "attribute_key": item.key, "value_json": {"value": item.value}, "evidence": [entry.model_dump() for entry in item.evidence], "confidence": item.confidence} for item in record.attributes]
            await self._request("POST", "/rest/v1/extracted_attributes", params={"on_conflict": "property_record_id,extractor_key,attribute_key"}, json=attributes, headers={**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"})
        reasons = list(record.review_reasons)
        if record.confidence < 0.75:
            reasons.append(f"Confianza global baja ({record.confidence:.0%}).")
        if reasons:
            await self._request("POST", "/rest/v1/review_tasks", json={"project_id": job.project_id, "property_record_id": record_id, "title": "Validación requerida", "reason": " ".join(reasons)[:2000], "severity": "high" if record.confidence < 0.6 else "medium"}, headers={**self.headers, "Prefer": "return=minimal"})
        return record_id

    async def audit(self, job: Job, action: str, detail: str) -> None:
        await self._request("POST", "/rest/v1/audit_events", json={"project_id": job.project_id, "actor_id": None, "action": action, "entity_type": "job", "entity_id": job.id, "metadata": {"detail": detail, "run_id": job.run_id}}, headers={**self.headers, "Prefer": "return=minimal"})

    async def create_or_get_tasks(self, job: Job, documents: list[SourceDocument], resolve_fn: Any) -> list[DocumentTask]:
        try:
            response = await self._request("GET", "/rest/v1/document_tasks", params={"batch_id": f"eq.{job.batch_id}", "select": "*"})
            existing = response.json()
            if existing:
                return [DocumentTask.model_validate(row) for row in existing]
            tasks_to_create = []
            for doc in documents:
                ext = resolve_fn(doc)
                if not ext:
                    continue
                is_neg = ext == ExtractorKey.NEGOTIATION
                tasks_to_create.append({
                    "job_id": job.id,
                    "batch_id": job.batch_id,
                    "project_id": job.project_id,
                    "source_document_id": doc.id,
                    "extractor_key": ext.value,
                    "status": "queued",
                    "dependency_status": "waiting" if is_neg else "ready",
                    "depends_on_extractors": ["title_study"] if is_neg else [],
                })
            if tasks_to_create:
                res = await self._request("POST", "/rest/v1/document_tasks", json=tasks_to_create, headers={**self.headers, "Prefer": "return=representation"})
                return [DocumentTask.model_validate(row) for row in res.json()]
        except Exception:
            pass
        return []

    async def patch_task(self, task_id: str, **values: Any) -> None:
        try:
            values.setdefault("updated_at", datetime.now(UTC).isoformat())
            await self._request("PATCH", "/rest/v1/document_tasks", params={"id": f"eq.{task_id}"}, json=values, headers={**self.headers, "Prefer": "return=minimal"})
        except Exception:
            pass

    async def extractor_config(self, extractor: ExtractorKey) -> ExtractorConfig:
        try:
            response = await self._request("GET", "/rest/v1/extractor_configs", params={"extractor_key": f"eq.{extractor.value}", "select": "*", "limit": "1"})
            rows = response.json()
            if rows:
                return ExtractorConfig.model_validate(rows[0])
        except Exception:
            pass
        return ExtractorConfig(extractor_key=extractor)

    async def record_ai_log(
        self,
        *,
        job: Job,
        task: DocumentTask | None,
        document_id: str | None,
        extractor: ExtractorKey,
        prompt_version: PromptVersion | None,
        ai_res: AiExecutionResult,
        status: str = "success",
        error_message: str | None = None,
    ) -> None:
        try:
            payload = {
                "project_id": job.project_id,
                "batch_id": job.batch_id,
                "task_id": task.id if task else None,
                "document_id": document_id,
                "extractor_key": extractor.value,
                "prompt_version_id": prompt_version.id if prompt_version else None,
                "prompt_version_number": prompt_version.version if prompt_version else None,
                "requested_model": ai_res.requested_model,
                "used_model": ai_res.used_model,
                "fallback_triggered": ai_res.fallback_triggered,
                "fallback_reason": ai_res.fallback_reason,
                "status": status,
                "latency_ms": ai_res.latency_ms,
                "prompt_tokens": ai_res.prompt_tokens,
                "completion_tokens": ai_res.completion_tokens,
                "total_tokens": ai_res.total_tokens,
                "error_message": error_message,
                "is_test_run": False,
            }
            await self._request("POST", "/rest/v1/ai_execution_logs", json=payload, headers={**self.headers, "Prefer": "return=minimal"})
        except Exception:
            pass
