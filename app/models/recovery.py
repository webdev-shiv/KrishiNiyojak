"""Recovery domain models: breakdowns, recovery plans, and priorities."""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.identity import User
    from app.models.resource import Machine, Operator


class MachineBreakdown(Base):
    """In-field machinery failure incident report."""

    __tablename__ = "machine_breakdowns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    booking_id: Mapped[int | None] = mapped_column(
        ForeignKey("bookings.id", ondelete="SET NULL"), nullable=True, index=True
    )
    reported_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    reported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    failure_type: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # ENGINE, HYDRAULIC, IMPLEMENT, ELECTRICAL, PUNCTURE, TRANSMISSION
    severity: Mapped[str] = mapped_column(
        String(30), default="MEDIUM", nullable=False, index=True
    )  # LOW, MEDIUM, CRITICAL
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    field_latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    field_longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="REPORTED", nullable=False, index=True
    )  # REPORTED, IN_REVIEW, RECOVERING, RESOLVED
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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
    machine: Mapped["Machine"] = relationship("Machine", back_populates="breakdowns")
    booking: Mapped["Booking | None"] = relationship("Booking", back_populates="breakdowns")
    reported_by: Mapped["User"] = relationship("User")
    recovery_plans: Mapped[list["RecoveryPlan"]] = relationship(
        "RecoveryPlan", back_populates="breakdown", cascade="all, delete-orphan"
    )


class RecoveryPlan(Base):
    """Candidate or approved action plan to recover from an operational breakdown."""

    __tablename__ = "recovery_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    breakdown_id: Mapped[int] = mapped_column(
        ForeignKey("machine_breakdowns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    strategy: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # REPLACE_MACHINE, TIME_SHIFT, SUBCONTRACT, CANCEL
    status: Mapped[str] = mapped_column(
        String(30), default="PROPOSED", nullable=False, index=True
    )  # PROPOSED, ACCEPTED, REJECTED, EXECUTED
    estimated_delay_hours: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    estimated_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    created_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    approved_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
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
    breakdown: Mapped["MachineBreakdown"] = relationship(
        "MachineBreakdown", back_populates="recovery_plans"
    )
    created_by: Mapped["User"] = relationship("User", foreign_keys=[created_by_id])
    approved_by: Mapped["User | None"] = relationship("User", foreign_keys=[approved_by_id])
    items: Mapped[list["RecoveryPlanItem"]] = relationship(
        "RecoveryPlanItem", back_populates="recovery_plan", cascade="all, delete-orphan"
    )


class RecoveryPlanItem(Base):
    """Specific operational re-dispatch or reassignment action within a recovery plan."""

    __tablename__ = "recovery_plan_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    recovery_plan_id: Mapped[int] = mapped_column(
        ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False, index=True
    )
    affected_booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    replacement_machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True
    )
    replacement_operator_id: Mapped[int | None] = mapped_column(
        ForeignKey("operators.id", ondelete="SET NULL"), nullable=True
    )
    action_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # REASSIGN_MACHINE, RESCHEDULE_SLOT, SUBCONTRACT_JOB, CANCEL_JOB
    new_scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
    )  # PENDING, DISPATCHED, COMPLETED, FAILED
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
    recovery_plan: Mapped["RecoveryPlan"] = relationship("RecoveryPlan", back_populates="items")
    affected_booking: Mapped["Booking"] = relationship("Booking", back_populates="recovery_items")
    replacement_machine: Mapped["Machine | None"] = relationship(
        "Machine", back_populates="recovery_items"
    )
    replacement_operator: Mapped["Operator | None"] = relationship(
        "Operator", back_populates="recovery_items"
    )


class BookingPriority(Base):
    """Agronomic and operational scheduling priority score for a booking."""

    __tablename__ = "booking_priority"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    priority_score: Mapped[int] = mapped_column(Integer, default=50, nullable=False)  # 1 to 100
    agronomic_urgency: Mapped[str] = mapped_column(
        String(30), default="MEDIUM", nullable=False
    )  # LOW, MEDIUM, HIGH, CRITICAL
    weather_risk_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
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
    booking: Mapped["Booking"] = relationship("Booking", back_populates="priority")
