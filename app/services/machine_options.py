"""Service module for evaluating and generating Farmer Machine Options.

Provides transparent machine options with:
- Model, category, horsepower, registration number
- Working speed (km/h), coverage width (m), field efficiency factor
- Effective field capacity (ha/h) and estimated duration (hours) including setup, turning, and travel
- Transparent rental rate and total cost calculations
- Compatible implement attachments and certified operator availability
- Feasibility constraints and warnings
"""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, ServiceRequest
from app.models.chc import CHC
from app.models.resource import Attachment, Machine, Operator
from app.schemas.service_request import (
    MachineOption,
    MachineOptionAttachment,
    MachineOptionSlot,
    MachineOptionsResponse,
)
from app.services.feasibility import (
    calculate_haversine_distance,
    estimate_travel_time_minutes,
    evaluate_feasibility,
    slots_overlap,
)

ACRES_TO_HA = 0.404686

OPERATION_COMPATIBLE_CATEGORIES: dict[str, list[str]] = {
    "PLOWING": ["TRACTOR"],
    "SOWING": ["TRACTOR"],
    "HARVESTING": ["HARVESTER", "TRACTOR"],
    "SPRAYING": ["SPRAYER", "TRACTOR"],
    "THRESHING": ["TRACTOR"],
    "TRANSPORTATION": ["TRACTOR"],
}

OPERATION_ATTACHMENT_CATEGORIES: dict[str, list[str]] = {
    "PLOWING": ["PLOW", "ROTAVATOR"],
    "SOWING": ["SEEDER", "ROTAVATOR"],
    "HARVESTING": ["HARVESTER_HEADER"],
    "SPRAYING": ["SPRAY_BOOM"],
}


def calculate_machine_performance_metrics(
    acreage: float,
    working_speed_kmh: float,
    coverage_width_m: float,
    field_efficiency_factor: float,
    travel_time_minutes: float = 0.0,
    setup_hours: float = 0.5,
    turning_ratio: float = 0.10,
) -> dict[str, float]:
    """Calculate effective field capacity (ha/h) and duration (hours) with setup, turning, and travel."""
    field_area_ha = round(acreage * ACRES_TO_HA, 3)
    speed = working_speed_kmh if working_speed_kmh > 0 else 6.0
    width = coverage_width_m if coverage_width_m > 0 else 2.0
    eff = field_efficiency_factor if field_efficiency_factor > 0 else 0.8

    effective_capacity = round((width * speed * eff) / 10.0, 3)
    pure_fieldwork = round(field_area_ha / effective_capacity, 2) if effective_capacity > 0 else round(acreage * 0.8, 2)
    turning_hours = round(pure_fieldwork * turning_ratio, 2)
    travel_hours = round(travel_time_minutes / 60.0, 2)
    total_duration = round(pure_fieldwork + turning_hours + setup_hours + travel_hours, 2)

    return {
        "field_area_ha": field_area_ha,
        "effective_capacity_ha_per_hour": effective_capacity,
        "pure_fieldwork_hours": pure_fieldwork,
        "setup_duration_hours": round(setup_hours + turning_hours, 2),
        "total_job_duration_hours": total_duration,
    }


def generate_machine_options_for_request(
    db: Session,
    service_request_id: int,
) -> MachineOptionsResponse:
    """Evaluate and compile all eligible machine options for a farmer's service request."""
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == service_request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {service_request_id} not found",
        )

    chc = db.execute(select(CHC).where(CHC.id == req.chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC with ID {req.chc_id} not found",
        )

    op_type = req.operation_type.strip().upper()
    compatible_cats = OPERATION_COMPATIBLE_CATEGORIES.get(op_type, ["TRACTOR", "HARVESTER", "SPRAYER"])

    # Query machines in this CHC
    machines = db.execute(
        select(Machine).where(
            Machine.chc_id == req.chc_id,
            Machine.status != "RETIRED",
        )
    ).scalars().all()

    # Query attachments in this CHC
    all_attachments = db.execute(
        select(Attachment).where(
            Attachment.chc_id == req.chc_id,
            Attachment.status == "AVAILABLE",
        )
    ).scalars().all()

    # Query active operators in this CHC
    operators = db.execute(
        select(Operator).where(
            Operator.chc_id == req.chc_id,
            Operator.status == "AVAILABLE",
        )
    ).scalars().all()

    # Calculate travel distance & time from CHC to field
    distance_km = calculate_haversine_distance(
        chc.latitude, chc.longitude, req.field_latitude, req.field_longitude
    )
    travel_time_minutes = estimate_travel_time_minutes(distance_km)

    target_att_cats = OPERATION_ATTACHMENT_CATEGORIES.get(op_type, [])

    options: list[MachineOption] = []

    for machine in machines:
        # Category filter
        if machine.category not in compatible_cats and machine.category != "TRACTOR":
            continue

        # Find compatible attachments for this machine and operation
        comp_attachments = [
            a for a in all_attachments
            if (not target_att_cats or a.category in target_att_cats)
            and machine.horsepower >= a.required_hp_min
        ]

        # Calculate performance and duration
        perf = calculate_machine_performance_metrics(
            acreage=req.acreage,
            working_speed_kmh=machine.working_speed_kmh,
            coverage_width_m=machine.coverage_width_m,
            field_efficiency_factor=machine.field_efficiency_factor,
            travel_time_minutes=travel_time_minutes,
        )

        duration_hours = Decimal(str(perf["total_job_duration_hours"]))

        # Calculate costs
        machine_cost = machine.hourly_rate * duration_hours
        att_hourly = comp_attachments[0].hourly_rate if comp_attachments else Decimal("0.00")
        att_cost = att_hourly * duration_hours
        op_hourly = operators[0].hourly_rate if operators else Decimal("100.00")
        op_cost = op_hourly * duration_hours
        total_cost = machine_cost + att_cost + op_cost

        # Find available slots in window
        available_slots: list[MachineOptionSlot] = []
        cur_date = req.requested_start_date
        while cur_date <= req.requested_end_date:
            for slot_type in ("FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"):
                # Check machine availability
                m_slot = db.execute(
                    select(MachineAvailability).where(
                        MachineAvailability.machine_id == machine.id,
                        MachineAvailability.slot_date == cur_date,
                    )
                ).scalars().all()
                if any(slots_overlap(slot_type, s.slot_type) and s.status != "AVAILABLE" for s in m_slot):
                    continue

                # Check active booking conflict
                m_conflicts = db.execute(
                    select(Booking).where(
                        Booking.machine_id == machine.id,
                        Booking.scheduled_date == cur_date,
                        Booking.status.notin_(["CANCELLED", "COMPLETED"]),
                    )
                ).scalars().all()
                if any(slots_overlap(slot_type, b.scheduled_slot) for b in m_conflicts):
                    continue

                # Find available operator
                matched_op = None
                for op in operators:
                    op_slot = db.execute(
                        select(OperatorAvailability).where(
                            OperatorAvailability.operator_id == op.id,
                            OperatorAvailability.slot_date == cur_date,
                        )
                    ).scalars().all()
                    if any(slots_overlap(slot_type, s.slot_type) and s.status != "AVAILABLE" for s in op_slot):
                        continue

                    op_conflicts = db.execute(
                        select(Booking).where(
                            Booking.operator_id == op.id,
                            Booking.scheduled_date == cur_date,
                            Booking.status.notin_(["CANCELLED", "COMPLETED"]),
                        )
                    ).scalars().all()
                    if any(slots_overlap(slot_type, b.scheduled_slot) for b in op_conflicts):
                        continue

                    matched_op = op
                    break

                if matched_op:
                    op_name = matched_op.user.full_name if matched_op.user else f"Operator {matched_op.id}"
                    available_slots.append(
                        MachineOptionSlot(
                            date=cur_date,
                            slot=slot_type,
                            operator_id=matched_op.id,
                            operator_name=op_name,
                        )
                    )
            cur_date += timedelta(days=1)

        # Feasibility check for top available slot or start date
        test_date = available_slots[0].date if available_slots else req.requested_start_date
        test_slot = available_slots[0].slot if available_slots else "FULL_DAY"
        eval_att_ids = [comp_attachments[0].id] if comp_attachments else []

        eval_res = evaluate_feasibility(
            db=db,
            chc_id=req.chc_id,
            scheduled_date=test_date,
            scheduled_slot=test_slot,
            service_request_id=req.id,
            machine_id=machine.id,
            operator_id=operators[0].id if operators else None,
            attachment_ids=eval_att_ids,
        )

        reasons = list(eval_res.reasons)
        if not available_slots and not reasons:
            reasons.append("No conflict-free slots available within requested date window")

        is_feasible = eval_res.feasible and len(available_slots) > 0

        options.append(
            MachineOption(
                machine_id=machine.id,
                make=machine.make,
                model=machine.model,
                category=machine.category,
                horsepower=machine.horsepower,
                registration_number=machine.registration_number,
                working_speed_kmh=machine.working_speed_kmh,
                coverage_width_m=machine.coverage_width_m,
                field_efficiency_factor=machine.field_efficiency_factor,
                effective_capacity_ha_per_hour=perf["effective_capacity_ha_per_hour"],
                estimated_duration_hours=perf["total_job_duration_hours"],
                hourly_rate=machine.hourly_rate,
                estimated_total_cost=round(total_cost, 2),
                compatible_attachments=[
                    MachineOptionAttachment(
                        id=a.id,
                        name=a.name,
                        code=a.code,
                        category=a.category,
                        required_hp_min=a.required_hp_min,
                        hourly_rate=a.hourly_rate,
                    )
                    for a in comp_attachments
                ],
                available_slots=available_slots[:10],  # top 10 convenient slots
                feasible=is_feasible,
                reasons=reasons,
                warnings=eval_res.warnings,
                is_selected=(req.selected_machine_id == machine.id),
            )
        )

    # Sort options: feasible first, then lowest estimated cost
    options.sort(key=lambda o: (not o.feasible, o.estimated_total_cost))

    return MachineOptionsResponse(
        service_request_id=req.id,
        chc_id=req.chc_id,
        operation_type=req.operation_type,
        acreage=req.acreage,
        field_area_ha=round(req.acreage * ACRES_TO_HA, 3),
        options=options,
    )
