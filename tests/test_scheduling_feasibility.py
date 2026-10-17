"""Tests for Scheduling Rules and Feasibility evaluation (T10).

Covers:
- Modular calculation of Haversine distance and configurable travel time estimation
- Time slot overlap validation consistent with T08 & T09
- Machine power and attachment compatibility (horsepower threshold checking)
- Missing, damaged, and cross-CHC attachment detection
- Machine and operator availability slot blocking (maintenance and leave)
- Conflicting active booking collision detection on identical machine-day slots
- Date window and deadline constraint verification
- CHC operational radius boundary enforcement
- Acreage and slot capacity warnings
- Evaluation of existing bookings via GET /api/v1/scheduling/feasibility/{booking_id}
- Strict role-based access control and tenant isolation
"""

import math
from collections.abc import Generator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.resource import Attachment, Machine, Operator
from app.services.feasibility import (
    calculate_haversine_distance,
    estimate_travel_time_minutes,
    slots_overlap,
)

# Isolated in-memory SQLite database for T10 unit tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Create all tables before each test and drop them after."""
    Base.metadata.create_all(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient fixture."""
    return TestClient(app)


# -----------------------------------------------------------------------------
# Test Helpers & Fixtures
# -----------------------------------------------------------------------------


def create_user_with_role(
    email: str, role_name: str, chc_id: int | None = None, chc_role: str | None = None
) -> tuple[int, str]:
    """Create user, assign role, and return (user_id, jwt_token)."""
    with TestingSessionLocal() as db:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()

        user = User(
            email=email,
            full_name=f"User {role_name}",
            hashed_password=hash_password("SecurePass123!"),
            is_active=True,
        )
        db.add(user)
        db.flush()

        user_role = UserRole(user_id=user.id, role_id=role.id)
        db.add(user_role)

        if chc_id is not None and chc_role is not None:
            membership = CHCMembership(
                chc_id=chc_id,
                user_id=user.id,
                role=chc_role,
                is_active=True,
            )
            db.add(membership)

        db.commit()
        db.refresh(user)

        token = create_access_token(
            subject=user.id,
            roles=[role_name] + ([chc_role] if chc_role else []),
        )
        return user.id, token


def create_base_environment() -> dict[str, int]:
    """Create a standard CHC, machine (55 HP), operator, and attachment (45 HP)."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code="CHC-FEAS-01",
            name="Ludhiana Central CHC",
            latitude=30.9010,
            longitude=75.8573,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        machine = Machine(
            chc_id=chc.id,
            registration_number="PB-10-FEAS-100",
            make="John Deere",
            model="5310 4WD",
            category="TRACTOR",
            horsepower=55.0,
            hourly_rate=Decimal("1100.00"),
            status="AVAILABLE",
        )
        db.add(machine)
        db.flush()

        attachment = Attachment(
            chc_id=chc.id,
            code="ROT-FEAS-01",
            name="Super Seeder",
            category="SEEDER",
            required_hp_min=45.0,
            hourly_rate=Decimal("400.00"),
            status="AVAILABLE",
        )
        db.add(attachment)
        db.flush()

        driver_role = db.query(Role).filter(Role.name == "OPERATOR").first()
        if not driver_role:
            driver_role = Role(name="OPERATOR")
            db.add(driver_role)
            db.flush()

        driver_user = User(
            email="driver_feas@chc.org",
            full_name="Driver Manpreet",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(driver_user)
        db.flush()

        operator = Operator(
            user_id=driver_user.id,
            chc_id=chc.id,
            license_number="DL-PB-FEAS-999",
            experience_years=5,
            hourly_rate=Decimal("350.00"),
            status="AVAILABLE",
        )
        db.add(operator)
        db.commit()

        return {
            "chc_id": chc.id,
            "machine_id": machine.id,
            "operator_id": operator.id,
            "attachment_id": attachment.id,
            "driver_user_id": driver_user.id,
        }


# -----------------------------------------------------------------------------
# Unit Tests: Calculation Helpers
# -----------------------------------------------------------------------------


def test_haversine_and_travel_time_calculation() -> None:
    """Verify that Haversine distance and road transit time match expected physics formulas."""
    # Amritsar (31.6340, 74.8723) to Ludhiana (30.9010, 75.8573) is ~124 km
    dist = calculate_haversine_distance(31.6340, 74.8723, 30.9010, 75.8573)
    assert 120.0 < dist < 130.0

    # Zero distance should be 0.0 minutes
    assert calculate_haversine_distance(30.0, 75.0, 30.0, 75.0) == 0.0
    assert estimate_travel_time_minutes(0.0) == 0.0

    # 25 km distance with default 25 km/h transit speed and 1.3 winding factor:
    # 25 * 1.3 = 32.5 road km / 25 km/h = 1.3 hours = 78 minutes
    est_mins = estimate_travel_time_minutes(25.0, transit_speed_kmh=25.0, road_winding_factor=1.3)
    assert math.isclose(est_mins, 78.0, abs_tol=0.5)


def test_time_slot_overlap_logic() -> None:
    """Verify slot overlap matrix across FULL_DAY, HALF_DAY_MORNING, and HALF_DAY_AFTERNOON."""
    # FULL_DAY overlaps with everything
    assert slots_overlap("FULL_DAY", "FULL_DAY") is True
    assert slots_overlap("FULL_DAY", "HALF_DAY_MORNING") is True
    assert slots_overlap("FULL_DAY", "HALF_DAY_AFTERNOON") is True
    assert slots_overlap("HALF_DAY_MORNING", "FULL_DAY") is True

    # Same half day overlaps
    assert slots_overlap("HALF_DAY_MORNING", "HALF_DAY_MORNING") is True
    assert slots_overlap("HALF_DAY_AFTERNOON", "HALF_DAY_AFTERNOON") is True

    # Distinct half days DO NOT overlap
    assert slots_overlap("HALF_DAY_MORNING", "HALF_DAY_AFTERNOON") is False
    assert slots_overlap("HALF_DAY_AFTERNOON", "HALF_DAY_MORNING") is False


# -----------------------------------------------------------------------------
# Integration Tests: Feasibility Evaluation Endpoints
# -----------------------------------------------------------------------------


def test_feasible_proposal_success(client: TestClient) -> None:
    """A fully compatible proposal returns feasible=True with zero blocking reasons."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_ok@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    today = date.today()
    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": (today + timedelta(days=2)).isoformat(),
        "scheduled_slot": "FULL_DAY",
        "machine_id": env["machine_id"],
        "operator_id": env["operator_id"],
        "attachment_ids": [env["attachment_id"]],
        "field_latitude": 30.9100,  # ~1.2 km from Ludhiana CHC
        "field_longitude": 75.8600,
        "acreage": 6.0,
    }

    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is True
    assert len(data["reasons"]) == 0
    assert data["constraints"]["machine_horsepower"] == 55.0
    assert data["constraints"]["required_horsepower_min"] == 45.0
    assert data["constraints"]["horsepower_sufficient"] is True
    assert data["constraints"]["within_operating_radius"] is True
    assert data["constraints"]["distance_km"] is not None
    assert data["constraints"]["distance_km"] < 5.0
    assert data["constraints"]["slot_duration_hours"] == 8.0
    assert data["constraints"]["capacity_sufficient"] is True


def test_incompatible_machine_horsepower_fails(client: TestClient) -> None:
    """When machine horsepower is less than required attachment horsepower, feasibility fails."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_hp@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    # Create low-power compact tractor (30 HP)
    with TestingSessionLocal() as db:
        low_hp_machine = Machine(
            chc_id=env["chc_id"],
            registration_number="PB-10-LOW-HP",
            make="Sonalika",
            model="DI 30",
            category="TRACTOR",
            horsepower=30.0,  # Less than attachment's 45.0 HP
            hourly_rate=Decimal("600.00"),
            status="AVAILABLE",
        )
        db.add(low_hp_machine)
        db.commit()
        low_hp_id = low_hp_machine.id

    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": (date.today() + timedelta(days=2)).isoformat(),
        "scheduled_slot": "FULL_DAY",
        "machine_id": low_hp_id,
        "attachment_ids": [env["attachment_id"]],  # Requires 45 HP
    }

    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("less than required 45.0 HP" in r for r in data["reasons"])
    assert data["constraints"]["horsepower_sufficient"] is False


def test_missing_and_cross_chc_attachment_fails(client: TestClient) -> None:
    """Missing or foreign CHC attachments cause blocking failure."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_att@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    # Case 1: Non-existent attachment ID
    payload_missing = {
        "chc_id": env["chc_id"],
        "scheduled_date": (date.today() + timedelta(days=3)).isoformat(),
        "scheduled_slot": "FULL_DAY",
        "attachment_ids": [99999],
    }
    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload_missing,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("99999" in r for r in data["reasons"])

    # Case 2: Attachment belonging to another CHC
    with TestingSessionLocal() as db:
        other_chc = CHC(
            code="CHC-OTHER-99",
            name="Other CHC",
            latitude=30.0,
            longitude=75.0,
            status="ACTIVE",
        )
        db.add(other_chc)
        db.flush()
        other_att = Attachment(
            chc_id=other_chc.id,
            code="ATT-FOREIGN-99",
            name="Foreign Attachment",
            category="PLOW",
            required_hp_min=40.0,
            status="AVAILABLE",
        )
        db.add(other_att)
        db.commit()
        foreign_att_id = other_att.id

    payload_foreign = {
        "chc_id": env["chc_id"],
        "scheduled_date": (date.today() + timedelta(days=3)).isoformat(),
        "scheduled_slot": "FULL_DAY",
        "attachment_ids": [foreign_att_id],
    }
    res2 = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload_foreign,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["feasible"] is False
    assert any("does not belong to CHC" in r for r in data2["reasons"])


def test_machine_blocked_for_maintenance_fails(client: TestClient) -> None:
    """When machine has MachineAvailability marked BLOCKED_MAINTENANCE, feasibility is blocked."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_maint@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    target_date = date.today() + timedelta(days=4)
    with TestingSessionLocal() as db:
        m_slot = MachineAvailability(
            machine_id=env["machine_id"],
            slot_date=target_date,
            slot_type="HALF_DAY_MORNING",
            status="BLOCKED_MAINTENANCE",
            note="Engine transmission overhaul",
        )
        db.add(m_slot)
        db.commit()

    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": target_date.isoformat(),
        "scheduled_slot": "FULL_DAY",  # Overlaps with morning maintenance
        "machine_id": env["machine_id"],
    }
    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("blocked for maintenance" in r for r in data["reasons"])


def test_operator_on_leave_fails(client: TestClient) -> None:
    """When operator has OperatorAvailability marked ON_LEAVE, feasibility is blocked."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_op_leave@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    target_date = date.today() + timedelta(days=5)
    with TestingSessionLocal() as db:
        op_slot = OperatorAvailability(
            operator_id=env["operator_id"],
            slot_date=target_date,
            slot_type="FULL_DAY",
            status="ON_LEAVE",
            note="Annual leave",
        )
        db.add(op_slot)
        db.commit()

    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": target_date.isoformat(),
        "scheduled_slot": "HALF_DAY_MORNING",
        "operator_id": env["operator_id"],
    }
    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("is on leave" in r for r in data["reasons"])


def test_active_booking_collision_fails(client: TestClient) -> None:
    """When machine or operator has active booking on date/slot, collision is flagged."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_coll@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_coll@agro.in", "FARMER")

    target_date = date.today() + timedelta(days=6)
    with TestingSessionLocal() as db:
        req = ServiceRequest(
            chc_id=env["chc_id"],
            farmer_id=farmer_id,
            field_latitude=30.9050,
            field_longitude=75.8550,
            acreage=5.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date + timedelta(days=3),
            status="APPROVED",
        )
        db.add(req)
        db.flush()

        booking = Booking(
            service_request_id=req.id,
            chc_id=env["chc_id"],
            machine_id=env["machine_id"],
            operator_id=env["operator_id"],
            booking_code="BK-COLL-101",
            scheduled_date=target_date,
            scheduled_slot="HALF_DAY_MORNING",
            status="SCHEDULED",
        )
        db.add(booking)
        db.commit()

    # Propose FULL_DAY which conflicts with morning booking
    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": target_date.isoformat(),
        "scheduled_slot": "FULL_DAY",
        "machine_id": env["machine_id"],
        "operator_id": env["operator_id"],
    }
    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("Machine" in r and "already has active booking" in r for r in data["reasons"])
    assert any("Operator" in r and "already has active booking" in r for r in data["reasons"])


def test_destination_outside_chc_radius_fails(client: TestClient) -> None:
    """A field location beyond CHC operating radius results in a blocking violation."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_rad@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    # Ludhiana is at 30.9010, 75.8573 (operating radius is 30.0 km).
    # Jalandhar is at 31.3260, 75.5762 (~54 km away).
    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": (date.today() + timedelta(days=2)).isoformat(),
        "scheduled_slot": "FULL_DAY",
        "field_latitude": 31.3260,
        "field_longitude": 75.5762,
    }

    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["feasible"] is False
    assert any("exceeding CHC operational radius" in r for r in data["reasons"])
    assert data["constraints"]["within_operating_radius"] is False
    assert data["constraints"]["distance_km"] > 30.0


def test_date_window_and_deadline_violations(client: TestClient) -> None:
    """Scheduled dates outside requested service request window fail with deadline/start reasons."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_win@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_win@agro.in", "FARMER")

    start_date = date.today() + timedelta(days=5)
    end_date = date.today() + timedelta(days=10)

    with TestingSessionLocal() as db:
        req = ServiceRequest(
            chc_id=env["chc_id"],
            farmer_id=farmer_id,
            field_latitude=30.9050,
            field_longitude=75.8550,
            acreage=4.0,
            operation_type="SOWING",
            requested_start_date=start_date,
            requested_end_date=end_date,
            status="APPROVED",
        )
        db.add(req)
        db.commit()
        req_id = req.id

    # Test early date violation
    res_early = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": env["chc_id"],
            "service_request_id": req_id,
            "scheduled_date": (start_date - timedelta(days=2)).isoformat(),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_early.status_code == 200
    data_early = res_early.json()
    assert data_early["feasible"] is False
    assert any("earlier than requested start date" in r for r in data_early["reasons"])
    assert data_early["constraints"]["within_date_window"] is False

    # Test deadline violation
    res_late = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": env["chc_id"],
            "service_request_id": req_id,
            "scheduled_date": (end_date + timedelta(days=2)).isoformat(),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res_late.status_code == 200
    data_late = res_late.json()
    assert data_late["feasible"] is False
    assert any("past requested deadline" in r for r in data_late["reasons"])


def test_acreage_capacity_advisory_warning(client: TestClient) -> None:
    """Large acreage for half-day slot yields an advisory warning without hard blocking."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_warn@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )

    # 10 acres * 0.8h = 8.0 hours estimated work; HALF_DAY_MORNING capacity is 4.0 hours
    payload = {
        "chc_id": env["chc_id"],
        "scheduled_date": (date.today() + timedelta(days=2)).isoformat(),
        "scheduled_slot": "HALF_DAY_MORNING",
        "machine_id": env["machine_id"],
        "field_latitude": 30.9050,
        "field_longitude": 75.8550,
        "acreage": 10.0,
    }
    res = client.post(
        "/api/v1/scheduling/feasibility",
        json=payload,
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    # It is feasible from hard rules, but includes an advisory capacity warning
    assert data["feasible"] is True
    assert len(data["warnings"]) > 0
    assert any("exceeds HALF_DAY_MORNING capacity" in w for w in data["warnings"])
    assert data["constraints"]["capacity_sufficient"] is False


def test_evaluate_existing_booking_endpoint(client: TestClient) -> None:
    """GET /api/v1/scheduling/feasibility/{booking_id} evaluates an existing booking correctly."""
    env = create_base_environment()
    mgr_id, mgr_token = create_user_with_role(
        "mgr_bk_eval@chc.org", "CHC_MANAGER", chc_id=env["chc_id"], chc_role="MANAGER"
    )
    farmer_id, farmer_token = create_user_with_role("farmer_bk_eval@agro.in", "FARMER")

    scheduled_date = date.today() + timedelta(days=7)
    with TestingSessionLocal() as db:
        req = ServiceRequest(
            chc_id=env["chc_id"],
            farmer_id=farmer_id,
            field_latitude=30.9020,
            field_longitude=75.8580,
            acreage=3.5,
            operation_type="HARVESTING",
            requested_start_date=scheduled_date - timedelta(days=1),
            requested_end_date=scheduled_date + timedelta(days=2),
            status="APPROVED",
        )
        db.add(req)
        db.flush()

        booking = Booking(
            service_request_id=req.id,
            chc_id=env["chc_id"],
            machine_id=env["machine_id"],
            operator_id=env["operator_id"],
            booking_code="BK-EVAL-888",
            scheduled_date=scheduled_date,
            scheduled_slot="FULL_DAY",
            status="CONFIRMED",
        )
        db.add(booking)
        db.flush()

        ba = BookingAttachment(booking_id=booking.id, attachment_id=env["attachment_id"])
        db.add(ba)
        db.commit()
        booking_id = booking.id

    # 1. Manager view
    res = client.get(
        f"/api/v1/scheduling/feasibility/{booking_id}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    data = res.json()
    # The booking should NOT conflict with itself
    assert data["feasible"] is True
    assert len(data["reasons"]) == 0
    assert data["constraints"]["within_operating_radius"] is True
    assert data["constraints"]["horsepower_sufficient"] is True

    # 2. Farmer owning the booking view
    res_farmer = client.get(
        f"/api/v1/scheduling/feasibility/{booking_id}",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert res_farmer.status_code == 200
    assert res_farmer.json()["feasible"] is True


def test_scheduling_authorization_and_isolation(client: TestClient) -> None:
    """Verify authorization barriers for proposal evaluation and booking feasibility inspection."""
    env = create_base_environment()
    farmer1_id, farmer1_token = create_user_with_role("farmer1_auth@agro.in", "FARMER")
    farmer2_id, farmer2_token = create_user_with_role("farmer2_auth@agro.in", "FARMER")

    with TestingSessionLocal() as db:
        req1 = ServiceRequest(
            chc_id=env["chc_id"],
            farmer_id=farmer1_id,
            field_latitude=30.9050,
            field_longitude=75.8550,
            acreage=2.0,
            operation_type="SPRAYING",
            requested_start_date=date.today(),
            requested_end_date=date.today() + timedelta(days=5),
            status="APPROVED",
        )
        db.add(req1)
        db.flush()

        booking1 = Booking(
            service_request_id=req1.id,
            chc_id=env["chc_id"],
            booking_code="BK-AUTH-001",
            scheduled_date=date.today() + timedelta(days=2),
            scheduled_slot="FULL_DAY",
            status="PENDING",
        )
        db.add(booking1)
        db.commit()
        req1_id = req1.id
        booking1_id = booking1.id

    # Farmer cannot evaluate proposal without a service request
    res_no_req = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": env["chc_id"],
            "scheduled_date": (date.today() + timedelta(days=2)).isoformat(),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {farmer1_token}"},
    )
    assert res_no_req.status_code == 403

    # Farmer 2 cannot evaluate proposal for Farmer 1's service request
    res_cross_eval = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": env["chc_id"],
            "service_request_id": req1_id,
            "scheduled_date": (date.today() + timedelta(days=2)).isoformat(),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {farmer2_token}"},
    )
    assert res_cross_eval.status_code == 403

    # Farmer 2 cannot inspect feasibility of Farmer 1's booking
    res_cross_view = client.get(
        f"/api/v1/scheduling/feasibility/{booking1_id}",
        headers={"Authorization": f"Bearer {farmer2_token}"},
    )
    assert res_cross_view.status_code == 403

    # Non-existent booking returns 404
    res_404 = client.get(
        "/api/v1/scheduling/feasibility/99999",
        headers={"Authorization": f"Bearer {farmer1_token}"},
    )
    assert res_404.status_code == 404
