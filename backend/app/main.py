from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from app.core.config import settings
from app.db.base import engine

# Import all models so SQLAlchemy registers them before first use
import app.models  # noqa: F401

logger = structlog.get_logger(__name__)

def _make_limiter() -> Limiter:
    """Create a rate limiter, falling back to in-memory storage if Redis is unavailable."""
    storage_uri = settings.REDIS_URL if settings.RATE_LIMIT_ENABLED else None
    try:
        return Limiter(
            key_func=get_remote_address,
            storage_uri=storage_uri,
            default_limits=["200/minute"],
            enabled=settings.RATE_LIMIT_ENABLED,
        )
    except Exception:
        logger.warning("rate_limiter.redis_unavailable", fallback="in-memory")
        return Limiter(
            key_func=get_remote_address,
            default_limits=["200/minute"],
            enabled=False,
        )


limiter = _make_limiter()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("startup", app=settings.APP_NAME, version=settings.APP_VERSION)
    yield
    # Close all DB connections gracefully on shutdown
    await engine.dispose()
    logger.info("shutdown.complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        version=settings.APP_VERSION,
        docs_url="/docs" if settings.DEBUG else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.DEBUG else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID", "X-RateLimit-Remaining"],
        max_age=600,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(SlowAPIMiddleware)

    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        start = time.perf_counter()

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            method=request.method,
            path=request.url.path,
        )

        response: Response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time-Ms"] = str(elapsed_ms)

        logger.info("http.request", status_code=response.status_code, elapsed_ms=elapsed_ms)
        return response

    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not settings.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response

    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={
            "error": "Validation failed",
            "issues": [{"path": ".".join(str(l) for l in e["loc"]), "message": e["msg"]} for e in exc.errors()],
            "request_id": request.headers.get("X-Request-ID", ""),
        })

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", exc_info=exc)
        return JSONResponse(status_code=500, content={
            "error": "An unexpected error occurred.",
            "request_id": request.headers.get("X-Request-ID", ""),
        })

    # Register routers
    API_PREFIX = "/api/v1"
    from app.api.v1.routers import vitals, medications, analytics, clinical
    app.include_router(vitals.router,      prefix=f"{API_PREFIX}/vitals",       tags=["Vitals"])
    app.include_router(medications.router, prefix=f"{API_PREFIX}/medications",  tags=["Medications"])
    app.include_router(analytics.router,   prefix=f"{API_PREFIX}/analytics",    tags=["Analytics"])
    # MediKeep clinical domains — one router, resource-prefixed paths
    app.include_router(clinical.router,    prefix=f"{API_PREFIX}",              tags=["Clinical"])

    @app.get("/health", include_in_schema=False)
    async def health_check():
        return {"status": "ok", "version": settings.APP_VERSION}

    return app


app = create_app()
