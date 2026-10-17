"""Tests for Breakdown Impact Analysis and Customer Priority workflows (T12).

Covers:
- Machine breakdown reporting by authorized CHC manager
- Machine status transition to BROKEN_DOWN and availability blocking
- Affected future booking identification (>= breakdown date)
- Strict exclusion of CANCELLED and COMPLETED bookings
- Exclusion of bookings scheduled on other operational machines
- Transparent customer priority score calculation (1-100) and sorting
- Explanatory reasons for each scoring factor
- Graceful handling of missing acreage, missing deadlines, or unknown ops with documented defaults
- Status transition of affected bookings to DISRUPTED
- Cross-CHC tenant isolation and role-based authorization (Farmer, Operator, Manager, Superadmin)
- Retrieval of breakdown impact analysis and listing endpoints
"""

from collections.abc import Generator
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.main import app
from app.models.availability import MachineAvailability
from app.models.booking import Booking, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.recovery import BookingPriority
from app.models.resource import Machine

# Isolated in-memory SQLite database for T12 tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Create all tables before each test and drop after."""
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


def create_user_with_role(
    email: str,
    role_name: str,
    chc_id: int | None = None,
    chc_role: str | None = None,
) -> tuple[int, str]:
    """Create user, assign role, and return (user_id, jwt_token)."""
    with TestingSessionLocal() as db:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()

        import hashlib

        phone_hash = int(hashlib.md5(email.encode()).hexdigest()[:8], 16) % 10000000000
        phone = f"+91{phone_hash:010d}"

        user = User(
            email=email,
            full_name=f"User {role_name}",
            phone_number=phone,
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


def create_chc_and_machine(code_suffix: str = "01") -> tuple[int, int]:
    """Helper to create a CHC and a machine."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code=f"CHC-BKD-{code_suffix}",
            name=f"Breakdown Hub {code_suffix}",
            latitude=31.3260,
            longitude=75.5762,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        machine = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-BKD-{code_suffix}",
            make="John Deere",
            model="5050D",
            category="TRACTOR",
            horsepower=50.0,
            hourly_rate=Decimal("850.00"),
            status="AVAILABLE",
        )
        db.add(machine)
        db.commit()
        db.refresh(chc)
        db.refresh(machine)
        return chc.id, machine.id


def test_report_breakdown_and_impact_workflow(client: TestClient) -> None:
    """Test breakdown reporting workflow: machine status, availability slots, and affected jobs."""
    chc_id, machine_id = create_chc_and_machine("01")
    manager_id, manager_token = create_user_with_role(
        "mgr1@chc.org", "CHC_MANAGER", chc_id, "MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer1@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Create availability slot for today and tomorrow
        s1 = MachineAvailability(
            machine_id=machine_id, slot_date=today, slot_type="FULL_DAY", status="FREE"
        )
        s2 = MachineAvailability(
            machine_id=machine_id,
            slot_date=today + timedelta(days=1),
            slot_type="FULL_DAY",
            status="FREE",
        )
        db.add_all([s1, s2])

        # Service request 1: Sowing, 10 acres, deadline in 2 days
        sr1 = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3300,
            field_longitude=75.5800,
            acreage=10.0,
            operation_type="SOWING",
            crop_type="WHEAT",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=2),
            status="APPROVED",
        )
        db.add(sr1)
        db.flush()

        b1 = Booking(
            service_request_id=sr1.id,
            chc_id=chc_id,
            machine_id=machine_id,
            booking_code="BKG-BKD-101",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(b1)
        db.commit()
        booking1_id = b1.id

    # Report breakdown
    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_id,
        "failure_type": "ENGINE",
        "severity": "CRITICAL",
        "description": "Engine overheating and coolant loss in field",
        "expected_repair_hours": 48.0,
    }

    response = client.post("/api/v1/breakdowns", json=payload, headers=headers)
    assert response.status_code == 201
    data = response.json()

    assert data["breakdown_id"] > 0
    assert data["machine_id"] == machine_id
    assert data["failure_type"] == "ENGINE"
    assert data["severity"] == "CRITICAL"
    assert data["total_affected_bookings"] == 1
    assert data["estimated_downtime_hours"] == 48.0

    affected = data["affected_bookings"][0]
    assert affected["booking_id"] == booking1_id
    assert affected["operation_type"] == "SOWING"
    assert affected["crop_type"] == "WHEAT"
    assert affected["acreage"] == 10.0
    assert affected["status"] == "DISRUPTED"
    assert affected["priority_score"] >= 60
    assert len(affected["priority_reasons"]) > 0

    # Verify machine status in DB is BROKEN_DOWN
    with TestingSessionLocal() as db:
        m = db.get(Machine, machine_id)
        assert m.status == "BROKEN_DOWN"

        # Verify availability slots are BLOCKED_MAINTENANCE
        slots = (
            db.execute(
                select(MachineAvailability).where(MachineAvailability.machine_id == machine_id)
            )
            .scalars()
            .all()
        )
        for slot in slots:
            assert slot.status == "BLOCKED_MAINTENANCE"

        # Verify booking status in DB is DISRUPTED
        b = db.get(Booking, booking1_id)
        assert b.status == "DISRUPTED"

        # Verify BookingPriority was persisted
        bp = db.execute(
            select(BookingPriority).where(BookingPriority.booking_id == booking1_id)
        ).scalar_one_or_none()
        assert bp is not None
        assert bp.priority_score == affected["priority_score"]


def test_affected_booking_identification_and_exclusions(client: TestClient) -> None:
    """Verify that cancelled and completed bookings and other machines' bookings are excluded."""
    chc_id, machine_1 = create_chc_and_machine("10")
    _, machine_2 = create_chc_and_machine("11")

    _, manager_token = create_user_with_role("mgr10@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer10@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3300,
            field_longitude=75.5800,
            acreage=5.0,
            operation_type="PLOWING",
            requested_start_date=today - timedelta(days=5),
            requested_end_date=today + timedelta(days=5),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        # 1. Past booking on machine 1 (yesterday) -> EXCLUDED
        b_past = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_1,
            booking_code="BKG-PAST",
            scheduled_date=today - timedelta(days=1),
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        # 2. Future booking on machine 1 but CANCELLED -> EXCLUDED
        b_cancelled = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_1,
            booking_code="BKG-CANCELLED",
            scheduled_date=today + timedelta(days=1),
            scheduled_slot="FULL_DAY",
            status="CANCELLED",
        )
        # 3. Future booking on machine 1 but COMPLETED -> EXCLUDED
        b_completed = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_1,
            booking_code="BKG-COMPLETED",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="COMPLETED",
        )
        # 4. Future booking on machine 2 (different machine) -> EXCLUDED
        b_other_machine = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_2,
            booking_code="BKG-OTHER-MACH",
            scheduled_date=today + timedelta(days=1),
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        # 5. Future booking on machine 1, SCHEDULED -> INCLUDED
        b_valid_future = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_1,
            booking_code="BKG-VALID-FUT",
            scheduled_date=today + timedelta(days=2),
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add_all([b_past, b_cancelled, b_completed, b_other_machine, b_valid_future])
        db.commit()
        valid_id = b_valid_future.id

    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_1,
        "failure_type": "HYDRAULIC",
        "severity": "MEDIUM",
        "description": "Hydraulic hose burst",
    }

    res = client.post("/api/v1/breakdowns", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["total_affected_bookings"] == 1
    assert data["affected_bookings"][0]["booking_id"] == valid_id
    assert data["affected_bookings"][0]["booking_code"] == "BKG-VALID-FUT"


def test_customer_priority_scoring_and_ordering(client: TestClient) -> None:
    """Verify affected bookings have transparent weights and are returned in priority order."""
    chc_id, machine_id = create_chc_and_machine("20")
    _, manager_token = create_user_with_role("mgr20@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer20@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Job A: SOWING, 25 acres, scheduled on exact deadline (0 buffer) -> highest priority
        sr_a = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=25.0,
            operation_type="SOWING",
            crop_type="WHEAT",
            requested_start_date=today,
            requested_end_date=today,
            status="APPROVED",
        )
        # Job B: HARVESTING, 12 acres, 1 day buffer
        sr_b = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=12.0,
            operation_type="HARVESTING",
            crop_type="PADDY",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=1),
            status="APPROVED",
        )
        # Job C: PLOWING, 3 acres, 4 days buffer -> should be lowest priority
        sr_c = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=3.0,
            operation_type="PLOWING",
            crop_type="MUSTARD",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=4),
            status="APPROVED",
        )
        db.add_all([sr_a, sr_b, sr_c])
        db.flush()

        b_c = Booking(
            service_request_id=sr_c.id,
            chc_id=chc_id,
            machine_id=machine_id,
            booking_code="BKG-C",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        b_a = Booking(
            service_request_id=sr_a.id,
            chc_id=chc_id,
            machine_id=machine_id,
            booking_code="BKG-A",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        b_b = Booking(
            service_request_id=sr_b.id,
            chc_id=chc_id,
            machine_id=machine_id,
            booking_code="BKG-B",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add_all([b_c, b_a, b_b])
        db.commit()

    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_id,
        "failure_type": "TRANSMISSION",
        "severity": "CRITICAL",
        "description": "Gearbox locked",
        "expected_repair_hours": 72.0,
    }

    res = client.post("/api/v1/breakdowns", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["total_affected_bookings"] == 3
    affected = data["affected_bookings"]

    # Verify descending priority score ordering
    scores = [item["priority_score"] for item in affected]
    assert scores == sorted(scores, reverse=True)

    # Job A must be first with highest priority
    assert affected[0]["booking_code"] == "BKG-A"
    assert affected[0]["operation_type"] == "SOWING"
    assert affected[0]["buffer_days"] == 0
    assert affected[0]["priority_score"] > affected[1]["priority_score"]

    # Job C must be last with lowest priority
    assert affected[2]["booking_code"] == "BKG-C"
    assert affected[2]["operation_type"] == "PLOWING"
    assert affected[1]["priority_score"] > affected[2]["priority_score"]

    # Verify each score has explanatory reasons
    for item in affected:
        assert len(item["priority_reasons"]) >= 4


def test_missing_data_uses_documented_defaults(client: TestClient) -> None:
    """Verify that when acreage or deadline is missing/unspecified, documented defaults are used."""
    chc_id, machine_id = create_chc_and_machine("30")
    _, manager_token = create_user_with_role("mgr30@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer30@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Service request with 0 acreage, unknown op, and requested date window
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=0.0,
            operation_type="UNKNOWN_OP",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=3),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        b = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=machine_id,
            booking_code="BKG-MISSING-DATA",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(b)
        db.commit()

    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_id,
        "failure_type": "ELECTRICAL",
        "severity": "LOW",
    }

    res = client.post("/api/v1/breakdowns", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["total_affected_bookings"] == 1
    item = data["affected_bookings"][0]
    # Priority score should be valid and between 1 and 100
    assert 1 <= item["priority_score"] <= 100
    # Check that reasons transparently mention default baseline
    reasons_text = " ".join(item["priority_reasons"])
    assert "baseline default" in reasons_text


def test_authorization_and_cross_chc_isolation(client: TestClient) -> None:
    """Verify that farmers/operators cannot report breakdowns and managers cannot cross CHCs."""
    chc_1, machine_1 = create_chc_and_machine("41")
    chc_2, machine_2 = create_chc_and_machine("42")

    _, farmer_token = create_user_with_role("farmer_auth@farm.org", "FARMER")
    _, operator_token = create_user_with_role("op_auth@chc.org", "OPERATOR")
    _, mgr1_token = create_user_with_role("mgr41@chc.org", "CHC_MANAGER", chc_1, "MANAGER")
    _, mgr2_token = create_user_with_role("mgr42@chc.org", "CHC_MANAGER", chc_2, "MANAGER")
    _, admin_token = create_user_with_role("admin@system.gov", "SUPERADMIN")

    payload_m1 = {
        "machine_id": machine_1,
        "failure_type": "ENGINE",
        "severity": "CRITICAL",
        "description": "Cylinder head crack",
    }

    # 1. Farmer cannot report breakdown (HTTP 403)
    res = client.post(
        "/api/v1/breakdowns", json=payload_m1, headers={"Authorization": f"Bearer {farmer_token}"}
    )
    assert res.status_code == 403

    # 2. Operator cannot report breakdown (HTTP 403)
    res = client.post(
        "/api/v1/breakdowns", json=payload_m1, headers={"Authorization": f"Bearer {operator_token}"}
    )
    assert res.status_code == 403

    # 3. Manager 2 cannot report breakdown on Machine 1 (CHC 1) (HTTP 403 Cross-CHC Isolation)
    res = client.post(
        "/api/v1/breakdowns", json=payload_m1, headers={"Authorization": f"Bearer {mgr2_token}"}
    )
    assert res.status_code == 403
    assert f"not authorized to manage CHC {chc_1}" in res.json()["detail"]

    # 4. Manager 1 successfully reports breakdown on Machine 1 (CHC 1) (HTTP 201)
    res = client.post(
        "/api/v1/breakdowns", json=payload_m1, headers={"Authorization": f"Bearer {mgr1_token}"}
    )
    assert res.status_code == 201
    breakdown_id = res.json()["breakdown_id"]

    # 5. Manager 2 cannot access impact analysis for CHC 1's breakdown (HTTP 403)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/impact",
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert res.status_code == 403

    # 6. Manager 1 CAN access impact analysis for their own breakdown (HTTP 200)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/impact",
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res.status_code == 200
    assert res.json()["breakdown_id"] == breakdown_id

    # 7. Superadmin has universal access (HTTP 200)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/impact",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
    assert res.json()["breakdown_id"] == breakdown_id


def test_machine_specific_breakdown_endpoint(client: TestClient) -> None:
    """Verify POST /api/v1/machines/{machine_id}/breakdown endpoint."""
    chc_id, machine_id = create_chc_and_machine("50")
    _, manager_token = create_user_with_role("mgr50@chc.org", "CHC_MANAGER", chc_id, "MANAGER")

    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_id,
        "failure_type": "PUNCTURE",
        "severity": "LOW",
        "description": "Rear tyre puncture during transport",
    }

    res = client.post(f"/api/v1/machines/{machine_id}/breakdown", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()
    assert data["machine_id"] == machine_id
    assert data["failure_type"] == "PUNCTURE"
    assert data["severity"] == "LOW"


def test_list_breakdowns_endpoint(client: TestClient) -> None:
    """Verify GET /api/v1/breakdowns listing and filtering."""
    chc_id, machine_id = create_chc_and_machine("60")
    _, manager_token = create_user_with_role("mgr60@chc.org", "CHC_MANAGER", chc_id, "MANAGER")

    headers = {"Authorization": f"Bearer {manager_token}"}
    payload = {
        "machine_id": machine_id,
        "failure_type": "IMPLEMENT",
        "severity": "MEDIUM",
        "description": "PTO shaft disengaged",
    }
    client.post("/api/v1/breakdowns", json=payload, headers=headers)

    res = client.get("/api/v1/breakdowns", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 1
    assert data["items"][0]["machine_id"] == machine_id
