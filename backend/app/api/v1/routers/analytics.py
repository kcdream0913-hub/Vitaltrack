from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Query, status
from pydantic import BaseModel

from app.api.v1.deps import CurrentUser, DbSession
from app.services.analytics_service import AnalyticsService
from app.services.vital_service import VitalService

logger = structlog.get_logger(__name__)
router = APIRouter()


# ── Schemas ────────────────────────────────────────────────────────────────────

class AggregationPeriod(str, Enum):
    HOUR  = "hour"
    DAY   = "day"
    WEEK  = "week"
    MONTH = "month"


class TrendPoint(BaseModel):
    timestamp: str
    value:     float


class VitalTrend(BaseModel):
    vital_type:     str
    unit:           str
    current_value:  float
    previous_value: float
    change_pct:     float
    direction:      str
    average:        float
    min_value:      float
    max_value:      float
    data_points:    List[TrendPoint]
    normal_min:     Optional[float] = None
    normal_max:     Optional[float] = None


class HealthScore(BaseModel):
    overall:     int
    heart:       int
    metabolic:   int
    activity:    int
    sleep:       int
    nutrition:   int
    computed_at: datetime
    insights:    List[str]


class HealthAlert(BaseModel):
    id:           UUID
    vital_type:   str
    severity:     str
    message:      str
    value:        float
    threshold:    float
    triggered_at: datetime
    acknowledged: bool = False


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get(
    "/trends/{vital_type}",
    response_model=VitalTrend,
    summary="Get trend data for a specific vital type",
)
async def get_vital_trend(
    vital_type: str,
    user_id:    CurrentUser,
    db:         DbSession,
    start_date: Optional[datetime] = Query(None),
    end_date:   Optional[datetime] = Query(None),
    period:     AggregationPeriod  = Query(AggregationPeriod.DAY),
) -> Any:
    svc = VitalService(db)
    return await svc.get_trend(
        user_id=user_id,
        vital_type=vital_type,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/health-score",
    response_model=HealthScore,
    summary="Get the user's composite health score",
)
async def get_health_score(
    user_id: CurrentUser,
    db:      DbSession,
) -> Any:
    svc = AnalyticsService(db)
    return await svc.get_health_score(user_id=user_id)


@router.get(
    "/alerts",
    response_model=List[HealthAlert],
    summary="Get active health alerts",
)
async def get_alerts(
    user_id:      CurrentUser,
    db:           DbSession,
    acknowledged: bool = Query(False),
) -> Any:
    svc = AnalyticsService(db)
    return await svc.get_alerts(user_id=user_id, acknowledged=acknowledged)


@router.patch(
    "/alerts/{alert_id}/acknowledge",
    summary="Acknowledge a health alert",
)
async def acknowledge_alert(
    alert_id: UUID,
    user_id:  CurrentUser,
) -> dict:
    # Alerts are generated on-the-fly from vitals — no persistence needed yet.
    # TODO: persist alert acknowledgements in a dedicated table.
    return {"acknowledged": True, "alert_id": str(alert_id)}


@router.get(
    "/report",
    summary="Generate a full insight report for a date range",
)
async def get_insight_report(
    user_id:    CurrentUser,
    db:         DbSession,
    start_date: Optional[datetime] = Query(None),
    end_date:   Optional[datetime] = Query(None),
) -> Any:
    svc = AnalyticsService(db)
    return await svc.get_report(
        user_id=user_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get(
    "/correlations",
    summary="Get correlations between vital metrics",
)
async def get_correlations(
    user_id:  CurrentUser,
    db:       DbSession,
    metric_a: str = Query(..., description="First vital type"),
    metric_b: str = Query(..., description="Second vital type"),
    days:     int = Query(30, ge=7, le=365),
) -> dict:
    # TODO: implement Pearson correlation via numpy / pandas
    return {
        "metric_a":                 metric_a,
        "metric_b":                 metric_b,
        "correlation_coefficient":  0.0,
        "sample_size":              0,
        "insight":                  "Correlation analysis coming soon.",
    }
