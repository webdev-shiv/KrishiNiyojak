"""Availability domain models: machine_availability and operator_availability."""

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.resource import Machine, Operator


class MachineAvailability(Base):
    """Machine-day slot tracking machinery availability and calendar reservation state."""

    __tablename__ = "machine_availability"
    __table_args__ = (
        UniqueConstraint(
            "machine_id", "slot_date", "slot_type", name="uq_machine_avail_machine_date_slot"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    slot_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    status: Mapped[str] = mapped_column(
        String(30), default="FREE", nullable=False, index=True
    )  # FREE, HELD, BOOKED, BLOCKED_MAINTENANCE
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    machine: Mapped["Machine"] = relationship("Machine", back_populates="availability_slots")


class OperatorAvailability(Base):
    """Operator duty and calendar slot tracking availability, shifts, and leave."""

    __tablename__ = "operator_availability"
    __table_args__ = (
        UniqueConstraint(
            "operator_id",
            "slot_date",
            "slot_type",
            name="uq_operator_avail_operator_date_slot",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    operator_id: Mapped[int] = mapped_column(
        ForeignKey("operators.id", ondelete="CASCADE"), nullable=False, index=True
    )
    slot_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    slot_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    status: Mapped[str] = mapped_column(
        String(30), default="AVAILABLE", nullable=False, index=True
    )  # AVAILABLE, ASSIGNED, ON_LEAVE
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    operator: Mapped["Operator"] = relationship("Operator", back_populates="availability_slots")
