"""API router for Scheduling Rules and Feasibility evaluation (T10)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    get_current_active_user,
    get_db,
    verify_chc_manager_access,
)
from app.models.booking import Booking, ServiceRequest
from app.models.identity import User
from app.models.resource import Operator
from app.schemas.scheduling import (
    FeasibilityCheckRequest,
    FeasibilityResponse,
)
from app.services.feasibility import evaluate_feasibility

router = APIRouter(prefix="/scheduling", tags=["Scheduling & Feasibility"])


def _get_user_roles(user: User) -> set[str]:
    """Helper to collect normalized roles from user_roles and chc_memberships."""
    roles: set[str] = set()
    for ur in user.user_roles:
        if ur.role:
            roles.add(ur.role.name.upper())
    for m in user.chc_memberships:
        if m.is_active:
            roles.add(m.role.upper())
    return roles


@router.post(
    "/feasibility",
    response_model=FeasibilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate feasibility of a proposed scheduling assignment",
)
def check_proposed_feasibility(
    payload: FeasibilityCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FeasibilityResponse:
    """Evaluate whether a proposed operational assignment can feasibly be scheduled.

    Evaluates:
    - CHC hub status and operating radius compliance.
    - Machine capability, horsepower, and required implement attachment compatibility.
    - Machine and operator availability calendar slots.
    - Operator eligibility, licensing, and active booking conflicts.
    - Estimated Haversine distance and road transit time.
    - Farmer date window, deadline, acreage, and slot capacity constraints.

    Does not modify database records or create bookings.
    Enforces authorization:
    - SUPERADMIN: Full access across all CHCs.
    - CHC_MANAGER: Authorized only for managed CHC hubs.
    - FARMER: Restricted to proposals linked to their own service requests.
    - OPERATOR: Permitted for their affiliated CHC hub.
    """
    user_roles = _get_user_roles(current_user)

    if "SUPERADMIN" not in user_roles:
        if "CHC_MANAGER" in user_roles:
            verify_chc_manager_access(current_user, payload.chc_id)
        elif "OPERATOR" in user_roles:
            is_member = any(
                m.chc_id == payload.chc_id and m.is_active for m in current_user.chc_memberships
            )
            if not is_member:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Access denied: You are not affiliated with CHC {payload.chc_id}",
                )
        elif "FARMER" in user_roles:
            if payload.service_request_id is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Farmers can only evaluate feasibility for their own service requests",
                )
            req = db.execute(
                select(ServiceRequest).where(ServiceRequest.id == payload.service_request_id)
            ).scalar_one_or_none()
            if not req or req.farmer_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: You do not own this service request",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operation not permitted for current user role",
            )

    return evaluate_feasibility(
        db=db,
        chc_id=payload.chc_id,
        scheduled_date=payload.scheduled_date,
        scheduled_slot=payload.scheduled_slot,
        service_request_id=payload.service_request_id,
        machine_id=payload.machine_id,
        operator_id=payload.operator_id,
        attachment_ids=payload.attachment_ids,
        field_latitude=payload.field_latitude,
        field_longitude=payload.field_longitude,
        acreage=payload.acreage,
    )


@router.get(
    "/feasibility/{booking_id}",
    response_model=FeasibilityResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate feasibility for an existing booking",
)
def check_booking_feasibility(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> FeasibilityResponse:
    """Evaluate current feasibility and constraint margins for an existing operational booking.

    Excludes the evaluated booking from colliding with itself during conflict checks.
    Enforces authorization:
    - SUPERADMIN: Full access.
    - CHC_MANAGER: Authorized only for managed CHC bookings.
    - FARMER: Authorized only for their own booking's service request.
    - OPERATOR: Authorized only for bookings assigned to their operator profile.
    """
    booking = db.execute(
        select(Booking)
        .options(
            selectinload(Booking.service_request),
            selectinload(Booking.booking_attachments),
        )
        .where(Booking.id == booking_id)
    ).scalar_one_or_none()

    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking with ID {booking_id} not found",
        )

    user_roles = _get_user_roles(current_user)

    if "SUPERADMIN" not in user_roles:
        authorized = False
        if "CHC_MANAGER" in user_roles:
            is_chc_mgr = any(
                m.is_active and m.chc_id == booking.chc_id and m.role.upper() == "MANAGER"
                for m in current_user.chc_memberships
            )
            if is_chc_mgr:
                authorized = True

        if not authorized and "FARMER" in user_roles:
            if booking.service_request and booking.service_request.farmer_id == current_user.id:
                authorized = True

        if not authorized and "OPERATOR" in user_roles:
            operator = db.execute(
                select(Operator).where(Operator.user_id == current_user.id)
            ).scalar_one_or_none()
            if operator and booking.operator_id == operator.id:
                authorized = True

        if not authorized:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not authorized to view feasibility for this booking",
            )

    attachment_ids = [ba.attachment_id for ba in booking.booking_attachments]

    return evaluate_feasibility(
        db=db,
        chc_id=booking.chc_id,
        scheduled_date=booking.scheduled_date,
        scheduled_slot=booking.scheduled_slot,
        service_request_id=booking.service_request_id,
        machine_id=booking.machine_id,
        operator_id=booking.operator_id,
        attachment_ids=attachment_ids,
        exclude_booking_id=booking.id,
    )
