from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.api.v1.deps import CurrentUser, DbSession
from app.core.audit import audit_log
from app.models.appointment import Appointment

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class AppointmentStatus(str, Enum):
    SCHEDULED  = "scheduled"
    COMPLETED  = "completed"
    CANCELLED  = "cancelled"
    NO_SHOW    = "no_show"


class AppointmentCreate(BaseModel):
    title:            str                      = Field(..., min_length=1, max_length=200)
    provider_name:    Optional[str]            = None
    specialty:        Optional[str]            = None
    location:         Optional[str]            = None
    appointment_date: datetime
    duration_minutes: Optional[int]            = Field(30, ge=1, le=1440)
    status:           AppointmentStatus        = AppointmentStatus.SCHEDULED
    notes:            Optional[str]            = None


class AppointmentUpdate(BaseModel):
    title:            Optional[str]            = Field(None, min_length=1, max_length=200)
    provider_name:    Optional[str]            = None
    specialty:        Optional[str]            = None
    location:         Optional[str]            = None
    appointment_date: Optional[datetime]       = None
    duration_minutes: Optional[int]            = Field(None, ge=1, le=1440)
    status:           Optional[AppointmentStatus] = None
    notes:            Optional[str]            = None
    reminder_sent:    Optional[bool]           = None


class AppointmentResponse(BaseModel):
    id:               UUID
    user_id:          UUID
    title:            str
    provider_name:    Optional[str]      = None
    specialty:        Optional[str]      = None
    location:         Optional[str]      = None
    appointment_date: datetime
    duration_minutes: Optional[int]      = None
    status:           str
    notes:            Optional[str]      = None
    reminder_sent:    bool
    deleted_at:       Optional[datetime] = None
    created_at:       datetime
    updated_at:       datetime

    class Config:
        from_attributes = True


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=List[AppointmentResponse],
    summary="List appointments",
)
async def list_appointments(
    current_user: CurrentUser,
    db:           DbSession,
    status:        Optional[AppointmentStatus] = Query(None, description="Filter by status"),
    upcoming_only: bool                        = Query(False, description="Return only future appointments"),
    page:          int                         = Query(1, ge=1),
    page_size:     int                         = Query(20, ge=1, le=100),
) -> Any:
    stmt = (
        select(Appointment)
        .where(
            Appointment.user_id == current_user,
            Appointment.deleted_at.is_(None),
        )
        .order_by(Appointment.appointment_date.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    if status is not None:
        stmt = stmt.where(Appointment.status == status.value)

    if upcoming_only:
        stmt = stmt.where(Appointment.appointment_date >= datetime.now(UTC))

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post(
    "",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create an appointment",
)
async def create_appointment(
    payload:      AppointmentCreate,
    current_user: CurrentUser,
    db:           DbSession,
) -> Any:
    appt = Appointment(
        id=uuid.uuid4(),
        user_id=current_user,
        title=payload.title,
        provider_name=payload.provider_name,
        specialty=payload.specialty,
        location=payload.location,
        appointment_date=payload.appointment_date,
        duration_minutes=payload.duration_minutes,
        status=payload.status.value,
        notes=payload.notes,
    )
    db.add(appt)
    await db.flush()

    await audit_log(
        db,
        user_id=current_user,
        action="appointment.create",
        resource_id=str(appt.id),
        table_name="appointments_v2",
        new_values={
            "title": appt.title,
            "appointment_date": str(appt.appointment_date),
            "status": appt.status,
        },
    )

    await db.commit()
    await db.refresh(appt)

    logger.info("appointment.created", appointment_id=str(appt.id), user_id=str(current_user))
    return appt


@router.get(
    "/upcoming",
    response_model=List[AppointmentResponse],
    summary="Upcoming appointments (next 30 days, status=scheduled)",
)
async def upcoming_appointments(
    current_user: CurrentUser,
    db:           DbSession,
) -> Any:
    now       = datetime.now(UTC)
    cutoff    = now + timedelta(days=30)

    stmt = (
        select(Appointment)
        .where(
            Appointment.user_id == current_user,
            Appointment.deleted_at.is_(None),
            Appointment.status == AppointmentStatus.SCHEDULED.value,
            Appointment.appointment_date >= now,
            Appointment.appointment_date <= cutoff,
        )
        .order_by(Appointment.appointment_date.asc())
    )

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/{id}",
    response_model=AppointmentResponse,
    summary="Get an appointment",
)
async def get_appointment(
    id:           UUID,
    current_user: CurrentUser,
    db:           DbSession,
) -> Any:
    stmt = select(Appointment).where(
        Appointment.id == id,
        Appointment.user_id == current_user,
        Appointment.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()

    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")

    return appt


@router.patch(
    "/{id}",
    response_model=AppointmentResponse,
    summary="Update an appointment",
)
async def update_appointment(
    id:           UUID,
    payload:      AppointmentUpdate,
    current_user: CurrentUser,
    db:           DbSession,
) -> Any:
    stmt = select(Appointment).where(
        Appointment.id == id,
        Appointment.user_id == current_user,
        Appointment.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()

    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")

    update_data = payload.model_dump(exclude_unset=True)
    old_values: dict[str, Any] = {}

    for field, value in update_data.items():
        old_values[field] = getattr(appt, field, None)
        if field == "status" and value is not None:
            # Convert enum instance to its string value
            setattr(appt, field, value.value if isinstance(value, AppointmentStatus) else value)
        else:
            setattr(appt, field, value)

    await audit_log(
        db,
        user_id=current_user,
        action="appointment.update",
        resource_id=str(appt.id),
        table_name="appointments_v2",
        old_values={k: str(v) for k, v in old_values.items()},
        new_values={k: str(v) for k, v in update_data.items()},
    )

    await db.commit()
    await db.refresh(appt)

    logger.info("appointment.updated", appointment_id=str(appt.id), user_id=str(current_user))
    return appt


@router.delete(
    "/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Soft-delete an appointment",
)
async def delete_appointment(
    id:           UUID,
    current_user: CurrentUser,
    db:           DbSession,
) -> None:
    stmt = select(Appointment).where(
        Appointment.id == id,
        Appointment.user_id == current_user,
        Appointment.deleted_at.is_(None),
    )
    result = await db.execute(stmt)
    appt = result.scalar_one_or_none()

    if appt is None:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.deleted_at = datetime.now(UTC)

    await audit_log(
        db,
        user_id=current_user,
        action="appointment.delete",
        resource_id=str(appt.id),
        table_name="appointments_v2",
        old_values={"status": appt.status, "title": appt.title},
    )

    await db.commit()

    logger.info("appointment.deleted", appointment_id=str(appt.id), user_id=str(current_user))
