from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Any, List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field

from app.api.v1.deps import CurrentUser, DbSession
from app.services.medication_service import MedicationService

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class FrequencyType(str, Enum):
    ONCE_DAILY        = "once_daily"
    TWICE_DAILY       = "twice_daily"
    THREE_DAILY       = "three_times_daily"
    FOUR_DAILY        = "four_times_daily"
    EVERY_OTHER_DAY   = "every_other_day"
    WEEKLY            = "weekly"
    AS_NEEDED         = "as_needed"
    CUSTOM            = "custom"


class MedicationCreate(BaseModel):
    name:             str            = Field(..., min_length=1, max_length=200)
    dose_amount:      Decimal        = Field(..., gt=0)
    dose_unit:        str            = Field(..., max_length=30)
    frequency:        FrequencyType
    prescribed_by:    Optional[str]  = Field(None, max_length=120)
    start_date:       Optional[datetime] = None
    end_date:         Optional[datetime] = None
    notes:            Optional[str]  = Field(None, max_length=2000)
    reminder_enabled: bool           = True


class MedicationResponse(BaseModel):
    id:               UUID
    name:             str
    dosage:           str
    frequency:        str
    prescribed_by:    Optional[str]      = None
    start_date:       Optional[str]      = None
    end_date:         Optional[str]      = None
    notes:            Optional[str]      = None
    reminder_enabled: bool
    is_active:        bool
    created_at:       datetime

    class Config:
        from_attributes = True


class AdherenceLogCreate(BaseModel):
    scheduled_at: datetime
    taken_at:     Optional[datetime] = None
    was_taken:    bool
    notes:        Optional[str] = Field(None, max_length=500)


class AdherenceLogResponse(BaseModel):
    id:            UUID
    medication_id: UUID
    scheduled_at:  datetime
    taken_at:      Optional[datetime] = None
    was_taken:     bool
    notes:         Optional[str] = None
    created_at:    datetime

    class Config:
        from_attributes = True


class AdherenceSummary(BaseModel):
    medication_id:    UUID
    medication_name:  str
    total_doses:      int
    taken_doses:      int
    adherence_rate:   float
    streak_days:      int
    last_taken:       Optional[datetime]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=MedicationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new medication",
)
async def create_medication(
    payload: MedicationCreate,
    user_id: CurrentUser,
    db:      DbSession,
) -> Any:
    svc = MedicationService(db)
    return await svc.create(
        user_id=user_id,
        name=payload.name,
        dose_amount=payload.dose_amount,
        dose_unit=payload.dose_unit,
        frequency=payload.frequency.value,
        prescribed_by=payload.prescribed_by,
        start_date=payload.start_date,
        end_date=payload.end_date,
        notes=payload.notes,
        reminder_enabled=payload.reminder_enabled,
    )


@router.get(
    "",
    response_model=List[MedicationResponse],
    summary="List medications",
)
async def list_medications(
    user_id:   CurrentUser,
    db:        DbSession,
    is_active: Optional[bool] = Query(None),
    page:      int             = Query(1, ge=1),
    page_size: int             = Query(20, ge=1, le=100),
) -> Any:
    svc = MedicationService(db)
    return await svc.list(user_id=user_id, is_active=is_active, page=page, page_size=page_size)


@router.get(
    "/adherence/summary",
    response_model=List[AdherenceSummary],
    summary="Adherence summary for all active medications",
)
async def get_adherence_summary(
    user_id: CurrentUser,
    db:      DbSession,
    days:    int = Query(30, ge=1, le=365),
) -> Any:
    svc = MedicationService(db)
    return await svc.get_adherence_summary(user_id=user_id, days=days)


@router.get(
    "/{medication_id}",
    response_model=MedicationResponse,
    summary="Get a medication",
)
async def get_medication(
    medication_id: UUID,
    user_id:       CurrentUser,
    db:            DbSession,
) -> Any:
    svc = MedicationService(db)
    return await svc.get_by_id(medication_id=medication_id, user_id=user_id)


@router.patch(
    "/{medication_id}",
    response_model=MedicationResponse,
    summary="Update a medication",
)
async def update_medication(
    medication_id: UUID,
    payload:       MedicationCreate,
    user_id:       CurrentUser,
    db:            DbSession,
) -> Any:
    svc = MedicationService(db)
    return await svc.update(
        medication_id=medication_id,
        user_id=user_id,
        name=payload.name,
        dose_amount=payload.dose_amount,
        dose_unit=payload.dose_unit,
        frequency=payload.frequency.value,
        prescribed_by=payload.prescribed_by,
        started_on=payload.start_date.date() if payload.start_date else None,
        ended_on=payload.end_date.date() if payload.end_date else None,
        instructions=payload.notes,
    )


@router.delete(
    "/{medication_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Deactivate a medication",
)
async def deactivate_medication(
    medication_id: UUID,
    user_id:       CurrentUser,
    db:            DbSession,
) -> None:
    svc = MedicationService(db)
    await svc.delete(medication_id=medication_id, user_id=user_id)


@router.post(
    "/{medication_id}/adherence",
    response_model=AdherenceLogResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log medication adherence",
)
async def log_adherence(
    medication_id: UUID,
    payload:       AdherenceLogCreate,
    user_id:       CurrentUser,
    db:            DbSession,
) -> Any:
    svc = MedicationService(db)
    return await svc.log_adherence(
        medication_id=medication_id,
        user_id=user_id,
        scheduled_at=payload.scheduled_at,
        taken_at=payload.taken_at,
        was_taken=payload.was_taken,
        notes=payload.notes,
    )


@router.get(
    "/{medication_id}/adherence",
    response_model=List[AdherenceLogResponse],
    summary="Get adherence history for a medication",
)
async def get_adherence_history(
    medication_id: UUID,
    user_id:       CurrentUser,
    db:            DbSession,
    start_date:    Optional[datetime] = Query(None),
    end_date:      Optional[datetime] = Query(None),
    page:          int                = Query(1, ge=1),
    page_size:     int                = Query(30, ge=1, le=100),
) -> Any:
    svc = MedicationService(db)
    return await svc.get_adherence_history(
        medication_id=medication_id,
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )
