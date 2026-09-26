import asyncio
import hmac
import logging
from contextlib import asynccontextmanager, suppress
from typing import Any

from fastapi import FastAPI, HTTPException, Request, status

from openai import AsyncOpenAI

from .ai_provider import OpenAIExtractionProvider
from .document_ai_revision import process_document_ai_revision
from .document_comparison import process_comparison_job
from .expediente_v2 import process_expediente_v2_task
from .pipeline import process_job
from .pipeline_v2 import Phase4PipelineOrchestrator
from .settings import Settings
from .supabase_gateway import SupabaseGateway

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("territorium.worker")
settings = Settings.from_env()


async def worker_loop(stop: asyncio.Event) -> None:
    if not settings.ready:
        logger.warning("worker_not_ready missing required configuration")
        return
    gateway = SupabaseGateway(settings)
    provider = OpenAIExtractionProvider(settings)
    try:
        while not stop.is_set():
            try:
                job = await gateway.claim()
                if job:
                    await process_job(gateway, provider, job)
                    continue
            except Exception:
                logger.exception("worker_poll_failed")
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.poll_seconds)
            except TimeoutError:
                pass
    finally:
        await gateway.close()


async def expediente_v2_worker_loop(stop: asyncio.Event) -> None:
    """Processes leased v2 tasks and triggers Phase 4 extraction upon input validation."""
    if not settings.expediente_v2_ready:
        logger.warning("expediente_v2_worker_not_ready missing required configuration")
        return
    gateway = SupabaseGateway(settings)
    ai_client = (
        AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.ai_base_url)
        if settings.openai_api_key
        else None
    )
    orchestrator = Phase4PipelineOrchestrator(ai_client=ai_client, primary_model=settings.ai_model)
    cleanup_counter = 0
    try:
        while not stop.is_set():
            try:
                task = await gateway.claim_expediente_v2_task()
                if task:
                    await process_expediente_v2_task(gateway, task, orchestrator=orchestrator)
                    cleanup_counter += 1
                    if cleanup_counter % 25 == 0:
                        await gateway.cleanup_expired_expediente_uploads()
                    continue
                pending_extractions = await gateway.get_pending_v2_extractions()
                if pending_extractions:
                    for pending_exec in pending_extractions:
                        from .expediente_v2 import trigger_phase4_extraction_if_ready
                        await trigger_phase4_extraction_if_ready(gateway, pending_exec, orchestrator)
                    continue
                revision = await gateway.claim_document_ai_revision()
                if revision:
                    await process_document_ai_revision(gateway, revision, ai_client, settings.ai_model)
                    continue
                comparison = await gateway.claim_comparison_job()
                if comparison:
                    await process_comparison_job(gateway, comparison, ai_client, settings.ai_model)
                    continue
                if cleanup_counter % 30 == 0:
                    await gateway.cleanup_expired_expediente_uploads()
                cleanup_counter += 1
            except Exception:
                # Do not include document paths, names, or bytes in worker logs.
                logger.exception("expediente_v2_worker_poll_failed")
            try:
                await asyncio.wait_for(stop.wait(), timeout=settings.expediente_v2_poll_seconds)
            except TimeoutError:
                pass
    finally:
        await gateway.close()


@asynccontextmanager
async def lifespan(_: FastAPI):
    stop = asyncio.Event()
    task = asyncio.create_task(worker_loop(stop)) if settings.enabled else None
    expediente_v2_task = asyncio.create_task(expediente_v2_worker_loop(stop)) if settings.expediente_v2_enabled else None
    yield
    stop.set()
    if task:
        with suppress(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=10)
    if expediente_v2_task:
        with suppress(asyncio.CancelledError):
            await asyncio.wait_for(expediente_v2_task, timeout=10)


from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(title="Territorium extraction worker", version="1.0.0", docs_url=None, redoc_url=None, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "territorium-worker"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    if not settings.expediente_v2_enabled or not settings.expediente_v2_ready:
        raise HTTPException(status_code=503, detail="worker configuration incomplete")
    return {
        "status": "ready",
        "phase3": "ingestion-ready",
        "phase4": "ai-ready" if settings.ready else "deterministic-ready",
    }


def wake_request_authorized(provided_token: str | None) -> bool:
    expected_token = settings.worker_wake_token
    return bool(expected_token and provided_token and hmac.compare_digest(expected_token, provided_token))


@app.post("/internal/wake", status_code=status.HTTP_202_ACCEPTED)
async def wake_worker(request: Request) -> dict[str, str]:
    if not wake_request_authorized(request.headers.get("x-territorium-wake-token")):
        # Do not reveal whether this internal route exists or is misconfigured.
        raise HTTPException(status_code=404, detail="Not found")
    if not settings.expediente_v2_enabled or not settings.expediente_v2_ready:
        raise HTTPException(status_code=503, detail="worker configuration incomplete")
    return {"status": "accepted"}


class DeleteFileBody(BaseModel):
    file_id: str


@app.post("/api/expediente/delete-file")
async def delete_expediente_file_post(body: DeleteFileBody) -> dict[str, Any]:
    return await _execute_file_deletion(body.file_id)


@app.delete("/api/expediente/files/{file_id}")
async def delete_expediente_file_delete(file_id: str) -> dict[str, Any]:
    return await _execute_file_deletion(file_id)


async def _execute_file_deletion(file_id: str) -> dict[str, Any]:
    gateway = SupabaseGateway(settings)
    try:
        # 1. Fetch target file
        resp = await gateway.client.get(
            f"{settings.supabase_url}/rest/v1/expediente_document_files?id=eq.{file_id}&select=id,project_id,group_id,storage_path,original_name",
            headers=gateway.headers,
        )
        files = resp.json()
        if not files or not isinstance(files, list):
            raise HTTPException(status_code=404, detail="Archivo no encontrado.")
        file_row = files[0]
        group_id = file_row["group_id"]
        storage_path = file_row.get("storage_path")

        # 2. Check group status
        grp_resp = await gateway.client.get(
            f"{settings.supabase_url}/rest/v1/expediente_document_groups?id=eq.{group_id}&select=id,status,current_negotiation_file_id",
            headers=gateway.headers,
        )
        groups = grp_resp.json()
        if groups and isinstance(groups, list):
            grp = groups[0]
            if grp.get("status") in ("queued", "processing"):
                raise HTTPException(status_code=400, detail="No se puede eliminar un archivo mientras el grupo se analiza.")

        # 3. Soft-delete / retire file
        patch_resp = await gateway.client.patch(
            f"{settings.supabase_url}/rest/v1/expediente_document_files?id=eq.{file_id}",
            headers=gateway.headers,
            json={"is_active": False, "is_current": False},
        )
        if patch_resp.status_code >= 400:
            err_msg = "Error al marcar archivo como retirado en la base de datos."
            with suppress(Exception):
                err_json = patch_resp.json()
                if "message" in err_json:
                    err_msg = f"{err_msg} ({err_json['message']})"
            logger.error(f"Failed to retire file {file_id}: {patch_resp.status_code} {patch_resp.text}")
            raise HTTPException(status_code=500, detail=err_msg)

        # 4. Optional Storage cleanup — usa el endpoint "remove" recomendado por Supabase.
        if storage_path:
            try:
                del_resp = await gateway.client.post(
                    f"{settings.supabase_url}/storage/v1/object/remove/source-documents",
                    headers=gateway.headers,
                    json={"prefixes": [storage_path]},
                )
                if del_resp.status_code >= 400:
                    logger.warning(
                        f"Storage cleanup failed for {storage_path}: "
                        f"HTTP {del_resp.status_code} — {del_resp.text[:200]}"
                    )
            except Exception as exc:
                # No bloqueamos el flujo pero registramos para evitar objetos huérfanos.
                logger.warning(f"Storage cleanup exception for {storage_path}: {exc}")

        # 5. Count remaining active files
        rem_resp = await gateway.client.get(
            f"{settings.supabase_url}/rest/v1/expediente_document_files?group_id=eq.{group_id}&is_active=eq.true&is_current=eq.true&select=id",
            headers=gateway.headers,
        )
        remaining = rem_resp.json() if rem_resp.status_code == 200 else []
        remaining_count = len(remaining) if isinstance(remaining, list) else 0

        # 6. Update group status and negotiation pointer
        if groups and isinstance(groups, list):
            grp = groups[0]
            updates: dict[str, Any] = {}
            if grp.get("current_negotiation_file_id") == file_id:
                updates["current_negotiation_file_id"] = remaining[0]["id"] if remaining_count > 0 else None

            if remaining_count == 0:
                updates["status"] = "empty"
            elif grp.get("status") in ("review_ready", "approved"):
                updates["status"] = "stale"

            if updates:
                await gateway.client.patch(
                    f"{settings.supabase_url}/rest/v1/expediente_document_groups?id=eq.{group_id}",
                    headers=gateway.headers,
                    json=updates,
                )

        logger.info(f"File {file_id} ({file_row.get('original_name')}) successfully retired from group {group_id}.")
        return {
            "status": "ok",
            "deleted_file_id": file_id,
            "file_name": file_row.get("original_name"),
            "remaining_files": remaining_count,
        }
    finally:
        await gateway.close()
