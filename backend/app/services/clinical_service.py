"""
Clinical domain service: conditions, allergies, encounters,
immunizations, lab results, symptoms.
Ported from MediKeep, adapted for VitalTrack's UUID + user_id pattern.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

import structlog
from fastapi import HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.clinical import (
    Allergy,
    Condition,
    Encounter,
    Immunization,
    LabResult,
    LabTestComponent,
    Symptom,
    SymptomOccurrence,
)
from app.core.audit import audit_log

logger = structlog.get_logger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_dict(obj: Any, exclude: set[str] | None = None) -> dict:
    """Shallow dict from an ORM instance, excluding SQLAlchemy internals."""
    exclude = exclude or set()
    return {
        k: v for k, v in obj.__dict__.items()
        if not k.startswith("_") and k not in exclude
    }


async def _get_or_404(db: AsyncSession, model, resource_id: uuid.UUID, user_id: uuid.UUID):
    row = await db.get(model, resource_id)
    if not row or getattr(row, "user_id", None) != user_id or getattr(row, "deleted_at", None) is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{model.__name__} not found")
    return row


# ══════════════════════════════════════════════════════════════════════════════
# CONDITIONS
# ══════════════════════════════════════════════════════════════════════════════

class ConditionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, **kwargs) -> Condition:
        obj = Condition(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="condition.create",
                        resource_id=str(obj.id), table_name="conditions")
        return obj

    async def list(self, *, user_id: uuid.UUID, status: str | None = None,
                   page: int = 1, page_size: int = 20) -> list[Condition]:
        q = select(Condition).where(
            and_(Condition.user_id == user_id, Condition.deleted_at.is_(None))
        )
        if status:
            q = q.where(Condition.status == status)
        q = q.order_by(Condition.onset_date.desc().nullslast(), Condition.created_at.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, condition_id: uuid.UUID, user_id: uuid.UUID) -> Condition:
        return await _get_or_404(self.db, Condition, condition_id, user_id)

    async def update(self, *, condition_id: uuid.UUID, user_id: uuid.UUID, **kwargs) -> Condition:
        obj = await _get_or_404(self.db, Condition, condition_id, user_id)
        for k, v in kwargs.items():
            if v is not None:
                setattr(obj, k, v)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="condition.update",
                        resource_id=str(condition_id), table_name="conditions")
        return obj

    async def delete(self, *, condition_id: uuid.UUID, user_id: uuid.UUID) -> None:
        obj = await _get_or_404(self.db, Condition, condition_id, user_id)
        obj.deleted_at = datetime.utcnow()
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="condition.delete",
                        resource_id=str(condition_id), table_name="conditions")


# ══════════════════════════════════════════════════════════════════════════════
# ALLERGIES
# ══════════════════════════════════════════════════════════════════════════════

class AllergyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, **kwargs) -> Allergy:
        obj = Allergy(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="allergy.create",
                        resource_id=str(obj.id), table_name="allergies")
        return obj

    async def list(self, *, user_id: uuid.UUID, status: str | None = None,
                   page: int = 1, page_size: int = 50) -> list[Allergy]:
        q = select(Allergy).where(
            and_(Allergy.user_id == user_id, Allergy.deleted_at.is_(None))
        )
        if status:
            q = q.where(Allergy.status == status)
        q = q.order_by(Allergy.severity.asc().nullslast(), Allergy.allergen.asc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, allergy_id: uuid.UUID, user_id: uuid.UUID) -> Allergy:
        return await _get_or_404(self.db, Allergy, allergy_id, user_id)

    async def update(self, *, allergy_id: uuid.UUID, user_id: uuid.UUID, **kwargs) -> Allergy:
        obj = await _get_or_404(self.db, Allergy, allergy_id, user_id)
        for k, v in kwargs.items():
            if v is not None:
                setattr(obj, k, v)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="allergy.update",
                        resource_id=str(allergy_id), table_name="allergies")
        return obj

    async def delete(self, *, allergy_id: uuid.UUID, user_id: uuid.UUID) -> None:
        obj = await _get_or_404(self.db, Allergy, allergy_id, user_id)
        obj.deleted_at = datetime.utcnow()
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="allergy.delete",
                        resource_id=str(allergy_id), table_name="allergies")


# ══════════════════════════════════════════════════════════════════════════════
# ENCOUNTERS
# ══════════════════════════════════════════════════════════════════════════════

class EncounterService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, **kwargs) -> Encounter:
        obj = Encounter(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="encounter.create",
                        resource_id=str(obj.id), table_name="encounters")
        return obj

    async def list(self, *, user_id: uuid.UUID, visit_type: str | None = None,
                   start_date: date | None = None, end_date: date | None = None,
                   page: int = 1, page_size: int = 20) -> list[Encounter]:
        q = select(Encounter).where(
            and_(Encounter.user_id == user_id, Encounter.deleted_at.is_(None))
        )
        if visit_type:
            q = q.where(Encounter.visit_type == visit_type)
        if start_date:
            q = q.where(Encounter.encounter_date >= start_date)
        if end_date:
            q = q.where(Encounter.encounter_date <= end_date)
        q = q.order_by(Encounter.encounter_date.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, encounter_id: uuid.UUID, user_id: uuid.UUID) -> Encounter:
        return await _get_or_404(self.db, Encounter, encounter_id, user_id)

    async def update(self, *, encounter_id: uuid.UUID, user_id: uuid.UUID, **kwargs) -> Encounter:
        obj = await _get_or_404(self.db, Encounter, encounter_id, user_id)
        for k, v in kwargs.items():
            if v is not None:
                setattr(obj, k, v)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="encounter.update",
                        resource_id=str(encounter_id), table_name="encounters")
        return obj

    async def delete(self, *, encounter_id: uuid.UUID, user_id: uuid.UUID) -> None:
        obj = await _get_or_404(self.db, Encounter, encounter_id, user_id)
        obj.deleted_at = datetime.utcnow()
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="encounter.delete",
                        resource_id=str(encounter_id), table_name="encounters")


# ══════════════════════════════════════════════════════════════════════════════
# IMMUNIZATIONS
# ══════════════════════════════════════════════════════════════════════════════

class ImmunizationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, **kwargs) -> Immunization:
        obj = Immunization(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="immunization.create",
                        resource_id=str(obj.id), table_name="immunizations")
        return obj

    async def list(self, *, user_id: uuid.UUID, page: int = 1, page_size: int = 50) -> list[Immunization]:
        q = (select(Immunization)
             .where(Immunization.user_id == user_id)
             .order_by(Immunization.date_administered.desc())
             .offset((page - 1) * page_size).limit(page_size))
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, immunization_id: uuid.UUID, user_id: uuid.UUID) -> Immunization:
        row = await self.db.get(Immunization, immunization_id)
        if not row or row.user_id != user_id:
            raise HTTPException(status_code=404, detail="Immunization not found")
        return row

    async def update(self, *, immunization_id: uuid.UUID, user_id: uuid.UUID, **kwargs) -> Immunization:
        obj = await self.get_by_id(immunization_id=immunization_id, user_id=user_id)
        for k, v in kwargs.items():
            if v is not None:
                setattr(obj, k, v)
        await self.db.flush()
        return obj

    async def delete(self, *, immunization_id: uuid.UUID, user_id: uuid.UUID) -> None:
        obj = await self.get_by_id(immunization_id=immunization_id, user_id=user_id)
        await self.db.delete(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="immunization.delete",
                        resource_id=str(immunization_id), table_name="immunizations")


# ══════════════════════════════════════════════════════════════════════════════
# LAB RESULTS
# ══════════════════════════════════════════════════════════════════════════════

class LabResultService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, components: list[dict] | None = None, **kwargs) -> LabResult:
        obj = LabResult(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()  # get obj.id
        if components:
            for comp in components:
                self.db.add(LabTestComponent(
                    id=uuid.uuid4(),
                    lab_result_id=obj.id,
                    **comp,
                ))
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="lab_result.create",
                        resource_id=str(obj.id), table_name="lab_results")
        return obj

    async def list(self, *, user_id: uuid.UUID, test_category: str | None = None,
                   status: str | None = None, page: int = 1, page_size: int = 20) -> list[LabResult]:
        q = (select(LabResult)
             .options(selectinload(LabResult.components))
             .where(and_(LabResult.user_id == user_id, LabResult.deleted_at.is_(None))))
        if test_category:
            q = q.where(LabResult.test_category == test_category)
        if status:
            q = q.where(LabResult.status == status)
        q = q.order_by(LabResult.completed_date.desc().nullslast(), LabResult.created_at.desc())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, lab_result_id: uuid.UUID, user_id: uuid.UUID) -> LabResult:
        q = (select(LabResult)
             .options(selectinload(LabResult.components))
             .where(and_(LabResult.id == lab_result_id, LabResult.user_id == user_id,
                         LabResult.deleted_at.is_(None))))
        result = await self.db.execute(q)
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Lab result not found")
        return row

    async def delete(self, *, lab_result_id: uuid.UUID, user_id: uuid.UUID) -> None:
        obj = await self.get_by_id(lab_result_id=lab_result_id, user_id=user_id)
        obj.deleted_at = datetime.utcnow()
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="lab_result.delete",
                        resource_id=str(lab_result_id), table_name="lab_results")


# ══════════════════════════════════════════════════════════════════════════════
# SYMPTOMS
# ══════════════════════════════════════════════════════════════════════════════

class SymptomService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, *, user_id: uuid.UUID, **kwargs) -> Symptom:
        obj = Symptom(id=uuid.uuid4(), user_id=user_id, **kwargs)
        self.db.add(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="symptom.create",
                        resource_id=str(obj.id), table_name="symptoms")
        return obj

    async def list(self, *, user_id: uuid.UUID, status: str | None = None,
                   page: int = 1, page_size: int = 30) -> list[Symptom]:
        q = (select(Symptom)
             .options(selectinload(Symptom.occurrences))
             .where(Symptom.user_id == user_id))
        if status:
            q = q.where(Symptom.status == status)
        q = q.order_by(Symptom.last_occurrence_date.desc().nullslast())
        q = q.offset((page - 1) * page_size).limit(page_size)
        result = await self.db.execute(q)
        return list(result.scalars())

    async def get_by_id(self, *, symptom_id: uuid.UUID, user_id: uuid.UUID) -> Symptom:
        q = (select(Symptom)
             .options(selectinload(Symptom.occurrences))
             .where(and_(Symptom.id == symptom_id, Symptom.user_id == user_id)))
        result = await self.db.execute(q)
        row = result.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Symptom not found")
        return row

    async def log_occurrence(self, *, symptom_id: uuid.UUID, user_id: uuid.UUID,
                              occurred_at: datetime, severity_scale: int | None = None,
                              duration_minutes: int | None = None, triggers: list | None = None,
                              relieving_factors: list | None = None,
                              resolved: bool = False, notes: str | None = None) -> SymptomOccurrence:
        # Verify ownership
        symptom = await self.get_by_id(symptom_id=symptom_id, user_id=user_id)
        occ = SymptomOccurrence(
            id=uuid.uuid4(),
            symptom_id=symptom_id,
            occurred_at=occurred_at,
            severity_scale=severity_scale,
            duration_minutes=duration_minutes,
            triggers=triggers or [],
            relieving_factors=relieving_factors or [],
            resolved=resolved,
            notes=notes,
        )
        self.db.add(occ)
        # Update parent last_occurrence_date
        if not symptom.last_occurrence_date or occurred_at.date() > symptom.last_occurrence_date:
            symptom.last_occurrence_date = occurred_at.date()
        await self.db.flush()
        return occ

    async def delete(self, *, symptom_id: uuid.UUID, user_id: uuid.UUID) -> None:
        q = select(Symptom).where(and_(Symptom.id == symptom_id, Symptom.user_id == user_id))
        result = await self.db.execute(q)
        obj = result.scalar_one_or_none()
        if not obj:
            raise HTTPException(status_code=404, detail="Symptom not found")
        await self.db.delete(obj)
        await self.db.flush()
        await audit_log(self.db, user_id=user_id, action="symptom.delete",
                        resource_id=str(symptom_id), table_name="symptoms")
