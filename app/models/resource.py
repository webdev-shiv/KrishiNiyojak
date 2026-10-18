"""Resource domain models: resource_owners, machines, operators, attachments."""

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Float, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.availability import MachineAvailability, OperatorAvailability
    from app.models.booking import Booking, BookingAttachment
    from app.models.chc import CHC
    from app.models.identity import User
    from app.models.recovery import MachineBreakdown, RecoveryPlanItem


class ResourceOwner(Base):
    """Entity or individual owning agricultural assets (CHC, third-party, coop)."""

    __tablename__ = "resource_owners"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    owner_type: Mapped[str] = mapped_column(
        String(50), default="CHC", nullable=False
    )  # CHC, THIRD_PARTY, COOPERATIVE
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    machines: Mapped[list["Machine"]] = relationship("Machine", back_populates="owner")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="owner")


class Machine(Base):
    """Agricultural machinery asset (tractors, harvesters, sprayers)."""

    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("resource_owners.id", ondelete="SET NULL"), nullable=True, index=True
    )
    registration_number: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    make: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # TRACTOR, HARVESTER, SPRAYER, BALER
    horsepower: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="AVAILABLE", nullable=False, index=True
    )  # AVAILABLE, DEPLOYED, MAINTENANCE, BROKEN_DOWN, RETIRED
    current_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    current_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
    )
    working_speed_kmh: Mapped[float] = mapped_column(Float, default=6.0, nullable=False)
    coverage_width_m: Mapped[float] = mapped_column(Float, default=2.0, nullable=False)
    field_efficiency_factor: Mapped[float] = mapped_column(Float, default=0.8, nullable=False)
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
    chc: Mapped["CHC"] = relationship("CHC", back_populates="machines")
    owner: Mapped["ResourceOwner | None"] = relationship("ResourceOwner", back_populates="machines")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="machine")
    availability_slots: Mapped[list["MachineAvailability"]] = relationship(
        "MachineAvailability", back_populates="machine", cascade="all, delete-orphan"
    )
    breakdowns: Mapped[list["MachineBreakdown"]] = relationship(
        "MachineBreakdown", back_populates="machine"
    )
    recovery_items: Mapped[list["RecoveryPlanItem"]] = relationship(
        "RecoveryPlanItem", back_populates="replacement_machine"
    )


class Operator(Base):
    """Certified operator or driver employed by or affiliated with a CHC."""

    __tablename__ = "operators"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True
    )
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    license_number: Mapped[str] = mapped_column(String(100), nullable=False)
    experience_years: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="AVAILABLE", nullable=False, index=True
    )  # AVAILABLE, ON_DUTY, LEAVE, INACTIVE
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
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
    user: Mapped["User"] = relationship("User")
    chc: Mapped["CHC"] = relationship("CHC", back_populates="operators")
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="operator")
    availability_slots: Mapped[list["OperatorAvailability"]] = relationship(
        "OperatorAvailability", back_populates="operator", cascade="all, delete-orphan"
    )
    recovery_items: Mapped[list["RecoveryPlanItem"]] = relationship(
        "RecoveryPlanItem", back_populates="replacement_operator"
    )


class Attachment(Base):
    """Implement or tool attachment (rotavator, plow, seeder, header)."""

    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    owner_id: Mapped[int | None] = mapped_column(
        ForeignKey("resource_owners.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(
        String(50), nullable=False, index=True
    )  # PLOW, ROTAVATOR, SEEDER, HARVESTER_HEADER, SPRAY_BOOM
    required_hp_min: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="AVAILABLE", nullable=False, index=True
    )  # AVAILABLE, DEPLOYED, MAINTENANCE, DAMAGED
    hourly_rate: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("0.00"), nullable=False
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
    chc: Mapped["CHC"] = relationship("CHC", back_populates="attachments")
    owner: Mapped["ResourceOwner | None"] = relationship(
        "ResourceOwner", back_populates="attachments"
    )
    booking_attachments: Mapped[list["BookingAttachment"]] = relationship(
        "BookingAttachment", back_populates="attachment"
    )
