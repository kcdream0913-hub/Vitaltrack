"""
Clinical domain models ported from MediKeep.
Adapted to use UUID PKs + user_id (Supabase auth) instead of
MediKeep's integer PKs + patient_id.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


# ── Condition ─────────────────────────────────────────────────────────────────

class Condition(Base):
    """Medical condition / diagnosis. Sourced from MediKeep."""
    __tablename__ = "conditions"
    __table_args__ = (
        Index("idx_conditions_user_id", "user_id"),
        Index("idx_conditions_user_status", "user_id", "status"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    condition_name: Mapped[str | None] = mapped_column(String(200))
    diagnosis: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    onset_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)

    # active | inactive | resolved | chronic | recurrence | relapse
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="active")
    # mild | moderate | severe | critical
    severity: Mapped[str | None] = mapped_column(String(30))

    # Medical codes
    icd10_code: Mapped[str | None] = mapped_column(String(20))
    snomed_code: Mapped[str | None] = mapped_column(String(30))
    code_description: Mapped[str | None] = mapped_column(String(500))

    # Free-form tags
    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    prescribed_by: Mapped[str | None] = mapped_column(String(120))  # practitioner name

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Allergy ───────────────────────────────────────────────────────────────────

class Allergy(Base):
    """Patient allergy with reaction details and severity. Sourced from MediKeep."""
    __tablename__ = "allergies"
    __table_args__ = (
        Index("idx_allergies_user_id", "user_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    allergen: Mapped[str] = mapped_column(String(200), nullable=False)
    reaction: Mapped[str] = mapped_column(String(500), nullable=False)
    # mild | moderate | severe | critical
    severity: Mapped[str | None] = mapped_column(String(30))
    onset_date: Mapped[date | None] = mapped_column(Date)
    # active | inactive | resolved
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text)

    # Link to a medication if drug allergy
    medication_name: Mapped[str | None] = mapped_column(String(200))

    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Encounter ─────────────────────────────────────────────────────────────────

class Encounter(Base):
    """Doctor visit / medical encounter. Sourced from MediKeep."""
    __tablename__ = "encounters"
    __table_args__ = (
        Index("idx_encounters_user_id", "user_id"),
        Index("idx_encounters_user_date", "user_id", "encounter_date"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    encounter_date: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    # annual_checkup | follow_up | consultation | emergency | telehealth | specialist
    visit_type: Mapped[str | None] = mapped_column(String(60))
    chief_complaint: Mapped[str | None] = mapped_column(String(500))
    diagnosis: Mapped[str | None] = mapped_column(String(500))
    treatment_plan: Mapped[str | None] = mapped_column(Text)
    follow_up_instructions: Mapped[str | None] = mapped_column(Text)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    # office | hospital | telehealth | urgent_care | er
    location: Mapped[str | None] = mapped_column(String(100))
    # routine | urgent | emergency
    priority: Mapped[str | None] = mapped_column(String(30))

    practitioner_name: Mapped[str | None] = mapped_column(String(120))
    facility_name: Mapped[str | None] = mapped_column(String(200))

    # Link to a condition record if applicable
    condition_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("public.conditions.id", ondelete="SET NULL"))

    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


# ── Immunization ──────────────────────────────────────────────────────────────

class Immunization(Base):
    """Vaccine / immunization record. Sourced from MediKeep."""
    __tablename__ = "immunizations"
    __table_args__ = (
        Index("idx_immunizations_user_id", "user_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    vaccine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vaccine_trade_name: Mapped[str | None] = mapped_column(String(200))
    date_administered: Mapped[date] = mapped_column(Date, nullable=False)
    dose_number: Mapped[int | None] = mapped_column(Integer)
    ndc_number: Mapped[str | None] = mapped_column(String(50))
    lot_number: Mapped[str | None] = mapped_column(String(50))
    manufacturer: Mapped[str | None] = mapped_column(String(200))
    site: Mapped[str | None] = mapped_column(String(100))   # injection site
    route: Mapped[str | None] = mapped_column(String(50))
    expiration_date: Mapped[date | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(200))
    notes: Mapped[str | None] = mapped_column(Text)

    practitioner_name: Mapped[str | None] = mapped_column(String(120))

    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


# ── Lab Results ───────────────────────────────────────────────────────────────

class LabResult(Base):
    """Lab test order and aggregate result. Sourced from MediKeep."""
    __tablename__ = "lab_results"
    __table_args__ = (
        Index("idx_lab_results_user_id", "user_id"),
        Index("idx_lab_results_user_date", "user_id", "completed_date"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    test_name: Mapped[str] = mapped_column(String(300), nullable=False)
    test_code: Mapped[str | None] = mapped_column(String(50))    # LOINC / CPT
    # blood_work | imaging | pathology | microbiology | urine | other
    test_category: Mapped[str | None] = mapped_column(String(60))
    test_type: Mapped[str | None] = mapped_column(String(60))    # routine | emergency
    facility: Mapped[str | None] = mapped_column(String(200))
    # ordered | in_progress | completed | cancelled
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="ordered")
    # normal | abnormal | critical | inconclusive
    labs_result: Mapped[str | None] = mapped_column(String(50))
    ordered_date: Mapped[date | None] = mapped_column(Date)
    completed_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)

    practitioner_name: Mapped[str | None] = mapped_column(String(120))

    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # One-to-many: individual test components
    components: Mapped[list["LabTestComponent"]] = relationship(
        "LabTestComponent", back_populates="lab_result", cascade="all, delete-orphan"
    )


class LabTestComponent(Base):
    """Individual test value within a LabResult (e.g., WBC, RBC, Glucose). Sourced from MediKeep."""
    __tablename__ = "lab_test_components"
    __table_args__ = (
        Index("idx_lab_test_components_lab_result_id", "lab_result_id"),
        Index("idx_lab_test_components_status", "status"),
        Index("idx_lab_test_components_category", "category"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lab_result_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.lab_results.id", ondelete="CASCADE"), nullable=False)

    test_name: Mapped[str] = mapped_column(String(200), nullable=False)
    abbreviation: Mapped[str | None] = mapped_column(String(30))
    test_code: Mapped[str | None] = mapped_column(String(30))     # LOINC
    canonical_test_name: Mapped[str | None] = mapped_column(String(200))

    # quantitative | qualitative
    result_type: Mapped[str] = mapped_column(String(20), default="quantitative")

    value: Mapped[float | None] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(30))
    qualitative_value: Mapped[str | None] = mapped_column(String(50))  # positive|negative|detected

    ref_range_min: Mapped[float | None] = mapped_column(Float)
    ref_range_max: Mapped[float | None] = mapped_column(Float)
    ref_range_text: Mapped[str | None] = mapped_column(String(100))

    # normal | high | low | critical
    status: Mapped[str | None] = mapped_column(String(20))
    # hematology | chemistry | immunology | etc.
    category: Mapped[str | None] = mapped_column(String(60))
    display_order: Mapped[int | None] = mapped_column(Integer)

    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    lab_result: Mapped["LabResult"] = relationship("LabResult", back_populates="components")


# ── Symptom ───────────────────────────────────────────────────────────────────

class Symptom(Base):
    """Parent symptom definition (e.g., 'Migraine'). Individual episodes in SymptomOccurrence. Sourced from MediKeep."""
    __tablename__ = "symptoms"
    __table_args__ = (
        Index("idx_symptoms_user_id", "user_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False)

    symptom_name: Mapped[str] = mapped_column(String(200), nullable=False)
    # Neurological | Gastrointestinal | Musculoskeletal | Respiratory | etc.
    category: Mapped[str | None] = mapped_column(String(100))

    # active | resolved | chronic
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")
    is_chronic: Mapped[bool] = mapped_column(Boolean, default=False)

    first_occurrence_date: Mapped[date] = mapped_column(Date, nullable=False)
    last_occurrence_date: Mapped[date | None] = mapped_column(Date)
    resolved_date: Mapped[date | None] = mapped_column(Date)

    typical_triggers: Mapped[list | None] = mapped_column(JSON, default=list)
    general_notes: Mapped[str | None] = mapped_column(Text)
    tags: Mapped[list | None] = mapped_column(JSON, default=list)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    occurrences: Mapped[list["SymptomOccurrence"]] = relationship(
        "SymptomOccurrence", back_populates="symptom", cascade="all, delete-orphan"
    )


class SymptomOccurrence(Base):
    """A single episode of a symptom. Sourced from MediKeep."""
    __tablename__ = "symptom_occurrences"
    __table_args__ = (
        Index("idx_symptom_occurrences_symptom_id", "symptom_id"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symptom_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("public.symptoms.id", ondelete="CASCADE"), nullable=False)

    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # 1–10
    severity_scale: Mapped[int | None] = mapped_column(Integer)
    duration_minutes: Mapped[int | None] = mapped_column(Integer)
    triggers: Mapped[list | None] = mapped_column(JSON, default=list)
    relieving_factors: Mapped[list | None] = mapped_column(JSON, default=list)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    symptom: Mapped["Symptom"] = relationship("Symptom", back_populates="occurrences")
