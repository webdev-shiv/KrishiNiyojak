"""API endpoints for Machine Breakdown Reporting and Impact Analysis (T12)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    get_db,
    require_roles,
    verify_chc_manager_access,
)
from app.models.identity import User
from app.models.recovery import MachineBreakdown
from app.schemas.recovery import (
    BreakdownCreateRequest,
    BreakdownImpactResponse,
    BreakdownPaginatedResponse,
    BreakdownResponse,
)
from app.services.breakdown import (
    get_breakdown_impact_analysis,
    list_breakdowns_for_user,
    report_breakdown_and_analyze,
)

router = APIRouter(prefix="/breakdowns", tags=["Breakdown & Recovery Impact"])


@router.post(
    "",
    response_model=BreakdownImpactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a machine breakdown and trigger impact analysis",
)
def report_breakdown(
    payload: BreakdownCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownImpactResponse:
    """Report an operational machine breakdown.

    - Transitions machine status to BROKEN_DOWN.
    - Blocks future availability slots for maintenance.
    - Identifies all affected upcoming bookings (excluding cancelled & completed).
    - Sets affected booking statuses to DISRUPTED.
    - Computes transparent customer-priority scores based on deadline urgency,
      expected downtime, agronomic job criticality, and farm acreage.
    - Returns affected bookings sorted in priority order with explicit scoring rationales.

    Enforces CHC manager authorization and tenant isolation.
    """
    return report_breakdown_and_analyze(
        db=db,
        payload=payload,
        current_user=current_user,
    )


@router.get(
    "/{breakdown_id}/impact",
    response_model=BreakdownImpactResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve breakdown impact analysis and customer priority queue",
)
def get_breakdown_impact(
    breakdown_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownImpactResponse:
    """Retrieve detailed impact analysis, delay risk metrics, and customer priority queue

    for an existing machine breakdown incident.
    """
    return get_breakdown_impact_analysis(
        db=db,
        breakdown_id=breakdown_id,
        current_user=current_user,
    )


@router.get(
    "/{breakdown_id}",
    response_model=BreakdownResponse,
    status_code=status.HTTP_200_OK,
    summary="Get breakdown incident details",
)
def get_breakdown_details(
    breakdown_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> MachineBreakdown:
    """Retrieve breakdown record details."""
    breakdown = db.execute(
        select(MachineBreakdown)
        .options(selectinload(MachineBreakdown.machine))
        .where(MachineBreakdown.id == breakdown_id)
    ).scalar_one_or_none()

    if not breakdown:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Breakdown with ID {breakdown_id} not found",
        )

    verify_chc_manager_access(current_user, breakdown.machine.chc_id)
    return breakdown


@router.get(
    "",
    response_model=BreakdownPaginatedResponse,
    status_code=status.HTTP_200_OK,
    summary="List reported machine breakdowns",
)
def list_breakdowns(
    chc_id: int | None = Query(default=None, description="Filter by CHC hub ID"),
    machine_id: int | None = Query(default=None, description="Filter by machine ID"),
    status: str | None = Query(default=None, description="Filter by breakdown status"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownPaginatedResponse:
    """List breakdowns with pagination and filters."""
    items, total = list_breakdowns_for_user(
        db=db,
        current_user=current_user,
        chc_id=chc_id,
        machine_id=machine_id,
        status_filter=status,
        skip=skip,
        limit=limit,
    )

    page = (skip // limit) + 1 if limit > 0 else 1
    return BreakdownPaginatedResponse(
        items=[BreakdownResponse.model_validate(item) for item in items],
        total=total,
        page=page,
        size=limit,
    )
