"""Custom Hiring Centre (CHC) domain models: chcs and chc_memberships."""

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.booking import Booking, ServiceRequest
    from app.models.identity import User
    from app.models.resource import Attachment, Machine, Operator
    from app.models.supporting import AuditLog


class CHC(Base):
    """Custom Hiring Centre (CHC) hub managing machinery fleet and local operations."""

    __tablename__ = "chcs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    operating_radius_km: Mapped[float] = mapped_column(Float, default=25.0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default="ACTIVE", nullable=False, index=True
    )  # ACTIVE, INACTIVE, SUSPENDED
    contact_phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
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
    memberships: Mapped[list["CHCMembership"]] = relationship(
        "CHCMembership", back_populates="chc", cascade="all, delete-orphan"
    )
    machines: Mapped[list["Machine"]] = relationship("Machine", back_populates="chc")
    operators: Mapped[list["Operator"]] = relationship("Operator", back_populates="chc")
    attachments: Mapped[list["Attachment"]] = relationship("Attachment", back_populates="chc")
    service_requests: Mapped[list["ServiceRequest"]] = relationship(
        "ServiceRequest", back_populates="chc"
    )
    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="chc")
    audit_logs: Mapped[list["AuditLog"]] = relationship("AuditLog", back_populates="chc")


class CHCMembership(Base):
    """CHC staff/operator membership assignment linking users to specific CHCs."""

    __tablename__ = "chc_memberships"
    __table_args__ = (UniqueConstraint("chc_id", "user_id", name="uq_chc_memberships_chc_user"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    chc_id: Mapped[int] = mapped_column(
        ForeignKey("chcs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # MANAGER, OPERATOR, TECHNICIAN
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
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
    chc: Mapped["CHC"] = relationship("CHC", back_populates="memberships")
    user: Mapped["User"] = relationship("User", back_populates="chc_memberships")
