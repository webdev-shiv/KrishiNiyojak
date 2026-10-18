"""NITI Domain Models: Farmer Profiles, Operator Profiles, Status Events, Reviews, and OTPs."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking
    from app.models.chc import CHC
    from app.models.identity import User
    from app.models.resource import Machine


class FarmerProfile(Base):
    """Profile details and farm metadata for registered agricultural producers."""

    __tablename__ = "farmer_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    preferred_language: Mapped[str] = mapped_column(String(10), default="hi", nullable=False)
    village: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    district: Mapped[str] = mapped_column(String(150), default="", nullable=False)
    state: Mapped[str] = mapped_column(String(150), default="Punjab", nullable=False)
    latitude: Mapped[float] = mapped_column(Float, default=30.9010, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, default=75.8573, nullable=False)
    farm_size: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    farm_size_unit: Mapped[str] = mapped_column(String(20), default="acres", nullable=False)
    primary_crops: Mapped[str] = mapped_column(
        String(255), default="Wheat, Paddy", nullable=False
    )
    seasonal_crops: Mapped[str | None] = mapped_column(String(255), nullable=True)
    onboarding_completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    voice_speed: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    auto_speak: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User")


class OperatorProfile(Base):
    """Detailed profile, qualifications, and operational preferences for machinery operators."""

    __tablename__ = "operator_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False
    )
    skills: Mapped[str] = mapped_column(
        String(255), default="Ploughing, Sowing, Harvesting", nullable=False
    )
    experience_years: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    supported_machinery: Mapped[str] = mapped_column(
        String(255), default="TRACTOR, HARVESTER, ROTAVATOR", nullable=False
    )
    license_number: Mapped[str] = mapped_column(String(50), default="PB-DL-2024-0091", nullable=False)
    daily_working_hours: Mapped[float] = mapped_column(Float, default=8.0, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=4.8, nullable=False)
    total_jobs_completed: Mapped[int] = mapped_column(Integer, default=18, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped["User"] = relationship("User")


class BookingStatusEvent(Base):
    """Real-time chronological events tracking lifecycle progression of a booking."""

    __tablename__ = "booking_status_events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    status: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    actor_role: Mapped[str] = mapped_column(String(50), default="SYSTEM", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking")


class RatingReview(Base):
    """Farmer ratings and reviews for completed machine operations."""

    __tablename__ = "rating_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    booking_id: Mapped[int] = mapped_column(
        ForeignKey("bookings.id", ondelete="CASCADE"), index=True, nullable=False
    )
    farmer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chc_id: Mapped[int] = mapped_column(ForeignKey("chcs.id", ondelete="CASCADE"), nullable=False)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), nullable=False
    )
    rating: Mapped[float] = mapped_column(Float, nullable=False)
    review_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    booking: Mapped["Booking"] = relationship("Booking")
    farmer: Mapped["User"] = relationship("User")
    chc: Mapped["CHC"] = relationship("CHC")
    machine: Mapped["Machine"] = relationship("Machine")


class OTPVerification(Base):
    """One-Time Password verification records for phone authentication."""

    __tablename__ = "otp_verifications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    phone_number: Mapped[str] = mapped_column(String(30), index=True, nullable=False)
    otp_code: Mapped[str] = mapped_column(String(10), nullable=False)
    role: Mapped[str] = mapped_column(String(50), default="FARMER", nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
