import logging
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


logger = logging.getLogger(__name__)


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

    async def claim_document_ai_revision(self) -> Any | None:
        response = await self._request(
            "POST",
            "/rest/v1/rpc/claim_next_expediente_document_ai_revision",
            json={"p_worker_name": self.settings.worker_name},
        )
        rows = response.json()
        if not rows:
            return None
        from .document_ai_revision import DocumentAiRevisionTask
        row = rows[0]
        return DocumentAiRevisionTask(
            id=row["id"],
            project_id=row["project_id"],
            source_document_version_id=row["source_document_version_id"],
            source_content=row["source_content"],
            user_comment=row["user_comment"],
            lease_token=row["lease_token"],
            attempt_count=row["attempt_count"],
        )

    async def complete_document_ai_revision(
        self,
        revision_id: str,
        lease_token: str,
        proposed_content: dict[str, Any] | None = None,
        error_code: str | None = None,
    ) -> bool:
        response = await self._request(
            "POST",
            "/rest/v1/rpc/complete_expediente_document_ai_revision",
            json={
                "p_revision_id": revision_id,
                "p_lease_token": lease_token,
                "p_proposed_content": proposed_content,
                "p_error_code": error_code,
            },
        )
        return bool(response.json())

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
        project_id: str | None = None,
        batch_id: str | None = None,
        task_id: str | None = None,
        document_id: str | None = None,
        extractor: ExtractorKey | str = "title_study",
        prompt_version: PromptVersion | None = None,
        prompt_version_id: str | None = None,
        prompt_version_number: int | None = None,
        requested_model: str | None = None,
        used_model: str | None = None,
        fallback_triggered: bool = False,
        fallback_reason: str | None = None,
        status: str = "success",
        latency_ms: int = 0,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
        total_tokens: int = 0,
        estimated_cost_usd: float | None = None,
        error_message: str | None = None,
        is_test_run: bool = False,
        job: Job | None = None,
        task: DocumentTask | None = None,
        ai_res: AiExecutionResult | None = None,
    ) -> None:
        try:
            # Reconcile V1 vs V2 parameters
            eff_project_id = project_id or (job.project_id if job else None)
            eff_batch_id = batch_id or (job.batch_id if job else None)
            eff_task_id = task_id or (task.id if task else None)
            
            # Normalize extractor key to match Supabase check constraint ('title_study', 'plan', 'negotiation')
            raw_ext = extractor.value if hasattr(extractor, "value") else str(extractor)
            ext_map = {"titles": "title_study", "plans": "plan", "title_study": "title_study", "plan": "plan", "negotiation": "negotiation"}
            eff_extractor = ext_map.get(raw_ext, "title_study")

            eff_req_model = requested_model or (ai_res.requested_model if ai_res else "gemini-flash-latest")
            eff_used_model = used_model or (ai_res.used_model if ai_res else eff_req_model)
            eff_fallback = fallback_triggered or (ai_res.fallback_triggered if ai_res else False)
            eff_fallback_reason = fallback_reason or (ai_res.fallback_reason if ai_res else None)
            eff_latency = latency_ms or (ai_res.latency_ms if ai_res else 0)
            eff_prompt_tok = prompt_tokens or (ai_res.prompt_tokens if ai_res else 0)
            eff_comp_tok = completion_tokens or (ai_res.completion_tokens if ai_res else 0)
            eff_total_tok = total_tokens or (ai_res.total_tokens if ai_res else (eff_prompt_tok + eff_comp_tok))

            if estimated_cost_usd is not None:
                eff_cost = float(estimated_cost_usd)
            else:
                m = eff_used_model.lower()
                if "mini" in m or "flash" in m:
                    p_rate, c_rate = 0.15, 0.60
                elif "claude-3-5" in m:
                    p_rate, c_rate = 3.0, 15.0
                elif "o1" in m or "o3" in m:
                    p_rate, c_rate = 15.0, 60.0
                else:
                    p_rate, c_rate = 2.5, 10.0
                eff_cost = round((eff_prompt_tok / 1_000_000.0) * p_rate + (eff_comp_tok / 1_000_000.0) * c_rate, 6)

            payload = {
                "project_id": eff_project_id,
                "batch_id": eff_batch_id,
                "task_id": eff_task_id,
                "document_id": document_id,
                "extractor_key": eff_extractor,
                "prompt_version_id": prompt_version_id or (prompt_version.id if prompt_version else None),
                "prompt_version_number": prompt_version_number or (prompt_version.version if prompt_version else None),
                "requested_model": eff_req_model,
                "used_model": eff_used_model,
                "fallback_triggered": eff_fallback,
                "fallback_reason": eff_fallback_reason,
                "status": status,
                "latency_ms": eff_latency,
                "prompt_tokens": eff_prompt_tok,
                "completion_tokens": eff_comp_tok,
                "total_tokens": eff_total_tok,
                "estimated_cost_usd": eff_cost,
                "error_message": error_message,
                "is_test_run": is_test_run,
            }
            try:
                await self._request("POST", "/rest/v1/ai_execution_logs", json=payload, headers={**self.headers, "Prefer": "return=minimal"})
            except Exception:
                if payload.get("document_id") is not None:
                    payload["document_id"] = None
                    try:
                        await self._request("POST", "/rest/v1/ai_execution_logs", json=payload, headers={**self.headers, "Prefer": "return=minimal"})
                    except Exception:
                        pass
        except Exception:
            pass

    async def get_v2_group_files(self, group_id: str) -> list[dict[str, Any]]:
        """Retrieves current active files for a document group in Territorium 2.0."""
        response = await self._request(
            "GET",
            "/rest/v1/expediente_document_files",
            params={"group_id": f"eq.{group_id}", "is_current": "eq.true", "is_active": "eq.true", "select": "*", "order": "created_at.asc"},
        )
        return response.json()

    async def save_v2_phase4_output(
        self,
        *,
        execution_id: str,
        project_id: str,
        group_id: str,
        input_version: int,
        canonical_payload: dict[str, Any],
        validation_report: dict[str, Any],
        discrepancies: list[dict[str, Any]],
        provenance: list[dict[str, Any]],
        documents_summary: list[dict[str, Any]],
    ) -> str:
        """
        Saves immutable execution output to expediente_execution_outputs and
        creates or updates a draft result in expediente_result_versions ready for human review.
        """
        import hashlib
        import json

        full_output_payload = {
            "canonical_data": canonical_payload,
            "validation_report": validation_report,
            "discrepancies": discrepancies,
            "provenance": provenance,
            "documents_summary": documents_summary,
        }
        serialized = json.dumps(full_output_payload, sort_keys=True)
        payload_sha256 = hashlib.sha256(serialized.encode("utf-8")).hexdigest()

        # 1. Insert into expediente_execution_outputs
        output_record = {
            "execution_id": execution_id,
            "project_id": project_id,
            "group_id": group_id,
            "payload": full_output_payload,
            "payload_sha256": payload_sha256,
        }
        out_res = await self._request(
            "POST",
            "/rest/v1/expediente_execution_outputs",
            json=output_record,
            headers={**self.headers, "Prefer": "return=representation"},
        )
        output_id = out_res.json()[0]["id"]

        # 2. Get latest version_number for this group to increment
        existing_versions = await self._request(
            "GET",
            "/rest/v1/expediente_result_versions",
            params={"group_id": f"eq.{group_id}", "select": "version_number", "order": "version_number.desc", "limit": "1"},
        )
        existing_rows = existing_versions.json()
        next_version = (existing_rows[0]["version_number"] + 1) if existing_rows else 1

        # 3. Create draft in expediente_result_versions
        result_version_record = {
            "project_id": project_id,
            "scope": "group",
            "group_id": group_id,
            "source_execution_id": execution_id,
            "source_output_id": output_id,
            "version_number": next_version,
            "source_input_version": input_version,
            "status": "draft",
            "payload": canonical_payload,
            "change_summary": f"Extracción automática Fase 4 (versión {next_version})",
        }
        await self._request(
            "POST",
            "/rest/v1/expediente_result_versions",
            json=result_version_record,
            headers={**self.headers, "Prefer": "return=minimal"},
        )

        # 4. Mark execution as review_ready
        await self._request(
            "PATCH",
            "/rest/v1/expediente_executions",
            params={"id": f"eq.{execution_id}"},
            json={
                "status": "review_ready",
                "stage": "completed",
                "stage_message": "Extracción completada y lista para revisión.",
                "completed_at": datetime.now(UTC).isoformat(),
            },
            headers={**self.headers, "Prefer": "return=minimal"},
        )

        # 5. Mark document group as review_ready
        await self._request(
            "PATCH",
            "/rest/v1/expediente_document_groups",
            params={"id": f"eq.{group_id}"},
            json={"status": "review_ready", "updated_at": datetime.now(UTC).isoformat()},
            headers={**self.headers, "Prefer": "return=minimal"},
        )

        return output_id

    # Fase 3 / expediente v2. These methods deliberately exchange metadata and
    # validation payloads only; source content is fetched only by the worker.
    async def claim_expediente_v2_task(self) -> Any | None:
        from .expediente_v2 import V2Task

        response = await self._request(
            "POST",
            "/rest/v1/rpc/claim_next_expediente_execution_task",
            json={"p_worker_name": self.settings.worker_name},
        )
        rows = response.json()
        if not rows:
            return None
        row = rows[0]
        return V2Task(
            id=row["id"],
            execution_id=row["execution_id"],
            document_file_id=row["document_file_id"],
            lease_token=row["lease_token"],
            attempt_count=row["attempt_count"],
            max_attempts=row["max_attempts"],
        )

    async def is_execution_ready_for_extraction(self, execution_id: str) -> bool:
        response = await self._request(
            "GET",
            "/rest/v1/expediente_executions",
            params={"id": f"eq.{execution_id}", "select": "stage,status", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            return False
        return rows[0].get("stage") == "ready_for_extraction"

    async def get_v2_group_info(self, group_id: str) -> dict[str, Any]:
        response = await self._request(
            "GET",
            "/rest/v1/expediente_document_groups",
            params={"id": f"eq.{group_id}", "select": "id,project_id,group_key,status,input_version", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            raise RuntimeError("GROUP_NOT_FOUND")
        return rows[0]

    async def update_execution_stage(self, execution_id: str, stage: str, stage_message: str) -> None:
        await self._request(
            "PATCH",
            "/rest/v1/expediente_executions",
            params={"id": f"eq.{execution_id}"},
            json={"stage": stage, "stage_message": stage_message, "updated_at": datetime.now(UTC).isoformat()},
            headers={**self.headers, "Prefer": "return=minimal"},
        )

    async def fail_v2_execution(self, execution_id: str, group_id: str, error_code: str, error_message: str) -> None:
        await self._request(
            "PATCH",
            "/rest/v1/expediente_executions",
            params={"id": f"eq.{execution_id}"},
            json={
                "status": "failed",
                "stage": "failed",
                "stage_message": error_message[:200],
                "error_code": error_code,
                "error_message": error_message[:2000],
                "completed_at": datetime.now(UTC).isoformat(),
            },
            headers={**self.headers, "Prefer": "return=minimal"},
        )
        await self._request(
            "PATCH",
            "/rest/v1/expediente_document_groups",
            params={"id": f"eq.{group_id}"},
            json={
                "status": "error",
                "last_error_code": error_code,
                "last_error_message": error_message[:2000],
                "updated_at": datetime.now(UTC).isoformat(),
            },
            headers={**self.headers, "Prefer": "return=minimal"},
        )

    async def v2_execution(self, execution_id: str) -> Any:
        from .expediente_v2 import V2Execution

        response = await self._request(
            "GET",
            "/rest/v1/expediente_executions",
            params={"id": f"eq.{execution_id}", "select": "id,project_id,group_id,input_version,extractor_key,extractor_snapshot,prompt_snapshot,model_snapshot", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            raise RuntimeError("EXECUTION_NOT_FOUND")
        row = rows[0]
        return V2Execution(
            id=row["id"], project_id=row["project_id"], group_id=row["group_id"],
            extractor_key=row["extractor_key"],
            extractor_snapshot=row.get("extractor_snapshot") or {}, prompt_snapshot=row.get("prompt_snapshot") or {},
            model_snapshot=row.get("model_snapshot") or {},
            input_version=int(row.get("input_version") or 1),
        )

    async def v2_document(self, document_id: str) -> Any:
        from .expediente_v2 import V2Document

        response = await self._request(
            "GET",
            "/rest/v1/expediente_document_files",
            params={"id": f"eq.{document_id}", "select": "id,storage_path,original_name,mime_type,sha256", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            raise RuntimeError("DOCUMENT_NOT_FOUND")
        row = rows[0]
        return V2Document(id=row["id"], storage_path=row["storage_path"], original_name=row["original_name"], mime_type=row["mime_type"], sha256=row["sha256"])

    async def v2_cache_hit(self, key: str) -> dict[str, Any] | None:
        response = await self._request(
            "GET",
            "/rest/v1/expediente_extraction_cache",
            params={"cache_key": f"eq.{key}", "select": "payload", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            return None
        await self._request("POST", "/rest/v1/rpc/record_expediente_cache_hit", json={"p_cache_key": key})
        return rows[0]["payload"]

    async def v2_store_cache(self, key: str, document_sha256: str, execution: Any, payload: dict[str, Any], payload_hash: str) -> None:
        import hashlib
        import json

        fingerprint = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        await self._request(
            "POST",
            "/rest/v1/expediente_extraction_cache",
            json={
                "cache_key": key,
                "document_sha256": document_sha256,
                "extractor_key": execution.extractor_key,
                "extractor_fingerprint": fingerprint(execution.extractor_snapshot),
                "prompt_fingerprint": fingerprint(execution.prompt_snapshot),
                "schema_fingerprint": fingerprint(execution.prompt_snapshot.get("schema", {})),
                "model_fingerprint": fingerprint(execution.model_snapshot),
                "payload": payload,
                "payload_sha256": payload_hash,
            },
            headers={**self.headers, "Prefer": "resolution=ignore-duplicates,return=minimal"},
        )

    async def v2_mark_document_validated(self, document_id: str, detected_mime: str) -> None:
        await self._request(
            "PATCH", "/rest/v1/expediente_document_files", params={"id": f"eq.{document_id}"},
            json={"validation_status": "validated", "detected_mime_type": detected_mime, "validation_error_code": None},
            headers={**self.headers, "Prefer": "return=minimal"},
        )

    async def v2_mark_document_rejected(self, document_id: str, error_code: str) -> None:
        await self._request(
            "PATCH", "/rest/v1/expediente_document_files", params={"id": f"eq.{document_id}"},
            json={"validation_status": "rejected", "validation_error_code": error_code},
            headers={**self.headers, "Prefer": "return=minimal"},
        )

    async def v2_complete(self, task: Any, payload: dict[str, Any] | None, payload_hash: str | None, error_code: str | None = None, error_message: str | None = None) -> None:
        await self._request(
            "POST", "/rest/v1/rpc/complete_expediente_execution_task",
            json={
                "p_task_id": task.id, "p_lease_token": task.lease_token, "p_payload": payload,
                "p_payload_sha256": payload_hash, "p_error_code": error_code, "p_error_message": error_message,
            },
        )

    async def v2_audit(self, project_id: str, action: str, entity_type: str, entity_id: str, metadata: dict[str, Any]) -> None:
        await self._request(
            "POST", "/rest/v1/expediente_audit_events",
            json={"project_id": project_id, "action": action, "entity_type": entity_type, "entity_id": entity_id, "metadata": metadata},
            headers={**self.headers, "Prefer": "return=minimal"},
        )

    async def cleanup_expired_expediente_uploads(self) -> None:
        response = await self._request("POST", "/rest/v1/rpc/expire_expediente_upload_reservations", json={"p_limit": 100})
        for row in response.json():
            try:
                del_resp = await self._request(
                    "POST",
                    f"/storage/v1/object/remove/source-documents",
                    json={"prefixes": [row["storage_path"]]},
                )
                if del_resp.status_code >= 400:
                    logger.warning(
                        f"Storage cleanup failed for expired upload {row.get('storage_path')}: "
                        f"HTTP {del_resp.status_code}"
                    )
            except Exception as exc:
                # La reserva permanece expirada; una limpieza posterior puede reintentar el borrado.
                logger.warning(f"Storage cleanup exception for expired upload {row.get('storage_path')}: {exc}")
