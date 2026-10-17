"""Pydantic schemas for Custom Hiring Centre (CHC) operations."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CHCCreate(BaseModel):
    """Schema for creating a new CHC hub."""

    name: str = Field(..., min_length=2, max_length=255, description="Full name of the CHC")
    code: str = Field(..., min_length=2, max_length=50, description="Unique CHC identifier")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="GPS latitude of the CHC centre")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="GPS longitude of CHC centre")
    operating_radius_km: float = Field(
        25.0, gt=0.0, le=500.0, description="Service coverage radius in km"
    )
    contact_phone: str | None = Field(None, max_length=30, description="Operational contact phone")


class CHCUpdate(BaseModel):
    """Schema for updating an existing CHC hub."""

    name: str | None = Field(None, min_length=2, max_length=255)
    latitude: float | None = Field(None, ge=-90.0, le=90.0)
    longitude: float | None = Field(None, ge=-180.0, le=180.0)
    operating_radius_km: float | None = Field(None, gt=0.0, le=500.0)
    status: str | None = Field(None, description="Status: ACTIVE, INACTIVE, SUSPENDED")
    contact_phone: str | None = Field(None, max_length=30)


class CHCResponse(BaseModel):
    """Schema for returning CHC details."""

    id: int
    name: str
    code: str
    latitude: float
    longitude: float
    operating_radius_km: float
    status: str
    contact_phone: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CHCPaginatedResponse(BaseModel):
    """Paginated list of CHCs."""

    items: list[CHCResponse]
    total: int
    skip: int
    limit: int


class CHCMembershipCreate(BaseModel):
    """Schema for adding a member to a CHC."""

    user_id: int = Field(..., description="Target User ID")
    role: str = Field(..., description="Role within CHC: MANAGER, OPERATOR, TECHNICIAN")


class CHCMembershipResponse(BaseModel):
    """Schema for returning CHC membership details."""

    id: int
    chc_id: int
    user_id: int
    role: str
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
