"""API endpoints for Recovery Plan Retrieval, Approval, and Execution (T14)."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.identity import User
from app.schemas.recovery import (
    RecoveryPlanExecutionResponse,
    RecoveryPlanRejectRequest,
    RecoveryPlanResponse,
)
from app.services.recovery import (
    approve_and_execute_recovery_plan,
    get_recovery_plan,
    reject_recovery_plan,
)

router = APIRouter(prefix="/recovery-plans", tags=["Recovery Approval & Execution"])


@router.get(
    "/{plan_id}",
    response_model=RecoveryPlanResponse,
    status_code=status.HTTP_200_OK,
    summary="Retrieve proposed recovery plan details and candidate reassignment items",
)
def get_recovery_plan_endpoint(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanResponse:
    """Retrieve details, status, and candidate items for a proposed recovery plan."""
    plan = get_recovery_plan(db=db, plan_id=plan_id, current_user=current_user)
    return RecoveryPlanResponse.model_validate(plan)


@router.post(
    "/{plan_id}/approve",
    response_model=RecoveryPlanExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve and atomically execute a proposed recovery plan",
)
def approve_recovery_plan_endpoint(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanExecutionResponse:
    """Validate and atomically execute a proposed recovery plan.

    - Live re-evaluates all assignments against machinery compatibility, operator eligibility,
      calendar availability, booking conflicts, transit radius, and farmer deadlines.
    - Atomically updates bookings to SCHEDULED and availability slots to BOOKED / ASSIGNED.
    - Prevents duplicate approval, stale-plan execution, or executing rejected plans.
    - Enforces CHC tenant isolation.
    - Records AuditLog with previous and new assignment details.
    - Dispatches operational notifications to farmers and replacement operators.
    - Rolls back the entire operation if any conflict or constraint failure occurs.
    """
    client_ip = request.client.host if request.client else None
    return approve_and_execute_recovery_plan(
        db=db,
        plan_id=plan_id,
        current_user=current_user,
        ip_address=client_ip,
    )


@router.post(
    "/{plan_id}/reject",
    response_model=RecoveryPlanExecutionResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject a proposed recovery plan",
)
def reject_recovery_plan_endpoint(
    plan_id: int,
    request: Request,
    payload: RecoveryPlanRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> RecoveryPlanExecutionResponse:
    """Reject a proposed recovery plan without modifying operational bookings or resources.

    - Prevents modifying already executed plans or duplicate rejections.
    - Transitions plan status to REJECTED and records manager justification.
    - Leaves existing bookings, machines, and operator availability slots untouched.
    - Records immutable AuditLog.
    """
    client_ip = request.client.host if request.client else None
    reason = payload.reason if payload else None
    return reject_recovery_plan(
        db=db,
        plan_id=plan_id,
        current_user=current_user,
        reason=reason,
        ip_address=client_ip,
    )
