"""Pydantic schemas for Breakdown Reporting, Impact Analysis, and Customer Priority (T12)."""

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class BreakdownCreateRequest(BaseModel):
    """Payload to report a machine breakdown incident."""

    machine_id: int = Field(..., description="ID of the broken-down machine")
    failure_type: str = Field(
        ...,
        description="Type of failure (ENGINE, HYDRAULIC, IMPLEMENT, ELECTRICAL, PUNCTURE, etc.)",
    )
    severity: str = Field(
        default="MEDIUM",
        description="Severity level: LOW, MEDIUM, CRITICAL",
    )
    description: str | None = Field(
        default=None,
        max_length=1000,
        description="Detailed description or observations from the field/operator",
    )
    reported_at: datetime | None = Field(
        default=None,
        description="Timestamp of failure incident (defaults to server UTC time if omitted)",
    )
    booking_id: int | None = Field(
        default=None,
        description="Optional ID of active booking during which breakdown occurred",
    )
    field_latitude: float | None = Field(
        default=None,
        ge=-90.0,
        le=90.0,
        description="GPS latitude where the machine broke down",
    )
    field_longitude: float | None = Field(
        default=None,
        ge=-180.0,
        le=180.0,
        description="GPS longitude where the machine broke down",
    )
    expected_repair_hours: float | None = Field(
        default=None,
        ge=0.0,
        description="Estimated downtime in hours. If omitted, defaults based on severity level.",
    )


class AffectedBookingImpact(BaseModel):
    """Detailed operational impact and customer priority evaluation for an affected booking."""

    booking_id: int
    booking_code: str
    service_request_id: int
    farmer_id: int
    farmer_name: str
    farmer_phone: str | None = None
    operation_type: str
    crop_type: str | None = None
    acreage: float | None = None
    scheduled_date: date
    scheduled_slot: str
    deadline: date | None = None
    buffer_days: int | None = None
    delay_risk: str = Field(..., description="Delay severity risk: LOW, MEDIUM, HIGH, CRITICAL")
    missed_deadline_risk: bool = Field(
        ..., description="True if estimated machine downtime risks exceeding farmer's deadline"
    )
    priority_score: int = Field(
        ..., ge=1, le=100, description="Customer priority score from 1 to 100"
    )
    agronomic_urgency: str = Field(
        ..., description="Agronomic urgency rating: LOW, MEDIUM, HIGH, CRITICAL"
    )
    priority_reasons: list[str] = Field(
        default_factory=list,
        description="Detailed explanatory breakdown of how the priority score was computed",
    )
    status: str

    model_config = ConfigDict(from_attributes=True)


class BreakdownImpactResponse(BaseModel):
    """Comprehensive impact analysis and customer priority queue for a machine breakdown."""

    breakdown_id: int
    machine_id: int
    machine_registration: str
    chc_id: int
    chc_name: str
    failure_type: str
    severity: str
    description: str | None = None
    reported_at: datetime
    status: str
    estimated_downtime_hours: float
    total_affected_bookings: int
    critical_priority_count: int
    high_priority_count: int
    medium_priority_count: int
    low_priority_count: int
    missed_deadline_count: int
    total_affected_acreage: float
    affected_bookings: list[AffectedBookingImpact] = Field(
        default_factory=list,
        description="Affected bookings sorted in descending order of customer priority score",
    )

    model_config = ConfigDict(from_attributes=True)


class BreakdownResponse(BaseModel):
    """Breakdown incident summary record."""

    id: int
    machine_id: int
    booking_id: int | None = None
    reported_by_id: int
    reported_at: datetime
    failure_type: str
    severity: str
    description: str | None = None
    field_latitude: float | None = None
    field_longitude: float | None = None
    status: str
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BreakdownPaginatedResponse(BaseModel):
    """Paginated list of breakdown incident reports."""

    items: list[BreakdownResponse]
    total: int
    page: int
    size: int
