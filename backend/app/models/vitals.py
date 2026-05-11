from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey,
    Numeric, SmallInteger, String, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Vital(Base):
    """
    public.vitals — wide table: one row = one measurement event.

    Not every column will be populated per row — a user can log just
    their heart rate (leaving BP, glucose, weight, etc. NULL), or log
    a full set from a device export.
    """
    __tablename__ = "vitals"
    __table_args__ = {"schema": "public"}

    id:      Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    measured_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(
        Enum(
            "manual", "device", "import", "provider",
            name="measurement_source",
            schema="public",
            create_type=False,   # enum already exists in DB
        ),
        server_default="manual",
        nullable=False,
    )
    device_identifier: Mapped[str | None] = mapped_column(String(200))

    # ── Cardiovascular ────────────────────────────────────────────────
    heart_rate:                Mapped[int | None]     = mapped_column(SmallInteger)
    blood_pressure_systolic:   Mapped[int | None]     = mapped_column(SmallInteger)
    blood_pressure_diastolic:  Mapped[int | None]     = mapped_column(SmallInteger)

    # ── Blood oxygen ──────────────────────────────────────────────────
    spo2: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))

    # ── Metabolic ────────────────────────────────────────────────────
    glucose:         Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    glucose_fasting: Mapped[bool | None]    = mapped_column(Boolean)

    # ── Anthropometric ───────────────────────────────────────────────
    weight_kg:  Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    height_cm:  Mapped[Decimal | None] = mapped_column(Numeric(5, 1))
    # bmi is GENERATED ALWAYS AS — read-only, not mapped for writes

    # ── Respiratory / temperature ─────────────────────────────────────
    respiratory_rate:    Mapped[int | None]     = mapped_column(SmallInteger)
    temperature_celsius: Mapped[Decimal | None] = mapped_column(Numeric(4, 1))

    notes:      Mapped[str | None] = mapped_column(Text)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    user: Mapped["UserProfile"] = relationship(back_populates="vitals", lazy="noload")
