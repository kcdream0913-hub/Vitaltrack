from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Query, status
from pydantic import BaseModel, Field, field_validator
from decimal import Decimal
from enum import Enum

from app.api.v1.deps import CurrentUser, DbSession
from app.services.vital_service import VitalService

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class VitalType(str, Enum):
    HEART_RATE       = "heart_rate"
    BLOOD_PRESSURE   = "blood_pressure"
    BLOOD_GLUCOSE    = "blood_glucose"
    BLOOD_OXYGEN     = "blood_oxygen"
    BODY_TEMPERATURE = "body_temperature"
    WEIGHT           = "weight"
    RESPIRATORY_RATE = "respiratory_rate"


class VitalCreate(BaseModel):
    vital_type:      VitalType
    value:           Decimal = Field(..., ge=0, le=99999, decimal_places=4)
    unit:            str     = Field(..., max_length=20)
    recorded_at:     datetime
    secondary_value: Optional[Decimal] = Field(None, ge=0, le=99999)
    notes:           Optional[str]     = Field(None, max_length=1000)
    device_source:   Optional[str]     = Field(None, max_length=200)

    @field_validator("recorded_at")
    @classmethod
    def not_in_future(cls, v: datetime) -> datetime:
        if v > datetime.utcnow():
            raise ValueError("recorded_at cannot be in the future")
        return v


class VitalResponse(BaseModel):
    id:              UUID
    vital_type:      str
    value:           Decimal
    unit:            str
    recorded_at:     datetime
    secondary_value: Optional[Decimal] = None
    notes:           Optional[str]     = None
    device_source:   Optional[str]     = None
    created_at:      datetime

    class Config:
        from_attributes = True


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=VitalResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Log a vital reading",
)
async def create_vital(
    payload: VitalCreate,
    user_id: CurrentUser,
    db:      DbSession,
) -> Any:
    svc = VitalService(db)
    return await svc.create(
        user_id=user_id,
        vital_type=payload.vital_type.value,
        value=payload.value,
        secondary_value=payload.secondary_value,
        recorded_at=payload.recorded_at,
        notes=payload.notes,
        device_source=payload.device_source,
    )


@router.get(
    "",
    response_model=List[VitalResponse],
    summary="List vital readings",
)
async def list_vitals(
    user_id:    CurrentUser,
    db:         DbSession,
    vital_type: Optional[VitalType] = Query(None),
    start_date: Optional[datetime]  = Query(None),
    end_date:   Optional[datetime]  = Query(None),
    page:       int                 = Query(1, ge=1),
    page_size:  int                 = Query(20, ge=1, le=100),
) -> Any:
    svc = VitalService(db)
    return await svc.list(
        user_id=user_id,
        vital_type=vital_type.value if vital_type else None,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/latest",
    summary="Get latest reading per vital type",
)
async def get_latest(
    user_id: CurrentUser,
    db:      DbSession,
) -> Any:
    svc = VitalService(db)
    return await svc.get_latest(user_id=user_id)


@router.get(
    "/{vital_id}",
    response_model=VitalResponse,
    summary="Get a single vital reading",
)
async def get_vital(
    vital_id: UUID,
    user_id:  CurrentUser,
    db:       DbSession,
) -> Any:
    svc = VitalService(db)
    return await svc.get_by_id(vital_id=vital_id, user_id=user_id)


@router.delete(
    "/{vital_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    summary="Soft-delete a vital reading",
)
async def delete_vital(
    vital_id: UUID,
    user_id:  CurrentUser,
    db:       DbSession,
) -> None:
    svc = VitalService(db)
    await svc.delete(vital_id=vital_id, user_id=user_id)
