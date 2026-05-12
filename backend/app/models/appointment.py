from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, DateTime, Enum, ForeignKey,
    SmallInteger, Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Appointment(Base):
    __tablename__ = "appointments_v2"
    __table_args__ = {"schema": "public"}

    id:      Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.user_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Appointment details [PHI]
    title:         Mapped[str]           = mapped_column(Text, nullable=False)
    provider_name: Mapped[str | None]    = mapped_column(Text)
    specialty:     Mapped[str | None]    = mapped_column(Text)
    location:      Mapped[str | None]    = mapped_column(Text)

    # Scheduling [PHI]
    appointment_date: Mapped[datetime]  = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(SmallInteger, server_default="30")

    # Status
    status: Mapped[str] = mapped_column(
        Enum(
            "scheduled", "completed", "cancelled", "no_show",
            name="appointment_status",
            schema="public",
            create_type=False,
        ),
        nullable=False,
        server_default="scheduled",
    )

    # Notes [PHI]
    notes: Mapped[str | None] = mapped_column(Text)

    # Reminder tracking
    reminder_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")

    # Soft delete / audit
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user: Mapped["UserProfile"] = relationship(back_populates="appointments", lazy="noload")
