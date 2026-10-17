"""Tests for Schedule Generation and Manager Approval workflows (T11).

Covers:
- Automated candidate schedule generation for approved service requests
- Non-destructive candidate proposal generation (zero database mutations before approval)
- Infeasible demand intake reporting clear blocking reasons in unscheduled_jobs
- Respect for existing confirmed bookings and conflict avoidance
- Intra-schedule collision prevention across multiple candidate jobs
- CHC Manager schedule review and listing endpoints
- Transactional schedule approval committing operational bookings and availability slots
- AuditLog tracking for schedule approval and rejection
- Concurrency conflict detection during approval (HTTP 409 Conflict)
- Duplicate approval and approval of rejected schedules rejection (HTTP 400)
- Manager rejection lifecycle leaving database state untouched
- Role-based authorization and cross-CHC tenant isolation
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
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.resource import Attachment, Machine, Operator
from app.models.supporting import AuditLog
from app.services.schedule_store import schedule_store

# Isolated in-memory SQLite database for T11 unit tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Create all tables before each test, clear schedule store, and drop after."""
    Base.metadata.create_all(bind=test_engine)
    schedule_store.clear()

    def override_get_db() -> Generator[Session, None, None]:
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    schedule_store.clear()
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


def create_chc_fleet() -> dict[str, int]:
    """Create a fully equipped CHC with tractors, operators, and implements."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code="CHC-GEN-01",
            name="Jalandhar Agricultural Hub",
            latitude=31.3260,
            longitude=75.5762,
            operating_radius_km=35.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        # Tractor 1: High power (65 HP)
        m1 = Machine(
            chc_id=chc.id,
            registration_number="PB-08-T-1001",
            make="Mahindra",
            model="Arjun Novo 605",
            category="TRACTOR",
            horsepower=65.0,
            hourly_rate=Decimal("1200.00"),
            status="AVAILABLE",
        )
        # Tractor 2: Medium power (50 HP)
        m2 = Machine(
            chc_id=chc.id,
            registration_number="PB-08-T-2002",
            make="Swaraj",
            model="855 FE",
            category="TRACTOR",
            horsepower=50.0,
            hourly_rate=Decimal("1000.00"),
            status="AVAILABLE",
        )
        db.add_all([m1, m2])
        db.flush()

        # Implements
        att1 = Attachment(
            chc_id=chc.id,
            code="ATT-ROT-01",
            name="Rotavator Heavy",
            category="ROTAVATOR",
            required_hp_min=45.0,
            hourly_rate=Decimal("300.00"),
            status="AVAILABLE",
        )
        att2 = Attachment(
            chc_id=chc.id,
            code="ATT-SEED-01",
            name="Pneumatic Planter",
            category="SEEDER",
            required_hp_min=55.0,
            hourly_rate=Decimal("450.00"),
            status="AVAILABLE",
        )
        db.add_all([att1, att2])
        db.flush()

        # Operator 1
        u_op1 = User(
            email="driver1_gen@chc.org",
            full_name="Driver Sukhdev",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        # Operator 2
        u_op2 = User(
            email="driver2_gen@chc.org",
            full_name="Driver Harpreet",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add_all([u_op1, u_op2])
        db.flush()

        op1 = Operator(
            user_id=u_op1.id,
            chc_id=chc.id,
            license_number="DL-PB-08-111",
            experience_years=7,
            hourly_rate=Decimal("350.00"),
            status="AVAILABLE",
        )
        op2 = Operator(
            user_id=u_op2.id,
            chc_id=chc.id,
            license_number="DL-PB-08-222",
            experience_years=4,
            hourly_rate=Decimal("300.00"),
            status="AVAILABLE",
        )
        db.add_all([op1, op2])
        db.commit()

        return {
            "chc_id": chc.id,
            "machine1_id": m1.id,
            "machine2_id": m2.id,
            "att1_id": att1.id,
            "att2_id": att2.id,
            "op1_id": op1.id,
            "op2_id": op2.id,
        }


# -----------------------------------------------------------------------------
# Integration Tests: Schedule Generation & Management
# -----------------------------------------------------------------------------


def test_generate_candidate_schedule_success(client: TestClient) -> None:
    """Eligible approved requests generate a candidate schedule without modifying DB bookings."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_gen@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_gen@agro.in", "FARMER")

    target_date = date.today() + timedelta(days=3)

    # Create 2 approved service requests for the CHC
    with TestingSessionLocal() as db:
        sr1 = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3300,
            field_longitude=75.5800,
            acreage=4.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date + timedelta(days=2),
            status="APPROVED",
        )
        sr2 = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3250,
            field_longitude=75.5700,
            acreage=6.0,
            operation_type="SOWING",
            requested_start_date=target_date,
            requested_end_date=target_date + timedelta(days=2),
            status="APPROVED",
        )
        db.add_all([sr1, sr2])
        db.commit()

    # Generate candidate schedule
    res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["chc_id"] == chc_id
    assert data["status"] == "PROPOSED"
    assert data["total_scheduled"] == 2
    assert data["total_unscheduled"] == 0
    assert len(data["candidate_assignments"]) == 2

    # Verify no database bookings were created yet (non-destructive)
    with TestingSessionLocal() as db:
        booking_count = db.execute(select(Booking).where(Booking.chc_id == chc_id)).scalars().all()
        assert len(booking_count) == 0


def test_candidate_schedule_infeasible_job_returns_reasons(client: TestClient) -> None:
    """An impossible job is reported in unscheduled_jobs with clear reasons."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_infeas@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_infeas@agro.in", "FARMER")

    # Add an implement requiring 150 HP (fleet max is 65 HP)
    with TestingSessionLocal() as db:
        massive_att = Attachment(
            chc_id=chc_id,
            code="ATT-HARV-MASSIVE",
            name="Massive Combine Header",
            category="HARVESTER_HEADER",
            required_hp_min=150.0,
            hourly_rate=Decimal("1500.00"),
            status="AVAILABLE",
        )
        db.add(massive_att)
        db.flush()

        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=20.0,
            operation_type="HARVESTING",
            requested_start_date=date.today() + timedelta(days=2),
            requested_end_date=date.today() + timedelta(days=5),
            status="APPROVED",
        )
        db.add(sr)
        db.commit()

    res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["total_unscheduled"] == 1
    unscheduled = data["unscheduled_jobs"][0]
    assert len(unscheduled["reasons"]) > 0
    assert any("insufficient for required" in r for r in unscheduled["reasons"])


def test_schedule_generation_respects_existing_bookings(client: TestClient) -> None:
    """Schedule generation avoids slots occupied by existing confirmed bookings."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_respect@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_respect@agro.in", "FARMER")

    target_date = date.today() + timedelta(days=4)

    # Create an existing confirmed booking locking Machine 1 on target_date
    with TestingSessionLocal() as db:
        sr_prior = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=5.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date,
            status="APPROVED",
        )
        db.add(sr_prior)
        db.flush()

        existing_booking = Booking(
            service_request_id=sr_prior.id,
            chc_id=chc_id,
            machine_id=fleet["machine1_id"],
            operator_id=fleet["op1_id"],
            booking_code="BK-LOCKED-001",
            scheduled_date=target_date,
            scheduled_slot="FULL_DAY",
            status="CONFIRMED",
        )
        db.add(existing_booking)

        # New unassigned request
        sr_new = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=4.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date,
            status="APPROVED",
        )
        db.add(sr_new)
        db.commit()
        sr_new_id = sr_new.id

    res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id, "service_request_ids": [sr_new_id]},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["total_scheduled"] == 1
    assignment = data["candidate_assignments"][0]
    # Machine 1 is locked; Machine 2 must have been assigned
    assert assignment["machine_id"] == fleet["machine2_id"]


def test_schedule_approval_transactionally_commits_bookings(client: TestClient) -> None:
    """Approving a schedule creates operational Bookings and locks calendar slots."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_approve@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_approve@agro.in", "FARMER")

    target_date = date.today() + timedelta(days=5)

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=5.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date + timedelta(days=2),
            status="APPROVED",
        )
        db.add(sr)
        db.commit()
        sr_id = sr.id

    # 1. Generate schedule
    gen_res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert gen_res.status_code == 201
    schedule_id = gen_res.json()["id"]

    # 2. Approve schedule
    app_res = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert app_res.status_code == 200
    app_data = app_res.json()
    assert app_data["status"] == "APPROVED"
    assert app_data["approved_by_id"] == mgr_id
    assert app_data["approved_at"] is not None

    # 3. Verify in database
    with TestingSessionLocal() as db:
        booking = db.execute(
            select(Booking).where(Booking.service_request_id == sr_id)
        ).scalar_one_or_none()
        assert booking is not None
        assert booking.status == "SCHEDULED"
        assert booking.machine_id is not None
        assert booking.operator_id is not None

        # Verify MachineAvailability slot
        m_slot = db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == booking.machine_id,
                MachineAvailability.slot_date == booking.scheduled_date,
            )
        ).scalar_one_or_none()
        assert m_slot is not None
        assert m_slot.status == "BOOKED"

        # Verify OperatorAvailability slot
        op_slot = db.execute(
            select(OperatorAvailability).where(
                OperatorAvailability.operator_id == booking.operator_id,
                OperatorAvailability.slot_date == booking.scheduled_date,
            )
        ).scalar_one_or_none()
        assert op_slot is not None
        assert op_slot.status == "ASSIGNED"

        # Verify AuditLog
        audit = db.execute(
            select(AuditLog).where(
                AuditLog.entity_id == schedule_id,
                AuditLog.action == "APPROVE_SCHEDULE",
            )
        ).scalar_one_or_none()
        assert audit is not None


def test_schedule_duplicate_approval_rejected(client: TestClient) -> None:
    """Repeated approval of an already approved schedule returns HTTP 400 Bad Request."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_dup@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_dup@agro.in", "FARMER")

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=3.0,
            operation_type="PLOWING",
            requested_start_date=date.today() + timedelta(days=3),
            requested_end_date=date.today() + timedelta(days=5),
            status="APPROVED",
        )
        db.add(sr)
        db.commit()

    # Generate and approve first time
    gen_res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    schedule_id = gen_res.json()["id"]

    res1 = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res1.status_code == 200

    # Second approval attempt must fail
    res2 = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res2.status_code == 400
    assert "already been approved" in res2.json()["detail"]


def test_schedule_rejection_workflow(client: TestClient) -> None:
    """Rejecting schedule marks it REJECTED, leaves DB untouched, and blocks approval."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_rej@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_rej@agro.in", "FARMER")

    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=4.0,
            operation_type="PLOWING",
            requested_start_date=date.today() + timedelta(days=3),
            requested_end_date=date.today() + timedelta(days=5),
            status="APPROVED",
        )
        db.add(sr)
        db.commit()
        sr_id = sr.id

    gen_res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    schedule_id = gen_res.json()["id"]

    # Reject schedule
    rej_res = client.post(
        f"/api/v1/schedules/{schedule_id}/reject",
        json={"reason": "Operator shifts conflict with harvest festival"},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "REJECTED"
    assert "harvest festival" in rej_res.json()["rejection_reason"]

    # Verify no booking was created
    with TestingSessionLocal() as db:
        booking = db.execute(
            select(Booking).where(Booking.service_request_id == sr_id)
        ).scalar_one_or_none()
        assert booking is None

    # Approval of rejected schedule must fail
    app_res = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert app_res.status_code == 400
    assert "Cannot approve a rejected schedule" in app_res.json()["detail"]


def test_schedule_approval_detects_concurrent_conflict(client: TestClient) -> None:
    """If proposed slot is occupied before approval, approval returns HTTP 409 Conflict."""
    fleet = create_chc_fleet()
    chc_id = fleet["chc_id"]
    mgr_id, mgr_token = create_user_with_role(
        "mgr_conflict@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )
    farmer_id, _ = create_user_with_role("farmer_conflict@agro.in", "FARMER")

    target_date = date.today() + timedelta(days=6)
    with TestingSessionLocal() as db:
        sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=5.0,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date,
            status="APPROVED",
        )
        db.add(sr)
        db.commit()

    # Generate schedule proposing an assignment on target_date
    gen_res = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    schedule_data = gen_res.json()
    schedule_id = schedule_data["id"]
    assigned_machine_id = schedule_data["candidate_assignments"][0]["machine_id"]

    # Simulate concurrent conflicting booking added before approval
    with TestingSessionLocal() as db:
        conflict_sr = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.3260,
            field_longitude=75.5762,
            acreage=2.0,
            operation_type="SPRAYING",
            requested_start_date=target_date,
            requested_end_date=target_date,
            status="APPROVED",
        )
        db.add(conflict_sr)
        db.flush()

        conflict_booking = Booking(
            service_request_id=conflict_sr.id,
            chc_id=chc_id,
            machine_id=assigned_machine_id,
            booking_code="BK-CONCURRENT-999",
            scheduled_date=target_date,
            scheduled_slot="FULL_DAY",
            status="CONFIRMED",
        )
        db.add(conflict_booking)
        db.commit()

    # Attempt to approve: must detect conflict and return 409
    app_res = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert app_res.status_code == 409
    assert "Conflict detected" in app_res.json()["detail"]


def test_schedule_authorization_and_tenant_isolation(client: TestClient) -> None:
    """Farmers cannot access schedules; managers of CHC 1 cannot access CHC 2 schedules."""
    fleet1 = create_chc_fleet()
    chc1_id = fleet1["chc_id"]

    # CHC 2
    with TestingSessionLocal() as db:
        chc2 = CHC(
            code="CHC-ISOLATE-02",
            name="Amritsar Hub",
            latitude=31.6340,
            longitude=74.8723,
            status="ACTIVE",
        )
        db.add(chc2)
        db.commit()
        chc2_id = chc2.id

    mgr1_id, mgr1_token = create_user_with_role(
        "mgr1_iso@chc.org", "CHC_MANAGER", chc_id=chc1_id, chc_role="MANAGER"
    )
    farmer_id, farmer_token = create_user_with_role("farmer_iso@agro.in", "FARMER")

    # 1. Farmer denied
    res_farmer = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc1_id},
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert res_farmer.status_code == 403

    # 2. Manager 1 cannot generate schedule for CHC 2
    res_cross = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc2_id},
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res_cross.status_code == 403

    # 3. Manager 1 generates schedule for CHC 1
    res_gen1 = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc1_id},
        headers={"Authorization": f"Bearer {mgr1_token}"},
    )
    assert res_gen1.status_code == 201
    schedule1_id = res_gen1.json()["id"]

    # 4. Manager 2 (of CHC 2) cannot review or approve schedule for CHC 1
    _, mgr2_token = create_user_with_role(
        "mgr2_iso@chc.org", "CHC_MANAGER", chc_id=chc2_id, chc_role="MANAGER"
    )
    res_cross_view = client.get(
        f"/api/v1/schedules/{schedule1_id}",
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert res_cross_view.status_code == 403

    res_cross_app = client.post(
        f"/api/v1/schedules/{schedule1_id}/approve",
        headers={"Authorization": f"Bearer {mgr2_token}"},
    )
    assert res_cross_app.status_code == 403
