"""API endpoints for Booking lifecycle management."""

import uuid
from datetime import UTC, date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import (
    get_current_active_user,
    get_db,
    require_roles,
    verify_chc_manager_access,
)
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.identity import User
from app.models.resource import Attachment, Machine, Operator
from app.schemas.booking import (
    BookingCancelRequest,
    BookingCreate,
    BookingPaginatedResponse,
    BookingResponse,
    BookingUpdate,
)

router = APIRouter(prefix="/bookings", tags=["Bookings Lifecycle"])

# Valid state machine transitions
VALID_BOOKING_TRANSITIONS: dict[str, set[str]] = {
    "PENDING": {"SCHEDULED", "CONFIRMED", "CANCELLED"},
    "SCHEDULED": {"CONFIRMED", "IN_PROGRESS", "CANCELLED", "DISRUPTED"},
    "CONFIRMED": {"IN_PROGRESS", "CANCELLED", "DISRUPTED"},
    "IN_PROGRESS": {"COMPLETED", "DISRUPTED", "CANCELLED"},
    "DISRUPTED": {"SCHEDULED", "CANCELLED"},
    "COMPLETED": set(),
    "CANCELLED": set(),
}


def serialize_booking(booking: Booking) -> dict[str, object]:
    """Helper to convert Booking model and its relationships to dict matching BookingResponse."""
    attachment_ids = [ba.attachment_id for ba in booking.booking_attachments]
    return {
        "id": booking.id,
        "service_request_id": booking.service_request_id,
        "chc_id": booking.chc_id,
        "machine_id": booking.machine_id,
        "operator_id": booking.operator_id,
        "booking_code": booking.booking_code,
        "scheduled_date": booking.scheduled_date,
        "scheduled_slot": booking.scheduled_slot,
        "status": booking.status,
        "total_cost": booking.total_cost,
        "payment_status": booking.payment_status,
        "attachment_ids": attachment_ids,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
    }


@router.post(
    "",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a booking from an approved service request",
)
def create_booking(
    payload: BookingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> dict[str, object]:
    """Convert an approved service request into an operational booking.

    Validates:
    - Service request existence and APPROVED status.
    - No existing non-cancelled booking for this service request.
    - Assigned machine, operator, and attachment compatibility and CHC alignment.
    - Date constraints within the service request window.
    """
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == payload.service_request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {payload.service_request_id} not found",
        )

    verify_chc_manager_access(current_user, req.chc_id)

    if req.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Service request {req.id} must be in APPROVED status "
                f"to create a booking (currently {req.status})"
            ),
        )

    # Prevent duplicate active bookings for the same service request
    existing_booking = db.execute(
        select(Booking).where(
            Booking.service_request_id == payload.service_request_id,
            Booking.status != "CANCELLED",
        )
    ).scalar_one_or_none()
    if existing_booking:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Service request {payload.service_request_id} already has an "
                f"active booking ({existing_booking.booking_code})"
            ),
        )

    # Validate machine if provided
    if payload.machine_id is not None:
        machine = db.execute(
            select(Machine).where(Machine.id == payload.machine_id)
        ).scalar_one_or_none()
        if not machine:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Machine with ID {payload.machine_id} not found",
            )
        if machine.chc_id != req.chc_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Machine {payload.machine_id} does not belong to CHC {req.chc_id}",
            )
        if machine.status == "RETIRED":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Machine {payload.machine_id} is retired from active fleet",
            )

    # Validate operator if provided
    if payload.operator_id is not None:
        operator = db.execute(
            select(Operator).where(Operator.id == payload.operator_id)
        ).scalar_one_or_none()
        if not operator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Operator with ID {payload.operator_id} not found",
            )
        if operator.chc_id != req.chc_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Operator {payload.operator_id} does not belong to CHC {req.chc_id}",
            )
        if operator.status == "INACTIVE":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Operator {payload.operator_id} is inactive",
            )

    # Validate scheduled date within service request window
    if (
        payload.scheduled_date < req.requested_start_date
        or payload.scheduled_date > req.requested_end_date
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Scheduled date {payload.scheduled_date} falls outside the service request "
                f"window ({req.requested_start_date} to {req.requested_end_date})"
            ),
        )

    slot_upper = payload.scheduled_slot.strip().upper()
    if slot_upper not in ("FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="scheduled_slot must be FULL_DAY, HALF_DAY_MORNING, or HALF_DAY_AFTERNOON",
        )

    # Validate attachments
    if payload.attachment_ids:
        attachments = (
            db.execute(select(Attachment).where(Attachment.id.in_(payload.attachment_ids)))
            .scalars()
            .all()
        )
        found_ids = {a.id for a in attachments}
        missing = set(payload.attachment_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachments not found: {sorted(missing)}",
            )
        for att in attachments:
            if att.chc_id != req.chc_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Attachment {att.id} does not belong to CHC {req.chc_id}",
                )

    # Generate or validate unique booking code
    if payload.booking_code:
        booking_code = payload.booking_code.strip().upper()
        existing_code = db.execute(
            select(Booking).where(Booking.booking_code == booking_code)
        ).scalar_one_or_none()
        if existing_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking code '{booking_code}' already exists",
            )
    else:
        ts = int(datetime.now(UTC).timestamp())
        random_suffix = uuid.uuid4().hex[:4].upper()
        booking_code = f"BK-{req.chc_id}-{ts}-{random_suffix}"

    total_cost = payload.total_cost if payload.total_cost is not None else req.estimated_cost

    booking = Booking(
        service_request_id=req.id,
        chc_id=req.chc_id,
        machine_id=payload.machine_id,
        operator_id=payload.operator_id,
        booking_code=booking_code,
        scheduled_date=payload.scheduled_date,
        scheduled_slot=slot_upper,
        status="CONFIRMED" if (payload.machine_id and payload.operator_id) else "PENDING",
        total_cost=total_cost,
        payment_status="PENDING",
    )
    db.add(booking)
    db.flush()

    for att_id in payload.attachment_ids:
        ba = BookingAttachment(booking_id=booking.id, attachment_id=att_id)
        db.add(ba)

    db.commit()

    # Re-fetch with attachments loaded
    db_booking = db.execute(
        select(Booking)
        .options(selectinload(Booking.booking_attachments))
        .where(Booking.id == booking.id)
    ).scalar_one()

    return serialize_booking(db_booking)


@router.get(
    "",
    response_model=BookingPaginatedResponse,
    summary="List bookings with role-based visibility and filters",
)
def list_bookings(
    chc_id: int | None = Query(None, description="Filter by CHC hub ID"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    scheduled_date: date | None = Query(None, description="Filter by date"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List bookings according to caller permissions."""
    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles

    managed_chc_ids = [
        m.chc_id
        for m in current_user.chc_memberships
        if m.is_active and m.role.upper() == "MANAGER"
    ]

    query = select(Booking).join(Booking.service_request)
    count_query = select(func.count(Booking.id)).join(Booking.service_request)

    if not is_superadmin:
        if managed_chc_ids:
            query = query.where(
                (Booking.chc_id.in_(managed_chc_ids))
                | (ServiceRequest.farmer_id == current_user.id)
            )
            count_query = count_query.where(
                (Booking.chc_id.in_(managed_chc_ids))
                | (ServiceRequest.farmer_id == current_user.id)
            )
        else:
            # Check if operator
            op_record = db.execute(
                select(Operator).where(Operator.user_id == current_user.id)
            ).scalar_one_or_none()
            if op_record:
                query = query.where(
                    (Booking.operator_id == op_record.id)
                    | (ServiceRequest.farmer_id == current_user.id)
                )
                count_query = count_query.where(
                    (Booking.operator_id == op_record.id)
                    | (ServiceRequest.farmer_id == current_user.id)
                )
            else:
                # Farmer only
                query = query.where(ServiceRequest.farmer_id == current_user.id)
                count_query = count_query.where(ServiceRequest.farmer_id == current_user.id)

    if chc_id is not None:
        query = query.where(Booking.chc_id == chc_id)
        count_query = count_query.where(Booking.chc_id == chc_id)
    if status_filter:
        query = query.where(Booking.status == status_filter.strip().upper())
        count_query = count_query.where(Booking.status == status_filter.strip().upper())
    if scheduled_date is not None:
        query = query.where(Booking.scheduled_date == scheduled_date)
        count_query = count_query.where(Booking.scheduled_date == scheduled_date)

    total = db.execute(count_query).scalar_one() or 0
    bookings = (
        db.execute(
            query.options(selectinload(Booking.booking_attachments))
            .order_by(Booking.scheduled_date.asc(), Booking.id.asc())
            .offset(skip)
            .limit(limit)
        )
        .scalars()
        .all()
    )

    items = [serialize_booking(b) for b in bookings]
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
    summary="Get details of a specific booking",
)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Retrieve booking details by ID."""
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

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_farmer = booking.service_request.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == booking.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    op_record = db.execute(
        select(Operator).where(Operator.user_id == current_user.id)
    ).scalar_one_or_none()
    is_assigned_operator = op_record and booking.operator_id == op_record.id

    if not (is_superadmin or is_farmer or is_chc_manager or is_assigned_operator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this booking",
        )

    return serialize_booking(booking)


@router.put(
    "/{booking_id}",
    response_model=BookingResponse,
    summary="Update booking details and advance status through lifecycle",
)
def update_booking(
    booking_id: int,
    payload: BookingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Update booking properties and validate status transitions."""
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

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_farmer = booking.service_request.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == booking.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    op_record = db.execute(
        select(Operator).where(Operator.user_id == current_user.id)
    ).scalar_one_or_none()
    is_assigned_operator = op_record and booking.operator_id == op_record.id

    if not (is_superadmin or is_farmer or is_chc_manager or is_assigned_operator):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to modify this booking",
        )

    # Validate status transition if provided
    if payload.status is not None:
        target_status = payload.status.strip().upper()
        current_status = booking.status.upper()

        if target_status != current_status:
            allowed_next = VALID_BOOKING_TRANSITIONS.get(current_status, set())
            if target_status not in allowed_next:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Invalid status transition from {current_status} to {target_status}. "
                        f"Allowed transitions: {', '.join(sorted(allowed_next)) or 'None'}"
                    ),
                )

            # Restrict farmer to CANCELLED only
            if is_farmer and not (is_superadmin or is_chc_manager):
                if target_status != "CANCELLED":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Farmers can only transition bookings to CANCELLED",
                    )

            booking.status = target_status

    # Role-based property updates: only managers and superadmins can reassign resources/dates
    if is_chc_manager or is_superadmin:
        if payload.machine_id is not None:
            machine = db.execute(
                select(Machine).where(Machine.id == payload.machine_id)
            ).scalar_one_or_none()
            if not machine:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Machine {payload.machine_id} not found",
                )
            if machine.chc_id != booking.chc_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Machine {payload.machine_id} does not belong to CHC {booking.chc_id}",
                )
            booking.machine_id = payload.machine_id

        if payload.operator_id is not None:
            operator = db.execute(
                select(Operator).where(Operator.id == payload.operator_id)
            ).scalar_one_or_none()
            if not operator:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Operator {payload.operator_id} not found",
                )
            if operator.chc_id != booking.chc_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Operator {payload.operator_id} does not belong to CHC {booking.chc_id}"
                    ),
                )
            booking.operator_id = payload.operator_id

        if payload.scheduled_date is not None:
            booking.scheduled_date = payload.scheduled_date
        if payload.scheduled_slot is not None:
            booking.scheduled_slot = payload.scheduled_slot.strip().upper()
        if payload.total_cost is not None:
            booking.total_cost = payload.total_cost
        if payload.payment_status is not None:
            booking.payment_status = payload.payment_status.strip().upper()

    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)


@router.post(
    "/{booking_id}/cancel",
    response_model=BookingResponse,
    summary="Cancel a booking",
)
def cancel_booking(
    booking_id: int,
    payload: BookingCancelRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """Cancel a booking in PENDING, SCHEDULED, or CONFIRMED state."""
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

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_farmer = booking.service_request.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == booking.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    if not (is_superadmin or is_farmer or is_chc_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to cancel this booking",
        )

    if booking.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a booking in {booking.status} status",
        )

    booking.status = "CANCELLED"
    db.commit()
    db.refresh(booking)
    return serialize_booking(booking)
