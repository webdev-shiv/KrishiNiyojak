"""Breakdown Reporting, Impact Analysis, and Customer Priority Service (T12)."""

from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import verify_chc_manager_access
from app.core.config import settings
from app.models.availability import MachineAvailability
from app.models.booking import Booking, ServiceRequest
from app.models.identity import User
from app.models.recovery import BookingPriority, MachineBreakdown
from app.models.resource import Machine
from app.schemas.recovery import (
    AffectedBookingImpact,
    BreakdownCreateRequest,
    BreakdownImpactResponse,
)


def calculate_booking_priority(
    booking: Booking,
    breakdown_severity: str,
    expected_repair_hours: float,
) -> tuple[int, str, str, bool, int | None, list[str]]:
    """Compute transparent customer priority score and delay risk metrics for an affected booking.

    Returns:
        tuple of (
            priority_score, agronomic_urgency, delay_risk,
            missed_deadline_risk, buffer_days, priority_reasons
        )
    """
    reasons: list[str] = []
    sr: ServiceRequest | None = booking.service_request

    # 1. Deadline Urgency component (Max 40 points)
    deadline: date | None = sr.requested_end_date if sr else None
    buffer_days: int | None = None
    urgency_points: float = 0.0

    if deadline is not None:
        buffer_days = (deadline - booking.scheduled_date).days
        if buffer_days < 0:
            urgency_points = 40.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"Deadline elapsed: Booking is {abs(buffer_days)} day(s) past requested deadline "
                f"({urgency_points:.1f} pts)."
            )
        elif buffer_days == 0:
            urgency_points = 36.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"Critical deadline: Scheduled on exact deadline date with 0 days buffer "
                f"({urgency_points:.1f} pts)."
            )
        elif buffer_days == 1:
            urgency_points = 30.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"High deadline urgency: Only 1 day buffer remaining before deadline "
                f"({urgency_points:.1f} pts)."
            )
        elif buffer_days == 2:
            urgency_points = 22.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"Moderate deadline urgency: 2 days buffer before deadline "
                f"({urgency_points:.1f} pts)."
            )
        elif buffer_days in (3, 4):
            urgency_points = 15.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"Low deadline urgency: {buffer_days} days buffer before deadline "
                f"({urgency_points:.1f} pts)."
            )
        else:
            urgency_points = 8.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
            reasons.append(
                f"Minimal deadline urgency: {buffer_days} days buffer before deadline "
                f"({urgency_points:.1f} pts)."
            )
    else:
        # Documented baseline default when deadline is missing
        urgency_points = 15.0 * (settings.PRIORITY_WEIGHT_URGENCY / 0.40)
        reasons.append("Deadline unspecified: Applied default baseline buffer (15.0 pts).")

    # 2. Job Criticality component (Max 25 points)
    op: str = sr.operation_type.upper() if sr and sr.operation_type else "UNKNOWN"
    criticality_points: float = 0.0

    if op in ("SOWING", "PLANTING"):
        criticality_points = 25.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation '{op}' has critical biological window to prevent germination failure "
            f"({criticality_points:.1f} pts)."
        )
    elif op in ("HARVESTING", "COMBINE"):
        criticality_points = 23.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation '{op}' is agronomically sensitive to avoid post-maturity weather loss "
            f"({criticality_points:.1f} pts)."
        )
    elif op in ("SPRAYING", "FERTILIZING"):
        criticality_points = 20.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation '{op}' has strict intervention timeline for pest and disease suppression "
            f"({criticality_points:.1f} pts)."
        )
    elif op in ("PLOWING", "TILLAGE", "LAND_PREP"):
        criticality_points = 14.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation '{op}' has standard operational scheduling tolerance "
            f"({criticality_points:.1f} pts)."
        )
    elif op == "UNKNOWN":
        criticality_points = 12.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation type unspecified: Applied default baseline criticality "
            f"({criticality_points:.1f} pts)."
        )
    else:
        criticality_points = 10.0 * (settings.PRIORITY_WEIGHT_CRITICALITY / 0.25)
        reasons.append(
            f"Operation '{op}' has general agricultural utility priority "
            f"({criticality_points:.1f} pts)."
        )

    # 3. Expected Delay & Breakdown Severity component (Max 20 points)
    repair_days = expected_repair_hours / 24.0
    sev = breakdown_severity.upper()
    delay_points: float = 0.0

    if sev == "CRITICAL":
        delay_points = 20.0 * (settings.PRIORITY_WEIGHT_DELAY_RISK / 0.20)
        reasons.append(
            f"Major failure ({sev}): Estimated downtime {expected_repair_hours:.1f}h "
            f"({delay_points:.1f} pts)."
        )
    elif sev == "MEDIUM":
        delay_points = 14.0 * (settings.PRIORITY_WEIGHT_DELAY_RISK / 0.20)
        reasons.append(
            f"Moderate failure ({sev}): Estimated downtime {expected_repair_hours:.1f}h "
            f"({delay_points:.1f} pts)."
        )
    elif sev == "LOW":
        delay_points = 8.0 * (settings.PRIORITY_WEIGHT_DELAY_RISK / 0.20)
        reasons.append(
            f"Minor failure ({sev}): Estimated downtime {expected_repair_hours:.1f}h "
            f"({delay_points:.1f} pts)."
        )
    else:
        delay_points = 14.0 * (settings.PRIORITY_WEIGHT_DELAY_RISK / 0.20)
        reasons.append(
            f"Failure severity '{breakdown_severity}' unspecified: Applied MEDIUM baseline "
            f"({delay_points:.1f} pts)."
        )

    # Delay Risk & Missed Deadline evaluation
    missed_deadline_risk = False
    delay_risk = "LOW"

    if buffer_days is not None:
        if repair_days >= buffer_days:
            missed_deadline_risk = True
            delay_risk = "CRITICAL" if buffer_days <= 0 else "HIGH"
        elif (repair_days + 1.0) >= buffer_days:
            delay_risk = "MEDIUM"
        else:
            delay_risk = "LOW"
    else:
        if sev == "CRITICAL":
            delay_risk = "HIGH"
        elif sev == "MEDIUM":
            delay_risk = "MEDIUM"
        else:
            delay_risk = "LOW"

    # 4. Acreage / Scale of Impact component (Max 15 points)
    acreage = sr.acreage if sr and sr.acreage is not None else None
    acreage_points: float = 0.0

    if acreage is None or acreage <= 0:
        acreage_points = 9.0 * (settings.PRIORITY_WEIGHT_ACREAGE / 0.15)
        reasons.append(
            f"Acreage unspecified: Applied baseline default of "
            f"{settings.DEFAULT_ACREAGE_BASELINE:.1f} acres ({acreage_points:.1f} pts)."
        )
    elif acreage >= 20.0:
        acreage_points = 15.0 * (settings.PRIORITY_WEIGHT_ACREAGE / 0.15)
        reasons.append(
            f"Large farm acreage ({acreage:.1f} ac >= 20.0 ac): High economic exposure "
            f"({acreage_points:.1f} pts)."
        )
    elif acreage >= 10.0:
        acreage_points = 12.0 * (settings.PRIORITY_WEIGHT_ACREAGE / 0.15)
        reasons.append(
            f"Medium-large acreage ({acreage:.1f} ac): Significant operational scale "
            f"({acreage_points:.1f} pts)."
        )
    elif acreage >= 5.0:
        acreage_points = 9.0 * (settings.PRIORITY_WEIGHT_ACREAGE / 0.15)
        reasons.append(
            f"Standard parcel acreage ({acreage:.1f} ac): Moderate scale "
            f"({acreage_points:.1f} pts)."
        )
    else:
        acreage_points = 6.0 * (settings.PRIORITY_WEIGHT_ACREAGE / 0.15)
        reasons.append(
            f"Smallholder parcel ({acreage:.1f} ac < 5.0 ac): Local parcel scale "
            f"({acreage_points:.1f} pts)."
        )

    # Total Score calculation (1 to 100)
    raw_score = urgency_points + criticality_points + delay_points + acreage_points
    priority_score = max(1, min(100, int(round(raw_score))))

    # Agronomic urgency classification
    if priority_score >= 80 or delay_risk == "CRITICAL":
        agronomic_urgency = "CRITICAL"
    elif priority_score >= 65 or delay_risk == "HIGH":
        agronomic_urgency = "HIGH"
    elif priority_score >= 45 or delay_risk == "MEDIUM":
        agronomic_urgency = "MEDIUM"
    else:
        agronomic_urgency = "LOW"

    return (
        priority_score,
        agronomic_urgency,
        delay_risk,
        missed_deadline_risk,
        buffer_days,
        reasons,
    )


def get_affected_bookings_query(machine_id: int, breakdown_date: date):
    """Build SQLAlchemy query to identify all bookings dependent on the broken machine.

    Includes current-day and future scheduled jobs.
    Strictly excludes CANCELLED and COMPLETED bookings.
    """
    return (
        select(Booking)
        .options(
            selectinload(Booking.service_request).selectinload(ServiceRequest.farmer),
            selectinload(Booking.machine),
            selectinload(Booking.operator),
            selectinload(Booking.priority),
        )
        .where(
            Booking.machine_id == machine_id,
            Booking.scheduled_date >= breakdown_date,
            Booking.status.not_in(["CANCELLED", "COMPLETED"]),
        )
        .order_by(Booking.scheduled_date.asc())
    )


def report_breakdown_and_analyze(
    db: Session,
    payload: BreakdownCreateRequest,
    current_user: User,
) -> BreakdownImpactResponse:
    """Report machine breakdown, update machine and availability status,

    and compute impact analysis.
    """
    # 1. Fetch machine and verify CHC manager access
    machine = db.execute(
        select(Machine).options(selectinload(Machine.chc)).where(Machine.id == payload.machine_id)
    ).scalar_one_or_none()

    if not machine:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {payload.machine_id} not found",
        )

    verify_chc_manager_access(current_user, machine.chc_id)

    # 2. Parse breakdown time and defaults
    reported_at = payload.reported_at or datetime.now(UTC)
    breakdown_date = payload.reported_at.date() if payload.reported_at else date.today()

    severity = payload.severity.upper() if payload.severity else "MEDIUM"
    if payload.expected_repair_hours is not None:
        expected_repair_hours = payload.expected_repair_hours
    elif severity == "CRITICAL":
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_CRITICAL
    elif severity == "LOW":
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_LOW
    else:
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_MEDIUM

    # 3. Find affected bookings (excluding CANCELLED and COMPLETED)
    affected_bookings_db = (
        db.execute(get_affected_bookings_query(machine.id, breakdown_date)).scalars().all()
    )

    # Link active booking if requested or if one is currently in progress / scheduled today
    linked_booking_id = payload.booking_id
    if linked_booking_id is None:
        today_booking = next(
            (
                b
                for b in affected_bookings_db
                if b.scheduled_date == breakdown_date and b.status in ("IN_PROGRESS", "SCHEDULED")
            ),
            None,
        )
        if today_booking:
            linked_booking_id = today_booking.id

    # 4. Create MachineBreakdown record
    breakdown = MachineBreakdown(
        machine_id=machine.id,
        booking_id=linked_booking_id,
        reported_by_id=current_user.id,
        reported_at=reported_at,
        failure_type=payload.failure_type.upper(),
        severity=severity,
        description=payload.description,
        field_latitude=payload.field_latitude,
        field_longitude=payload.field_longitude,
        status="REPORTED",
    )
    db.add(breakdown)
    db.flush()

    # 5. Update Machine status to BROKEN_DOWN
    machine.status = "BROKEN_DOWN"

    # 6. Block machine's future availability slots
    future_slots = (
        db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == machine.id,
                MachineAvailability.slot_date >= breakdown_date,
            )
        )
        .scalars()
        .all()
    )

    for slot in future_slots:
        slot.status = "BLOCKED_MAINTENANCE"
        slot.note = f"Blocked: Breakdown #{breakdown.id} ({breakdown.failure_type})"

    # 7. Evaluate impact and customer priority for each affected booking
    affected_items: list[AffectedBookingImpact] = []
    total_acreage = 0.0
    crit_count = 0
    high_count = 0
    med_count = 0
    low_count = 0
    missed_count = 0

    for b in affected_bookings_db:
        # Mark active or scheduled bookings as DISRUPTED
        if b.status in ("SCHEDULED", "IN_PROGRESS", "PENDING"):
            b.status = "DISRUPTED"

        (
            score,
            urgency,
            delay_risk,
            missed_deadline,
            buffer_days,
            reasons,
        ) = calculate_booking_priority(
            booking=b,
            breakdown_severity=severity,
            expected_repair_hours=expected_repair_hours,
        )

        # Upsert BookingPriority in database
        priority_record = db.execute(
            select(BookingPriority).where(BookingPriority.booking_id == b.id)
        ).scalar_one_or_none()

        if priority_record:
            priority_record.priority_score = score
            priority_record.agronomic_urgency = urgency
        else:
            priority_record = BookingPriority(
                booking_id=b.id,
                priority_score=score,
                agronomic_urgency=urgency,
            )
            db.add(priority_record)

        sr = b.service_request
        farmer = sr.farmer if sr else None
        farmer_name = farmer.full_name if farmer else "Unknown Farmer"
        farmer_phone = farmer.phone_number if farmer else None
        acreage_val = sr.acreage if sr else None

        if acreage_val:
            total_acreage += acreage_val

        if urgency == "CRITICAL":
            crit_count += 1
        elif urgency == "HIGH":
            high_count += 1
        elif urgency == "MEDIUM":
            med_count += 1
        else:
            low_count += 1

        if missed_deadline:
            missed_count += 1

        affected_items.append(
            AffectedBookingImpact(
                booking_id=b.id,
                booking_code=b.booking_code,
                service_request_id=b.service_request_id,
                farmer_id=farmer.id if farmer else 0,
                farmer_name=farmer_name,
                farmer_phone=farmer_phone,
                operation_type=sr.operation_type if sr else "UNKNOWN",
                crop_type=sr.crop_type if sr else None,
                acreage=acreage_val,
                scheduled_date=b.scheduled_date,
                scheduled_slot=b.scheduled_slot,
                deadline=sr.requested_end_date if sr else None,
                buffer_days=buffer_days,
                delay_risk=delay_risk,
                missed_deadline_risk=missed_deadline,
                priority_score=score,
                agronomic_urgency=urgency,
                priority_reasons=reasons,
                status=b.status,
            )
        )

    # Commit all state changes
    db.commit()

    # 8. Sort affected bookings in descending order of customer priority score
    # Tie-breaking: smaller buffer_days (more urgent), then earlier scheduled_date
    affected_items.sort(
        key=lambda item: (
            -item.priority_score,
            item.buffer_days if item.buffer_days is not None else 9999,
            item.scheduled_date,
        )
    )

    chc_name = machine.chc.name if machine.chc else f"CHC #{machine.chc_id}"

    return BreakdownImpactResponse(
        breakdown_id=breakdown.id,
        machine_id=machine.id,
        machine_registration=machine.registration_number,
        chc_id=machine.chc_id,
        chc_name=chc_name,
        failure_type=breakdown.failure_type,
        severity=breakdown.severity,
        description=breakdown.description,
        reported_at=breakdown.reported_at,
        status=breakdown.status,
        estimated_downtime_hours=expected_repair_hours,
        total_affected_bookings=len(affected_items),
        critical_priority_count=crit_count,
        high_priority_count=high_count,
        medium_priority_count=med_count,
        low_priority_count=low_count,
        missed_deadline_count=missed_count,
        total_affected_acreage=round(total_acreage, 2),
        affected_bookings=affected_items,
    )


def get_breakdown_impact_analysis(
    db: Session,
    breakdown_id: int,
    current_user: User,
) -> BreakdownImpactResponse:
    """Retrieve impact analysis and customer priority queue for an existing breakdown incident."""
    breakdown = db.execute(
        select(MachineBreakdown)
        .options(selectinload(MachineBreakdown.machine).selectinload(Machine.chc))
        .where(MachineBreakdown.id == breakdown_id)
    ).scalar_one_or_none()

    if not breakdown:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Breakdown with ID {breakdown_id} not found",
        )

    verify_chc_manager_access(current_user, breakdown.machine.chc_id)

    severity = breakdown.severity.upper() if breakdown.severity else "MEDIUM"
    if severity == "CRITICAL":
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_CRITICAL
    elif severity == "LOW":
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_LOW
    else:
        expected_repair_hours = settings.DEFAULT_REPAIR_HOURS_MEDIUM

    breakdown_date = breakdown.reported_at.date()

    affected_bookings_db = (
        db.execute(get_affected_bookings_query(breakdown.machine_id, breakdown_date))
        .scalars()
        .all()
    )

    affected_items: list[AffectedBookingImpact] = []
    total_acreage = 0.0
    crit_count = 0
    high_count = 0
    med_count = 0
    low_count = 0
    missed_count = 0

    for b in affected_bookings_db:
        (
            score,
            urgency,
            delay_risk,
            missed_deadline,
            buffer_days,
            reasons,
        ) = calculate_booking_priority(
            booking=b,
            breakdown_severity=severity,
            expected_repair_hours=expected_repair_hours,
        )

        sr = b.service_request
        farmer = sr.farmer if sr else None
        farmer_name = farmer.full_name if farmer else "Unknown Farmer"
        farmer_phone = farmer.phone_number if farmer else None
        acreage_val = sr.acreage if sr else None

        if acreage_val:
            total_acreage += acreage_val

        if urgency == "CRITICAL":
            crit_count += 1
        elif urgency == "HIGH":
            high_count += 1
        elif urgency == "MEDIUM":
            med_count += 1
        else:
            low_count += 1

        if missed_deadline:
            missed_count += 1

        affected_items.append(
            AffectedBookingImpact(
                booking_id=b.id,
                booking_code=b.booking_code,
                service_request_id=b.service_request_id,
                farmer_id=farmer.id if farmer else 0,
                farmer_name=farmer_name,
                farmer_phone=farmer_phone,
                operation_type=sr.operation_type if sr else "UNKNOWN",
                crop_type=sr.crop_type if sr else None,
                acreage=acreage_val,
                scheduled_date=b.scheduled_date,
                scheduled_slot=b.scheduled_slot,
                deadline=sr.requested_end_date if sr else None,
                buffer_days=buffer_days,
                delay_risk=delay_risk,
                missed_deadline_risk=missed_deadline,
                priority_score=score,
                agronomic_urgency=urgency,
                priority_reasons=reasons,
                status=b.status,
            )
        )

    # Sort descending by priority score
    affected_items.sort(
        key=lambda item: (
            -item.priority_score,
            item.buffer_days if item.buffer_days is not None else 9999,
            item.scheduled_date,
        )
    )

    machine = breakdown.machine
    chc_name = machine.chc.name if machine and machine.chc else f"CHC #{breakdown.machine.chc_id}"

    return BreakdownImpactResponse(
        breakdown_id=breakdown.id,
        machine_id=breakdown.machine_id,
        machine_registration=machine.registration_number if machine else "Unknown",
        chc_id=breakdown.machine.chc_id,
        chc_name=chc_name,
        failure_type=breakdown.failure_type,
        severity=breakdown.severity,
        description=breakdown.description,
        reported_at=breakdown.reported_at,
        status=breakdown.status,
        estimated_downtime_hours=expected_repair_hours,
        total_affected_bookings=len(affected_items),
        critical_priority_count=crit_count,
        high_priority_count=high_count,
        medium_priority_count=med_count,
        low_priority_count=low_count,
        missed_deadline_count=missed_count,
        total_affected_acreage=round(total_acreage, 2),
        affected_bookings=affected_items,
    )


def list_breakdowns_for_user(
    db: Session,
    current_user: User,
    chc_id: int | None = None,
    machine_id: int | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[MachineBreakdown], int]:
    """List breakdowns with tenant authorization checks and filtering."""
    # Determine allowed CHCs
    user_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_roles

    managed_chc_ids: set[int] = set()
    for m in current_user.chc_memberships:
        if m.is_active and m.role.upper() == "MANAGER":
            managed_chc_ids.add(m.chc_id)

    query = select(MachineBreakdown).join(MachineBreakdown.machine)

    if chc_id is not None:
        verify_chc_manager_access(current_user, chc_id)
        query = query.where(Machine.chc_id == chc_id)
    elif not is_superadmin:
        if not managed_chc_ids:
            return [], 0
        query = query.where(Machine.chc_id.in_(managed_chc_ids))

    if machine_id is not None:
        query = query.where(MachineBreakdown.machine_id == machine_id)

    if status_filter is not None:
        query = query.where(MachineBreakdown.status == status_filter.upper())

    total = len(db.execute(query).scalars().all())
    items = (
        db.execute(query.order_by(MachineBreakdown.reported_at.desc()).offset(skip).limit(limit))
        .scalars()
        .all()
    )
    return list(items), total
