import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException

from openai import AsyncOpenAI

from .ai_provider import OpenAIExtractionProvider
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
    ai_client = AsyncOpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None
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


app = FastAPI(title="Territorium extraction worker", version="1.0.0", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "territorium-worker"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    if not settings.expediente_v2_ready:
        raise HTTPException(status_code=503, detail="worker configuration incomplete")
    return {
        "status": "ready",
        "phase3": "ingestion-ready",
        "phase4": "ai-ready" if settings.ready else "deterministic-ready",
    }

