import asyncio
import logging
from datetime import UTC, datetime, timedelta

from openai import APIConnectionError, APITimeoutError, RateLimitError

from .ai_provider import OpenAIExtractionProvider
from .contracts import (
    AiExecutionResult,
    DocumentTask,
    ExtractionEnvelope,
    ExtractorKey,
    Job,
    SourceDocument,
)
from .supabase_gateway import SupabaseGateway

logger = logging.getLogger("territorium.worker")


def resolve_extractor(document: SourceDocument) -> ExtractorKey | None:
    if document.kind in {item.value for item in ExtractorKey}:
        return ExtractorKey(document.kind)
    name = document.original_name.lower()
    if any(token in name for token in ("estudio", "titulo", "título", "matricula", "matrícula")):
        return ExtractorKey.TITLE_STUDY
    if any(token in name for token in ("plano", "topogr", "lindero", "cartogr")):
        return ExtractorKey.PLAN
    if any(token in name for token in ("negocia", "oferta", "avalúo", "avaluo", "servidumbre")):
        return ExtractorKey.NEGOTIATION
    return None


def retry_delay(attempt: int) -> int:
    return min(300, 15 * (2 ** max(0, attempt - 1)))


async def process_job(gateway: SupabaseGateway, provider: OpenAIExtractionProvider, job: Job) -> None:
    await gateway.begin_attempt(job)
    await gateway.patch_batch(job.batch_id, "running")
    await gateway.audit(job, "job.started", f"Ejecución {job.run_id} iniciada.")
    try:
        documents = await gateway.documents(job.batch_id)
        valid_documents = []
        for document in documents:
            if document.is_encrypted or document.preprocessing_status in ("exception", "corrupt"):
                await gateway.audit(
                    job,
                    "document.exception",
                    f"Documento ilegible o protegido omitido de procesamiento automático: {document.original_name}. Motivo: {document.exception_reason or 'No procesable'}"
                )
                continue
            valid_documents.append(document)

        tasks = await gateway.create_or_get_tasks(job, valid_documents, resolve_extractor)
        doc_map = {doc.id: doc for doc in valid_documents}
        task_by_id = {t.id: t for t in tasks}

        processable = [(document, resolve_extractor(document)) for document in valid_documents]
        processable = [(document, extractor) for document, extractor in processable if extractor]
        if not processable:
            raise RuntimeError("NO_PROCESSABLE_DOCUMENTS")

        # US-045 & US-052: Control de concurrencia mediante semáforo (máximo 3 concurrentes por lote)
        semaphore = asyncio.Semaphore(3)
        completed_tasks: set[str] = set()
        failed_tasks: set[str] = set()
        total_items = len(processable)
        processed_count = 0

        async def execute_task_item(document: SourceDocument, extractor: ExtractorKey, task_id: str | None = None) -> None:
            nonlocal processed_count
            async with semaphore:
                if await gateway.job_status(job.id) == "cancelled":
                    return
                cfg = await gateway.extractor_config(extractor)
                if not cfg.is_enabled:
                    if task_id:
                        await gateway.patch_task(
                            task_id,
                            status="failed",
                            error_code="EXTRACTOR_DISABLED",
                            error_message=f"El extractor {extractor.value} está deshabilitado en configuración.",
                            suggested_action="Habilitar el extractor en el panel de configuración técnica.",
                            completed_at=datetime.now(UTC).isoformat(),
                        )
                    processed_count += 1
                    await gateway.patch_job(job.id, progress=round((processed_count / total_items) * 100))
                    return

                prompt = None
                try:
                    if task_id:
                        await gateway.patch_task(task_id, status="running", started_at=datetime.now(UTC).isoformat())
                    content = await gateway.download(document.storage_path)
                    prompt = await gateway.prompt(extractor)
                    result = await provider.extract(
                        content=content,
                        filename=document.original_name,
                        prompt=prompt.prompt,
                        extractor=extractor,
                        run_id=job.run_id,
                        config=cfg,
                    )
                    for record in result.envelope.records:
                        await gateway.save_record(job=job, document=document, extractor=extractor, record=record)

                    completed_tasks.add(document.id)
                    log_status = "fallback_success" if result.fallback_triggered else "success"
                    await gateway.record_ai_log(
                        job=job,
                        task=task_by_id.get(task_id) if task_id else None,
                        document_id=document.id,
                        extractor=extractor,
                        prompt_version=prompt,
                        ai_res=result,
                        status=log_status,
                    )
                    if task_id:
                        await gateway.patch_task(
                            task_id,
                            status="completed",
                            tokens_used=result.total_tokens,
                            completed_at=datetime.now(UTC).isoformat(),
                        )
                except Exception as task_err:
                    failed_tasks.add(document.id)
                    err_msg = str(task_err)[:1000]
                    logger.warning("task_failed doc=%s extractor=%s err=%s", document.original_name, extractor.value, err_msg)
                    await gateway.record_ai_log(
                        job=job,
                        task=task_by_id.get(task_id) if task_id else None,
                        document_id=document.id,
                        extractor=extractor,
                        prompt_version=prompt,
                        ai_res=AiExecutionResult(
                            envelope=ExtractionEnvelope(records=[]),
                            requested_model=cfg.primary_model,
                            used_model=cfg.primary_model,
                        ),
                        status="failed",
                        error_message=err_msg,
                    )
                    if task_id:
                        await gateway.patch_task(
                            task_id,
                            status="failed",
                            error_code="TASK_ERROR",
                            error_message=err_msg,
                            suggested_action="Revisar formato del insumo y ejecutar reproceso puntual.",
                            completed_at=datetime.now(UTC).isoformat(),
                        )
                finally:
                    processed_count += 1
                    progress = round((processed_count / total_items) * 100)
                    await gateway.patch_job(job.id, progress=progress)

        # US-045: Estudios de títulos y planos se ejecutan concurrentemente en paralelo
        independent_tasks = [(doc, ext) for doc, ext in processable if ext in (ExtractorKey.TITLE_STUDY, ExtractorKey.PLAN)]
        dependent_tasks = [(doc, ext) for doc, ext in processable if ext == ExtractorKey.NEGOTIATION]

        doc_task_map = {t.source_document_id: t.id for t in tasks}

        if independent_tasks:
            await asyncio.gather(*[
                execute_task_item(doc, ext, doc_task_map.get(doc.id))
                for doc, ext in independent_tasks
            ])

        # US-046: Negociación solo se ejecuta si los insumos requeridos están listos
        for doc, ext in dependent_tasks:
            t_id = doc_task_map.get(doc.id)
            # Verificar si existe estudio de títulos completado
            has_title = any(d.id in completed_tasks for d, e in independent_tasks if e == ExtractorKey.TITLE_STUDY)
            if has_title or not independent_tasks:
                await execute_task_item(doc, ext, t_id)
            else:
                if t_id:
                    await gateway.patch_task(
                        t_id,
                        status="blocked",
                        dependency_status="blocked",
                        error_code="DEPENDENCY_MISSING",
                        error_message="Requiere estudio de títulos completado para procesar la negociación.",
                        suggested_action="Cargar o reprocesar el estudio de títulos previo para habilitar la negociación."
                    )
                processed_count += 1
                progress = round((processed_count / total_items) * 100)
                await gateway.patch_job(job.id, progress=progress)

        if await gateway.job_status(job.id) == "cancelled":
            await gateway.finish_attempt(job, "cancelled")
            await gateway.patch_batch(job.batch_id, "cancelled")
            return

        final_status = "needs_review" if completed_tasks else "failed"
        await gateway.patch_job(job.id, status=final_status, progress=100, completed_at=datetime.now(UTC).isoformat(), lease_expires_at=None)
        await gateway.patch_batch(job.batch_id, final_status)
        await gateway.finish_attempt(job, final_status)
        await gateway.audit(job, f"job.{final_status}", f"Extracción finalizada: {len(completed_tasks)} tarea(s) completada(s), {len(failed_tasks)} con excepción.")
        logger.info("job_completed job_id=%s project_id=%s run_id=%s", job.id, job.project_id, job.run_id)
    except (RateLimitError, APIConnectionError, APITimeoutError) as exc:
        message = str(exc)[:1000]
        if job.attempt_count < job.max_attempts:
            next_attempt = datetime.now(UTC) + timedelta(seconds=retry_delay(job.attempt_count))
            await gateway.patch_job(job.id, status="queued", error_code="AI_TRANSIENT", error_message=message, next_attempt_at=next_attempt.isoformat(), lease_expires_at=None)
            await gateway.patch_batch(job.batch_id, "queued")
            await gateway.finish_attempt(job, "failed", "AI_TRANSIENT", message)
        else:
            await fail_job(gateway, job, "AI_RETRY_EXHAUSTED", message)
    except Exception as exc:
        logger.exception("job_failed job_id=%s project_id=%s", job.id, job.project_id)
        await fail_job(gateway, job, "PIPELINE_FAILURE", str(exc)[:1000])


async def fail_job(gateway: SupabaseGateway, job: Job, code: str, message: str) -> None:
    await gateway.patch_job(job.id, status="failed", progress=100, error_code=code, error_message=message, completed_at=datetime.now(UTC).isoformat(), lease_expires_at=None)
    await gateway.patch_batch(job.batch_id, "failed")
    await gateway.finish_attempt(job, "failed", code, message)
    await gateway.audit(job, "job.failed", f"{code}: {message[:300]}")

