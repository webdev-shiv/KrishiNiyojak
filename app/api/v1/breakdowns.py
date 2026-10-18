"""API endpoints for Machine Breakdown Reporting and Impact Analysis (T12)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
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
    BreakdownRecoveryResponse,
    BreakdownResponse,
    RecoveryPlanExecutionResponse,
    RecoveryPlanRejectRequest,
    RecoveryPlanResponse,
)
from app.services.breakdown import (
    get_breakdown_impact_analysis,
    list_breakdowns_for_user,
    report_breakdown_and_analyze,
)
from app.services.recovery import (
    approve_and_execute_recovery_plan,
    generate_breakdown_recovery_alternatives,
    get_recovery_plan,
    reject_recovery_plan,
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

    - Transitions machine status to UNDER_MAINTENANCE and deactivates machine availability slots.
    - Persists MachineBreakdown incident record.
    - Evaluates all future and in-progress bookings assigned to the machine.
    - Computes delay severity, deadline violation risk, and multi-factor customer priority score
      (1-100) based on agronomic urgency, customer deadline buffer,
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


@router.post(
    "/{breakdown_id}/recovery-alternatives",
    response_model=BreakdownRecoveryResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate candidate recovery alternatives and ranking for affected bookings",
)
def generate_recovery_plan(
    breakdown_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownRecoveryResponse:
    """Evaluate and rank recovery alternatives for bookings disrupted by a machine breakdown.

    - Identifies compatible machinery and available operators in the CHC.
    - Evaluates operational feasibility using the T10 feasibility checker.
    - Computes multi-factor ranking scores (Delay 35%, Transit 25%, Cost 25%, Availability 15%).
    - Generates a candidate RecoveryPlan proposal with status PROPOSED.
    - Does not modify bookings or commit operational state changes.

    Enforces CHC manager authorization and tenant isolation.
    """
    return generate_breakdown_recovery_alternatives(
        db=db,
        breakdown_id=breakdown_id,
        current_user=current_user,
        persist_proposed_plan=True,
    )


@router.get(
    "/{breakdown_id}/recovery-alternatives",
    response_model=BreakdownRecoveryResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve recovery alternatives recommendations and ranking queue",
)
def get_recovery_alternatives(
    breakdown_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownRecoveryResponse:
    """Retrieve evaluated recovery alternatives and ranking recommendations

    for a machine breakdown incident without modifying state.
    """
    return generate_breakdown_recovery_alternatives(
        db=db,
        breakdown_id=breakdown_id,
        current_user=current_user,
        persist_proposed_plan=False,
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


@router.get(
    "/{breakdown_id}/recovery-plans/{plan_id}",
    response_model=RecoveryPlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve recovery plan details for a specific breakdown",
)
def get_breakdown_recovery_plan(
    breakdown_id: int,
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanResponse:
    """Retrieve details and candidate items for a recovery plan under a breakdown incident."""
    plan = get_recovery_plan(db=db, plan_id=plan_id, current_user=current_user)
    if plan.breakdown_id != breakdown_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery plan #{plan_id} does not belong to breakdown #{breakdown_id}",
        )
    return RecoveryPlanResponse.model_validate(plan)


@router.post(
    "/{breakdown_id}/recovery-plans/{plan_id}/approve",
    response_model=RecoveryPlanExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve and execute a proposed recovery plan for a breakdown",
)
def approve_breakdown_recovery_plan(
    breakdown_id: int,
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanExecutionResponse:
    """Approve and atomically execute a proposed recovery plan under a breakdown incident."""
    client_ip = request.client.host if request.client else None
    plan = get_recovery_plan(db=db, plan_id=plan_id, current_user=current_user)
    if plan.breakdown_id != breakdown_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery plan #{plan_id} does not belong to breakdown #{breakdown_id}",
        )
    return approve_and_execute_recovery_plan(
        db=db,
        plan_id=plan_id,
        current_user=current_user,
        ip_address=client_ip,
    )


@router.post(
    "/{breakdown_id}/recovery-plans/{plan_id}/reject",
    response_model=RecoveryPlanExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a proposed recovery plan for a breakdown",
)
def reject_breakdown_recovery_plan(
    breakdown_id: int,
    plan_id: int,
    request: Request,
    payload: RecoveryPlanRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanExecutionResponse:
    """Reject a proposed recovery plan under a breakdown incident."""
    client_ip = request.client.host if request.client else None
    reason = payload.reason if payload else None
    plan = get_recovery_plan(db=db, plan_id=plan_id, current_user=current_user)
    if plan.breakdown_id != breakdown_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Recovery plan #{plan_id} does not belong to breakdown #{breakdown_id}",
        )
    return reject_recovery_plan(
        db=db,
        plan_id=plan_id,
        current_user=current_user,
        reason=reason,
        ip_address=client_ip,
    )
