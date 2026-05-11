from __future__ import annotations

"""
VitalService — translates between the API's (vital_type, value, secondary_value) model
and the DB's wide-column vitals table.

DB schema (migration 002):
  heart_rate                SMALLINT
  blood_pressure_systolic   SMALLINT
  blood_pressure_diastolic  SMALLINT
  spo2                      NUMERIC(5,2)
  glucose                   NUMERIC(6,2)   (blood_glucose in API)
  weight_kg                 NUMERIC(6,2)   (weight in API)
  respiratory_rate          SMALLINT
  temperature_celsius       NUMERIC(4,1)   (body_temperature in API)
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Optional

import structlog
from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vitals import Vital

logger = structlog.get_logger(__name__)

# ── Column mapping ─────────────────────────────────────────────────────────────
# Maps API vital_type → (primary_column_name, secondary_column_name | None, unit)
VITAL_COLUMN_MAP: dict[str, tuple[str, str | None, str]] = {
    "heart_rate":       ("heart_rate",              None,                       "bpm"),
    "blood_pressure":   ("blood_pressure_systolic",  "blood_pressure_diastolic", "mmHg"),
    "blood_glucose":    ("glucose",                  None,                       "mg/dL"),
    "blood_oxygen":     ("spo2",                     None,                       "%"),
    "body_temperature": ("temperature_celsius",      None,                       "°C"),
    "weight":           ("weight_kg",                None,                       "kg"),
    "respiratory_rate": ("respiratory_rate",         None,                       "br/min"),
}

# Physiological normal ranges for alert generation
NORMAL_RANGES: dict[str, tuple[float, float]] = {
    "heart_rate":       (60,   100),
    "blood_pressure":   (90,   130),   # systolic
    "blood_glucose":    (70,   140),
    "blood_oxygen":     (95,   100),
    "body_temperature": (36.1, 37.5),
    "weight":           (0,    9999),  # no universal normal; alert suppressed
    "respiratory_rate": (12,   20),
}


def _vital_to_dict(vital: Vital, vital_type: str) -> dict[str, Any]:
    """Convert a Vital ORM row to the VitalResponse schema dict."""
    col, sec_col, unit = VITAL_COLUMN_MAP[vital_type]
    primary = getattr(vital, col)
    secondary = getattr(vital, sec_col) if sec_col else None

    return {
        "id":              vital.id,
        "vital_type":      vital_type,
        "value":           primary,
        "unit":            unit,
        "recorded_at":     vital.measured_at,
        "secondary_value": secondary,
        "notes":           vital.notes,
        "device_source":   vital.device_identifier,
        "created_at":      vital.created_at,
    }


def _which_vital_types(vital: Vital) -> list[str]:
    """Return all vital_type keys that have a non-null value in this row."""
    types = []
    for vt, (col, sec_col, _) in VITAL_COLUMN_MAP.items():
        if getattr(vital, col) is not None:
            types.append(vt)
    return types


# ── Service class ──────────────────────────────────────────────────────────────

class VitalService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Create ─────────────────────────────────────────────────────────────────
    async def create(
        self,
        *,
        user_id:         uuid.UUID,
        vital_type:      str,
        value:           Decimal,
        secondary_value: Decimal | None,
        recorded_at:     datetime,
        notes:           str | None,
        device_source:   str | None,
    ) -> dict[str, Any]:
        if vital_type not in VITAL_COLUMN_MAP:
            raise HTTPException(status_code=422, detail=f"Unknown vital_type: {vital_type}")

        col, sec_col, _ = VITAL_COLUMN_MAP[vital_type]

        kwargs: dict[str, Any] = {
            "user_id":           user_id,
            "measured_at":       recorded_at,
            "source":            "manual",
            "device_identifier": device_source,
            "notes":             notes,
            col:                 value,
        }
        if sec_col and secondary_value is not None:
            kwargs[sec_col] = secondary_value

        vital = Vital(**kwargs)
        self.db.add(vital)
        await self.db.flush()   # get the generated id before commit

        logger.info("vital.created", user_id=str(user_id), vital_type=vital_type, id=str(vital.id))
        return _vital_to_dict(vital, vital_type)

    # ── List (paginated + filtered) ────────────────────────────────────────────
    async def list(
        self,
        *,
        user_id:    uuid.UUID,
        vital_type: str | None = None,
        start_date: datetime | None = None,
        end_date:   datetime | None = None,
        page:       int = 1,
        page_size:  int = 20,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(Vital)
            .where(
                Vital.user_id == user_id,
                Vital.deleted_at.is_(None),
            )
            .order_by(Vital.measured_at.desc())
        )

        if vital_type and vital_type in VITAL_COLUMN_MAP:
            col = VITAL_COLUMN_MAP[vital_type][0]
            stmt = stmt.where(getattr(Vital, col).isnot(None))

        if start_date:
            stmt = stmt.where(Vital.measured_at >= start_date)
        if end_date:
            stmt = stmt.where(Vital.measured_at <= end_date)

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)

        rows = (await self.db.execute(stmt)).scalars().all()

        result: list[dict] = []
        for row in rows:
            # If vital_type filter was applied, only return that type
            if vital_type:
                result.append(_vital_to_dict(row, vital_type))
            else:
                # Return one dict per non-null vital in the row
                for vt in _which_vital_types(row):
                    result.append(_vital_to_dict(row, vt))

        return result

    # ── Latest per type ────────────────────────────────────────────────────────
    async def get_latest(self, *, user_id: uuid.UUID) -> dict[str, Any]:
        """
        For each vital_type, return the most recent reading.
        Uses a subquery per type to keep things simple.
        """
        readings: dict[str, Any] = {}

        for vt, (col, sec_col, _) in VITAL_COLUMN_MAP.items():
            col_attr = getattr(Vital, col)
            stmt = (
                select(Vital)
                .where(
                    Vital.user_id == user_id,
                    Vital.deleted_at.is_(None),
                    col_attr.isnot(None),
                )
                .order_by(Vital.measured_at.desc())
                .limit(1)
            )
            row = (await self.db.execute(stmt)).scalar_one_or_none()
            if row:
                readings[vt] = _vital_to_dict(row, vt)

        return {"readings": readings, "as_of": datetime.utcnow()}

    # ── Single by ID ───────────────────────────────────────────────────────────
    async def get_by_id(
        self, *, vital_id: uuid.UUID, user_id: uuid.UUID
    ) -> dict[str, Any]:
        stmt = select(Vital).where(
            Vital.id == vital_id,
            Vital.user_id == user_id,
            Vital.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Vital not found")

        # Return the first non-null vital type in the row
        types = _which_vital_types(row)
        if not types:
            raise HTTPException(status_code=404, detail="Vital not found")
        return _vital_to_dict(row, types[0])

    # ── Soft delete ────────────────────────────────────────────────────────────
    async def delete(self, *, vital_id: uuid.UUID, user_id: uuid.UUID) -> None:
        stmt = select(Vital).where(
            Vital.id == vital_id,
            Vital.user_id == user_id,
            Vital.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Vital not found")

        row.deleted_at = datetime.utcnow()
        logger.info("vital.deleted", user_id=str(user_id), id=str(vital_id))

    # ── Trend data (for analytics) ─────────────────────────────────────────────
    async def get_trend(
        self,
        *,
        user_id:    uuid.UUID,
        vital_type: str,
        start_date: datetime | None = None,
        end_date:   datetime | None = None,
    ) -> dict[str, Any]:
        if vital_type not in VITAL_COLUMN_MAP:
            raise HTTPException(status_code=422, detail=f"Unknown vital_type: {vital_type}")

        col, _, unit = VITAL_COLUMN_MAP[vital_type]
        col_attr = getattr(Vital, col)

        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Aggregate stats in one query
        stats_stmt = select(
            func.avg(col_attr).label("avg"),
            func.min(col_attr).label("min"),
            func.max(col_attr).label("max"),
            func.count(col_attr).label("count"),
        ).where(
            Vital.user_id == user_id,
            Vital.deleted_at.is_(None),
            col_attr.isnot(None),
            Vital.measured_at >= start_date,
            Vital.measured_at <= end_date,
        )
        stats = (await self.db.execute(stats_stmt)).one()

        # Data points for the chart
        points_stmt = (
            select(Vital.measured_at, col_attr)
            .where(
                Vital.user_id == user_id,
                Vital.deleted_at.is_(None),
                col_attr.isnot(None),
                Vital.measured_at >= start_date,
                Vital.measured_at <= end_date,
            )
            .order_by(Vital.measured_at.asc())
        )
        points = (await self.db.execute(points_stmt)).all()

        # Period-over-period change
        half = (end_date - start_date) / 2
        mid  = start_date + half
        prev_stmt = select(func.avg(col_attr)).where(
            Vital.user_id == user_id,
            Vital.deleted_at.is_(None),
            col_attr.isnot(None),
            Vital.measured_at >= start_date,
            Vital.measured_at < mid,
        )
        curr_stmt = select(func.avg(col_attr)).where(
            Vital.user_id == user_id,
            Vital.deleted_at.is_(None),
            col_attr.isnot(None),
            Vital.measured_at >= mid,
            Vital.measured_at <= end_date,
        )
        prev_avg = (await self.db.execute(prev_stmt)).scalar()
        curr_avg = (await self.db.execute(curr_stmt)).scalar()

        change_pct = 0.0
        direction  = "stable"
        if prev_avg and curr_avg and prev_avg != 0:
            change_pct = float(((curr_avg - prev_avg) / prev_avg) * 100)
            direction  = "up" if change_pct > 0.5 else "down" if change_pct < -0.5 else "stable"

        normal = NORMAL_RANGES.get(vital_type, (None, None))

        return {
            "vital_type":      vital_type,
            "unit":            unit,
            "current_value":   float(curr_avg or 0),
            "previous_value":  float(prev_avg or 0),
            "change_pct":      round(change_pct, 2),
            "direction":       direction,
            "average":         float(stats.avg or 0),
            "min_value":       float(stats.min or 0),
            "max_value":       float(stats.max or 0),
            "data_points": [
                {"timestamp": r[0].isoformat(), "value": float(r[1])}
                for r in points
            ],
            "normal_min": normal[0],
            "normal_max": normal[1],
        }
