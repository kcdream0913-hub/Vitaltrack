from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.db.base import Base


class UserProfile(Base):
    """
    Mirror of public.user_profiles — linked 1:1 with auth.users.
    We only store the id + a few display fields here; everything else
    lives in health_profiles.
    """
    __tablename__ = "user_profiles"
    __table_args__ = {"schema": "public"}

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    display_name: Mapped[str | None] = mapped_column(String(120))
    avatar_url:   Mapped[str | None] = mapped_column(Text)
    timezone:     Mapped[str]        = mapped_column(String(60), default="UTC")
    is_active:    Mapped[bool]       = mapped_column(Boolean, default=True)
    created_at:   Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at:   Mapped[datetime]   = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    vitals:      Mapped[list["Vital"]]      = relationship(back_populates="user", lazy="noload")
    medications: Mapped[list["Medication"]] = relationship(back_populates="user", lazy="noload")
