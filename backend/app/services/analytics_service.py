from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any

import structlog
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.vitals import Vital
from app.models.medications import MedicationAdherenceLog
from app.services.vital_service import VitalService, VITAL_COLUMN_MAP, NORMAL_RANGES

logger = structlog.get_logger(__name__)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self._vital_svc = VitalService(db)

    # ── Health score ──────────────────────────────────────────────────────────
    async def get_health_score(self, *, user_id: uuid.UUID) -> dict[str, Any]:
        """
        Compute a 0–100 composite score across 5 domains.
        Each domain score = 100 × (readings in normal range / total readings) in the last 7 days.
        """
        since = datetime.utcnow() - timedelta(days=7)

        async def _domain_score(vital_types: list[str]) -> int:
            total = 0
            normal = 0
            for vt in vital_types:
                if vt not in VITAL_COLUMN_MAP:
                    continue
                col_name, _, _ = VITAL_COLUMN_MAP[vt]
                col_attr = getattr(Vital, col_name)
                lo, hi = NORMAL_RANGES.get(vt, (None, None))

                count_stmt = select(func.count()).where(
                    Vital.user_id == user_id,
                    Vital.deleted_at.is_(None),
                    col_attr.isnot(None),
                    Vital.measured_at >= since,
                )
                total += (await self.db.execute(count_stmt)).scalar() or 0

                if lo is not None and hi is not None:
                    in_range_stmt = select(func.count()).where(
                        Vital.user_id == user_id,
                        Vital.deleted_at.is_(None),
                        col_attr.isnot(None),
                        col_attr >= lo,
                        col_attr <= hi,
                        Vital.measured_at >= since,
                    )
                    normal += (await self.db.execute(in_range_stmt)).scalar() or 0

            if total == 0:
                return 75  # default when insufficient data
            return min(100, int(normal / total * 100))

        heart      = await _domain_score(["heart_rate", "blood_pressure", "blood_oxygen"])
        metabolic  = await _domain_score(["blood_glucose"])
        activity   = 78   # TODO: pull from daily_activity table
        sleep_sc   = 69   # TODO: pull from sleep_sessions table
        nutrition  = 71   # TODO: pull from nutrition data
        overall    = int((heart * 0.25 + metabolic * 0.25 + activity * 0.20 + sleep_sc * 0.15 + nutrition * 0.15))

        insights = await self._generate_insights(user_id=user_id, since=since)

        return {
            "overall":     overall,
            "heart":       heart,
            "metabolic":   metabolic,
            "activity":    activity,
            "sleep":       sleep_sc,
            "nutrition":   nutrition,
            "computed_at": datetime.utcnow(),
            "insights":    insights,
        }

    async def _generate_insights(self, *, user_id: uuid.UUID, since: datetime) -> list[str]:
        insights: list[str] = []

        for vt, (col_name, _, unit) in VITAL_COLUMN_MAP.items():
            col_attr = getattr(Vital, col_name)
            lo, hi = NORMAL_RANGES.get(vt, (None, None))
            if lo is None:
                continue

            # Latest reading
            stmt = (
                select(col_attr)
                .where(
                    Vital.user_id == user_id,
                    Vital.deleted_at.is_(None),
                    col_attr.isnot(None),
                )
                .order_by(Vital.measured_at.desc())
                .limit(1)
            )
            latest = (await self.db.execute(stmt)).scalar_one_or_none()
            if latest is None:
                continue

            latest_f = float(latest)
            label = vt.replace("_", " ").title()

            if latest_f > hi:
                pct = round((latest_f - hi) / hi * 100, 1)
                insights.append(f"{label} is {pct}% above the normal range — latest reading: {latest_f} {unit}.")
            elif latest_f < lo:
                insights.append(f"{label} is below the normal range — latest reading: {latest_f} {unit}.")

        # Trend insight for heart rate
        hr_stmt = (
            select(func.avg(Vital.heart_rate))
            .where(
                Vital.user_id == user_id,
                Vital.deleted_at.is_(None),
                Vital.heart_rate.isnot(None),
                Vital.measured_at >= since,
            )
        )
        hr_avg = (await self.db.execute(hr_stmt)).scalar()
        if hr_avg:
            insights.append(f"Your average heart rate this week is {round(float(hr_avg), 1)} bpm.")

        return insights[:5]  # cap at 5 insights

    # ── Alerts ────────────────────────────────────────────────────────────────
    async def get_alerts(
        self,
        *,
        user_id:      uuid.UUID,
        acknowledged: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Generate alerts for readings that are outside normal ranges in the last 24h.
        """
        since = datetime.utcnow() - timedelta(hours=24)
        alerts: list[dict] = []

        for vt, (col_name, _, unit) in VITAL_COLUMN_MAP.items():
            col_attr = getattr(Vital, col_name)
            lo, hi = NORMAL_RANGES.get(vt, (None, None))
            if lo is None or vt == "weight":
                continue

            stmt = (
                select(Vital)
                .where(
                    Vital.user_id == user_id,
                    Vital.deleted_at.is_(None),
                    col_attr.isnot(None),
                    Vital.measured_at >= since,
                )
                .order_by(Vital.measured_at.desc())
                .limit(5)
            )
            rows = (await self.db.execute(stmt)).scalars().all()

            for row in rows:
                val = float(getattr(row, col_name))
                if val > hi:
                    severity = "critical" if val > hi * 1.2 else "warning"
                    alerts.append({
                        "id":           row.id,
                        "vital_type":   vt,
                        "severity":     severity,
                        "message":      f"{vt.replace('_',' ').title()} reading of {val} {unit} is above the normal maximum of {hi} {unit}.",
                        "value":        val,
                        "threshold":    hi,
                        "triggered_at": row.measured_at,
                        "acknowledged": False,
                    })
                elif val < lo:
                    alerts.append({
                        "id":           row.id,
                        "vital_type":   vt,
                        "severity":     "warning",
                        "message":      f"{vt.replace('_',' ').title()} reading of {val} {unit} is below the normal minimum of {lo} {unit}.",
                        "value":        val,
                        "threshold":    lo,
                        "triggered_at": row.measured_at,
                        "acknowledged": False,
                    })

        # Sort by severity (critical first), then by triggered_at
        alerts.sort(key=lambda a: (0 if a["severity"] == "critical" else 1, a["triggered_at"]), reverse=False)
        return alerts

    # ── Insight report ────────────────────────────────────────────────────────
    async def get_report(
        self,
        *,
        user_id:    uuid.UUID,
        start_date: datetime | None = None,
        end_date:   datetime | None = None,
    ) -> dict[str, Any]:
        now = datetime.utcnow()
        if not start_date:
            start_date = now - timedelta(days=30)
        if not end_date:
            end_date = now

        health_score = await self.get_health_score(user_id=user_id)
        alerts       = await self.get_alerts(user_id=user_id)

        # Trend data for key vitals
        trends = []
        for vt in ["heart_rate", "blood_pressure", "blood_glucose", "weight"]:
            try:
                t = await self._vital_svc.get_trend(
                    user_id=user_id, vital_type=vt,
                    start_date=start_date, end_date=end_date,
                )
                trends.append(t)
            except Exception:
                pass

        recommendations = [
            "Log readings consistently — aim for at least once daily for each tracked vital.",
            "Take medications at the same time each day to improve adherence rates.",
            "Schedule a follow-up if any reading has been outside the normal range for 3+ days.",
        ]

        return {
            "period_start":    start_date,
            "period_end":      end_date,
            "health_score":    health_score,
            "trends":          trends,
            "alerts":          alerts[:10],
            "recommendations": recommendations,
            "generated_at":    now,
        }
