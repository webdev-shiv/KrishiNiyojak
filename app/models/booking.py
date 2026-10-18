"""Booking domain models: service_requests, bookings, booking_attachments."""

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import Date, DateTime, Float, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.chc import CHC
    from app.models.identity import User
    from app.models.recovery import BookingPriority, MachineBreakdown, RecoveryPlanItem
    from app.models.resource import Attachment, Machine, Operator


class ServiceRequest(Base):
    """Farmer demand intake specifying field location, operation type, acreage, and window."""

    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    farmer_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    field_latitude: Mapped[float] = mapped_column(Float, nullable=False)
    field_longitude: Mapped[float] = mapped_column(Float, nullable=False)
    acreage: Mapped[float] = mapped_column(Float, nullable=False)
    operation_type: Mapped[str] = mapped_column(
        String(50), nullable=False
    )  # PLOWING, SOWING, HARVESTING, SPRAYING
    crop_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    requested_start_date: Mapped[date] = mapped_column(Date, nullable=False)
    requested_end_date: Mapped[date] = mapped_column(Date, nullable=False)
    estimated_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(30), default="SUBMITTED", nullable=False, index=True
    )  # DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED
    selected_machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    selected_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    selected_slot: Mapped[str | None] = mapped_column(String(30), nullable=True)
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
    chc: Mapped["CHC"] = relationship("CHC", back_populates="service_requests")
    farmer: Mapped["User"] = relationship("User", back_populates="service_requests")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="service_request")
    selected_machine: Mapped["Machine | None"] = relationship("Machine", foreign_keys=[selected_machine_id])


class Booking(Base):
    """Operational booking agreement binding a service request to a machine-day assignment."""

    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    service_request_id: Mapped[int] = mapped_column(
        ForeignKey("service_requests.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    operator_id: Mapped[int | None] = mapped_column(
        ForeignKey("operators.id", ondelete="SET NULL"), nullable=True, index=True
    )
    booking_code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    scheduled_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    scheduled_slot: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON
    status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False, index=True
    )  # PENDING, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, DISRUPTED
    total_cost: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    payment_status: Mapped[str] = mapped_column(
        String(30), default="PENDING", nullable=False
    )  # PENDING, PAID, SUBSIDIZED, REFUNDED
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
    service_request: Mapped["ServiceRequest"] = relationship(
        "ServiceRequest", back_populates="bookings"
    )
    chc: Mapped["CHC"] = relationship("CHC", back_populates="bookings")
    machine: Mapped["Machine | None"] = relationship("Machine", back_populates="bookings")
    operator: Mapped["Operator | None"] = relationship("Operator", back_populates="bookings")
    booking_attachments: Mapped[list["BookingAttachment"]] = relationship(
        "BookingAttachment", back_populates="booking", cascade="all, delete-orphan"
    )
    breakdowns: Mapped[list["MachineBreakdown"]] = relationship(
        "MachineBreakdown", back_populates="booking"
    )
    recovery_items: Mapped[list["RecoveryPlanItem"]] = relationship(
        "RecoveryPlanItem", back_populates="affected_booking"
    )
    priority: Mapped["BookingPriority | None"] = relationship(
        "BookingPriority", back_populates="booking", uselist=False, cascade="all, delete-orphan"
    )


class BookingAttachment(Base):
    """Association table linking bookings to attached implement attachments."""

    __tablename__ = "booking_attachments"
    __table_args__ = (
        UniqueConstraint(
            "booking_id", "attachment_id", name="uq_booking_attachments_booking_attachment"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    attachment_id: Mapped[int] = mapped_column(
        ForeignKey("attachments.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking", back_populates="booking_attachments")
    attachment: Mapped["Attachment"] = relationship(
        "Attachment", back_populates="booking_attachments"
    )
