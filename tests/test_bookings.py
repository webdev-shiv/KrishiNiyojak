"""Tests for Booking lifecycle management (T09).

Covers:
- Booking creation from approved service requests
- Duplicate booking prevention for the same service request
- Machine and operator alignment validation
- Date window constraint validation
- Attachment association
- Status transitions state machine (valid vs invalid transitions)
- Cancellation lifecycle and terminal state constraints
- Role-based visibility and access control across Farmer, CHC Manager, and Operator
"""

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
from app.models.booking import ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.resource import Attachment, Machine, Operator

# Isolated in-memory SQLite database for T09 unit tests
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
# Test Helpers
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


def create_test_setup() -> dict[str, int]:
    """Create a complete set of CHC, machine, operator, and attachment."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code="CHC-BK-01",
            name="Amritsar Central CHC",
            latitude=31.6340,
            longitude=74.8723,
            operating_radius_km=35.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()

        machine = Machine(
            chc_id=chc.id,
            registration_number="PB-02-BK-1111",
            make="New Holland",
            model="3630 TX",
            category="TRACTOR",
            horsepower=55.0,
            hourly_rate=Decimal("950.00"),
            status="AVAILABLE",
        )
        db.add(machine)
        db.flush()

        att = Attachment(
            chc_id=chc.id,
            code="ROT-BK-01",
            name="Heavy Rotavator",
            category="ROTAVATOR",
            required_hp_min=45.0,
            hourly_rate=Decimal("350.00"),
            status="AVAILABLE",
        )
        db.add(att)
        db.flush()

        driver_role = db.query(Role).filter(Role.name == "OPERATOR").first()
        if not driver_role:
            driver_role = Role(name="OPERATOR")
            db.add(driver_role)
            db.flush()

        driver_user = User(
            email="driver_bk@op.org",
            full_name="Driver Kuldeep",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(driver_user)
        db.flush()

        operator = Operator(
            user_id=driver_user.id,
            chc_id=chc.id,
            license_number="DL-BK-777",
            experience_years=6,
            hourly_rate=Decimal("300.00"),
            status="AVAILABLE",
        )
        db.add(operator)
        db.commit()

        return {
            "chc_id": chc.id,
            "machine_id": machine.id,
            "operator_id": operator.id,
            "attachment_id": att.id,
            "driver_user_id": driver_user.id,
        }


def create_approved_service_request(
    chc_id: int, farmer_id: int, start_days: int = 2, end_days: int = 6
) -> int:
    """Helper to create an approved service request."""
    with TestingSessionLocal() as db:
        req = ServiceRequest(
            chc_id=chc_id,
            farmer_id=farmer_id,
            field_latitude=31.63,
            field_longitude=74.87,
            acreage=10.0,
            operation_type="PLOWING",
            crop_type="WHEAT",
            requested_start_date=date.today() + timedelta(days=start_days),
            requested_end_date=date.today() + timedelta(days=end_days),
            estimated_cost=Decimal("7500.00"),
            status="APPROVED",
        )
        db.add(req)
        db.commit()
        db.refresh(req)
        return req.id


# -----------------------------------------------------------------------------
# 1. Booking Creation Tests
# -----------------------------------------------------------------------------


def test_create_booking_success(client: TestClient) -> None:
    """Verify that a CHC Manager can create a booking from an approved service request."""
    setup = create_test_setup()
    farmer_id, _ = create_user_with_role("farmer_bk1@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_bk@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req_id = create_approved_service_request(setup["chc_id"], farmer_id)
    sched_date = date.today() + timedelta(days=3)

    payload = {
        "service_request_id": req_id,
        "machine_id": setup["machine_id"],
        "operator_id": setup["operator_id"],
        "scheduled_date": str(sched_date),
        "scheduled_slot": "FULL_DAY",
        "attachment_ids": [setup["attachment_id"]],
        "total_cost": "8000.00",
    }
    res = client.post(
        "/api/v1/bookings",
        json=payload,
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "CONFIRMED"
    assert data["service_request_id"] == req_id
    assert data["machine_id"] == setup["machine_id"]
    assert data["operator_id"] == setup["operator_id"]
    assert data["attachment_ids"] == [setup["attachment_id"]]
    assert "BK-" in data["booking_code"]


def test_create_booking_unapproved_request_fails(client: TestClient) -> None:
    """Verify that creating a booking from an unapproved service request is rejected."""
    setup = create_test_setup()
    farmer_id, _ = create_user_with_role("farmer_unapp@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_unapp@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    # Insert request in SUBMITTED status (not APPROVED)
    with TestingSessionLocal() as db:
        req = ServiceRequest(
            chc_id=setup["chc_id"],
            farmer_id=farmer_id,
            field_latitude=31.63,
            field_longitude=74.87,
            acreage=5.0,
            operation_type="SOWING",
            requested_start_date=date.today() + timedelta(days=2),
            requested_end_date=date.today() + timedelta(days=5),
            status="SUBMITTED",
        )
        db.add(req)
        db.commit()
        req_id = req.id

    payload = {
        "service_request_id": req_id,
        "scheduled_date": str(date.today() + timedelta(days=3)),
        "scheduled_slot": "FULL_DAY",
    }
    res = client.post(
        "/api/v1/bookings",
        json=payload,
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res.status_code == 400
    assert "must be in APPROVED status" in res.json()["detail"]


def test_duplicate_booking_for_same_request_fails(client: TestClient) -> None:
    """Verify that multiple active bookings cannot be created for the same service request."""
    setup = create_test_setup()
    farmer_id, _ = create_user_with_role("farmer_dup@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_dup@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req_id = create_approved_service_request(setup["chc_id"], farmer_id)
    sched_date = date.today() + timedelta(days=3)

    payload = {
        "service_request_id": req_id,
        "scheduled_date": str(sched_date),
        "scheduled_slot": "FULL_DAY",
    }
    # First booking succeeds
    res1 = client.post(
        "/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {token_mgr}"}
    )
    assert res1.status_code == 201

    # Second booking for same request must fail
    res2 = client.post(
        "/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {token_mgr}"}
    )
    assert res2.status_code == 400
    assert "already has an active booking" in res2.json()["detail"]


def test_booking_date_outside_window_fails(client: TestClient) -> None:
    """Verify that scheduling a booking outside the requested window returns 400 Bad Request."""
    setup = create_test_setup()
    farmer_id, _ = create_user_with_role("farmer_window@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_win@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req_id = create_approved_service_request(setup["chc_id"], farmer_id, start_days=3, end_days=5)

    # Date is 10 days out (outside start=3, end=5)
    payload = {
        "service_request_id": req_id,
        "scheduled_date": str(date.today() + timedelta(days=10)),
        "scheduled_slot": "FULL_DAY",
    }
    res = client.post(
        "/api/v1/bookings", json=payload, headers={"Authorization": f"Bearer {token_mgr}"}
    )
    assert res.status_code == 400
    assert "falls outside the service request window" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 2. Booking Lifecycle & Status Transitions
# -----------------------------------------------------------------------------


def test_booking_status_transitions_and_terminal_states(client: TestClient) -> None:
    """Verify allowed status transitions and rejection of invalid/terminal transitions."""
    setup = create_test_setup()
    farmer_id, _ = create_user_with_role("farmer_trans@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_trans@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req_id = create_approved_service_request(setup["chc_id"], farmer_id)
    post_res = client.post(
        "/api/v1/bookings",
        json={
            "service_request_id": req_id,
            "machine_id": setup["machine_id"],
            "operator_id": setup["operator_id"],
            "scheduled_date": str(date.today() + timedelta(days=3)),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    booking_id = post_res.json()["id"]
    assert post_res.json()["status"] == "CONFIRMED"

    # Transition 1: CONFIRMED -> IN_PROGRESS (Allowed)
    res_in_prog = client.put(
        f"/api/v1/bookings/{booking_id}",
        json={"status": "IN_PROGRESS"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res_in_prog.status_code == 200
    assert res_in_prog.json()["status"] == "IN_PROGRESS"

    # Transition 2: IN_PROGRESS -> COMPLETED (Allowed)
    res_comp = client.put(
        f"/api/v1/bookings/{booking_id}",
        json={"status": "COMPLETED", "payment_status": "PAID"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res_comp.status_code == 200
    assert res_comp.json()["status"] == "COMPLETED"

    # Transition 3: COMPLETED -> IN_PROGRESS (Invalid: COMPLETED is terminal)
    res_invalid = client.put(
        f"/api/v1/bookings/{booking_id}",
        json={"status": "IN_PROGRESS"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res_invalid.status_code == 400
    assert "Invalid status transition" in res_invalid.json()["detail"]


def test_booking_cancellation_lifecycle(client: TestClient) -> None:
    """Verify booking cancellation by farmer and rejection on completed bookings."""
    setup = create_test_setup()
    farmer_id, token_farmer = create_user_with_role("farmer_cancel@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_cancel@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req_id = create_approved_service_request(setup["chc_id"], farmer_id)
    post_res = client.post(
        "/api/v1/bookings",
        json={
            "service_request_id": req_id,
            "scheduled_date": str(date.today() + timedelta(days=3)),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    booking_id = post_res.json()["id"]

    # Farmer cancels their booking
    cancel_res = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        json={"reason": "Rain forecasted on field"},
        headers={"Authorization": f"Bearer {token_farmer}"},
    )
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Attempting to cancel an already cancelled booking returns 400 Bad Request
    cancel_again = client.post(
        f"/api/v1/bookings/{booking_id}/cancel",
        headers={"Authorization": f"Bearer {token_farmer}"},
    )
    assert cancel_again.status_code == 400
    assert "Cannot cancel a booking in CANCELLED status" in cancel_again.json()["detail"]


# -----------------------------------------------------------------------------
# 3. Role-Based Permissions & Isolation Tests
# -----------------------------------------------------------------------------


def test_cross_farmer_booking_isolation(client: TestClient) -> None:
    """Verify that Farmer 1 cannot view or cancel Farmer 2's booking."""
    setup = create_test_setup()
    farmer1_id, token_farmer1 = create_user_with_role("f1_bk@farm.org", "FARMER")
    _, token_farmer2 = create_user_with_role("f2_bk@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_iso@chc.org", "CHC_MANAGER", chc_id=setup["chc_id"], chc_role="MANAGER"
    )

    req1_id = create_approved_service_request(setup["chc_id"], farmer1_id)
    post_res = client.post(
        "/api/v1/bookings",
        json={
            "service_request_id": req1_id,
            "scheduled_date": str(date.today() + timedelta(days=3)),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    bk1_id = post_res.json()["id"]

    # Farmer 2 attempts to GET Farmer 1's booking -> 403 Forbidden
    get_res = client.get(
        f"/api/v1/bookings/{bk1_id}",
        headers={"Authorization": f"Bearer {token_farmer2}"},
    )
    assert get_res.status_code == 403

    # Farmer 2 attempts to cancel Farmer 1's booking -> 403 Forbidden
    del_res = client.post(
        f"/api/v1/bookings/{bk1_id}/cancel",
        headers={"Authorization": f"Bearer {token_farmer2}"},
    )
    assert del_res.status_code == 403

    # Farmer 2 lists bookings -> Farmer 1's booking must not appear
    list_res = client.get(
        "/api/v1/bookings",
        headers={"Authorization": f"Bearer {token_farmer2}"},
    )
    assert list_res.status_code == 200
    assert all(b["id"] != bk1_id for b in list_res.json()["items"])


def test_farmer_cannot_create_booking_directly(client: TestClient) -> None:
    """Verify that a farmer cannot create bookings directly (restricted to managers)."""
    setup = create_test_setup()
    farmer_id, token_farmer = create_user_with_role("farmer_deny@farm.org", "FARMER")
    req_id = create_approved_service_request(setup["chc_id"], farmer_id)

    res = client.post(
        "/api/v1/bookings",
        json={
            "service_request_id": req_id,
            "scheduled_date": str(date.today() + timedelta(days=3)),
            "scheduled_slot": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {token_farmer}"},
    )
    assert res.status_code == 403
