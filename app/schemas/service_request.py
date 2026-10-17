"""Pydantic schemas for Farmer Service Requests."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ServiceRequestCreate(BaseModel):
    """Schema for a farmer creating a service request."""

    chc_id: int = Field(..., description="ID of the target CHC hub")
    field_latitude: float = Field(..., ge=-90.0, le=90.0, description="Field GPS latitude")
    field_longitude: float = Field(..., ge=-180.0, le=180.0, description="Field GPS longitude")
    acreage: float = Field(..., gt=0.0, le=10000.0, description="Land area in acres")
    operation_type: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="Operation: PLOWING, SOWING, HARVESTING, SPRAYING",
    )
    crop_type: str | None = Field(None, max_length=100, description="Crop: WHEAT, PADDY, COTTON")
    requested_start_date: date = Field(..., description="Desired operational start date")
    requested_end_date: date = Field(..., description="Desired operational end date")
    requested_attachment: str | None = Field(
        None, max_length=100, description="Optional preferred attachment"
    )
    estimated_cost: Decimal = Field(
        Decimal("0.00"), ge=Decimal("0.00"), description="Estimated service cost"
    )

    @model_validator(mode="after")
    def validate_dates(self) -> "ServiceRequestCreate":
        """Validate that the requested end date is not before the start date."""
        if self.requested_end_date < self.requested_start_date:
            raise ValueError("requested_end_date cannot be earlier than requested_start_date")
        return self


class ServiceRequestUpdate(BaseModel):
    """Schema for updating a service request."""

    field_latitude: float | None = Field(None, ge=-90.0, le=90.0)
    field_longitude: float | None = Field(None, ge=-180.0, le=180.0)
    acreage: float | None = Field(None, gt=0.0, le=10000.0)
    operation_type: str | None = Field(None, min_length=2, max_length=50)
    crop_type: str | None = Field(None, max_length=100)
    requested_start_date: date | None = None
    requested_end_date: date | None = None
    status: str | None = Field(
        None, description="Status: DRAFT, SUBMITTED, APPROVED, REJECTED, CANCELLED"
    )

    @model_validator(mode="after")
    def validate_dates(self) -> "ServiceRequestUpdate":
        """Validate date ordering when both dates are provided."""
        if (
            self.requested_start_date is not None
            and self.requested_end_date is not None
            and self.requested_end_date < self.requested_start_date
        ):
            raise ValueError("requested_end_date cannot be earlier than requested_start_date")
        return self


class ServiceRequestResponse(BaseModel):
    """Schema for returning service request details."""

    id: int
    chc_id: int
    farmer_id: int
    field_latitude: float
    field_longitude: float
    acreage: float
    operation_type: str
    crop_type: str | None
    requested_start_date: date
    requested_end_date: date
    estimated_cost: Decimal
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ServiceRequestPaginatedResponse(BaseModel):
    """Paginated list of service requests."""

    items: list[ServiceRequestResponse]
    total: int
    skip: int
    limit: int
