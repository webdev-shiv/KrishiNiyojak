"""Pydantic schemas for Booking lifecycle management."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class BookingCreate(BaseModel):
    """Schema for creating a booking from an approved service request."""

    service_request_id: int = Field(..., description="ID of the approved service request")
    machine_id: int | None = Field(None, description="Assigned machine asset ID")
    operator_id: int | None = Field(None, description="Assigned certified operator ID")
    scheduled_date: date = Field(..., description="Operational machine-day date")
    scheduled_slot: str = Field(
        "FULL_DAY", description="Slot: FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON"
    )
    attachment_ids: list[int] = Field(
        default_factory=list, description="List of required implement attachment IDs"
    )
    total_cost: Decimal | None = Field(
        None, ge=Decimal("0.00"), description="Total agreed rental/service cost"
    )
    booking_code: str | None = Field(
        None, max_length=50, description="Optional custom unique booking identifier"
    )


class BookingUpdate(BaseModel):
    """Schema for updating booking details and status."""

    machine_id: int | None = None
    operator_id: int | None = None
    scheduled_date: date | None = None
    scheduled_slot: str | None = None
    status: str | None = Field(
        None,
        description="PENDING, SCHEDULED, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED, DISRUPTED",
    )
    payment_status: str | None = Field(
        None, description="Payment status: PENDING, PAID, SUBSIDIZED, REFUNDED"
    )
    total_cost: Decimal | None = Field(None, ge=Decimal("0.00"))


class BookingCancelRequest(BaseModel):
    """Schema for cancelling an existing booking."""

    reason: str | None = Field(None, max_length=255, description="Reason for cancellation")


class BookingResponse(BaseModel):
    """Schema for returning detailed booking representation."""

    id: int
    service_request_id: int
    chc_id: int
    machine_id: int | None
    operator_id: int | None
    booking_code: str
    scheduled_date: date
    scheduled_slot: str
    status: str
    total_cost: Decimal
    payment_status: str
    attachment_ids: list[int] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BookingPaginatedResponse(BaseModel):
    """Paginated list of bookings."""

    items: list[BookingResponse]
    total: int
    skip: int
    limit: int
