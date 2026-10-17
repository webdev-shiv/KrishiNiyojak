"""Recovery Alternatives Generation and Ranking Service (T13).

Provides modular business logic to generate, evaluate, and rank candidate operational
recovery options for bookings disrupted by a machinery breakdown incident.

Evaluates:
- Compatible fleet machinery within the Custom Hiring Centre (horsepower and implement matching)
- Certified operators and availability
- Date shifting within or near farmer requested deadlines
- Operational feasibility via T10 Feasibility Checker
- Multi-criteria ranking score (Delay 35%, Transit 25%, Differential Cost 25%, Availability 15%)
- Transparent failure explanations when no alternative is feasible

Preserves existing confirmed bookings and operational state (generates proposals only).
Cross-CHC resource borrowing is documented as restricted by single-CHC manager RBAC boundaries.
"""

from datetime import date, timedelta
from decimal import Decimal
from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import verify_chc_manager_access
from app.core.config import settings
from app.models.availability import MachineAvailability
from app.models.booking import Booking
from app.models.identity import User
from app.models.recovery import MachineBreakdown, RecoveryPlan, RecoveryPlanItem
from app.models.resource import Attachment, Machine, Operator
from app.schemas.recovery import (
    BookingRecoveryPlan,
    BreakdownRecoveryResponse,
    RecoveryAlternativeResponse,
)
from app.services.breakdown import get_affected_bookings_query
from app.services.feasibility import evaluate_feasibility


def score_recovery_alternative(
    candidate_date: date,
    original_date: date,
    deadline: date | None,
    distance_km: float,
    operating_radius_km: float,
    orig_total_rate: Decimal,
    rep_total_rate: Decimal,
    estimated_work_hours: float,
    has_free_slot: bool,
    is_same_operator: bool,
) -> tuple[int, Decimal, Decimal, int, bool, list[str]]:
    """Compute multi-factor ranking score (0-100) for a recovery alternative.

    Weights:
    - Expected Delay & Deadline Risk: 35%
    - Travel Distance / Transit Time: 25%
    - Differential / Additional Cost: 25%
    - Resource Availability & Familiarity: 15%

    Returns:
        tuple of (score, estimated_cost, additional_cost, delay_days, missed_deadline, reasons)
    """
    reasons: list[str] = []

    # 1. Expected Delay & Deadline Risk (Weight: 35%)
    delay_days = (candidate_date - original_date).days
    missed_deadline = bool(deadline is not None and candidate_date > deadline)
    delay_pts: float = 0.0

    if delay_days == 0:
        delay_pts = 35.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Zero delay: Same-day substitute assignment on {candidate_date} ({delay_pts:.1f} pts)."
        )
    elif delay_days == 1 and not missed_deadline:
        delay_pts = 28.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Minimal delay: 1 day reschedule on {candidate_date} within deadline "
            f"({delay_pts:.1f} pts)."
        )
    elif delay_days == 2 and not missed_deadline:
        delay_pts = 20.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Moderate delay: 2 days reschedule on {candidate_date} within deadline "
            f"({delay_pts:.1f} pts)."
        )
    elif delay_days in (3, 4) and not missed_deadline:
        delay_pts = 14.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Acceptable delay: {delay_days} days reschedule on {candidate_date} within deadline "
            f"({delay_pts:.1f} pts)."
        )
    elif delay_days >= 5 and not missed_deadline:
        delay_pts = 8.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Extended delay: {delay_days} days reschedule on {candidate_date} within deadline "
            f"({delay_pts:.1f} pts)."
        )
    else:
        # Missed farmer's requested deadline
        delay_pts = 2.0 * (settings.RECOVERY_WEIGHT_DELAY / 0.35)
        reasons.append(
            f"Deadline missed: Proposed date {candidate_date} exceeds farmer deadline {deadline} "
            f"({delay_pts:.1f} pts)."
        )

    # 2. Travel Distance / Transit Time (Weight: 25%)
    transit_pts: float = 0.0
    if distance_km <= 5.0:
        transit_pts = 25.0 * (settings.RECOVERY_WEIGHT_TRANSIT / 0.25)
        reasons.append(
            f"Close proximity: {distance_km:.1f} km transit distance ({transit_pts:.1f} pts)."
        )
    elif distance_km <= 15.0:
        transit_pts = 20.0 * (settings.RECOVERY_WEIGHT_TRANSIT / 0.25)
        reasons.append(
            f"Moderate transit: {distance_km:.1f} km transit distance ({transit_pts:.1f} pts)."
        )
    elif distance_km <= 25.0:
        transit_pts = 14.0 * (settings.RECOVERY_WEIGHT_TRANSIT / 0.25)
        reasons.append(
            f"Significant transit: {distance_km:.1f} km transit distance ({transit_pts:.1f} pts)."
        )
    elif distance_km <= operating_radius_km:
        transit_pts = 8.0 * (settings.RECOVERY_WEIGHT_TRANSIT / 0.25)
        reasons.append(
            f"Near operational boundary: {distance_km:.1f} km transit distance "
            f"({transit_pts:.1f} pts)."
        )
    else:
        transit_pts = 0.0
        reasons.append(
            f"Exceeds operating radius: {distance_km:.1f} km > "
            f"{operating_radius_km:.1f} km (0 pts)."
        )

    # 3. Differential / Additional Cost (Weight: 25%)
    cost_pts: float = 0.0
    work_hours = max(1.0, estimated_work_hours)
    estimated_cost = Decimal(str(round(float(rep_total_rate) * work_hours, 2)))
    diff_rate = rep_total_rate - orig_total_rate
    additional_cost = Decimal(str(max(0.0, round(float(diff_rate) * work_hours, 2))))

    if additional_cost <= Decimal("0.00"):
        cost_pts = 25.0 * (settings.RECOVERY_WEIGHT_COST / 0.25)
        reasons.append(
            f"Cost neutral or saving: Estimated cost Rs. {estimated_cost:.2f} "
            f"matches or improves baseline ({cost_pts:.1f} pts)."
        )
    else:
        pct_increase = (
            float(diff_rate / orig_total_rate) * 100.0
            if orig_total_rate > Decimal("0.00")
            else 50.0
        )
        if pct_increase < 15.0:
            cost_pts = 20.0 * (settings.RECOVERY_WEIGHT_COST / 0.25)
            reasons.append(
                f"Minor premium: +Rs. {additional_cost:.2f} (+{pct_increase:.1f}% rate) "
                f"({cost_pts:.1f} pts)."
            )
        elif pct_increase < 30.0:
            cost_pts = 14.0 * (settings.RECOVERY_WEIGHT_COST / 0.25)
            reasons.append(
                f"Moderate premium: +Rs. {additional_cost:.2f} (+{pct_increase:.1f}% rate) "
                f"({cost_pts:.1f} pts)."
            )
        elif pct_increase < 50.0:
            cost_pts = 8.0 * (settings.RECOVERY_WEIGHT_COST / 0.25)
            reasons.append(
                f"High premium: +Rs. {additional_cost:.2f} (+{pct_increase:.1f}% rate) "
                f"({cost_pts:.1f} pts)."
            )
        else:
            cost_pts = 3.0 * (settings.RECOVERY_WEIGHT_COST / 0.25)
            reasons.append(
                f"Substantial premium: +Rs. {additional_cost:.2f} (+{pct_increase:.1f}% rate) "
                f"({cost_pts:.1f} pts)."
            )

    # 4. Resource Availability & Familiarity (Weight: 15%)
    avail_pts: float = 0.0
    if has_free_slot:
        avail_pts += 10.0 * (settings.RECOVERY_WEIGHT_AVAILABILITY / 0.15) * (10.0 / 15.0)
        reasons.append("Machine has unreserved calendar slot on target date (6.7 pts).")
    else:
        avail_pts += 6.0 * (settings.RECOVERY_WEIGHT_AVAILABILITY / 0.15) * (10.0 / 15.0)
        reasons.append("Machine availability implicit from absence of active conflicts (4.0 pts).")

    if is_same_operator:
        avail_pts += 5.0 * (settings.RECOVERY_WEIGHT_AVAILABILITY / 0.15) * (5.0 / 15.0)
        reasons.append("Assigned original operator maintaining customer continuity (3.3 pts).")
    else:
        avail_pts += 3.0 * (settings.RECOVERY_WEIGHT_AVAILABILITY / 0.15) * (5.0 / 15.0)
        reasons.append("Assigned qualified alternate CHC operator (2.0 pts).")

    raw_score = delay_pts + transit_pts + cost_pts + avail_pts
    final_score = max(0, min(100, int(round(raw_score))))
    return final_score, estimated_cost, additional_cost, delay_days, missed_deadline, reasons


def generate_recovery_alternatives_for_booking(
    db: Session,
    booking: Booking,
    breakdown_date: date,
    available_machines: list[Machine],
    available_operators: list[Operator],
    operating_radius_km: float,
) -> BookingRecoveryPlan:
    """Evaluate and rank all feasible recovery alternatives for a single disrupted booking."""
    sr = booking.service_request
    farmer_name = sr.farmer.full_name if sr and sr.farmer else "Unknown Farmer"
    op_type = sr.operation_type if sr else "UNKNOWN"
    original_date = booking.scheduled_date
    deadline = sr.requested_end_date if sr else None
    acreage = sr.acreage if sr else None

    # Required implement attachments and horsepower threshold
    attachments = [
        cast(Attachment, ba.attachment) for ba in booking.booking_attachments if ba.attachment
    ]
    required_hp = max([att.required_hp_min for att in attachments], default=0.0)
    attachment_ids = [ba.attachment_id for ba in booking.booking_attachments]

    # Baseline rates for cost comparison
    orig_machine_rate = booking.machine.hourly_rate if booking.machine else Decimal("0.00")
    orig_op_rate = booking.operator.hourly_rate if booking.operator else Decimal("0.00")
    orig_total_rate = orig_machine_rate + orig_op_rate

    # Filter compatible machines by horsepower
    compatible_machines = [m for m in available_machines if m.horsepower >= required_hp]

    # Priority score for customer
    priority_score = booking.priority.priority_score if booking.priority else 50

    # Search window: from max(original_date, breakdown_date) up to max_search_date
    start_date = max(original_date, breakdown_date)
    max_search_days = settings.MAX_RECOVERY_SEARCH_DAYS
    search_end_date = start_date + timedelta(days=max_search_days)
    if deadline and (deadline + timedelta(days=1)) > start_date:
        # Allow searching up to 1 day past deadline so we evaluate late options if on-time fails
        search_end_date = min(search_end_date, deadline + timedelta(days=2))

    evaluated_alternatives: list[RecoveryAlternativeResponse] = []
    infeasible_reasons_tally: dict[str, int] = {}
    alt_counter = 0

    # Build prioritized candidate operator list: original operator first, then others
    candidate_operators: list[Operator] = []
    if booking.operator and booking.operator.status == "AVAILABLE":
        candidate_operators.append(booking.operator)
    for op in available_operators:
        if booking.operator is None or op.id != booking.operator.id:
            candidate_operators.append(op)

    current_date = start_date
    while current_date <= search_end_date:
        target_slot = booking.scheduled_slot

        for candidate_machine in compatible_machines:
            for candidate_operator in candidate_operators:
                feasibility = evaluate_feasibility(
                    db=db,
                    chc_id=booking.chc_id,
                    scheduled_date=current_date,
                    scheduled_slot=target_slot,
                    service_request_id=booking.service_request_id,
                    machine_id=candidate_machine.id,
                    operator_id=candidate_operator.id,
                    attachment_ids=attachment_ids,
                    field_latitude=sr.field_latitude if sr else None,
                    field_longitude=sr.field_longitude if sr else None,
                    acreage=acreage,
                    exclude_booking_id=booking.id,
                )

                if feasibility.feasible:
                    alt_counter += 1
                    # Check free slot in machine availability
                    free_slot = db.execute(
                        select(MachineAvailability).where(
                            MachineAvailability.machine_id == candidate_machine.id,
                            MachineAvailability.slot_date == current_date,
                            MachineAvailability.slot_type == target_slot,
                            MachineAvailability.status == "FREE",
                        )
                    ).scalar_one_or_none()

                    rep_m_rate = candidate_machine.hourly_rate
                    rep_op_rate = candidate_operator.hourly_rate
                    rep_total_rate = rep_m_rate + rep_op_rate

                    c_details = feasibility.constraints
                    dist_km = (
                        c_details.distance_km
                        if c_details and c_details.distance_km is not None
                        else 10.0
                    )
                    transit_mins = (
                        c_details.estimated_travel_time_minutes
                        if c_details and c_details.estimated_travel_time_minutes is not None
                        else 25.0
                    )
                    work_hours = (
                        c_details.estimated_work_duration_hours
                        if c_details and c_details.estimated_work_duration_hours is not None
                        else 4.0
                    )

                    is_same_op = bool(
                        booking.operator_id is not None
                        and candidate_operator.id == booking.operator_id
                    )

                    strategy = "REPLACE_MACHINE" if current_date == original_date else "TIME_SHIFT"

                    score, est_cost, add_cost, delay_days, missed_dl, score_reasons = (
                        score_recovery_alternative(
                            candidate_date=current_date,
                            original_date=original_date,
                            deadline=deadline,
                            distance_km=dist_km,
                            operating_radius_km=operating_radius_km,
                            orig_total_rate=orig_total_rate,
                            rep_total_rate=rep_total_rate,
                            estimated_work_hours=work_hours,
                            has_free_slot=bool(free_slot),
                            is_same_operator=is_same_op,
                        )
                    )

                    op_user_name = (
                        candidate_operator.user.full_name
                        if candidate_operator.user
                        else f"Operator #{candidate_operator.id}"
                    )

                    mach_label = (
                        f"{candidate_machine.make} {candidate_machine.model} "
                        f"({candidate_machine.registration_number})"
                    )
                    evaluated_alternatives.append(
                        RecoveryAlternativeResponse(
                            alternative_id=f"ALT-{booking.id}-{alt_counter}",
                            strategy=strategy,
                            booking_id=booking.id,
                            booking_code=booking.booking_code,
                            replacement_machine_id=candidate_machine.id,
                            replacement_machine_name=mach_label,
                            replacement_machine_hp=candidate_machine.horsepower,
                            replacement_operator_id=candidate_operator.id,
                            replacement_operator_name=op_user_name,
                            proposed_date=current_date,
                            proposed_slot=target_slot,
                            is_feasible=True,
                            score=score,
                            estimated_cost=est_cost,
                            additional_cost=add_cost,
                            travel_distance_km=dist_km,
                            travel_time_minutes=transit_mins,
                            delay_days=delay_days,
                            missed_deadline=missed_dl,
                            reasons=score_reasons,
                            warnings=feasibility.warnings,
                        )
                    )
                else:
                    for reason in feasibility.reasons:
                        infeasible_reasons_tally[reason] = (
                            infeasible_reasons_tally.get(reason, 0) + 1
                        )

        current_date += timedelta(days=1)

    # Sort alternatives by ranking score descending (tie-breaker: delay_days, distance)
    evaluated_alternatives.sort(
        key=lambda alt: (-alt.score, alt.delay_days, alt.travel_distance_km)
    )

    no_alt_reason: str | None = None
    if not evaluated_alternatives:
        if not compatible_machines:
            no_alt_reason = (
                f"No alternative machine in CHC hub meets the minimum required power of "
                f"{required_hp:.1f} HP across attached implements."
            )
        elif not candidate_operators:
            no_alt_reason = (
                "No certified operators in CHC hub are currently available on active duty."
            )
        elif infeasible_reasons_tally:
            top_blocker = max(infeasible_reasons_tally.items(), key=lambda kv: kv[1])[0]
            no_alt_reason = (
                f"All candidate machinery and date options blocked by operational constraints. "
                f"Primary factor: {top_blocker}"
            )
        else:
            no_alt_reason = (
                "No feasible alternative machine or date slot could be matched "
                "within the search window."
            )

    recommended = evaluated_alternatives[0] if evaluated_alternatives else None

    return BookingRecoveryPlan(
        booking_id=booking.id,
        booking_code=booking.booking_code,
        farmer_name=farmer_name,
        operation_type=op_type,
        original_date=original_date,
        deadline=deadline,
        acreage=acreage,
        priority_score=priority_score,
        ranked_alternatives=evaluated_alternatives,
        recommended_alternative=recommended,
        no_alternative_reason=no_alt_reason,
    )


def generate_breakdown_recovery_alternatives(
    db: Session,
    breakdown_id: int,
    current_user: User,
    persist_proposed_plan: bool = False,
) -> BreakdownRecoveryResponse:
    """Generate and rank recovery alternatives for all affected bookings of a breakdown.

    Enforces CHC manager authorization and tenant isolation.
    Does not modify confirmed bookings or commit operational state changes.
    """
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

    broken_machine = breakdown.machine
    chc = broken_machine.chc
    chc_id = broken_machine.chc_id
    chc_name = chc.name if chc else f"CHC #{chc_id}"
    operating_radius_km = chc.operating_radius_km if chc else 35.0
    breakdown_date = breakdown.reported_at.date()

    # 1. Retrieve affected bookings (excluding CANCELLED and COMPLETED)
    affected_bookings = (
        db.execute(get_affected_bookings_query(broken_machine.id, breakdown_date)).scalars().all()
    )

    # 2. Retrieve candidate alternative machines and operators from the same CHC
    candidate_machines = (
        db.execute(
            select(Machine).where(
                Machine.chc_id == chc_id,
                Machine.id != broken_machine.id,
                Machine.status == "AVAILABLE",
            )
        )
        .scalars()
        .all()
    )

    candidate_operators = (
        db.execute(
            select(Operator)
            .options(selectinload(Operator.user))
            .where(
                Operator.chc_id == chc_id,
                Operator.status == "AVAILABLE",
            )
        )
        .scalars()
        .all()
    )

    # 3. Generate and rank alternatives per affected booking
    booking_plans: list[BookingRecoveryPlan] = []
    recoverable_count = 0
    unrecoverable_count = 0
    total_est_cost = Decimal("0.00")
    total_delay_hours = 0.0

    for b in affected_bookings:
        plan = generate_recovery_alternatives_for_booking(
            db=db,
            booking=b,
            breakdown_date=breakdown_date,
            available_machines=list(candidate_machines),
            available_operators=list(candidate_operators),
            operating_radius_km=operating_radius_km,
        )
        booking_plans.append(plan)

        if plan.recommended_alternative:
            recoverable_count += 1
            total_est_cost += plan.recommended_alternative.estimated_cost
            total_delay_hours += plan.recommended_alternative.delay_days * 8.0
        else:
            unrecoverable_count += 1

    # Sort booking recovery plans according to customer priority score (T12) descending
    booking_plans.sort(key=lambda p: -p.priority_score)

    recovery_plan_id: int | None = None

    # 4. Optional proposal persistence (RecoveryPlan record with status=PROPOSED)
    if persist_proposed_plan:
        # Check if an existing PROPOSED plan already exists for this breakdown
        existing_plan = db.execute(
            select(RecoveryPlan).where(
                RecoveryPlan.breakdown_id == breakdown.id,
                RecoveryPlan.status == "PROPOSED",
            )
        ).scalar_one_or_none()

        if existing_plan:
            recovery_plan = existing_plan
            recovery_plan.estimated_cost = total_est_cost
            recovery_plan.estimated_delay_hours = total_delay_hours
            # Remove stale items
            recovery_plan.items.clear()
        else:
            recovery_plan = RecoveryPlan(
                breakdown_id=breakdown.id,
                strategy="REPLACE_MACHINE",
                status="PROPOSED",
                estimated_delay_hours=total_delay_hours,
                estimated_cost=total_est_cost,
                created_by_id=current_user.id,
            )
            db.add(recovery_plan)
            db.flush()

        for bp in booking_plans:
            rec = bp.recommended_alternative
            if rec:
                item = RecoveryPlanItem(
                    recovery_plan_id=recovery_plan.id,
                    affected_booking_id=bp.booking_id,
                    replacement_machine_id=rec.replacement_machine_id,
                    replacement_operator_id=rec.replacement_operator_id,
                    action_type="REASSIGN_MACHINE"
                    if rec.strategy == "REPLACE_MACHINE"
                    else "RESCHEDULE_SLOT",
                    new_scheduled_date=rec.proposed_date,
                    status="PENDING",
                )
                db.add(item)

        db.commit()
        db.refresh(recovery_plan)
        recovery_plan_id = recovery_plan.id

    return BreakdownRecoveryResponse(
        breakdown_id=breakdown.id,
        machine_id=broken_machine.id,
        machine_registration=broken_machine.registration_number,
        chc_id=chc_id,
        chc_name=chc_name,
        failure_type=breakdown.failure_type,
        severity=breakdown.severity,
        total_affected_bookings=len(affected_bookings),
        recoverable_bookings_count=recoverable_count,
        unrecoverable_bookings_count=unrecoverable_count,
        recovery_plan_id=recovery_plan_id,
        booking_recovery_plans=booking_plans,
        cross_chc_supported=False,
        cross_chc_notes=(
            "Cross-CHC resource borrowing is restricted by current single-CHC manager "
            "RBAC boundaries. All evaluated alternatives originate from host CHC fleet."
        ),
    )
