"""Pydantic schemas for Feasibility checking (T10) and Schedule Generation (T11)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FeasibilityCheckRequest(BaseModel):
    """Payload to evaluate feasibility of a proposed scheduling assignment."""

    chc_id: int = Field(..., description="ID of the Custom Hiring Centre managing the operation")
    scheduled_date: date = Field(..., description="Target date for the machine-day assignment")
    scheduled_slot: Literal["FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"] = Field(
        "FULL_DAY",
        description="Slot: FULL_DAY (8h), HALF_DAY_MORNING (4h), or HALF_DAY_AFTERNOON (4h)",
    )
    service_request_id: int | None = Field(
        None,
        description="Optional service request ID linking demand constraints and field coords",
    )
    machine_id: int | None = Field(
        None, description="Optional machinery asset ID proposed for the assignment"
    )
    operator_id: int | None = Field(
        None, description="Optional certified operator ID proposed for the assignment"
    )
    attachment_ids: list[int] = Field(
        default_factory=list,
        description="List of implement/attachment IDs required for the agricultural operation",
    )
    field_latitude: float | None = Field(
        None,
        ge=-90.0,
        le=90.0,
        description="Field latitude coordinate in degrees (if not inferred from request)",
    )
    field_longitude: float | None = Field(
        None,
        ge=-180.0,
        le=180.0,
        description="Field longitude coordinate in degrees (if not inferred from request)",
    )
    acreage: float | None = Field(
        None,
        gt=0.0,
        description="Field acreage in acres (used if not inferred from service request)",
    )


class FeasibilityConstraintDetails(BaseModel):
    """Structured constraint metrics with explicit units evaluated during feasibility checking."""

    # Travel & Distance metrics
    distance_km: float | None = Field(
        None, description="Straight-line Haversine transit distance in kilometers"
    )
    estimated_travel_time_minutes: float | None = Field(
        None,
        description="Estimated road transit time in minutes using winding factor and speed",
    )
    chc_operating_radius_km: float | None = Field(
        None, description="Operational service radius limit of managing CHC in kilometers"
    )
    within_operating_radius: bool | None = Field(
        None, description="True if field destination is within CHC operating radius"
    )

    # Machinery & Power metrics
    machine_horsepower: float | None = Field(
        None, description="Rated power capacity of the proposed machine in Horsepower (HP)"
    )
    required_horsepower_min: float | None = Field(
        None,
        description="Max required power threshold among requested attachments in HP",
    )
    horsepower_sufficient: bool | None = Field(
        None,
        description="True if machine horsepower meets or exceeds required implement HP",
    )

    # Job Duration & Capacity metrics
    acreage: float | None = Field(None, description="Target field operational area in acres")
    estimated_work_duration_hours: float | None = Field(
        None,
        description="Estimated field work duration in hours based on acreage and rate model",
    )
    slot_duration_hours: float | None = Field(
        None,
        description="Standard slot capacity in hours (FULL_DAY: 8h, HALF_DAY: 4h)",
    )
    capacity_sufficient: bool | None = Field(
        None, description="True if estimated work duration fits within slot capacity"
    )

    # Timeline & Deadline metrics
    within_date_window: bool | None = Field(
        None, description="True if scheduled date falls within farmer's requested window"
    )
    requested_start_date: date | None = Field(
        None, description="Earliest acceptable operational date requested by the farmer"
    )
    deadline_date: date | None = Field(
        None, description="Strict operational deadline date requested by the farmer"
    )

    model_config = ConfigDict(from_attributes=True)


class FeasibilityResponse(BaseModel):
    """Comprehensive feasibility evaluation report."""

    feasible: bool = Field(
        ...,
        description="True if assignment satisfies all constraints and has zero blocking reasons",
    )
    reasons: list[str] = Field(
        default_factory=list,
        description="List of blocking operational or compliance violations preventing scheduling",
    )
    warnings: list[str] = Field(
        default_factory=list,
        description="Advisory warnings or non-blocking capacity notes",
    )
    constraints: FeasibilityConstraintDetails = Field(
        default_factory=FeasibilityConstraintDetails,
        description="Detailed constraint metrics and evaluated thresholds",
    )

    model_config = ConfigDict(from_attributes=True)


# ==============================================================================
# T11: Schedule Generation & Management Schemas
# ==============================================================================


class CandidateAssignmentResponse(BaseModel):
    """Proposed assignment for a specific service request or booking within a schedule."""

    service_request_id: int
    booking_id: int | None = Field(
        None, description="Existing booking ID if schedule was generated from a pending booking"
    )
    machine_id: int
    machine_model: str
    operator_id: int
    operator_name: str
    attachment_ids: list[int] = Field(default_factory=list)
    scheduled_date: date
    scheduled_slot: str
    estimated_cost: Decimal | None = None
    feasible: bool = True
    warnings: list[str] = Field(default_factory=list)
    constraints: FeasibilityConstraintDetails = Field(default_factory=FeasibilityConstraintDetails)

    model_config = ConfigDict(from_attributes=True)


class UnscheduledJobResponse(BaseModel):
    """Service request or booking that could not be feasibly scheduled."""

    service_request_id: int
    booking_id: int | None = None
    farmer_id: int | None = None
    acreage: float | None = None
    operation_type: str | None = None
    reasons: list[str] = Field(
        default_factory=list,
        description="Detailed blocking reasons explaining why the job could not be scheduled",
    )
    attempted_evaluations: int = 0

    model_config = ConfigDict(from_attributes=True)


class ScheduleGenerateRequest(BaseModel):
    """Payload to generate candidate schedule for a CHC."""

    chc_id: int = Field(..., description="Target Custom Hiring Centre ID")
    start_date: date | None = Field(
        None, description="Optional start of scheduling window (defaults to earliest demand date)"
    )
    end_date: date | None = Field(
        None, description="Optional end of scheduling window (defaults to latest deadline)"
    )
    service_request_ids: list[int] | None = Field(
        None, description="Optional list of specific approved service request IDs to schedule"
    )
    booking_ids: list[int] | None = Field(
        None, description="Optional list of specific pending booking IDs to schedule"
    )


class ScheduleRejectRequest(BaseModel):
    """Payload to reject a proposed candidate schedule."""

    reason: str | None = Field(
        None, max_length=255, description="Manager rationale for rejecting the schedule"
    )


class ScheduleResponse(BaseModel):
    """Comprehensive representation of a candidate or approved schedule."""

    id: str = Field(..., description="Unique schedule identifier (UUID)")
    chc_id: int = Field(..., description="Managing CHC ID")
    status: Literal["PROPOSED", "APPROVED", "REJECTED"] = Field(
        ..., description="Schedule lifecycle state"
    )
    created_at: datetime
    created_by_id: int
    approved_at: datetime | None = None
    approved_by_id: int | None = None
    rejection_reason: str | None = None
    candidate_assignments: list[CandidateAssignmentResponse] = Field(default_factory=list)
    unscheduled_jobs: list[UnscheduledJobResponse] = Field(default_factory=list)
    total_scheduled: int = 0
    total_unscheduled: int = 0

    model_config = ConfigDict(from_attributes=True)


class ScheduleSummaryResponse(BaseModel):
    """Lightweight summary of a generated schedule."""

    id: str
    chc_id: int
    status: str
    created_at: datetime
    created_by_id: int
    approved_at: datetime | None = None
    total_scheduled: int
    total_unscheduled: int

    model_config = ConfigDict(from_attributes=True)
