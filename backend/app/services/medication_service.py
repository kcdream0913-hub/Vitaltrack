from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

import structlog
from fastapi import HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.medications import Medication, MedicationAdherenceLog

logger = structlog.get_logger(__name__)


class MedicationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── helpers ────────────────────────────────────────────────────────────────
    def _to_dict(self, med: Medication) -> dict[str, Any]:
        return {
            "id":               med.id,
            "name":             med.name,
            "dosage":           f"{med.dose_amount} {med.dose_unit}",
            "frequency":        med.frequency,
            "prescribed_by":    med.prescribed_by,
            "start_date":       med.started_on.isoformat() if med.started_on else None,
            "end_date":         med.ended_on.isoformat() if med.ended_on else None,
            "notes":            med.instructions,
            "reminder_enabled": True,
            "is_active":        med.is_active,
            "created_at":       med.created_at,
        }

    def _adherence_to_dict(self, log: MedicationAdherenceLog) -> dict[str, Any]:
        return {
            "id":            log.id,
            "medication_id": log.medication_id,
            "scheduled_at":  log.scheduled_at,
            "taken_at":      log.recorded_at,
            "was_taken":     log.status in ("taken", "late"),
            "notes":         log.notes,
            "created_at":    log.created_at,
        }

    # ── Create ─────────────────────────────────────────────────────────────────
    async def create(
        self,
        *,
        user_id:          uuid.UUID,
        name:             str,
        dose_amount:      Decimal,
        dose_unit:        str,
        frequency:        str,
        prescribed_by:    str | None = None,
        start_date:       datetime | None = None,
        end_date:         datetime | None = None,
        notes:            str | None = None,
        reminder_enabled: bool = True,
    ) -> dict[str, Any]:
        med = Medication(
            user_id=user_id,
            name=name,
            dose_amount=dose_amount,
            dose_unit=dose_unit,
            frequency=frequency,
            prescribed_by=prescribed_by,
            started_on=start_date.date() if start_date else None,
            ended_on=end_date.date() if end_date else None,
            instructions=notes,
            is_active=True,
        )
        self.db.add(med)
        await self.db.flush()
        logger.info("medication.created", user_id=str(user_id), name=name, id=str(med.id))
        return self._to_dict(med)

    # ── List ──────────────────────────────────────────────────────────────────
    async def list(
        self,
        *,
        user_id:   uuid.UUID,
        is_active: bool | None = None,
        page:      int = 1,
        page_size: int = 20,
    ) -> list[dict[str, Any]]:
        stmt = (
            select(Medication)
            .where(
                Medication.user_id == user_id,
                Medication.deleted_at.is_(None),
            )
            .order_by(Medication.name.asc())
        )
        if is_active is not None:
            stmt = stmt.where(Medication.is_active == is_active)

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [self._to_dict(r) for r in rows]

    # ── Get by id ─────────────────────────────────────────────────────────────
    async def get_by_id(self, *, medication_id: uuid.UUID, user_id: uuid.UUID) -> dict[str, Any]:
        stmt = select(Medication).where(
            Medication.id == medication_id,
            Medication.user_id == user_id,
            Medication.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Medication not found")
        return self._to_dict(row)

    # ── Update ────────────────────────────────────────────────────────────────
    async def update(
        self,
        *,
        medication_id: uuid.UUID,
        user_id:       uuid.UUID,
        **kwargs: Any,
    ) -> dict[str, Any]:
        stmt = select(Medication).where(
            Medication.id == medication_id,
            Medication.user_id == user_id,
            Medication.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Medication not found")

        for key, val in kwargs.items():
            if hasattr(row, key) and val is not None:
                setattr(row, key, val)

        await self.db.flush()
        return self._to_dict(row)

    # ── Soft delete ───────────────────────────────────────────────────────────
    async def delete(self, *, medication_id: uuid.UUID, user_id: uuid.UUID) -> None:
        stmt = select(Medication).where(
            Medication.id == medication_id,
            Medication.user_id == user_id,
            Medication.deleted_at.is_(None),
        )
        row = (await self.db.execute(stmt)).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Medication not found")
        row.deleted_at = datetime.utcnow()
        logger.info("medication.deleted", user_id=str(user_id), id=str(medication_id))

    # ── Log adherence ─────────────────────────────────────────────────────────
    async def log_adherence(
        self,
        *,
        medication_id: uuid.UUID,
        user_id:       uuid.UUID,
        scheduled_at:  datetime,
        taken_at:      datetime | None,
        was_taken:     bool,
        notes:         str | None = None,
    ) -> dict[str, Any]:
        # Verify medication belongs to user
        await self.get_by_id(medication_id=medication_id, user_id=user_id)

        status = "taken" if was_taken else "missed"
        if was_taken and taken_at and taken_at > scheduled_at + timedelta(minutes=30):
            status = "late"

        log = MedicationAdherenceLog(
            medication_id=medication_id,
            user_id=user_id,
            scheduled_at=scheduled_at,
            recorded_at=taken_at,
            status=status,
            notes=notes,
        )
        self.db.add(log)
        await self.db.flush()
        logger.info("adherence.logged", medication_id=str(medication_id), status=status)
        return self._adherence_to_dict(log)

    # ── Adherence history ─────────────────────────────────────────────────────
    async def get_adherence_history(
        self,
        *,
        medication_id: uuid.UUID,
        user_id:       uuid.UUID,
        start_date:    datetime | None = None,
        end_date:      datetime | None = None,
        page:          int = 1,
        page_size:     int = 30,
    ) -> list[dict[str, Any]]:
        # Verify ownership
        await self.get_by_id(medication_id=medication_id, user_id=user_id)

        stmt = (
            select(MedicationAdherenceLog)
            .where(
                MedicationAdherenceLog.medication_id == medication_id,
                MedicationAdherenceLog.user_id == user_id,
            )
            .order_by(MedicationAdherenceLog.scheduled_at.desc())
        )
        if start_date:
            stmt = stmt.where(MedicationAdherenceLog.scheduled_at >= start_date)
        if end_date:
            stmt = stmt.where(MedicationAdherenceLog.scheduled_at <= end_date)

        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = (await self.db.execute(stmt)).scalars().all()
        return [self._adherence_to_dict(r) for r in rows]

    # ── Adherence summary (30-day rate per medication) ────────────────────────
    async def get_adherence_summary(
        self,
        *,
        user_id: uuid.UUID,
        days:    int = 30,
    ) -> list[dict[str, Any]]:
        since = datetime.utcnow() - timedelta(days=days)

        meds = await self.list(user_id=user_id, is_active=True, page_size=100)
        result = []

        for med_dict in meds:
            med_id = med_dict["id"]

            total_stmt = select(func.count()).where(
                MedicationAdherenceLog.medication_id == med_id,
                MedicationAdherenceLog.user_id == user_id,
                MedicationAdherenceLog.scheduled_at >= since,
            )
            taken_stmt = select(func.count()).where(
                MedicationAdherenceLog.medication_id == med_id,
                MedicationAdherenceLog.user_id == user_id,
                MedicationAdherenceLog.scheduled_at >= since,
                MedicationAdherenceLog.status.in_(["taken", "late"]),
            )
            last_stmt = (
                select(MedicationAdherenceLog.recorded_at)
                .where(
                    MedicationAdherenceLog.medication_id == med_id,
                    MedicationAdherenceLog.user_id == user_id,
                    MedicationAdherenceLog.status.in_(["taken", "late"]),
                )
                .order_by(MedicationAdherenceLog.recorded_at.desc())
                .limit(1)
            )

            total = (await self.db.execute(total_stmt)).scalar() or 0
            taken = (await self.db.execute(taken_stmt)).scalar() or 0
            last  = (await self.db.execute(last_stmt)).scalar_one_or_none()

            rate = round(taken / total * 100, 1) if total > 0 else 0.0

            result.append({
                "medication_id":   med_id,
                "medication_name": med_dict["name"],
                "total_doses":     total,
                "taken_doses":     taken,
                "adherence_rate":  rate,
                "streak_days":     0,        # TODO: compute streak
                "last_taken":      last,
            })

        return result
