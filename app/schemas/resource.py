"""Pydantic schemas for machinery, operator, and attachment resource management."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

# ==============================================================================
# Machine Schemas
# ==============================================================================


class MachineCreate(BaseModel):
    """Schema for registering a new agricultural machine."""

    chc_id: int = Field(..., description="ID of the managing CHC hub")
    owner_id: int | None = Field(None, description="Optional ResourceOwner ID")
    registration_number: str = Field(
        ..., min_length=2, max_length=100, description="Unique registration plate / serial"
    )
    make: str = Field(..., min_length=1, max_length=100, description="Manufacturer / brand")
    model: str = Field(..., min_length=1, max_length=100, description="Model designation")
    category: str = Field(
        ..., description="Category: TRACTOR, HARVESTER, SPRAYER, BALER, TRANSPLANTER"
    )
    horsepower: float = Field(..., gt=0.0, description="Rated horsepower (HP)")
    hourly_rate: Decimal = Field(
        Decimal("0.00"), ge=Decimal("0.00"), description="Rental/service rate per hour"
    )
    status: str = Field(
        "AVAILABLE", description="Status: AVAILABLE, DEPLOYED, MAINTENANCE, BROKEN_DOWN, RETIRED"
    )
    current_lat: float | None = Field(None, ge=-90.0, le=90.0)
    current_lng: float | None = Field(None, ge=-180.0, le=180.0)


class MachineUpdate(BaseModel):
    """Schema for updating machine properties."""

    owner_id: int | None = None
    make: str | None = Field(None, min_length=1, max_length=100)
    model: str | None = Field(None, min_length=1, max_length=100)
    category: str | None = None
    horsepower: float | None = Field(None, gt=0.0)
    hourly_rate: Decimal | None = Field(None, ge=Decimal("0.00"))
    status: str | None = None
    current_lat: float | None = Field(None, ge=-90.0, le=90.0)
    current_lng: float | None = Field(None, ge=-180.0, le=180.0)


class MachineResponse(BaseModel):
    """Schema for returning machine details."""

    id: int
    chc_id: int
    owner_id: int | None
    registration_number: str
    make: str
    model: str
    category: str
    horsepower: float
    status: str
    current_lat: float | None
    current_lng: float | None
    hourly_rate: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MachinePaginatedResponse(BaseModel):
    """Paginated list of machines."""

    items: list[MachineResponse]
    total: int
    skip: int
    limit: int


# ==============================================================================
# Operator Schemas
# ==============================================================================


class OperatorCreate(BaseModel):
    """Schema for registering a CHC certified operator."""

    user_id: int = Field(..., description="User ID corresponding to this operator")
    chc_id: int = Field(..., description="ID of the employing/affiliating CHC hub")
    license_number: str = Field(
        ..., min_length=2, max_length=100, description="Commercial / driving license number"
    )
    experience_years: int = Field(0, ge=0, description="Years of professional driving experience")
    hourly_rate: Decimal = Field(
        Decimal("0.00"), ge=Decimal("0.00"), description="Operator wage rate per hour"
    )
    status: str = Field("AVAILABLE", description="Status: AVAILABLE, ON_DUTY, LEAVE, INACTIVE")


class OperatorUpdate(BaseModel):
    """Schema for updating operator details."""

    license_number: str | None = Field(None, min_length=2, max_length=100)
    experience_years: int | None = Field(None, ge=0)
    hourly_rate: Decimal | None = Field(None, ge=Decimal("0.00"))
    status: str | None = None


class OperatorResponse(BaseModel):
    """Schema for returning operator details."""

    id: int
    user_id: int
    chc_id: int
    license_number: str
    experience_years: int
    status: str
    hourly_rate: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperatorPaginatedResponse(BaseModel):
    """Paginated list of operators."""

    items: list[OperatorResponse]
    total: int
    skip: int
    limit: int


# ==============================================================================
# Attachment Schemas
# ==============================================================================


class AttachmentCreate(BaseModel):
    """Schema for registering a farm implement or attachment."""

    chc_id: int = Field(..., description="ID of the managing CHC hub")
    owner_id: int | None = Field(None, description="Optional ResourceOwner ID")
    name: str = Field(..., min_length=2, max_length=255, description="Common name of implement")
    code: str = Field(..., min_length=2, max_length=100, description="Unique implement code")
    category: str = Field(
        ..., description="Category: PLOW, ROTAVATOR, SEEDER, HARVESTER_HEADER, SPRAY_BOOM"
    )
    required_hp_min: float = Field(0.0, ge=0.0, description="Minimum tractor HP required to pull")
    hourly_rate: Decimal = Field(
        Decimal("0.00"), ge=Decimal("0.00"), description="Rental rate per hour"
    )
    status: str = Field("AVAILABLE", description="AVAILABLE, DEPLOYED, MAINTENANCE, DAMAGED")


class AttachmentUpdate(BaseModel):
    """Schema for updating an attachment."""

    name: str | None = Field(None, min_length=2, max_length=255)
    category: str | None = None
    required_hp_min: float | None = Field(None, ge=0.0)
    hourly_rate: Decimal | None = Field(None, ge=Decimal("0.00"))
    status: str | None = None


class AttachmentResponse(BaseModel):
    """Schema for returning attachment details."""

    id: int
    chc_id: int
    owner_id: int | None
    name: str
    code: str
    category: str
    required_hp_min: float
    status: str
    hourly_rate: Decimal
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AttachmentPaginatedResponse(BaseModel):
    """Paginated list of attachments."""

    items: list[AttachmentResponse]
    total: int
    skip: int
    limit: int
