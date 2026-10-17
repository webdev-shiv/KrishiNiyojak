"""Pydantic schemas for Machine and Operator Availability slots."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

# ==============================================================================
# Machine Availability Schemas
# ==============================================================================


class MachineAvailabilityCreate(BaseModel):
    """Schema for setting a machine availability slot."""

    machine_id: int = Field(..., description="ID of the machine")
    slot_date: date = Field(..., description="Calendar date for availability slot")
    slot_type: str = Field(
        "FULL_DAY", description="Slot type: FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON"
    )
    status: str = Field(
        "FREE", description="Status: FREE, HELD, BOOKED, BLOCKED_MAINTENANCE"
    )
    note: str | None = Field(None, max_length=255, description="Operational notes")


class MachineAvailabilityUpdate(BaseModel):
    """Schema for updating machine availability status or notes."""

    status: str | None = Field(
        None, description="Status: FREE, HELD, BOOKED, BLOCKED_MAINTENANCE"
    )
    note: str | None = Field(None, max_length=255)


class MachineAvailabilityResponse(BaseModel):
    """Schema for returning machine availability details."""

    id: int
    machine_id: int
    slot_date: date
    slot_type: str
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MachineAvailabilityPaginatedResponse(BaseModel):
    """Paginated list of machine availability slots."""

    items: list[MachineAvailabilityResponse]
    total: int
    skip: int
    limit: int


# ==============================================================================
# Operator Availability Schemas
# ==============================================================================


class OperatorAvailabilityCreate(BaseModel):
    """Schema for setting an operator availability slot."""

    operator_id: int = Field(..., description="ID of the operator")
    slot_date: date = Field(..., description="Calendar date for availability slot")
    slot_type: str = Field(
        "FULL_DAY", description="Slot type: FULL_DAY, HALF_DAY_MORNING, HALF_DAY_AFTERNOON"
    )
    status: str = Field("AVAILABLE", description="Status: AVAILABLE, ASSIGNED, ON_LEAVE")
    note: str | None = Field(None, max_length=255, description="Duty or shift notes")


class OperatorAvailabilityUpdate(BaseModel):
    """Schema for updating operator availability status or notes."""

    status: str | None = Field(None, description="Status: AVAILABLE, ASSIGNED, ON_LEAVE")
    note: str | None = Field(None, max_length=255)


class OperatorAvailabilityResponse(BaseModel):
    """Schema for returning operator availability details."""

    id: int
    operator_id: int
    slot_date: date
    slot_type: str
    status: str
    note: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OperatorAvailabilityPaginatedResponse(BaseModel):
    """Paginated list of operator availability slots."""

    items: list[OperatorAvailabilityResponse]
    total: int
    skip: int
    limit: int
