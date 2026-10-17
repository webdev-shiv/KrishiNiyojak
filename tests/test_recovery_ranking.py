"""Tests for Recovery Alternatives Generation and Multi-Criteria Ranking (T13).

Covers:
- Generating candidate recovery alternatives for disrupted bookings
- Evaluating alternative machines within the host CHC
- Horsepower compatibility and required implement matching
- Active booking conflict avoidance and maintenance blocking
- Operator qualification and availability tracking
- Multi-factor ranking (Delay 35%, Transit 25%, Cost 25%, Availability 15%)
- Penalization of alternatives exceeding farmer deadlines
- Clear root-cause reporting when no feasible alternative exists
- Preserving existing operational state (no automatic booking mutations)
- Role-based authorization and cross-CHC tenant isolation
"""

import hashlib
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
from app.models.availability import MachineAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.recovery import RecoveryPlan
from app.models.resource import Attachment, Machine, Operator

# Isolated in-memory SQLite database for T13 tests
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


def create_chc_fleet(code_suffix: str = "01") -> dict[str, int]:
    """Helper to create a CHC with multiple machines and operators."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code=f"CHC-RCV-{code_suffix}",
            name=f"Recovery Hub {code_suffix}",
            latitude=31.3260,
            longitude=75.5762,
            operating_radius_km=35.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        # Primary machine (will break down): 50 HP
        m_primary = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-PRI-{code_suffix}",
            make="Mahindra",
            model="575 DI",
            category="TRACTOR",
            horsepower=50.0,
            hourly_rate=Decimal("800.00"),
            status="AVAILABLE",
        )
        # Alt machine 1: 55 HP, low rate
        m_alt1 = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-ALT1-{code_suffix}",
            make="John Deere",
            model="5050D",
            category="TRACTOR",
            horsepower=55.0,
            hourly_rate=Decimal("850.00"),
            status="AVAILABLE",
        )
        # Alt machine 2: 65 HP, higher rate
        m_alt2 = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-ALT2-{code_suffix}",
            make="Sonalika",
            model="DI 60",
            category="TRACTOR",
            horsepower=65.0,
            hourly_rate=Decimal("1100.00"),
            status="AVAILABLE",
        )
        # Incompatible low HP machine: 30 HP
        m_low_hp = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-LOW-{code_suffix}",
            make="Swaraj",
            model="735 FE",
            category="TRACTOR",
            horsepower=30.0,
            hourly_rate=Decimal("600.00"),
            status="AVAILABLE",
        )
        db.add_all([m_primary, m_alt1, m_alt2, m_low_hp])
        db.flush()

        # Operators
        u_op1 = User(
            email=f"op1_{code_suffix}@chc.org",
            full_name=f"Operator One {code_suffix}",
            phone_number=f"+918888{code_suffix.zfill(6)}",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        u_op2 = User(
            email=f"op2_{code_suffix}@chc.org",
            full_name=f"Operator Two {code_suffix}",
            phone_number=f"+917777{code_suffix.zfill(6)}",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add_all([u_op1, u_op2])
        db.flush()

        op1 = Operator(
            user_id=u_op1.id,
            chc_id=chc.id,
            license_number=f"LIC-101-{code_suffix}",
            experience_years=6,
            hourly_rate=Decimal("150.00"),
            status="AVAILABLE",
        )
        op2 = Operator(
            user_id=u_op2.id,
            chc_id=chc.id,
            license_number=f"LIC-102-{code_suffix}",
            experience_years=4,
            hourly_rate=Decimal("150.00"),
            status="AVAILABLE",
        )
        db.add_all([op1, op2])
        db.flush()

        # Implement requiring 45 HP
        att = Attachment(
            chc_id=chc.id,
            name="Rotavator 7ft",
            code=f"ATT-ROTA-{code_suffix}",
            category="ROTAVATOR",
            required_hp_min=45.0,
            hourly_rate=Decimal("200.00"),
            status="AVAILABLE",
        )
        db.add(att)
        db.commit()

        return {
            "chc_id": chc.id,
            "primary_machine_id": m_primary.id,
            "alt1_machine_id": m_alt1.id,
            "alt2_machine_id": m_alt2.id,
            "low_hp_machine_id": m_low_hp.id,
            "operator1_id": op1.id,
            "operator2_id": op2.id,
            "attachment_id": att.id,
        }


def test_generate_recovery_alternatives_success_and_ranking(client: TestClient) -> None:
    """Verify generating recovery alternatives, ranking formula, and plan proposal creation."""
    fleet = create_chc_fleet("01")
    chc_id = fleet["chc_id"]
    m_primary_id = fleet["primary_machine_id"]
    m_alt1_id = fleet["alt1_machine_id"]
    op1_id = fleet["operator1_id"]
    att_id = fleet["attachment_id"]

    _, mgr_token = create_user_with_role("mgr01@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer01@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Create service request and booking on primary machine
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3300,
            field_longitude=75.5800,
            acreage=8.0,
            operation_type="SOWING",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=3),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        booking = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=m_primary_id,
            operator_id=op1_id,
            booking_code="BKG-RCV-001",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(booking)
        db.flush()

        b_att = BookingAttachment(booking_id=booking.id, attachment_id=att_id)
        db.add(b_att)
        db.commit()
        booking_id = booking.id

    # 1. Report breakdown for primary machine
    headers = {"Authorization": f"Bearer {mgr_token}"}
    bkd_payload = {
        "machine_id": m_primary_id,
        "failure_type": "ENGINE",
        "severity": "CRITICAL",
        "description": "Blown head gasket",
    }
    bkd_res = client.post("/api/v1/breakdowns", json=bkd_payload, headers=headers)
    assert bkd_res.status_code == 201
    breakdown_id = bkd_res.json()["breakdown_id"]

    # 2. Generate recovery alternatives
    res = client.post(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers=headers,
    )
    assert res.status_code == 201
    data = res.json()

    assert data["breakdown_id"] == breakdown_id
    assert data["total_affected_bookings"] == 1
    assert data["recoverable_bookings_count"] == 1
    assert data["unrecoverable_bookings_count"] == 0
    assert data["recovery_plan_id"] is not None

    b_plan = data["booking_recovery_plans"][0]
    assert b_plan["booking_id"] == booking_id
    assert len(b_plan["ranked_alternatives"]) >= 1

    # Check ranking order: scores must be in descending order
    scores = [alt["score"] for alt in b_plan["ranked_alternatives"]]
    assert scores == sorted(scores, reverse=True)

    top_alt = b_plan["recommended_alternative"]
    assert top_alt is not None
    # Top alternative should be on the earliest date (zero delay = today)
    assert top_alt["delay_days"] == 0
    assert top_alt["score"] >= 70
    assert len(top_alt["reasons"]) >= 4

    # Verify that booking state in DB was NOT modified (recommendations only!)
    with TestingSessionLocal() as db:
        b = db.get(Booking, booking_id)
        assert b.status == "DISRUPTED"
        assert b.machine_id == m_primary_id  # Machine remains original until execution in T14

        # Verify RecoveryPlan was created in PROPOSED status
        plan = db.get(RecoveryPlan, data["recovery_plan_id"])
        assert plan.status == "PROPOSED"
        assert len(plan.items) == 1
        assert plan.items[0].status == "PENDING"
        assert plan.items[0].replacement_machine_id in (m_alt1_id, fleet["alt2_machine_id"])


def test_horsepower_compatibility_filtering(client: TestClient) -> None:
    """Verify that machines with insufficient horsepower for requested implements are excluded."""
    fleet = create_chc_fleet("02")
    chc_id = fleet["chc_id"]
    m_primary_id = fleet["primary_machine_id"]
    low_hp_id = fleet["low_hp_machine_id"]  # 30 HP
    att_id = fleet["attachment_id"]  # requires 45 HP

    _, mgr_token = create_user_with_role("mgr02@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer02@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=6.0,
            operation_type="PLOWING",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=2),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        booking = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=m_primary_id,
            booking_code="BKG-HP-002",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(booking)
        db.flush()

        b_att = BookingAttachment(booking_id=booking.id, attachment_id=att_id)
        db.add(b_att)
        db.commit()

    headers = {"Authorization": f"Bearer {mgr_token}"}
    bkd_res = client.post(
        "/api/v1/breakdowns",
        json={"machine_id": m_primary_id, "failure_type": "HYDRAULIC", "severity": "MEDIUM"},
        headers=headers,
    )
    breakdown_id = bkd_res.json()["breakdown_id"]

    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers=headers,
    )
    assert res.status_code == 200
    data = res.json()

    alts = data["booking_recovery_plans"][0]["ranked_alternatives"]
    # Verify that the 30 HP machine is never recommended for a 45 HP job
    for alt in alts:
        assert alt["replacement_machine_id"] != low_hp_id
        assert alt["replacement_machine_hp"] >= 45.0


def test_unavailable_resources_and_conflicts_excluded(client: TestClient) -> None:
    """Verify that machines with slot conflicts or maintenance blocks are excluded."""
    fleet = create_chc_fleet("03")
    chc_id = fleet["chc_id"]
    m_primary_id = fleet["primary_machine_id"]
    m_alt1_id = fleet["alt1_machine_id"]

    _, mgr_token = create_user_with_role("mgr03@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer03@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Block alt1 machine for maintenance today
        avail = MachineAvailability(
            machine_id=m_alt1_id,
            slot_date=today,
            slot_type="FULL_DAY",
            status="BLOCKED_MAINTENANCE",
            note="Scheduled oil service",
        )
        db.add(avail)

        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=5.0,
            operation_type="SOWING",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=2),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        booking = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=m_primary_id,
            booking_code="BKG-CONF-003",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(booking)
        db.commit()

    headers = {"Authorization": f"Bearer {mgr_token}"}
    bkd_res = client.post(
        "/api/v1/breakdowns",
        json={"machine_id": m_primary_id, "failure_type": "ELECTRICAL", "severity": "LOW"},
        headers=headers,
    )
    breakdown_id = bkd_res.json()["breakdown_id"]

    res = client.get(f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives", headers=headers)
    assert res.status_code == 200
    data = res.json()

    alts = data["booking_recovery_plans"][0]["ranked_alternatives"]
    # Check that alt1 is never assigned for today (since it is blocked for maintenance)
    today_alt1_assignments = [
        alt
        for alt in alts
        if alt["replacement_machine_id"] == m_alt1_id and alt["proposed_date"] == str(today)
    ]
    assert len(today_alt1_assignments) == 0


def test_deadline_miss_penalized_in_score(client: TestClient) -> None:
    """Verify that alternatives scheduled past deadline receive heavy score penalties."""
    fleet = create_chc_fleet("04")
    chc_id = fleet["chc_id"]
    m_primary_id = fleet["primary_machine_id"]

    _, mgr_token = create_user_with_role("mgr04@chc.org", "CHC_MANAGER", chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer04@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        # Tight deadline: today only
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=5.0,
            operation_type="SOWING",
            requested_start_date=today,
            requested_end_date=today,  # Deadline is today
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        booking = Booking(
            service_request_id=sr.id,
            chc_id=chc_id,
            machine_id=m_primary_id,
            booking_code="BKG-DL-004",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(booking)
        db.commit()

    headers = {"Authorization": f"Bearer {mgr_token}"}
    bkd_res = client.post(
        "/api/v1/breakdowns",
        json={"machine_id": m_primary_id, "failure_type": "ENGINE", "severity": "CRITICAL"},
        headers=headers,
    )
    breakdown_id = bkd_res.json()["breakdown_id"]

    res = client.get(f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives", headers=headers)
    assert res.status_code == 200
    data = res.json()

    alts = data["booking_recovery_plans"][0]["ranked_alternatives"]
    # Check that any alternative proposed after today has missed_deadline=True and lower score
    for alt in alts:
        if alt["delay_days"] > 0:
            assert alt["missed_deadline"] is True
            # The score for a missed deadline must be noticeably lower than on-time alternatives
            same_day_alts = [a for a in alts if a["delay_days"] == 0]
            if same_day_alts:
                assert alt["score"] < same_day_alts[0]["score"]


def test_no_alternative_case_returns_clear_reason(client: TestClient) -> None:
    """Verify that when no alternative machine meets requirements, clear reason is given."""
    with TestingSessionLocal() as db:
        # Create a CHC with only one broken machine and no other machines
        chc = CHC(
            code="CHC-SOLO-05",
            name="Solo Machine Hub",
            latitude=31.3260,
            longitude=75.5762,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        machine = Machine(
            chc_id=chc.id,
            registration_number="PB-08-SOLO-1",
            make="Mahindra",
            model="Single",
            category="TRACTOR",
            horsepower=50.0,
            status="AVAILABLE",
        )
        db.add(machine)
        db.commit()
        solo_chc_id = chc.id
        solo_machine_id = machine.id

    _, mgr_token = create_user_with_role("mgr05@chc.org", "CHC_MANAGER", solo_chc_id, "MANAGER")
    farmer_id, _ = create_user_with_role("farmer05@farm.org", "FARMER")

    today = date.today()

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=solo_chc_id,
            farmer_id=farmer_id,
            field_latitude=31.33,
            field_longitude=75.58,
            acreage=5.0,
            operation_type="SOWING",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=2),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        booking = Booking(
            service_request_id=sr.id,
            chc_id=solo_chc_id,
            machine_id=solo_machine_id,
            booking_code="BKG-NO-ALT-005",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="SCHEDULED",
        )
        db.add(booking)
        db.commit()

    headers = {"Authorization": f"Bearer {mgr_token}"}
    bkd_res = client.post(
        "/api/v1/breakdowns",
        json={
            "machine_id": solo_machine_id,
            "failure_type": "TRANSMISSION",
            "severity": "CRITICAL",
        },
        headers=headers,
    )
    breakdown_id = bkd_res.json()["breakdown_id"]

    res = client.get(f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert data["recoverable_bookings_count"] == 0
    assert data["unrecoverable_bookings_count"] == 1
    plan = data["booking_recovery_plans"][0]
    assert plan["recommended_alternative"] is None
    assert len(plan["ranked_alternatives"]) == 0
    assert plan["no_alternative_reason"] is not None
    assert "No alternative machine" in plan["no_alternative_reason"]


def test_authorization_and_cross_chc_isolation(client: TestClient) -> None:
    """Verify that farmers, operators, and managers from different CHCs are denied access."""
    fleet1 = create_chc_fleet("06")
    fleet2 = create_chc_fleet("07")

    _, farmer_token = create_user_with_role("farmer_rcv_auth@farm.org", "FARMER")
    _, operator_token = create_user_with_role("op_rcv_auth@chc.org", "OPERATOR")
    _, mgr1_token = create_user_with_role(
        "mgr06@chc.org", "CHC_MANAGER", fleet1["chc_id"], "MANAGER"
    )
    _, mgr2_token = create_user_with_role(
        "mgr07@chc.org", "CHC_MANAGER", fleet2["chc_id"], "MANAGER"
    )
    _, admin_token = create_user_with_role("admin_rcv@gov.in", "SUPERADMIN")

    # Manager 1 reports breakdown on Fleet 1
    bkd_res = client.post(
        "/api/v1/breakdowns",
        json={
            "machine_id": fleet1["primary_machine_id"],
            "failure_type": "ENGINE",
            "severity": "LOW",
        },
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    breakdown_id = bkd_res.json()["breakdown_id"]

    # 1. Farmer denied (HTTP 403)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert res.status_code == 403

    # 2. Operator denied (HTTP 403)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers={"Authorization": f"Bearer {operator_token}"},
    )
    assert res.status_code == 403

    # 3. Manager 2 denied cross-CHC access (HTTP 403)
    res = client.post(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert res.status_code == 403

    # 4. Manager 1 authorized (HTTP 200 / 201)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res.status_code == 200

    # 5. Superadmin universally authorized (HTTP 200)
    res = client.get(
        f"/api/v1/breakdowns/{breakdown_id}/recovery-alternatives",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 200
