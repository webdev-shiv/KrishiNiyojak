"""Tests for Recovery Plan Approval, Execution, and Atomic Rollback (T14).

Covers:
- CHC-manager-authorized retrieval of proposed recovery plans
- Live re-validation upon approval (machine/attachment compatibility, operator availability,
  booking conflicts, travel estimates, farmer deadlines)
- Atomic transactional execution: updating bookings, availability slots, and plan items
- Rejection workflow leaving bookings and resources untouched
- Duplicate approval and invalid state prevention (HTTP 400)
- Concurrent booking/resource conflict detection with clear error (HTTP 409)
- Atomic rollback ensuring zero partial state mutation on conflict or failure
- CHC tenant isolation preventing cross-CHC approval/rejection (HTTP 403)
- Immutable AuditLog generation with previous/new assignments and actors
- Operational dispatch notifications persisted with clean abstraction
"""

import hashlib
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
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.recovery import MachineBreakdown, RecoveryPlan, RecoveryPlanItem
from app.models.resource import Attachment, Machine, Operator
from app.models.supporting import AuditLog, Notification

# In-memory SQLite database for isolated test execution
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db() -> Generator[None, None, None]:
    """Create fresh database schema before each test and drop after."""
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
    """Helper to register user, role, and CHC membership, returning (user_id, token)."""
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


def seed_breakdown_environment(code_suffix: str = "T14") -> dict[str, int]:
    """Seed a full operational CHC with breakdown, affected booking, and candidate resources."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code=f"CHC-{code_suffix}",
            name=f"Execution Hub {code_suffix}",
            latitude=31.3260,
            longitude=75.5762,
            operating_radius_km=35.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        # Primary machine (broken)
        m_pri = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-BROKEN-{code_suffix}",
            make="Mahindra",
            model="575 DI",
            category="TRACTOR",
            horsepower=50.0,
            hourly_rate=Decimal("800.00"),
            status="BROKEN_DOWN",
        )
        # Substitute machine (available)
        m_alt = Machine(
            chc_id=chc.id,
            registration_number=f"PB-08-REPLACE-{code_suffix}",
            make="John Deere",
            model="5050D",
            category="TRACTOR",
            horsepower=55.0,
            hourly_rate=Decimal("850.00"),
            status="AVAILABLE",
        )
        db.add_all([m_pri, m_alt])
        db.flush()

        # Farmer
        f_hash = (
            int(hashlib.md5(f"farmer_{code_suffix}".encode()).hexdigest()[:8], 16) % 10000000000
        )
        farmer = User(
            email=f"farmer_{code_suffix}@example.com",
            full_name=f"Farmer {code_suffix}",
            phone_number=f"+91{f_hash:010d}",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        # Replacement Operator
        op_hash = int(hashlib.md5(f"op_{code_suffix}".encode()).hexdigest()[:8], 16) % 10000000000
        op_user = User(
            email=f"op_{code_suffix}@example.com",
            full_name=f"Operator {code_suffix}",
            phone_number=f"+91{op_hash:010d}",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add_all([farmer, op_user])
        db.flush()

        operator = Operator(
            chc_id=chc.id,
            user_id=op_user.id,
            license_number=f"DL-EXEC-{code_suffix}",
            experience_years=5,
            hourly_rate=Decimal("200.00"),
            status="AVAILABLE",
        )
        db.add(operator)
        db.flush()

        # Attachment
        attachment = Attachment(
            chc_id=chc.id,
            name="Heavy Duty Rotavator",
            category="TILLAGE",
            code=f"ROT-{code_suffix}",
            required_hp_min=45.0,
            hourly_rate=Decimal("250.00"),
            status="AVAILABLE",
        )
        db.add(attachment)
        db.flush()

        # Service Request
        target_date = date.today() + timedelta(days=2)
        sr = ServiceRequest(
            chc_id=chc.id,
            farmer_id=farmer.id,
            field_latitude=31.3300,
            field_longitude=75.5800,
            acreage=3.5,
            operation_type="PLOWING",
            requested_start_date=target_date,
            requested_end_date=target_date + timedelta(days=2),
            estimated_cost=Decimal("3500.00"),
            status="APPROVED",
        )
        db.add(sr)
        db.flush()

        # Disrupted Booking
        booking = Booking(
            service_request_id=sr.id,
            chc_id=chc.id,
            machine_id=m_pri.id,
            operator_id=operator.id,
            booking_code=f"BK-DISRUPT-{code_suffix}",
            scheduled_date=target_date,
            scheduled_slot="FULL_DAY",
            status="DISRUPTED",
            total_cost=Decimal("3500.00"),
            payment_status="PENDING",
        )
        db.add(booking)
        db.flush()

        db.add(BookingAttachment(booking_id=booking.id, attachment_id=attachment.id))

        # Breakdown Incident
        breakdown = MachineBreakdown(
            machine_id=m_pri.id,
            booking_id=booking.id,
            reported_by_id=op_user.id,
            failure_type="ENGINE",
            severity="CRITICAL",
            description="Engine block cracked in field",
            status="REPORTED",
        )
        db.add(breakdown)
        db.flush()

        # Proposed RecoveryPlan
        plan = RecoveryPlan(
            breakdown_id=breakdown.id,
            strategy="REPLACE_MACHINE",
            status="PROPOSED",
            estimated_delay_hours=0.0,
            estimated_cost=Decimal("3600.00"),
            created_by_id=op_user.id,
        )
        db.add(plan)
        db.flush()

        # Plan Item
        item = RecoveryPlanItem(
            recovery_plan_id=plan.id,
            affected_booking_id=booking.id,
            replacement_machine_id=m_alt.id,
            replacement_operator_id=operator.id,
            action_type="REASSIGN_MACHINE",
            new_scheduled_date=target_date,
            status="PENDING",
        )
        db.add(item)
        db.commit()

        return {
            "chc_id": chc.id,
            "broken_machine_id": m_pri.id,
            "replacement_machine_id": m_alt.id,
            "operator_id": operator.id,
            "farmer_id": farmer.id,
            "service_request_id": sr.id,
            "booking_id": booking.id,
            "breakdown_id": breakdown.id,
            "plan_id": plan.id,
            "plan_item_id": item.id,
        }


def test_get_recovery_plan(client: TestClient) -> None:
    """Test retrieving proposed recovery plan details by authorized CHC manager."""
    ids = seed_breakdown_environment("GET")
    _, mgr_token = create_user_with_role(
        "mgr_get@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    response = client.get(
        f"/api/v1/recovery-plans/{ids['plan_id']}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == ids["plan_id"]
    assert data["breakdown_id"] == ids["breakdown_id"]
    assert data["status"] == "PROPOSED"
    assert len(data["items"]) == 1
    assert data["items"][0]["replacement_machine_id"] == ids["replacement_machine_id"]


def test_successful_recovery_approval_and_execution(client: TestClient) -> None:
    """Test atomic approval and execution of recovery plan."""
    ids = seed_breakdown_environment("EXEC")
    mgr_id, mgr_token = create_user_with_role(
        "mgr_exec@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    response = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "EXECUTED"
    assert data["executed_items_count"] == 1
    assert data["audit_log_id"] is not None
    assert data["notifications_dispatched_count"] >= 1

    # Verify atomic database changes
    with TestingSessionLocal() as db:
        # 1. Booking reassigned and scheduled
        bk = db.execute(select(Booking).where(Booking.id == ids["booking_id"])).scalar_one()
        assert bk.machine_id == ids["replacement_machine_id"]
        assert bk.operator_id == ids["operator_id"]
        assert bk.status == "SCHEDULED"

        # 2. Machine Availability updated to BOOKED
        m_slot = db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == ids["replacement_machine_id"],
                MachineAvailability.slot_date == bk.scheduled_date,
            )
        ).scalar_one_or_none()
        assert m_slot is not None
        assert m_slot.status == "BOOKED"
        assert f"Recovery Plan #{ids['plan_id']}" in m_slot.note

        # 3. Operator Availability updated to ASSIGNED
        op_slot = db.execute(
            select(OperatorAvailability).where(
                OperatorAvailability.operator_id == ids["operator_id"],
                OperatorAvailability.slot_date == bk.scheduled_date,
            )
        ).scalar_one_or_none()
        assert op_slot is not None
        assert op_slot.status == "ASSIGNED"

        # 4. Plan and Item status updated
        plan = db.execute(
            select(RecoveryPlan).where(RecoveryPlan.id == ids["plan_id"])
        ).scalar_one()
        assert plan.status == "EXECUTED"
        assert plan.approved_by_id == mgr_id

        item = db.execute(
            select(RecoveryPlanItem).where(RecoveryPlanItem.id == ids["plan_item_id"])
        ).scalar_one()
        assert item.status == "COMPLETED"

        # 5. Breakdown updated to RECOVERING
        bd = db.execute(
            select(MachineBreakdown).where(MachineBreakdown.id == ids["breakdown_id"])
        ).scalar_one()
        assert bd.status == "RECOVERING"

        # 6. AuditLog created with previous and new assignment details
        audit = db.execute(
            select(AuditLog).where(
                AuditLog.action == "APPROVE_RECOVERY_PLAN",
                AuditLog.entity_id == str(ids["plan_id"]),
            )
        ).scalar_one_or_none()
        assert audit is not None
        assert audit.chc_id == ids["chc_id"]
        assert audit.user_id == mgr_id
        assert str(ids["broken_machine_id"]) in audit.payload_before
        assert str(ids["replacement_machine_id"]) in audit.payload_after

        # 7. Notifications persisted
        notifs = db.execute(select(Notification)).scalars().all()
        assert len(notifs) >= 1
        farmer_notif = next((n for n in notifs if n.user_id == ids["farmer_id"]), None)
        assert farmer_notif is not None
        assert "Recovery Plan Approved" in farmer_notif.title
        assert farmer_notif.status == "PENDING"


def test_prevent_duplicate_approval(client: TestClient) -> None:
    """Test that approving an already executed recovery plan returns HTTP 400."""
    ids = seed_breakdown_environment("DUP")
    _, mgr_token = create_user_with_role(
        "mgr_dup@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    first_res = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert first_res.status_code == 200

    second_res = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert second_res.status_code == 400
    assert "already been approved and executed" in second_res.json()["detail"]


def test_rejection_workflow_leaves_operational_state_untouched(client: TestClient) -> None:
    """Test rejecting a proposed recovery plan records audit trail and modifies zero bookings."""
    ids = seed_breakdown_environment("REJ")
    mgr_id, mgr_token = create_user_with_role(
        "mgr_rej@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    response = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/reject",
        headers={"Authorization": f"Bearer {mgr_token}"},
        json={"reason": "Fleet manager prefers manual tractor dispatch"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "REJECTED"
    assert data["executed_items_count"] == 0

    with TestingSessionLocal() as db:
        # Plan marked REJECTED
        plan = db.execute(
            select(RecoveryPlan).where(RecoveryPlan.id == ids["plan_id"])
        ).scalar_one()
        assert plan.status == "REJECTED"

        # Plan item marked FAILED
        item = db.execute(
            select(RecoveryPlanItem).where(RecoveryPlanItem.id == ids["plan_item_id"])
        ).scalar_one()
        assert item.status == "FAILED"

        # Booking is UNTOUCHED (remains DISRUPTED with original machine)
        bk = db.execute(select(Booking).where(Booking.id == ids["booking_id"])).scalar_one()
        assert bk.status == "DISRUPTED"
        assert bk.machine_id == ids["broken_machine_id"]

        # Substitute machine availability slots NOT booked
        m_slot = db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == ids["replacement_machine_id"]
            )
        ).scalar_one_or_none()
        assert m_slot is None

        # AuditLog recorded with rejection reason
        audit = db.execute(
            select(AuditLog).where(
                AuditLog.action == "REJECT_RECOVERY_PLAN",
                AuditLog.entity_id == str(ids["plan_id"]),
            )
        ).scalar_one_or_none()
        assert audit is not None
        assert audit.user_id == mgr_id
        assert "prefers manual tractor dispatch" in audit.payload_after


def test_prevent_approving_rejected_plan(client: TestClient) -> None:
    """Test that approving a previously rejected plan is rejected with HTTP 400."""
    ids = seed_breakdown_environment("REJ_APP")
    _, mgr_token = create_user_with_role(
        "mgr_rejapp@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/reject",
        headers={"Authorization": f"Bearer {mgr_token}"},
        json={"reason": "Cancelled"},
    )

    app_res = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert app_res.status_code == 400
    assert "Cannot approve rejected recovery plan" in app_res.json()["detail"]


def test_live_conflict_detection_and_atomic_rollback(client: TestClient) -> None:
    """Test that concurrent resource booking causes live re-validation failure and rolls back."""
    ids = seed_breakdown_environment("CONF")
    _, mgr_token = create_user_with_role(
        "mgr_conf@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    # Introduce concurrent conflict: replacement machine is blocked for maintenance
    with TestingSessionLocal() as db:
        bk = db.execute(select(Booking).where(Booking.id == ids["booking_id"])).scalar_one()
        db.add(
            MachineAvailability(
                machine_id=ids["replacement_machine_id"],
                slot_date=bk.scheduled_date,
                slot_type=bk.scheduled_slot,
                status="BLOCKED_MAINTENANCE",
                note="Sudden hydraulic leak detected",
            )
        )
        db.commit()

    # Attempt to approve recovery plan
    response = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "Conflict detected during recovery approval" in detail
    assert "blocked for maintenance" in detail

    # Verify ATOMIC ROLLBACK: Booking remains DISRUPTED, plan remains PROPOSED
    with TestingSessionLocal() as db:
        bk = db.execute(select(Booking).where(Booking.id == ids["booking_id"])).scalar_one()
        assert bk.status == "DISRUPTED"
        assert bk.machine_id == ids["broken_machine_id"]

        plan = db.execute(
            select(RecoveryPlan).where(RecoveryPlan.id == ids["plan_id"])
        ).scalar_one()
        assert plan.status == "PROPOSED"

        # Failed approval recorded in AuditLog
        audit = db.execute(
            select(AuditLog).where(
                AuditLog.action == "FAILED_RECOVERY_APPROVAL",
                AuditLog.entity_id == str(ids["plan_id"]),
            )
        ).scalar_one_or_none()
        assert audit is not None
        assert "blocked for maintenance" in audit.payload_after


def test_stale_alternative_booking_cancelled(client: TestClient) -> None:
    """Test that approving a plan when affected booking was cancelled returns HTTP 409."""
    ids = seed_breakdown_environment("STALE")
    _, mgr_token = create_user_with_role(
        "mgr_stale@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    # Farmer cancels booking before manager approves recovery
    with TestingSessionLocal() as db:
        bk = db.execute(select(Booking).where(Booking.id == ids["booking_id"])).scalar_one()
        bk.status = "CANCELLED"
        db.commit()

    response = client.post(
        f"/api/v1/recovery-plans/{ids['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert response.status_code == 409
    assert "already CANCELLED" in response.json()["detail"]


def test_authorization_and_tenant_isolation(client: TestClient) -> None:
    """Test RBAC enforcement and CHC tenant boundary isolation."""
    ids_a = seed_breakdown_environment("A")
    ids_b = seed_breakdown_environment("B")

    # Manager of CHC-B
    _, mgr_b_token = create_user_with_role(
        "mgr_b@example.com", "CHC_MANAGER", chc_id=ids_b["chc_id"], chc_role="MANAGER"
    )

    # Manager B attempts to view CHC A's recovery plan -> HTTP 403
    get_res = client.get(
        f"/api/v1/recovery-plans/{ids_a['plan_id']}",
        headers={"Authorization": f"Bearer {mgr_b_token}"},
    )
    assert get_res.status_code == 403

    # Manager B attempts to approve CHC A's recovery plan -> HTTP 403
    app_res = client.post(
        f"/api/v1/recovery-plans/{ids_a['plan_id']}/approve",
        headers={"Authorization": f"Bearer {mgr_b_token}"},
    )
    assert app_res.status_code == 403

    # Manager B attempts to reject CHC A's recovery plan -> HTTP 403
    rej_res = client.post(
        f"/api/v1/recovery-plans/{ids_a['plan_id']}/reject",
        headers={"Authorization": f"Bearer {mgr_b_token}"},
    )
    assert rej_res.status_code == 403

    # Farmer attempts to access endpoint -> HTTP 403
    _, farmer_token = create_user_with_role("farmer_rbac@example.com", "FARMER")
    f_res = client.post(
        f"/api/v1/recovery-plans/{ids_a['plan_id']}/approve",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert f_res.status_code == 403


def test_breakdown_nested_routes(client: TestClient) -> None:
    """Test nested breakdown recovery-plans routes and mismatch validation."""
    ids = seed_breakdown_environment("NEST")
    _, mgr_token = create_user_with_role(
        "mgr_nest@example.com", "CHC_MANAGER", chc_id=ids["chc_id"], chc_role="MANAGER"
    )

    # 1. Retrieve via nested breakdown route
    res = client.get(
        f"/api/v1/breakdowns/{ids['breakdown_id']}/recovery-plans/{ids['plan_id']}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert res.status_code == 200
    assert res.json()["id"] == ids["plan_id"]

    # 2. Mismatch breakdown ID returns HTTP 404
    mismatch_res = client.get(
        f"/api/v1/breakdowns/99999/recovery-plans/{ids['plan_id']}",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert mismatch_res.status_code == 404
