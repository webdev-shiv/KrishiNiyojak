"""Scheduling Rules and Feasibility evaluation service (T10).

Provides modular business logic to verify whether a proposed or existing agricultural
machine-day assignment is operationally viable across:
- Custom Hiring Centre (CHC) hub status and operating radius
- Machine type, horsepower, and required attachment compatibility
- Machine availability calendar slots and active booking conflicts
- Operator eligibility, licensing, duty/leave slots, and active booking conflicts
- Haversine travel distance and road transit time estimation
- Farmer requested date window, deadline, acreage, and slot capacity constraints
"""

import logging
import math
from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.core.config import settings
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, ServiceRequest
from app.models.chc import CHC
from app.models.resource import Attachment, Machine, Operator
from app.schemas.scheduling import (
    FeasibilityConstraintDetails,
    FeasibilityResponse,
)


def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two GPS coordinates in kilometers."""
    earth_radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2.0) ** 2
    )
    c = 2.0 * math.asin(math.sqrt(max(0.0, min(1.0, a))))
    return round(earth_radius_km * c, 2)


def calculate_road_route_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> tuple[float, float, bool]:
    """Calculate actual road distance (km) and travel duration (minutes) using real routing provider (OSRM).

    Returns (distance_km, travel_time_minutes, is_real_route).
    Gracefully falls back to haversine + road winding factor on network error or invalid coordinates.
    """
    if not settings.ENABLE_REAL_ROUTING:
        h_dist = calculate_haversine_distance(lat1, lon1, lat2, lon2)
        return h_dist, estimate_travel_time_minutes(h_dist), False

    try:
        url = f"{settings.ROUTING_SERVICE_URL}/{lon1},{lat1};{lon2},{lat2}?overview=false"
        with httpx.Client(timeout=settings.ROUTING_TIMEOUT_SECONDS) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("code") == "Ok" and data.get("routes"):
                    r = data["routes"][0]
                    dist_km = round(r["distance"] / 1000.0, 2)
                    time_min = round((dist_km / settings.TRANSIT_SPEED_KMH) * 60.0, 1)
                    return dist_km, time_min, True
    except Exception as exc:
        logger.warning(f"OSRM routing service failed, falling back to Haversine: {exc}")

    # Fallback to Haversine with rural road winding factor
    h_dist = calculate_haversine_distance(lat1, lon1, lat2, lon2)
    return h_dist, estimate_travel_time_minutes(h_dist), False


def estimate_travel_time_minutes(
    distance_km: float,
    transit_speed_kmh: float | None = None,
    road_winding_factor: float | None = None,
) -> float:
    """Estimate road travel time in minutes based on distance, winding factor, and speed.

    Uses a configurable rural road winding factor and machinery transit speed
    until an external GIS/routing engine is plugged in.
    """
    if distance_km <= 0.0:
        return 0.0

    speed = transit_speed_kmh if transit_speed_kmh is not None else settings.TRANSIT_SPEED_KMH
    winding = (
        road_winding_factor if road_winding_factor is not None else settings.ROAD_WINDING_FACTOR
    )

    if speed <= 0.0:
        return 0.0

    road_distance_km = distance_km * winding
    travel_hours = road_distance_km / speed
    return round(travel_hours * 60.0, 1)


def slots_overlap(slot_a: str, slot_b: str) -> bool:
    """Determine whether two operational machine-day time slots overlap.

    - FULL_DAY overlaps with all slots on that date.
    - HALF_DAY_MORNING overlaps with FULL_DAY and HALF_DAY_MORNING.
    - HALF_DAY_AFTERNOON overlaps with FULL_DAY and HALF_DAY_AFTERNOON.
    """
    a = slot_a.upper()
    b = slot_b.upper()
    if a == "FULL_DAY" or b == "FULL_DAY":
        return True
    return a == b


def evaluate_feasibility(
    db: Session,
    chc_id: int,
    scheduled_date: date,
    scheduled_slot: str,
    service_request_id: int | None = None,
    machine_id: int | None = None,
    operator_id: int | None = None,
    attachment_ids: list[int] | None = None,
    field_latitude: float | None = None,
    field_longitude: float | None = None,
    acreage: float | None = None,
    exclude_booking_id: int | None = None,
) -> FeasibilityResponse:
    """Evaluate scheduling feasibility against operational rules and constraints.

    Returns a structured FeasibilityResponse containing:
    - feasible: True if zero blocking violations exist.
    - reasons: list of blocking reasons preventing scheduling.
    - warnings: list of non-blocking advisories or capacity notices.
    - constraints: detailed evaluated metrics with explicit units.
    """
    reasons: list[str] = []
    warnings: list[str] = []
    constraints = FeasibilityConstraintDetails()

    slot_upper = scheduled_slot.strip().upper()
    if slot_upper not in ("FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"):
        reasons.append(
            f"Invalid scheduled_slot '{scheduled_slot}'. "
            "Must be FULL_DAY, HALF_DAY_MORNING, or HALF_DAY_AFTERNOON"
        )
        slot_upper = "FULL_DAY"

    # 1. Custom Hiring Centre (CHC) Verification
    chc = db.execute(select(CHC).where(CHC.id == chc_id)).scalar_one_or_none()
    if not chc:
        reasons.append(f"Custom Hiring Centre (CHC) with ID {chc_id} not found")
        return FeasibilityResponse(
            feasible=False,
            reasons=reasons,
            warnings=warnings,
            constraints=constraints,
        )

    if chc.status != "ACTIVE":
        reasons.append(f"CHC '{chc.name}' (ID {chc_id}) is currently {chc.status}")

    # 2. Service Request Demand & Date Window Verification
    req: ServiceRequest | None = None
    if service_request_id is not None:
        req = db.execute(
            select(ServiceRequest).where(ServiceRequest.id == service_request_id)
        ).scalar_one_or_none()
        if not req:
            reasons.append(f"Service request with ID {service_request_id} not found")
        else:
            if req.chc_id != chc_id:
                reasons.append(
                    f"Service request {req.id} belongs to CHC {req.chc_id}, not CHC {chc_id}"
                )
            if req.status in ("CANCELLED", "REJECTED"):
                reasons.append(f"Service request {req.id} is in {req.status} status")

            # Infer field coordinates and acreage if not explicitly provided
            if field_latitude is None:
                field_latitude = req.field_latitude
            if field_longitude is None:
                field_longitude = req.field_longitude
            if acreage is None:
                acreage = req.acreage

            # Date window constraints
            constraints.requested_start_date = req.requested_start_date
            constraints.deadline_date = req.requested_end_date
            if scheduled_date < req.requested_start_date:
                constraints.within_date_window = False
                reasons.append(
                    f"Scheduled date {scheduled_date} is earlier than "
                    f"requested start date {req.requested_start_date}"
                )
            elif scheduled_date > req.requested_end_date:
                constraints.within_date_window = False
                reasons.append(
                    f"Scheduled date {scheduled_date} is past requested deadline "
                    f"{req.requested_end_date}"
                )
            else:
                constraints.within_date_window = True

    # 3. Machine Resource & Compatibility Checks
    machine: Machine | None = None
    if machine_id is not None:
        machine = db.execute(select(Machine).where(Machine.id == machine_id)).scalar_one_or_none()
        if not machine:
            reasons.append(f"Machine with ID {machine_id} not found")
        else:
            if machine.chc_id != chc_id:
                reasons.append(
                    f"Machine {machine.registration_number} (ID {machine_id}) "
                    f"does not belong to CHC {chc_id}"
                )
            if machine.status in ("RETIRED", "BROKEN_DOWN", "MAINTENANCE"):
                reasons.append(f"Machine {machine.registration_number} status is {machine.status}")

            constraints.machine_horsepower = machine.horsepower

            # Machine calendar availability slots
            machine_slots = (
                db.execute(
                    select(MachineAvailability).where(
                        MachineAvailability.machine_id == machine.id,
                        MachineAvailability.slot_date == scheduled_date,
                    )
                )
                .scalars()
                .all()
            )
            for slot in machine_slots:
                if slots_overlap(slot_upper, slot.slot_type):
                    if slot.status == "BLOCKED_MAINTENANCE":
                        reasons.append(
                            f"Machine {machine.registration_number} is blocked for maintenance "
                            f"on {scheduled_date} ({slot.slot_type})"
                        )
                    elif slot.status in ("HELD", "BOOKED"):
                        reasons.append(
                            f"Machine {machine.registration_number} slot {slot.slot_type} "
                            f"on {scheduled_date} is already {slot.status}"
                        )

            # Machine conflicting active bookings
            m_booking_query = select(Booking).where(
                Booking.machine_id == machine.id,
                Booking.scheduled_date == scheduled_date,
                Booking.status.notin_(["CANCELLED", "COMPLETED"]),
            )
            if exclude_booking_id is not None:
                m_booking_query = m_booking_query.where(Booking.id != exclude_booking_id)

            existing_m_bookings = db.execute(m_booking_query).scalars().all()
            for b in existing_m_bookings:
                if slots_overlap(slot_upper, b.scheduled_slot):
                    reasons.append(
                        f"Machine {machine.registration_number} already has active booking "
                        f"{b.booking_code} on {scheduled_date} ({b.scheduled_slot})"
                    )

    # 4. Operator Resource & Eligibility Checks
    operator: Operator | None = None
    if operator_id is not None:
        operator = db.execute(
            select(Operator).where(Operator.id == operator_id)
        ).scalar_one_or_none()
        if not operator:
            reasons.append(f"Operator with ID {operator_id} not found")
        else:
            if operator.chc_id != chc_id:
                reasons.append(f"Operator (ID {operator_id}) does not belong to CHC {chc_id}")
            if operator.status in ("INACTIVE", "LEAVE"):
                reasons.append(f"Operator (ID {operator_id}) status is {operator.status}")
            if not operator.license_number or not operator.license_number.strip():
                reasons.append(
                    f"Operator (ID {operator_id}) has no valid operator license registered"
                )
            if operator.experience_years < 1:
                warnings.append(
                    f"Operator (ID {operator_id}) has less than 1 year of recorded experience "
                    f"({operator.experience_years} years)"
                )

            # Operator calendar availability slots
            op_slots = (
                db.execute(
                    select(OperatorAvailability).where(
                        OperatorAvailability.operator_id == operator.id,
                        OperatorAvailability.slot_date == scheduled_date,
                    )
                )
                .scalars()
                .all()
            )
            for slot in op_slots:
                if slots_overlap(slot_upper, slot.slot_type):
                    if slot.status == "ON_LEAVE":
                        reasons.append(
                            f"Operator (ID {operator_id}) is on leave on "
                            f"{scheduled_date} ({slot.slot_type})"
                        )
                    elif slot.status == "ASSIGNED":
                        reasons.append(
                            f"Operator (ID {operator_id}) availability slot {slot.slot_type} "
                            f"on {scheduled_date} is already ASSIGNED"
                        )

            # Operator conflicting active bookings
            op_booking_query = select(Booking).where(
                Booking.operator_id == operator.id,
                Booking.scheduled_date == scheduled_date,
                Booking.status.notin_(["CANCELLED", "COMPLETED"]),
            )
            if exclude_booking_id is not None:
                op_booking_query = op_booking_query.where(Booking.id != exclude_booking_id)

            existing_op_bookings = db.execute(op_booking_query).scalars().all()
            for b in existing_op_bookings:
                if slots_overlap(slot_upper, b.scheduled_slot):
                    reasons.append(
                        f"Operator (ID {operator_id}) already has active booking "
                        f"{b.booking_code} on {scheduled_date} ({b.scheduled_slot})"
                    )

    # 5. Attachment & Machine Horsepower Compatibility
    if attachment_ids:
        attachments = (
            db.execute(select(Attachment).where(Attachment.id.in_(attachment_ids))).scalars().all()
        )
        found_ids = {a.id for a in attachments}
        missing_ids = set(attachment_ids) - found_ids
        if missing_ids:
            reasons.append(f"Required attachment IDs not found: {sorted(missing_ids)}")

        max_hp_req = 0.0
        for att in attachments:
            if att.chc_id != chc_id:
                reasons.append(
                    f"Attachment '{att.name}' ({att.code}) does not belong to CHC {chc_id}"
                )
            if att.status in ("MAINTENANCE", "DAMAGED"):
                reasons.append(
                    f"Attachment '{att.name}' ({att.code}) is unavailable (status: {att.status})"
                )
            if att.required_hp_min > max_hp_req:
                max_hp_req = att.required_hp_min
            if machine is not None and machine.horsepower < att.required_hp_min:
                reasons.append(
                    f"Machine horsepower ({machine.horsepower} HP) is less than required "
                    f"{att.required_hp_min} HP for attachment '{att.name}'"
                )

        constraints.required_horsepower_min = max_hp_req
        if machine is not None:
            constraints.horsepower_sufficient = machine.horsepower >= max_hp_req

    # 6. Destination Coordinates & Travel Distance Estimation
    if field_latitude is not None and field_longitude is not None:
        origin_lat = chc.latitude
        origin_lng = chc.longitude
        if (
            machine is not None
            and machine.current_lat is not None
            and machine.current_lng is not None
        ):
            origin_lat = machine.current_lat
            origin_lng = machine.current_lng

        distance_km, travel_minutes, _ = calculate_road_route_distance(
            origin_lat, origin_lng, field_latitude, field_longitude
        )

        constraints.distance_km = distance_km
        constraints.estimated_travel_time_minutes = travel_minutes
        constraints.chc_operating_radius_km = chc.operating_radius_km

        if distance_km > chc.operating_radius_km:
            constraints.within_operating_radius = False
            reasons.append(
                f"Field location is {distance_km:.1f} km away, "
                f"exceeding CHC operational radius limit ({chc.operating_radius_km:.1f} km)"
            )
        else:
            constraints.within_operating_radius = True
            if distance_km > chc.operating_radius_km * 0.8:
                warnings.append(
                    f"Field distance ({distance_km:.1f} km) is near the edge of "
                    f"CHC operational radius ({chc.operating_radius_km:.1f} km)"
                )
            if travel_minutes > 60.0:
                warnings.append(
                    f"Long transit time estimated: {travel_minutes:.0f} minutes "
                    "road transit each way"
                )

    # 7. Acreage & Work Duration vs Slot Capacity
    slot_hours = 8.0 if slot_upper == "FULL_DAY" else 4.0
    constraints.slot_duration_hours = slot_hours

    if acreage is not None and acreage > 0.0:
        constraints.acreage = acreage
        field_area_ha = round(acreage * 0.404686, 3)
        constraints.field_area_ha = field_area_ha

        # Dynamic capacity calculation from machine parameters if available
        if machine is not None and machine.coverage_width_m > 0 and machine.working_speed_kmh > 0:
            speed = machine.working_speed_kmh
            width = machine.coverage_width_m
            eff = machine.field_efficiency_factor or 0.8
            eff_cap = round((width * speed * eff) / 10.0, 3)
            pure_fieldwork = round(field_area_ha / eff_cap, 2) if eff_cap > 0 else round(acreage * settings.ESTIMATED_HOURS_PER_ACRE, 2)
            turning_hours = round(pure_fieldwork * 0.10, 2)
            setup_hours = 0.5
            travel_hours = round((constraints.estimated_travel_time_minutes or 0.0) / 60.0, 2)
            total_duration = round(pure_fieldwork + turning_hours + setup_hours + travel_hours, 2)

            constraints.working_speed_kmh = speed
            constraints.coverage_width_m = width
            constraints.field_efficiency_factor = eff
            constraints.effective_capacity_ha_per_hour = eff_cap
            constraints.setup_duration_hours = round(setup_hours + turning_hours, 2)
            constraints.total_job_duration_hours = total_duration
            est_work_hours = round(acreage * settings.ESTIMATED_HOURS_PER_ACRE, 1)
        else:
            est_work_hours = round(acreage * settings.ESTIMATED_HOURS_PER_ACRE, 1)
            constraints.total_job_duration_hours = est_work_hours

        constraints.estimated_work_duration_hours = est_work_hours

        if est_work_hours > slot_hours:
            constraints.capacity_sufficient = False
            warnings.append(
                f"Estimated work duration ({est_work_hours}h for {acreage} acres) "
                f"exceeds {slot_upper} capacity ({slot_hours}h); "
                "multi-slot or full-day scheduling recommended"
            )
        else:
            constraints.capacity_sufficient = True

    feasible = len(reasons) == 0
    return FeasibilityResponse(
        feasible=feasible,
        reasons=reasons,
        warnings=warnings,
        constraints=constraints,
    )
