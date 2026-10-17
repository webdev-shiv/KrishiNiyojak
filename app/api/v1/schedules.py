"""API router for Schedule Generation, Review, Approval, and Rejection (T11)."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    require_roles,
    verify_chc_manager_access,
)
from app.models.identity import User
from app.schemas.scheduling import (
    ScheduleGenerateRequest,
    ScheduleRejectRequest,
    ScheduleResponse,
)
from app.services.schedule_store import schedule_store
from app.services.scheduler import (
    apply_approved_schedule,
    generate_candidate_schedule,
    reject_candidate_schedule,
)

router = APIRouter(prefix="/schedules", tags=["Schedule Management"])


@router.post(
    "/generate",
    response_model=ScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate candidate schedule for a CHC",
)
def generate_schedule(
    payload: ScheduleGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> ScheduleResponse:
    """Generate a non-destructive candidate machine-day schedule for a CHC.

    Evaluates feasibility of matching available fleet machinery, certified operators,
    and agricultural implements with approved farmer service requests.

    Does not modify database records or confirmed bookings until approved.
    Enforces CHC manager authorization and tenant isolation.
    """
    verify_chc_manager_access(current_user, payload.chc_id)

    return generate_candidate_schedule(
        db=db,
        chc_id=payload.chc_id,
        created_by_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        service_request_ids=payload.service_request_ids,
        booking_ids=payload.booking_ids,
    )


@router.get(
    "",
    response_model=list[ScheduleResponse],
    status_code=status.HTTP_200_OK,
    summary="List candidate and approved schedules for a CHC",
)
def list_schedules(
    chc_id: int = Query(..., description="Target Custom Hiring Centre ID"),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> list[ScheduleResponse]:
    """Retrieve all candidate, approved, or rejected schedules generated for a CHC.

    Enforces CHC manager authorization and tenant isolation.
    """
    verify_chc_manager_access(current_user, chc_id)
    return schedule_store.list_by_chc(chc_id)


@router.get(
    "/{schedule_id}",
    response_model=ScheduleResponse,
    status_code=status.HTTP_200_OK,
    summary="Review candidate schedule details",
)
def get_schedule(
    schedule_id: str,
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> ScheduleResponse:
    """Review candidate assignments, feasibility metrics, and unscheduled reasons for a schedule.

    Enforces CHC manager authorization and tenant isolation.
    """
    schedule = schedule_store.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate schedule with ID {schedule_id} not found",
        )

    verify_chc_manager_access(current_user, schedule.chc_id)
    return schedule


@router.post(
    "/{schedule_id}/approve",
    response_model=ScheduleResponse,
    status_code=status.HTTP_200_OK,
    summary="Approve candidate schedule and commit assignments",
)
def approve_schedule(
    schedule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> ScheduleResponse:
    """Transactionally approve a candidate schedule and commit operational bookings.

    Re-verifies all candidate slots against live database availability to detect
    concurrent conflicts. On success, transitions bookings to SCHEDULED and reserves
    machinery and operator availability slots atomically.

    Prevents duplicate approval or approval of rejected schedules.
    """
    return apply_approved_schedule(
        db=db,
        schedule_id=schedule_id,
        manager_user=current_user,
    )


@router.post(
    "/{schedule_id}/reject",
    response_model=ScheduleResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject candidate schedule",
)
def reject_schedule(
    schedule_id: str,
    payload: ScheduleRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> ScheduleResponse:
    """Reject a proposed candidate schedule.

    Leaves all database bookings and availability slots untouched.
    Prevents subsequent approval of the rejected plan.
    """
    reason = payload.reason if payload else None
    return reject_candidate_schedule(
        db=db,
        schedule_id=schedule_id,
        manager_user=current_user,
        reason=reason,
    )
