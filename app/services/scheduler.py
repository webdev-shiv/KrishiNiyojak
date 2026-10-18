"""Schedule Generation and Manager Approval service engine (T11).

Provides business logic to:
- Identify eligible demand from approved service requests and pending bookings.
- Match compatible machinery, implements, and certified operators.
- Evaluate candidate assignments across dates and slots using the T10 Feasibility Checker.
- Prevent intra-schedule assignment collisions across candidate jobs.
- Produce non-destructive candidate schedules for CHC manager review.
- Atomically apply approved schedule changes to operational bookings and availability slots.
- Provide concurrency conflict detection and duplicate approval prevention.
"""

import uuid
from datetime import date, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import verify_chc_manager_access
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC
from app.models.identity import User
from app.models.resource import Attachment, Machine, Operator
from app.models.supporting import AuditLog
from app.schemas.scheduling import (
    CandidateAssignmentResponse,
    ScheduleResponse,
    UnscheduledJobResponse,
)
from app.services.feasibility import evaluate_feasibility, slots_overlap
from app.services.schedule_store import schedule_store

# Mapping typical operation types to compatible attachment categories
OPERATION_ATTACHMENT_CATEGORIES: dict[str, list[str]] = {
    "PLOWING": ["PLOW", "ROTAVATOR"],
    "SOWING": ["SEEDER", "ROTAVATOR"],
    "HARVESTING": ["HARVESTER_HEADER"],
    "SPRAYING": ["SPRAY_BOOM"],
}


class _EligibleJob:
    """Internal lightweight representation of demand to schedule."""

    def __init__(
        self,
        service_request_id: int,
        booking_id: int | None,
        farmer_id: int,
        operation_type: str,
        acreage: float,
        field_latitude: float,
        field_longitude: float,
        requested_start_date: date,
        requested_end_date: date,
        existing_attachment_ids: list[int] | None = None,
        selected_machine_id: int | None = None,
        selected_date: date | None = None,
        selected_slot: str | None = None,
    ) -> None:
        self.service_request_id = service_request_id
        self.booking_id = booking_id
        self.farmer_id = farmer_id
        self.operation_type = operation_type
        self.acreage = acreage
        self.field_latitude = field_latitude
        self.field_longitude = field_longitude
        self.requested_start_date = requested_start_date
        self.requested_end_date = requested_end_date
        self.existing_attachment_ids = existing_attachment_ids or []
        self.selected_machine_id = selected_machine_id
        self.selected_date = selected_date
        self.selected_slot = selected_slot


def generate_candidate_schedule(
    db: Session,
    chc_id: int,
    created_by_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
    service_request_ids: list[int] | None = None,
    booking_ids: list[int] | None = None,
) -> ScheduleResponse:
    """Generate a non-destructive candidate schedule for eligible demand in a CHC.

    Evaluates feasibility of matching available machinery, operators, and implements
    without modifying database records or confirmed bookings.
    """
    chc = db.execute(select(CHC).where(CHC.id == chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Custom Hiring Centre with ID {chc_id} not found",
        )
    if chc.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot generate schedule: CHC '{chc.name}' is currently {chc.status}",
        )

    # 1. Collect eligible jobs
    eligible_jobs: list[_EligibleJob] = []

    # A. Approved Service Requests without active non-cancelled bookings
    sr_query = select(ServiceRequest).where(
        ServiceRequest.chc_id == chc_id,
        ServiceRequest.status == "APPROVED",
    )
    if service_request_ids:
        sr_query = sr_query.where(ServiceRequest.id.in_(service_request_ids))

    service_requests = db.execute(sr_query).scalars().all()
    for sr in service_requests:
        # Check if already booked
        active_booking = db.execute(
            select(Booking).where(
                Booking.service_request_id == sr.id,
                Booking.status.notin_(["CANCELLED"]),
            )
        ).scalar_one_or_none()

        if active_booking is None:
            eligible_jobs.append(
                _EligibleJob(
                    service_request_id=sr.id,
                    booking_id=None,
                    farmer_id=sr.farmer_id,
                    operation_type=sr.operation_type,
                    acreage=sr.acreage,
                    field_latitude=sr.field_latitude,
                    field_longitude=sr.field_longitude,
                    requested_start_date=sr.requested_start_date,
                    requested_end_date=sr.requested_end_date,
                    selected_machine_id=sr.selected_machine_id,
                    selected_date=sr.selected_date,
                    selected_slot=sr.selected_slot,
                )
            )

    # B. Pending bookings (if requested or available)
    bk_query = select(Booking).where(
        Booking.chc_id == chc_id,
        Booking.status == "PENDING",
    )
    if booking_ids:
        bk_query = bk_query.where(Booking.id.in_(booking_ids))

    pending_bookings = db.execute(bk_query).scalars().all()
    for bk in pending_bookings:
        sr = bk.service_request
        if sr:
            att_ids = [ba.attachment_id for ba in bk.booking_attachments]
            eligible_jobs.append(
                _EligibleJob(
                    service_request_id=sr.id,
                    booking_id=bk.id,
                    farmer_id=sr.farmer_id,
                    operation_type=sr.operation_type,
                    acreage=sr.acreage,
                    field_latitude=sr.field_latitude,
                    field_longitude=sr.field_longitude,
                    requested_start_date=sr.requested_start_date,
                    requested_end_date=sr.requested_end_date,
                    existing_attachment_ids=att_ids,
                    selected_machine_id=sr.selected_machine_id or bk.machine_id,
                    selected_date=sr.selected_date or bk.scheduled_date,
                    selected_slot=sr.selected_slot or bk.scheduled_slot,
                )
            )

    # Sort jobs by earliest deadline first (Earliest Deadline First policy)
    eligible_jobs.sort(key=lambda j: (j.requested_end_date, j.requested_start_date))

    # 2. Query available resources belonging to this CHC
    available_machines = (
        db.execute(
            select(Machine).where(
                Machine.chc_id == chc_id,
                Machine.status == "AVAILABLE",
            )
        )
        .scalars()
        .all()
    )

    available_operators = (
        db.execute(
            select(Operator).where(
                Operator.chc_id == chc_id,
                Operator.status == "AVAILABLE",
            )
        )
        .scalars()
        .all()
    )

    available_attachments = (
        db.execute(
            select(Attachment).where(
                Attachment.chc_id == chc_id,
                Attachment.status == "AVAILABLE",
            )
        )
        .scalars()
        .all()
    )

    candidate_assignments: list[CandidateAssignmentResponse] = []
    unscheduled_jobs: list[UnscheduledJobResponse] = []

    # Intra-schedule tracking to avoid double-assigning within this proposed plan
    tentative_machine_slots: set[tuple[int, date, str]] = set()
    tentative_operator_slots: set[tuple[int, date, str]] = set()

    # 3. Schedule generation loop
    for job in eligible_jobs:
        job_scheduled = False
        job_reasons: list[str] = []
        attempted_evals = 0

        earliest = max(job.requested_start_date, start_date or job.requested_start_date)
        latest = min(job.requested_end_date, end_date or job.requested_end_date)

        if earliest > latest:
            unscheduled_jobs.append(
                UnscheduledJobResponse(
                    service_request_id=job.service_request_id,
                    booking_id=job.booking_id,
                    farmer_id=job.farmer_id,
                    acreage=job.acreage,
                    operation_type=job.operation_type,
                    reasons=[
                        f"Requested date window ({job.requested_start_date} to "
                        f"{job.requested_end_date}) falls outside scheduling horizon"
                    ],
                    attempted_evaluations=0,
                )
            )
            continue

        # Determine compatible implements
        target_categories = OPERATION_ATTACHMENT_CATEGORIES.get(job.operation_type.upper(), [])
        compatible_attachments = [
            a
            for a in available_attachments
            if a.category.upper() in target_categories or a.id in job.existing_attachment_ids
        ]

        # Authority Rule: If farmer explicitly selected a machine, evaluate ONLY that machine.
        # No silent substitution is allowed!
        if job.selected_machine_id is not None:
            candidate_machines = [m for m in available_machines if m.id == job.selected_machine_id]
            if not candidate_machines:
                job_reasons.append(
                    f"Selected machine (ID {job.selected_machine_id}) is currently unavailable in CHC fleet. "
                    "Farmer re-selection required."
                )
        else:
            candidate_machines = sorted(
                available_machines, key=lambda m: (m.horsepower, m.hourly_rate)
            )

        # Prioritize FULL_DAY for larger acreage (> 4 acres)
        preferred_slots = (
            ["FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"]
            if job.acreage > 4.0
            else ["HALF_DAY_MORNING", "HALF_DAY_AFTERNOON", "FULL_DAY"]
        )
        if job.selected_slot and job.selected_slot in preferred_slots:
            preferred_slots = [job.selected_slot] + [s for s in preferred_slots if s != job.selected_slot]

        # Iterate through target dates within requested window
        delta_days = (latest - earliest).days + 1
        dates_to_try = [earliest + date.resolution * d_offset for d_offset in range(delta_days)]
        if job.selected_date and job.selected_date in dates_to_try:
            dates_to_try.remove(job.selected_date)
            dates_to_try.insert(0, job.selected_date)

        for target_date in dates_to_try:
            for slot in preferred_slots:
                # Find compatible machine-operator combinations
                for machine in candidate_machines:
                    # Check intra-schedule machine conflict
                    m_collision = any(
                        m_id == machine.id and s_date == target_date and slots_overlap(slot, s_slot)
                        for (m_id, s_date, s_slot) in tentative_machine_slots
                    )
                    if m_collision:
                        continue

                    # Select compatible implement attachment
                    chosen_attachments: list[Attachment] = []
                    if compatible_attachments:
                        # Pick attachment with required HP <= machine HP
                        suitable_atts = [
                            a
                            for a in compatible_attachments
                            if a.required_hp_min <= machine.horsepower
                        ]
                        if suitable_atts:
                            chosen_attachments = [suitable_atts[0]]
                        else:
                            job_reasons.append(
                                f"Machine {machine.registration_number} ({machine.horsepower} HP) "
                                f"insufficient for required {job.operation_type} implements"
                            )
                            continue

                    for operator in sorted(
                        available_operators, key=lambda o: (o.hourly_rate, -o.experience_years)
                    ):
                        # Check intra-schedule operator conflict
                        o_collision = any(
                            o_id == operator.id
                            and s_date == target_date
                            and slots_overlap(slot, s_slot)
                            for (o_id, s_date, s_slot) in tentative_operator_slots
                        )
                        if o_collision:
                            continue

                        attempted_evals += 1
                        att_ids = [a.id for a in chosen_attachments]

                        # Evaluate feasibility via T10 Service Checker
                        eval_res = evaluate_feasibility(
                            db=db,
                            chc_id=chc_id,
                            scheduled_date=target_date,
                            scheduled_slot=slot,
                            service_request_id=job.service_request_id,
                            machine_id=machine.id,
                            operator_id=operator.id,
                            attachment_ids=att_ids,
                            field_latitude=job.field_latitude,
                            field_longitude=job.field_longitude,
                            acreage=job.acreage,
                            exclude_booking_id=job.booking_id,
                        )

                        if eval_res.feasible:
                            # Estimate cost
                            slot_hours = 8.0 if slot == "FULL_DAY" else 4.0
                            m_cost = machine.hourly_rate * Decimal(str(slot_hours))
                            o_cost = operator.hourly_rate * Decimal(str(slot_hours))
                            att_cost = sum(a.hourly_rate for a in chosen_attachments) * Decimal(
                                str(slot_hours)
                            )
                            total_cost = m_cost + o_cost + att_cost

                            candidate_assignments.append(
                                CandidateAssignmentResponse(
                                    service_request_id=job.service_request_id,
                                    booking_id=job.booking_id,
                                    machine_id=machine.id,
                                    machine_model=f"{machine.make} {machine.model}",
                                    operator_id=operator.id,
                                    operator_name=(
                                        operator.user.full_name
                                        if operator.user
                                        else f"Operator {operator.id}"
                                    ),
                                    attachment_ids=att_ids,
                                    scheduled_date=target_date,
                                    scheduled_slot=slot,
                                    estimated_cost=total_cost,
                                    feasible=True,
                                    warnings=eval_res.warnings,
                                    constraints=eval_res.constraints,
                                )
                            )

                            tentative_machine_slots.add((machine.id, target_date, slot))
                            tentative_operator_slots.add((operator.id, target_date, slot))
                            job_scheduled = True
                            break
                        else:
                            job_reasons.extend(eval_res.reasons)

                    if job_scheduled:
                        break
                if job_scheduled:
                    break
            if job_scheduled:
                break

        if not job_scheduled:
            # Deduplicate reasons while preserving order
            unique_reasons: list[str] = []
            if job.selected_machine_id is not None:
                unique_reasons.append(
                    f"Farmer-selected machine (ID {job.selected_machine_id}) could not be feasibly scheduled in requested window. "
                    "Silent substitution is prohibited. Farmer must select again from refreshed options."
                )
            for r in job_reasons:
                if r not in unique_reasons:
                    unique_reasons.append(r)

            if not unique_reasons:
                unique_reasons = ["No available machinery or operator found in target window"]

            unscheduled_jobs.append(
                UnscheduledJobResponse(
                    service_request_id=job.service_request_id,
                    booking_id=job.booking_id,
                    farmer_id=job.farmer_id,
                    acreage=job.acreage,
                    operation_type=job.operation_type,
                    reasons=unique_reasons[:5],  # top 5 representative reasons
                    attempted_evaluations=attempted_evals,
                )
            )

    schedule = ScheduleResponse(
        id=str(uuid.uuid4()),
        chc_id=chc_id,
        status="PROPOSED",
        created_at=datetime.now(),
        created_by_id=created_by_id,
        candidate_assignments=candidate_assignments,
        unscheduled_jobs=unscheduled_jobs,
        total_scheduled=len(candidate_assignments),
        total_unscheduled=len(unscheduled_jobs),
    )

    schedule_store.save(schedule)
    return schedule


def apply_approved_schedule(
    db: Session,
    schedule_id: str,
    manager_user: User,
) -> ScheduleResponse:
    """Transactionally approve and commit a proposed candidate schedule.

    Validates:
    - Manager role and CHC authorization.
    - Schedule existence and PROPOSED status (rejects duplicate or rejected approval).
    - Concurrency safety: re-checks all proposed slots against live bookings before mutating.
    - Authority rule: Farmer makes final machine choice; silent substitution is strictly prohibited.
    - Transactionally creates/updates operational Bookings and calendar availability slots.
    """
    schedule = schedule_store.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate schedule with ID {schedule_id} not found",
        )

    verify_chc_manager_access(manager_user, schedule.chc_id)

    if schedule.status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule has already been approved",
        )
    if schedule.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot approve a rejected schedule",
        )

    # Authority verification: ensure no machine was silently substituted contrary to farmer selection
    for assignment in schedule.candidate_assignments:
        sr = db.execute(
            select(ServiceRequest).where(ServiceRequest.id == assignment.service_request_id)
        ).scalar_one_or_none()
        if sr and sr.selected_machine_id and assignment.machine_id != sr.selected_machine_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Machine substitution prohibited: Service request {sr.id} was selected by farmer for machine "
                    f"{sr.selected_machine_id}, but candidate schedule proposes machine {assignment.machine_id}. "
                    "Silent machine substitution is not permitted. Ask farmer to select from refreshed options."
                ),
            )

    # Concurrency verification: verify no conflicting booking occurred in the interim
    for assignment in schedule.candidate_assignments:
        eval_res = evaluate_feasibility(
            db=db,
            chc_id=schedule.chc_id,
            scheduled_date=assignment.scheduled_date,
            scheduled_slot=assignment.scheduled_slot,
            service_request_id=assignment.service_request_id,
            machine_id=assignment.machine_id,
            operator_id=assignment.operator_id,
            attachment_ids=assignment.attachment_ids,
            exclude_booking_id=assignment.booking_id,
        )
        if not eval_res.feasible:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Conflict detected during approval for service request "
                    f"{assignment.service_request_id}: {'; '.join(eval_res.reasons)}"
                ),
            )

    # Transactional execution
    for assignment in schedule.candidate_assignments:
        if assignment.booking_id is None:
            # Create new Booking
            booking_code = f"BK-{uuid.uuid4().hex[:8].upper()}"
            new_booking = Booking(
                service_request_id=assignment.service_request_id,
                chc_id=schedule.chc_id,
                machine_id=assignment.machine_id,
                operator_id=assignment.operator_id,
                booking_code=booking_code,
                scheduled_date=assignment.scheduled_date,
                scheduled_slot=assignment.scheduled_slot,
                status="SCHEDULED",
                total_cost=assignment.estimated_cost or Decimal("0.00"),
                payment_status="PENDING",
            )
            db.add(new_booking)
            db.flush()
            assignment.booking_id = new_booking.id

            for att_id in assignment.attachment_ids:
                db.add(
                    BookingAttachment(
                        booking_id=new_booking.id,
                        attachment_id=att_id,
                    )
                )
        else:
            # Update existing pending Booking
            existing_booking = db.execute(
                select(Booking).where(Booking.id == assignment.booking_id)
            ).scalar_one_or_none()
            if existing_booking:
                existing_booking.machine_id = assignment.machine_id
                existing_booking.operator_id = assignment.operator_id
                existing_booking.scheduled_date = assignment.scheduled_date
                existing_booking.scheduled_slot = assignment.scheduled_slot
                existing_booking.status = "SCHEDULED"
                if assignment.estimated_cost:
                    existing_booking.total_cost = assignment.estimated_cost

                # Update attachments
                db.query(BookingAttachment).filter(
                    BookingAttachment.booking_id == existing_booking.id
                ).delete()
                for att_id in assignment.attachment_ids:
                    db.add(
                        BookingAttachment(
                            booking_id=existing_booking.id,
                            attachment_id=att_id,
                        )
                    )

        # Update or insert MachineAvailability
        m_slot = db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == assignment.machine_id,
                MachineAvailability.slot_date == assignment.scheduled_date,
                MachineAvailability.slot_type == assignment.scheduled_slot,
            )
        ).scalar_one_or_none()
        if m_slot:
            m_slot.status = "BOOKED"
            m_slot.note = f"Booked via Schedule {schedule.id[:8]}"
        else:
            db.add(
                MachineAvailability(
                    machine_id=assignment.machine_id,
                    slot_date=assignment.scheduled_date,
                    slot_type=assignment.scheduled_slot,
                    status="BOOKED",
                    note=f"Booked via Schedule {schedule.id[:8]}",
                )
            )

        # Update or insert OperatorAvailability
        op_slot = db.execute(
            select(OperatorAvailability).where(
                OperatorAvailability.operator_id == assignment.operator_id,
                OperatorAvailability.slot_date == assignment.scheduled_date,
                OperatorAvailability.slot_type == assignment.scheduled_slot,
            )
        ).scalar_one_or_none()
        if op_slot:
            op_slot.status = "ASSIGNED"
            op_slot.note = f"Assigned via Schedule {schedule.id[:8]}"
        else:
            db.add(
                OperatorAvailability(
                    operator_id=assignment.operator_id,
                    slot_date=assignment.scheduled_date,
                    slot_type=assignment.scheduled_slot,
                    status="ASSIGNED",
                    note=f"Assigned via Schedule {schedule.id[:8]}",
                )
            )

    # Record AuditLog
    db.add(
        AuditLog(
            chc_id=schedule.chc_id,
            user_id=manager_user.id,
            action="APPROVE_SCHEDULE",
            entity_type="SCHEDULE",
            entity_id=schedule.id,
            payload_after=f"Approved {len(schedule.candidate_assignments)} assignments",
        )
    )
    db.commit()

    schedule.status = "APPROVED"
    schedule.approved_at = datetime.now()
    schedule.approved_by_id = manager_user.id
    schedule_store.update(schedule)
    return schedule


def reject_candidate_schedule(
    db: Session,
    schedule_id: str,
    manager_user: User,
    reason: str | None = None,
) -> ScheduleResponse:
    """Reject a proposed candidate schedule without applying any database mutations."""
    schedule = schedule_store.get(schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate schedule with ID {schedule_id} not found",
        )

    verify_chc_manager_access(manager_user, schedule.chc_id)

    if schedule.status == "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reject an already approved schedule",
        )
    if schedule.status == "REJECTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Schedule has already been rejected",
        )

    schedule.status = "REJECTED"
    schedule.rejection_reason = reason
    schedule_store.update(schedule)

    db.add(
        AuditLog(
            chc_id=schedule.chc_id,
            user_id=manager_user.id,
            action="REJECT_SCHEDULE",
            entity_type="SCHEDULE",
            entity_id=schedule.id,
            payload_after=f"Rejected schedule: {reason or 'No reason provided'}",
        )
    )
    db.commit()
    return schedule
