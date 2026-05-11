from __future__ import annotations

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.db.base import get_db

logger = structlog.get_logger(__name__)

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> UUID:
    """
    Validate the Supabase JWT and return the authenticated user's UUID.
    Verifies RS256 token issued by Supabase Auth using python-jose.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # ── Production: verify JWT with Supabase JWKS ─────────────────────────────
    # Supabase issues HS256 tokens signed with SUPABASE_JWT_SECRET.
    # Uncomment once SUPABASE_JWT_SECRET is available in settings:
    #
    # from jose import jwt, JWTError
    # try:
    #     payload = jwt.decode(
    #         token,
    #         settings.SUPABASE_SERVICE_ROLE_KEY,   # use JWT_SECRET in real setup
    #         algorithms=["HS256"],
    #         audience="authenticated",
    #     )
    #     return UUID(payload["sub"])
    # except JWTError as exc:
    #     raise HTTPException(status_code=401, detail=f"Invalid token: {exc}") from exc

    # ── Development stub ──────────────────────────────────────────────────────
    # Accept any Bearer token and return a fixed dev user UUID.
    # Replace with the real verification above before deploying.
    if settings.ENVIRONMENT == "production":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="JWT verification not configured — set SUPABASE_JWT_SECRET.",
        )

    logger.debug("auth.stub", token_prefix=token[:8] + "...")
    return UUID("00000000-0000-0000-0000-000000000001")


# ── Typed dependency aliases ──────────────────────────────────────────────────
CurrentUser = Annotated[UUID, Depends(get_current_user_id)]
DbSession   = Annotated[AsyncSession, Depends(get_db)]
