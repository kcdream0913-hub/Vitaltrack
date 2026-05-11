from __future__ import annotations

"""
Lightweight audit logging helper.

For every CREATE / UPDATE / DELETE operation on PHI tables, call
`audit_log()` with the relevant context.  In production the function
inserts a row into public.audit_logs (the append-only HIPAA audit trail
defined in migration 001).  In test environments it just logs to stdout.

Usage inside a service method:
    from app.core.audit import audit_log
    await audit_log(db, user_id=user_id, action="vital.create", resource_id=str(vital.id))
"""

import uuid
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings

logger = structlog.get_logger(__name__)


async def audit_log(
    db:          AsyncSession,
    *,
    user_id:     uuid.UUID,
    action:      str,               # e.g. "vital.create", "medication.delete"
    resource_id: str | None = None, # UUID of the affected row
    table_name:  str | None = None,
    old_values:  dict[str, Any] | None = None,
    new_values:  dict[str, Any] | None = None,
    ip_address:  str | None = None,
) -> None:
    """
    Insert a row into public.audit_logs.

    The table schema (from migration 001) is:
        id, user_id, action, table_name, record_id,
        old_values (jsonb), new_values (jsonb),
        ip_address, created_at
    """
    if not settings.AUDIT_LOG_ENABLED:
        return

    try:
        import json
        await db.execute(
            text("""
                INSERT INTO public.audit_logs
                    (user_id, action, table_name, record_id,
                     old_values, new_values, ip_address, created_at)
                VALUES
                    (:user_id, :action, :table_name, :record_id,
                     :old_values::jsonb, :new_values::jsonb, :ip_address, NOW())
            """),
            {
                "user_id":    str(user_id),
                "action":     action,
                "table_name": table_name,
                "record_id":  resource_id,
                "old_values": json.dumps(old_values) if old_values else None,
                "new_values": json.dumps(new_values, default=str) if new_values else None,
                "ip_address": ip_address,
            },
        )
    except Exception as exc:
        # Audit logging must never break the main request flow
        logger.error("audit_log.failed", error=str(exc), action=action, user_id=str(user_id))
