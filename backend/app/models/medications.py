from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, Date, DateTime, Enum, ForeignKey,
    Numeric, SmallInteger, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Medication(Base):
    __tablename__ = "medications"
    __table_args__ = {"schema": "public"}

    id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Drug identity
    name:          Mapped[str]       = mapped_column(Text, nullable=False)
    generic_name:  Mapped[str | None] = mapped_column(Text)
    ndc_code:      Mapped[str | None] = mapped_column(String(20))
    rxnorm_code:   Mapped[str | None] = mapped_column(String(20))

    # Dosage
    dose_amount: Mapped[Decimal]   = mapped_column(Numeric(10, 3), nullable=False)
    dose_unit:   Mapped[str]       = mapped_column(String(30), nullable=False)
    frequency: Mapped[str] = mapped_column(
        Enum(
            "once_daily", "twice_daily", "three_times_daily", "four_times_daily",
            "every_other_day", "weekly", "as_needed", "custom",
            name="medication_frequency",
            schema="public",
            create_type=False,
        ),
        nullable=False,
        server_default="once_daily",
    )
    frequency_custom: Mapped[str | None] = mapped_column(Text)
    route:            Mapped[str | None] = mapped_column(String(30), server_default="oral")

    # Prescriber
    prescribed_by:     Mapped[str | None] = mapped_column(String(120))
    prescription_date: Mapped[date | None] = mapped_column(Date)
    pharmacy_name:     Mapped[str | None] = mapped_column(String(120))
    rx_number:         Mapped[str | None] = mapped_column(String(60))

    # Validity window
    started_on: Mapped[date | None] = mapped_column(Date)
    ended_on:   Mapped[date | None] = mapped_column(Date)
    is_active:  Mapped[bool]        = mapped_column(Boolean, nullable=False, server_default="true")

    # Refill tracking
    refills_remaining: Mapped[int | None]  = mapped_column(SmallInteger)
    next_refill_date:  Mapped[date | None] = mapped_column(Date)

    # Appearance
    color:   Mapped[str | None] = mapped_column(String(60))
    shape:   Mapped[str | None] = mapped_column(String(60))
    imprint: Mapped[str | None] = mapped_column(String(60))

    # Notes
    instructions:       Mapped[str | None] = mapped_column(Text)
    side_effects_noted: Mapped[str | None] = mapped_column(Text)

    # Soft delete / audit
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user:            Mapped["UserProfile"]             = relationship(back_populates="medications", lazy="noload")
    adherence_logs:  Mapped[list["MedicationAdherenceLog"]] = relationship(back_populates="medication", lazy="noload")
    schedules:       Mapped[list["MedicationSchedule"]]     = relationship(back_populates="medication", lazy="noload")


class MedicationSchedule(Base):
    __tablename__ = "medication_schedules"
    __table_args__ = {"schema": "public"}

    id:            Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.medications.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False
    )

    scheduled_time:   Mapped[str]      = mapped_column(String(8), nullable=False)  # TIME stored as HH:MM:SS
    days_of_week:     Mapped[int | None] = mapped_column(SmallInteger)
    is_active:        Mapped[bool]     = mapped_column(Boolean, nullable=False, server_default="true")
    reminder_minutes: Mapped[int | None] = mapped_column(SmallInteger)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    medication: Mapped["Medication"] = relationship(back_populates="schedules", lazy="noload")


class MedicationAdherenceLog(Base):
    __tablename__ = "medication_adherence_logs"
    __table_args__ = {"schema": "public"}

    id:            Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    medication_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.medications.id", ondelete="CASCADE"), nullable=False
    )
    schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.medication_schedules.id", ondelete="SET NULL")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("public.user_profiles.id", ondelete="CASCADE"), nullable=False
    )

    scheduled_at: Mapped[datetime]       = mapped_column(DateTime(timezone=True), nullable=False)
    recorded_at:  Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        Enum(
            "taken", "missed", "skipped", "late",
            name="adherence_status",
            schema="public",
            create_type=False,
        ),
        nullable=False,
        server_default="taken",
    )
    actual_dose: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    notes:       Mapped[str | None]     = mapped_column(Text)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    medication: Mapped["Medication"] = relationship(back_populates="adherence_logs", lazy="noload")
