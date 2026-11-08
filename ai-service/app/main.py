"""FastAPI entry point. Run with: uvicorn --factory app.main:create_app"""

from __future__ import annotations

import hmac
import logging
import time
import uuid
from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from .config import MAX_UPLOAD_BYTES, Settings
from .logging_setup import configure_logging
from .pipeline import InvalidImageError, Pipeline

PipelineFactory = Callable[[Settings], Pipeline]
# Multipart framing (boundary, part headers) on top of the 5 MB file itself.
MULTIPART_OVERHEAD_BYTES = 64 * 1024
PUBLIC_PATHS = {"/health"}

log = logging.getLogger("tera.ai")


class InMemoryMultiPartParser(MultiPartParser):
    # Starlette spools parts above 1 MB to a temp file; keep uploads in memory so the
    # service never writes a photo to disk.
    spool_max_size = MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES


def load_pipeline(settings: Settings) -> Pipeline:
    # Heavy imports stay here so contract tests with fake models never import torch models.
    from .detector import OwlDetector
    from .embedder import MiewIdEmbedder

    detector = OwlDetector(
        settings.detector_model, settings.device, settings.detector_input_size, settings.detector_revision
    )
    return Pipeline(
        detector,
        MiewIdEmbedder(settings.device),
        quality=settings.quality,
        detection=settings.detection,
        max_side=settings.max_side,
        crop_margin=settings.crop_margin,
    )


def error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"error": code}, status_code=status)


async def read_capped_body(request: Request, limit: int) -> bytes | None:
    """Read the request body, returning None as soon as it exceeds `limit` bytes."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > limit:
        return None
    chunks, size = [], 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            return None
        chunks.append(chunk)
    return b"".join(chunks)


async def single_chunk(data: bytes) -> AsyncGenerator[bytes, None]:
    yield data


async def read_image_field(request: Request, body: bytes) -> bytes | None:
    parser = InMemoryMultiPartParser(request.headers, single_chunk(body), max_files=1, max_fields=0)
    form = await parser.parse()
    upload = form.get("image")
    if not isinstance(upload, UploadFile):
        return None
    try:
        return await upload.read()
    finally:
        await upload.close()


def create_app(settings: Settings | None = None, pipeline_factory: PipelineFactory = load_pipeline) -> FastAPI:
    configure_logging()
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        started = time.perf_counter()
        app.state.pipeline = await run_in_threadpool(pipeline_factory, settings)
        log.info(
            "models_loaded",
            extra={
                "event": "models_loaded",
                "model_version": app.state.pipeline.model_version,
                "embedding_dim": app.state.pipeline.embedding_dim,
                "latency_ms": round((time.perf_counter() - started) * 1000),
            },
        )
        yield

    app = FastAPI(title="Tera AI service", lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def auth_and_log(request: Request, call_next):
        # Accept the caller's id so Next.js and service logs can be joined; bound its length.
        request_id = (request.headers.get("x-request-id") or uuid.uuid4().hex)[:128]
        request.state.request_id = request_id
        request.state.log = {}
        started = time.perf_counter()
        if request.url.path in PUBLIC_PATHS or is_authorized(request, settings.service_key):
            response = await call_next(request)
        else:
            response = error(401, "unauthorized")
        response.headers["X-Request-Id"] = request_id
        log.info(
            "request",
            extra={
                "event": "request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status": response.status_code,
                "latency_ms": round((time.perf_counter() - started) * 1000, 1),
                **request.state.log,
            },
        )
        return response

    @app.get("/health")
    async def health(request: Request) -> dict:
        pipeline: Pipeline = request.app.state.pipeline
        return {"status": "ok", "model_version": pipeline.model_version, "embedding_dim": pipeline.embedding_dim}

    @app.post("/v1/analyze")
    async def analyze(request: Request):
        body = await read_capped_body(request, MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES)
        if body is None:
            request.state.log["outcome"] = "too_large"
            return error(413, "too_large")
        try:
            data = await read_image_field(request, body)
        except MultiPartException:
            data = None
        if not data:
            request.state.log["outcome"] = "invalid_image"
            return error(400, "invalid_image")
        if len(data) > MAX_UPLOAD_BYTES:
            request.state.log["outcome"] = "too_large"
            return error(413, "too_large")

        pipeline: Pipeline = request.app.state.pipeline
        try:
            result = await run_in_threadpool(pipeline.analyze_bytes, data)
        except InvalidImageError:
            request.state.log["outcome"] = "invalid_image"
            return error(400, "invalid_image")
        request.state.log.update(
            outcome="accepted" if result.embedding is not None else "rejected",
            reasons=result.reasons,
            stage_ms=result.timings_ms,
            width=result.width,
            height=result.height,
            detection_score=round(result.score, 4),
        )
        return result.to_response(pipeline.model_version)

    @app.exception_handler(Exception)
    async def unhandled(request: Request, exc: Exception) -> JSONResponse:
        log.exception(
            "unhandled_error",
            extra={"event": "unhandled_error", "request_id": getattr(request.state, "request_id", None)},
        )
        return error(500, "internal_error")

    return app


def is_authorized(request: Request, expected: str | None) -> bool:
    if expected is None:
        return True  # only reachable with ALLOW_NO_KEY=1
    supplied = request.headers.get("x-service-key", "")
    return hmac.compare_digest(supplied.encode(), expected.encode())
