import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, HTTPException

from .ai_provider import OpenAIExtractionProvider
from .pipeline import process_job
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


@asynccontextmanager
async def lifespan(_: FastAPI):
    stop = asyncio.Event()
    task = asyncio.create_task(worker_loop(stop)) if settings.enabled else None
    yield
    stop.set()
    if task:
        with suppress(asyncio.CancelledError):
            await asyncio.wait_for(task, timeout=10)


app = FastAPI(title="Territorium extraction worker", version="1.0.0", docs_url=None, redoc_url=None, lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "territorium-worker"}


@app.get("/ready")
async def ready() -> dict[str, str]:
    if not settings.ready:
        raise HTTPException(status_code=503, detail="worker configuration incomplete")
    return {"status": "ready"}
