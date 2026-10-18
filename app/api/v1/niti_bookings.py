"""NITI Transactional Booking Creation, Role-Isolated Listing, and Live Status Progression."""

import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_active_user, get_db
from app.models.availability import MachineAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import User
from app.models.niti_extensions import BookingStatusEvent
from app.models.resource import Machine, Operator
from app.schemas.niti import (
    BookingStatusEventResponse,
    NitiBookingCreateRequest,
    NitiBookingDetailResponse,
)

router = APIRouter(prefix="/bookings/niti", tags=["NITI Bookings & Live Tracking"])


def _generate_booking_code() -> str:
    rnd = random.randint(1000, 9999)
    return f"NITI-{date.today().year}-{rnd}"


@router.post("/create", response_model=NitiBookingDetailResponse, summary="Create confirmed booking from offer")
def create_niti_booking(
    payload: NitiBookingCreateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> NitiBookingDetailResponse:
    """Create an operational booking for an agricultural machine offer with conflict checking."""
    # Query target machine
    machine = db.execute(
        select(Machine)
        .options(selectinload(Machine.chc))
        .where(Machine.id == payload.offer_id)
    ).scalar_one_or_none()

    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine offer #{payload.offer_id} not found",
        )

    chc_id = machine.chc_id

    # Check for active conflicting bookings on same machine, date, and slot
    conflict = db.execute(
        select(Booking).where(
            Booking.machine_id == machine.id,
            Booking.scheduled_date == payload.scheduled_date,
            Booking.scheduled_slot == payload.scheduled_slot,
            Booking.status.in_(["SCHEDULED", "IN_PROGRESS", "CONFIRMED"]),
        )
    ).scalar_one_or_none()

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Machine {machine.make} {machine.model} is already booked for {payload.scheduled_date} ({payload.scheduled_slot}). Please select an alternate date or machine.",
        )

    # Compute total cost
    rate = machine.hourly_rate if machine.hourly_rate else Decimal("350.00")
    total_cost = rate * Decimal(str(payload.acreage))

    # Create ServiceRequest
    sr = ServiceRequest(
        chc_id=chc_id,
        farmer_id=current_user.id,
        field_latitude=payload.field_latitude,
        field_longitude=payload.field_longitude,
        acreage=payload.acreage,
        operation_type=payload.operation_type,
        crop_type=payload.crop_type,
        requested_start_date=payload.scheduled_date,
        requested_end_date=payload.scheduled_date + timedelta(days=1),
        estimated_cost=total_cost,
        status="APPROVED",
    )
    db.add(sr)
    db.flush()

    # Assign default available operator from this CHC if available
    operator = db.execute(
        select(Operator).where(Operator.chc_id == chc_id, Operator.status == "AVAILABLE")
    ).scalars().first()

    booking_code = _generate_booking_code()
    booking = Booking(
        service_request_id=sr.id,
        chc_id=chc_id,
        machine_id=machine.id,
        operator_id=operator.id if operator else None,
        booking_code=booking_code,
        scheduled_date=payload.scheduled_date,
        scheduled_slot=payload.scheduled_slot,
        status="CONFIRMED",
        total_cost=total_cost,
        payment_status="PENDING",
    )
    db.add(booking)
    db.flush()

    # Lock machine availability
    db.add(
        MachineAvailability(
            machine_id=machine.id,
            slot_date=payload.scheduled_date,
            slot_type=payload.scheduled_slot,
            status="BOOKED",
        )
    )

    # Initial Live Updates Event
    initial_event = BookingStatusEvent(
        booking_id=booking.id,
        status="CONFIRMED",
        title="बुकिंग कन्फर्म हो गई (Booking Confirmed)",
        description=f"{machine.chc.name if machine.chc else 'CHC'} ने आपकी {payload.acreage} एकड़ {payload.operation_type} की रिक्वेस्ट स्वीकार कर ली है।",
        actor_role="SYSTEM",
        created_at=datetime.now(UTC),
    )
    db.add(initial_event)
    db.commit()

    return _build_booking_detail_response(db, booking.id)


@router.get("/my-bookings", response_model=list[NitiBookingDetailResponse], summary="List role-scoped bookings")
def get_my_bookings(
    status_filter: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> list[NitiBookingDetailResponse]:
    """Retrieve bookings accessible to authenticated user based on role boundaries."""
    roles = [ur.role.name.upper() for ur in current_user.user_roles if ur.role]
    for m in current_user.chc_memberships:
        if m.is_active:
            roles.append(m.role.upper())

    query = select(Booking).options(
        selectinload(Booking.service_request).selectinload(ServiceRequest.farmer),
        selectinload(Booking.chc),
        selectinload(Booking.machine),
        selectinload(Booking.operator),
    )

    if "SUPERADMIN" in roles:
        pass  # sees all
    elif "CHC_MANAGER" in roles or "MANAGER" in roles:
        # CHC manager sees bookings for their managed CHCs
        chc_ids = [m.chc_id for m in current_user.chc_memberships if m.is_active]
        if chc_ids:
            query = query.where(Booking.chc_id.in_(chc_ids))
        else:
            query = query.where(Booking.service_request.has(farmer_id=current_user.id))
    elif "OPERATOR" in roles:
        # Operator sees jobs assigned to them
        op_rec = db.execute(select(Operator).where(Operator.user_id == current_user.id)).scalar_one_or_none()
        if op_rec:
            query = query.where(Booking.operator_id == op_rec.id)
        else:
            query = query.where(Booking.service_request.has(farmer_id=current_user.id))
    else:
        # Farmer sees their own bookings
        query = query.where(Booking.service_request.has(farmer_id=current_user.id))

    if status_filter:
        query = query.where(Booking.status == status_filter.upper())

    query = query.order_by(Booking.scheduled_date.desc(), Booking.id.desc())
    bookings = db.execute(query).scalars().all()

    return [_build_booking_detail_response(db, b.id) for b in bookings]


@router.post("/{booking_id}/status", response_model=NitiBookingDetailResponse, summary="Update booking status progression")
def update_booking_status(
    booking_id: int,
    new_status: str,
    note: str | None = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> NitiBookingDetailResponse:
    """Transition booking lifecycle state: CONFIRMED -> ASSIGNED -> TRAVELLING -> ARRIVED -> WORKING -> COMPLETED."""
    booking = db.execute(
        select(Booking)
        .options(
            selectinload(Booking.service_request).selectinload(ServiceRequest.farmer),
            selectinload(Booking.machine),
            selectinload(Booking.chc),
            selectinload(Booking.operator),
        )
        .where(Booking.id == booking_id)
    ).scalar_one_or_none()

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    status_upper = new_status.upper()
    booking.status = status_upper

    status_titles = {
        "CONFIRMED": "बुकिंग कन्फर्म हो गई (Booking Confirmed)",
        "ASSIGNED": "मशीन और ऑपरेटर नियुक्त (Machine & Operator Assigned)",
        "TRAVELLING": "ऑपरेटर खेत के लिए रवाना (Operator En Route)",
        "ARRIVED": "ऑपरेटर खेत पर पहुँच गया (Arrived at Farm)",
        "WORKING": "खेत में काम शुरू (Work in Progress)",
        "COMPLETED": "काम सफलतापूर्वक संपन्न (Work Completed)",
        "CANCELLED": "बुकिंग रद्द (Booking Cancelled)",
        "DISRUPTED": "मशीन खराबी / रुकावट (Breakdown Reported)",
    }

    title = status_titles.get(status_upper, f"Status: {status_upper}")
    desc = note or f"बुकिंग स्टेटस बदलकर {status_upper} कर दिया गया है।"

    event = BookingStatusEvent(
        booking_id=booking.id,
        status=status_upper,
        title=title,
        description=desc,
        actor_role="OPERATOR",
        created_at=datetime.now(UTC),
    )
    db.add(event)
    db.commit()

    return _build_booking_detail_response(db, booking.id)


def _build_booking_detail_response(db: Session, booking_id: int) -> NitiBookingDetailResponse:
    booking = db.execute(
        select(Booking)
        .options(
            selectinload(Booking.service_request).selectinload(ServiceRequest.farmer),
            selectinload(Booking.chc),
            selectinload(Booking.machine),
            selectinload(Booking.operator).selectinload(Operator.user),
        )
        .where(Booking.id == booking_id)
    ).scalar_one()

    # Load events
    events = db.execute(
        select(BookingStatusEvent)
        .where(BookingStatusEvent.booking_id == booking_id)
        .order_by(BookingStatusEvent.created_at.desc())
    ).scalars().all()

    sr = booking.service_request
    farmer = sr.farmer if sr else None
    machine = booking.machine
    operator = booking.operator
    op_name = operator.user.full_name if (operator and operator.user) else None
    op_phone = operator.user.phone_number if (operator and operator.user) else None

    return NitiBookingDetailResponse(
        id=booking.id,
        booking_code=booking.booking_code,
        service_request_id=booking.service_request_id,
        chc_id=booking.chc_id,
        chc_name=booking.chc.name if booking.chc else "Kisan Seva Kendra CHC",
        farmer_id=farmer.id if farmer else 1,
        farmer_name=farmer.full_name if farmer else "Farmer",
        farmer_phone=farmer.phone_number if farmer else None,
        machine_id=machine.id if machine else None,
        machine_name=f"{machine.make} {machine.model}" if machine else None,
        machine_category=machine.category if machine else None,
        operator_id=operator.id if operator else None,
        operator_name=op_name,
        operator_phone=op_phone,
        operation_type=sr.operation_type if sr else "AGRICULTURE",
        crop_type=sr.crop_type if sr else "Wheat",
        acreage=sr.acreage if sr else 5.0,
        scheduled_date=booking.scheduled_date,
        scheduled_slot=booking.scheduled_slot,
        total_cost=booking.total_cost,
        payment_status=booking.payment_status,
        status=booking.status,
        created_at=booking.created_at,
        events=[BookingStatusEventResponse.model_validate(ev) for ev in events],
    )
