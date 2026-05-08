"""FastAPI application entry point — wires up middleware, routers, and lifespan."""
from __future__ import annotations
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.api.cors import add_cors
from app.api.auth import router as auth_router
from app.api.conversations import router as conversations_router
from app.api.websocket import router as ws_router
from app.core import cancel_bus
from app.core.logging import configure_logging, get_logger
from app.core.redis import close_redis, get_redis
from app.schemas.common import HealthResponse

configure_logging()
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    redis = await get_redis()
    await cancel_bus.start(redis)
    log.info("startup_complete")
    yield
    await cancel_bus.stop()
    await close_redis()
    log.info("shutdown_complete")


app = FastAPI(
    title="Hugo",
    version="0.1.0",
    lifespan=lifespan,
)

add_cors(app)

app.include_router(auth_router, prefix="/api")
app.include_router(conversations_router, prefix="/api")
app.include_router(ws_router)


@app.get("/health", response_model=HealthResponse, tags=["meta"])
async def health():
    return HealthResponse(status="ok", version="0.1.0")
