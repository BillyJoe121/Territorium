import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import quote


import httpx

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

    async def claim_document_ai_revision(self) -> Any | None:
        try:
            response = await self._request(
                "POST",
                "/rest/v1/rpc/claim_next_expediente_document_ai_revision",
                json={"p_worker_name": self.settings.worker_name},
            )
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 400:
                # La función SQL no existe aún en la BD (script APLICAR_EN_SUPABASE_EXPEDIENTE_V2.sql
                # pendiente de ejecutar en el dashboard de Supabase). Se omite sin traceback.
                logger.warning(
                    "claim_next_expediente_document_ai_revision → 400 (función SQL no disponible). "
                    "Ejecuta APLICAR_EN_SUPABASE_EXPEDIENTE_V2.sql en el dashboard de Supabase."
                )
                return None
            raise
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

    async def download(self, storage_path: str) -> bytes:
        response = await self._request("GET", f"/storage/v1/object/authenticated/source-documents/{quote(storage_path, safe='/')}")
        return response.content

    async def claim_comparison_job(self) -> dict[str, Any] | None:
        response = await self._request("POST", "/rest/v1/rpc/claim_next_comparison_job", json={})
        rows = response.json()
        return rows[0] if rows else None

    async def get_comparison_document(self, document_id: str, project_id: str) -> dict[str, Any] | None:
        response = await self._request("GET", "/rest/v1/comparison_documents", params={
            "id": f"eq.{document_id}", "project_id": f"eq.{project_id}",
            "select": "id,original_name,storage_path", "limit": "1",
        })
        rows = response.json()
        return rows[0] if rows else None

    async def finish_comparison_job(self, job_id: str, lease_token: str, result: dict[str, Any] | None, error_code: str | None) -> bool:
        response = await self._request("POST", "/rest/v1/rpc/finish_comparison_job", json={
            "p_job_id": job_id, "p_lease_token": lease_token,
            "p_result": result, "p_error_code": error_code,
        })
        return bool(response.json())

    async def record_ai_log(
        self,
        *,
        project_id: str | None = None,
        batch_id: str | None = None,
        task_id: str | None = None,
        document_id: str | None = None,
        extractor: str = "title_study",
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
    ) -> None:
        try:
            # Normalize extractor key to match Supabase check constraint ('title_study', 'plan', 'negotiation')
            raw_ext = extractor.value if hasattr(extractor, "value") else str(extractor)
            ext_map = {"titles": "title_study", "plans": "plan", "title_study": "title_study", "plan": "plan", "negotiation": "negotiation"}
            eff_extractor = ext_map.get(raw_ext, "title_study")

            eff_req_model = requested_model or "gemini-2.5-flash"
            eff_used_model = used_model or eff_req_model
            eff_prompt_tok = prompt_tokens
            eff_comp_tok = completion_tokens
            eff_total_tok = total_tokens or (eff_prompt_tok + eff_comp_tok)

            if estimated_cost_usd is not None:
                eff_cost = float(estimated_cost_usd)
            else:
                m = eff_used_model.lower()
                year = datetime.now(UTC).year
                if "gemini" in m:
                    # Tarifas oficiales Gemini 3.8 Flash (Estándar):
                    # Hasta 31 dic 2026: Entrada USD 0.75 / 1M tokens, Salida USD 3.75 / 1M tokens
                    # A partir de 1 ene 2027: Entrada USD 1.50 / 1M tokens, Salida USD 7.50 / 1M tokens
                    if year >= 2027:
                        p_rate, c_rate = 1.50, 7.50
                    else:
                        p_rate, c_rate = 0.75, 3.75
                elif "mini" in m:
                    p_rate, c_rate = 0.15, 0.60
                elif "claude-3-5" in m:
                    p_rate, c_rate = 3.0, 15.0
                elif "o1" in m or "o3" in m:
                    p_rate, c_rate = 15.0, 60.0
                else:
                    p_rate, c_rate = 2.5, 10.0
                eff_cost = round((eff_prompt_tok / 1_000_000.0) * p_rate + (eff_comp_tok / 1_000_000.0) * c_rate, 6)

            payload = {
                "project_id": project_id,
                "batch_id": batch_id,
                "task_id": task_id,
                "document_id": document_id,
                "extractor_key": eff_extractor,
                "prompt_version_id": prompt_version_id,
                "prompt_version_number": prompt_version_number,
                "requested_model": eff_req_model,
                "used_model": eff_used_model,
                "fallback_triggered": fallback_triggered,
                "fallback_reason": fallback_reason,
                "status": status,
                "latency_ms": latency_ms,
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
            params={"id": f"eq.{execution_id}", "select": "stage,status,completed_units,total_units", "limit": "1"},
        )
        rows = response.json()
        if not rows:
            return False
        row = rows[0]
        if row.get("status") in ("completed", "review_ready", "failed", "cancelled"):
            return False
        stage = row.get("stage")
        if stage in ("ready_for_extraction", "extracting"):
            return True
        c = row.get("completed_units", 0)
        t = row.get("total_units", 0)
        return t > 0 and c >= t

    async def get_pending_v2_extractions(self) -> list[Any]:
        """Finds executions that have validated inputs but haven't completed Phase 4 extraction."""
        from .expediente_v2 import V2Execution

        response = await self._request(
            "GET",
            "/rest/v1/expediente_executions",
            params={
                "status": "in.(queued,processing)",
                "stage": "in.(ready_for_extraction,extracting,queued)",
                "select": "id,project_id,group_id,input_version,extractor_key,extractor_snapshot,prompt_snapshot,model_snapshot,completed_units,total_units",
                "order": "created_at.asc",
                "limit": "5",
            },
        )
        rows = response.json()
        if not rows or not isinstance(rows, list):
            return []
        pending = []
        for r in rows:
            t = r.get("total_units", 0)
            c = r.get("completed_units", 0)
            if t > 0 and c >= t:
                pending.append(
                    V2Execution(
                        id=r["id"],
                        project_id=r["project_id"],
                        group_id=r["group_id"],
                        extractor_key=r["extractor_key"],
                        extractor_snapshot=r.get("extractor_snapshot") or {},
                        prompt_snapshot=r.get("prompt_snapshot") or {},
                        model_snapshot=r.get("model_snapshot") or {},
                        input_version=int(r.get("input_version") or 1),
                    )
                )
        return pending

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

    async def claim_extraction(self, execution_id: str, stage_message: str, stale_after_seconds: int = 600) -> bool:
        """Reclama la extracción de forma atómica: solo un worker la ejecuta.

        La actualización es condicional (PostgREST): pasa a "extracting" únicamente si la ejecución
        sigue abierta y nadie la está extrayendo, o si el reclamo anterior quedó abandonado.
        """
        now = datetime.now(UTC)
        stale = (now - timedelta(seconds=stale_after_seconds)).isoformat()
        response = await self._request(
            "PATCH",
            "/rest/v1/expediente_executions",
            params={
                "id": f"eq.{execution_id}",
                "status": "not.in.(completed,review_ready,failed,cancelled)",
                "or": f"(stage.neq.extracting,updated_at.lt.{stale})",
            },
            json={"stage": "extracting", "stage_message": stage_message, "updated_at": now.isoformat()},
            headers={**self.headers, "Prefer": "return=representation"},
        )
        return bool(response.json())

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
