"""Tests for Farmer Service Requests and Machine/Operator Availability (T08).

Covers:
- Farmer service request creation, validation, ownership scoping, and lifecycle
- Access control: Cross-farmer isolation and CHC manager approval gates
- Machine availability scheduling, slot conflict prevention, and RBAC
- Operator availability scheduling, slot conflict prevention, and RBAC
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
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.resource import Machine, Operator

# Isolated in-memory SQLite database for T08 unit tests
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


def create_chc(code: str = "CHC-T08-1") -> int:
    """Helper to insert a test CHC."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code=code,
            name=f"Hub {code}",
            latitude=30.9009,
            longitude=75.8573,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.commit()
        db.refresh(chc)
        return chc.id


# -----------------------------------------------------------------------------
# 1. Farmer Service Request Tests
# -----------------------------------------------------------------------------


def test_create_service_request_valid(client: TestClient) -> None:
    """Verify that a farmer can submit a valid service request."""
    chc_id = create_chc("CHC-SR-1")
    _, token = create_user_with_role("farmer1@farm.org", "FARMER")

    start_date = date.today() + timedelta(days=2)
    end_date = date.today() + timedelta(days=5)

    payload = {
        "chc_id": chc_id,
        "field_latitude": 30.9123,
        "field_longitude": 75.8645,
        "acreage": 12.5,
        "operation_type": "PLOWING",
        "crop_type": "WHEAT",
        "requested_start_date": str(start_date),
        "requested_end_date": str(end_date),
        "estimated_cost": "6250.00",
    }
    res = client.post(
        "/api/v1/service-requests",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "SUBMITTED"
    assert data["acreage"] == 12.5
    assert data["operation_type"] == "PLOWING"
    assert "id" in data


def test_create_service_request_invalid_dates_fails(client: TestClient) -> None:
    """Verify that end date before start date is rejected with 422 Unprocessable Entity."""
    chc_id = create_chc("CHC-SR-VAL")
    _, token = create_user_with_role("farmer_val@farm.org", "FARMER")

    start_date = date.today() + timedelta(days=5)
    end_date = date.today() + timedelta(days=2)  # Invalid: end < start

    payload = {
        "chc_id": chc_id,
        "field_latitude": 30.9123,
        "field_longitude": 75.8645,
        "acreage": 10.0,
        "operation_type": "SOWING",
        "requested_start_date": str(start_date),
        "requested_end_date": str(end_date),
    }
    res = client.post(
        "/api/v1/service-requests",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422


def test_service_request_cross_farmer_isolation(client: TestClient) -> None:
    """Verify that Farmer 1 cannot view or modify Farmer 2's service request."""
    chc_id = create_chc("CHC-SR-ISO")
    _, token1 = create_user_with_role("farmer_one@farm.org", "FARMER")
    _, token2 = create_user_with_role("farmer_two@farm.org", "FARMER")

    start_date = date.today() + timedelta(days=1)
    end_date = date.today() + timedelta(days=3)

    # Farmer 1 creates a request
    payload = {
        "chc_id": chc_id,
        "field_latitude": 30.91,
        "field_longitude": 75.86,
        "acreage": 5.0,
        "operation_type": "HARVESTING",
        "requested_start_date": str(start_date),
        "requested_end_date": str(end_date),
    }
    post_res = client.post(
        "/api/v1/service-requests",
        json=payload,
        headers={"Authorization": f"Bearer {token1}"},
    )
    req_id = post_res.json()["id"]

    # Farmer 2 tries to GET Farmer 1's request -> 403 Forbidden
    get_res = client.get(
        f"/api/v1/service-requests/{req_id}",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert get_res.status_code == 403
    assert "Access denied" in get_res.json()["detail"]

    # Farmer 2 tries to PUT/cancel Farmer 1's request -> 403 Forbidden
    put_res = client.put(
        f"/api/v1/service-requests/{req_id}",
        json={"status": "CANCELLED"},
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert put_res.status_code == 403

    # Farmer 2 listing requests: Farmer 1's request MUST NOT appear
    list_res = client.get(
        "/api/v1/service-requests",
        headers={"Authorization": f"Bearer {token2}"},
    )
    assert list_res.status_code == 200
    farmer2_items = list_res.json()["items"]
    assert all(item["id"] != req_id for item in farmer2_items)


def test_farmer_cannot_self_approve_service_request(client: TestClient) -> None:
    """Verify that a farmer cannot approve their own request (403 Forbidden)."""
    chc_id = create_chc("CHC-SR-APPR")
    _, token = create_user_with_role("farmer_self@farm.org", "FARMER")

    start_date = date.today() + timedelta(days=1)
    end_date = date.today() + timedelta(days=2)

    post_res = client.post(
        "/api/v1/service-requests",
        json={
            "chc_id": chc_id,
            "field_latitude": 30.9,
            "field_longitude": 75.8,
            "acreage": 8.0,
            "operation_type": "PLOWING",
            "requested_start_date": str(start_date),
            "requested_end_date": str(end_date),
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    req_id = post_res.json()["id"]

    # Farmer attempts to update status to APPROVED -> 403 Forbidden
    put_res = client.put(
        f"/api/v1/service-requests/{req_id}",
        json={"status": "APPROVED"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_res.status_code == 403
    assert "only cancel or submit" in put_res.json()["detail"]


def test_chc_manager_can_approve_service_request(client: TestClient) -> None:
    """Verify that the CHC manager of the target hub can approve a service request."""
    chc_id = create_chc("CHC-SR-MGR")
    _, token_farmer = create_user_with_role("farmer_sub@farm.org", "FARMER")
    _, token_mgr = create_user_with_role(
        "mgr_sub@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    start_date = date.today() + timedelta(days=1)
    end_date = date.today() + timedelta(days=2)

    post_res = client.post(
        "/api/v1/service-requests",
        json={
            "chc_id": chc_id,
            "field_latitude": 30.9,
            "field_longitude": 75.8,
            "acreage": 15.0,
            "operation_type": "SPRAYING",
            "requested_start_date": str(start_date),
            "requested_end_date": str(end_date),
        },
        headers={"Authorization": f"Bearer {token_farmer}"},
    )
    req_id = post_res.json()["id"]

    # Manager approves request
    appr_res = client.put(
        f"/api/v1/service-requests/{req_id}",
        json={"status": "APPROVED"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert appr_res.status_code == 200
    assert appr_res.json()["status"] == "APPROVED"


# -----------------------------------------------------------------------------
# 2. Machine Availability Tests
# -----------------------------------------------------------------------------


def test_machine_availability_scheduling_and_conflict(client: TestClient) -> None:
    """Verify setting machine availability and preventing slot conflicts."""
    chc_id = create_chc("CHC-MA-1")
    _, token_mgr = create_user_with_role(
        "mgr_ma@chc.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    with TestingSessionLocal() as db:
        m = Machine(
            chc_id=chc_id,
            registration_number="PB-MA-001",
            make="Swaraj",
            model="855 FE",
            category="TRACTOR",
            horsepower=52.0,
            hourly_rate=Decimal("800.00"),
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        machine_id = m.id

    target_date = date.today() + timedelta(days=7)

    # 1. Schedule FULL_DAY slot
    res1 = client.post(
        "/api/v1/machine-availability",
        json={
            "machine_id": machine_id,
            "slot_date": str(target_date),
            "slot_type": "FULL_DAY",
            "status": "FREE",
            "note": "Available for plowing",
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res1.status_code == 201
    slot_id = res1.json()["id"]

    # 2. Attempt conflicting slot on same date -> 400 Bad Request
    res_conflict = client.post(
        "/api/v1/machine-availability",
        json={
            "machine_id": machine_id,
            "slot_date": str(target_date),
            "slot_type": "HALF_DAY_MORNING",
            "status": "FREE",
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res_conflict.status_code == 400
    assert "Conflicting slot" in res_conflict.json()["detail"]

    # 3. Update slot status to BLOCKED_MAINTENANCE
    upd_res = client.put(
        f"/api/v1/machine-availability/{slot_id}",
        json={"status": "BLOCKED_MAINTENANCE", "note": "Engine service"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["status"] == "BLOCKED_MAINTENANCE"

    # 4. Delete slot
    del_res = client.delete(
        f"/api/v1/machine-availability/{slot_id}",
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert del_res.status_code == 204


def test_unauthorized_user_cannot_set_machine_availability(client: TestClient) -> None:
    """Verify that a farmer cannot schedule machine availability (403 Forbidden)."""
    chc_id = create_chc("CHC-MA-DENY")
    _, token_farmer = create_user_with_role("farmer_unauth@farm.org", "FARMER")

    with TestingSessionLocal() as db:
        m = Machine(
            chc_id=chc_id,
            registration_number="PB-MA-DENY",
            make="Mahindra",
            model="Arjun 605",
            category="TRACTOR",
            horsepower=60.0,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        m_id = m.id

    res = client.post(
        "/api/v1/machine-availability",
        json={
            "machine_id": m_id,
            "slot_date": str(date.today() + timedelta(days=3)),
            "slot_type": "FULL_DAY",
        },
        headers={"Authorization": f"Bearer {token_farmer}"},
    )
    assert res.status_code == 403


# -----------------------------------------------------------------------------
# 3. Operator Availability Tests
# -----------------------------------------------------------------------------


def test_operator_availability_lifecycle_and_conflict(client: TestClient) -> None:
    """Verify operator availability scheduling, conflict rejection, and deletion."""
    chc_id = create_chc("CHC-OA-1")
    user_driver_id, token_driver = create_user_with_role("driver_oa@op.org", "OPERATOR")

    with TestingSessionLocal() as db:
        op = Operator(
            user_id=user_driver_id,
            chc_id=chc_id,
            license_number="DL-OA-12345",
            experience_years=4,
        )
        db.add(op)
        db.commit()
        db.refresh(op)
        op_id = op.id

    target_date = date.today() + timedelta(days=10)

    # 1. Driver schedules self as AVAILABLE for HALF_DAY_MORNING
    res1 = client.post(
        "/api/v1/operator-availability",
        json={
            "operator_id": op_id,
            "slot_date": str(target_date),
            "slot_type": "HALF_DAY_MORNING",
            "status": "AVAILABLE",
        },
        headers={"Authorization": f"Bearer {token_driver}"},
    )
    assert res1.status_code == 201
    slot_id = res1.json()["id"]

    # 2. Driver schedules self for complementary HALF_DAY_AFTERNOON -> Allowed
    res2 = client.post(
        "/api/v1/operator-availability",
        json={
            "operator_id": op_id,
            "slot_date": str(target_date),
            "slot_type": "HALF_DAY_AFTERNOON",
            "status": "AVAILABLE",
        },
        headers={"Authorization": f"Bearer {token_driver}"},
    )
    assert res2.status_code == 201

    # 3. Driver attempts duplicate HALF_DAY_MORNING on same date -> 400 Bad Request
    res_dup = client.post(
        "/api/v1/operator-availability",
        json={
            "operator_id": op_id,
            "slot_date": str(target_date),
            "slot_type": "HALF_DAY_MORNING",
            "status": "AVAILABLE",
        },
        headers={"Authorization": f"Bearer {token_driver}"},
    )
    assert res_dup.status_code == 400
    assert "Conflicting slot" in res_dup.json()["detail"]

    # 4. Update status to ON_LEAVE
    upd_res = client.put(
        f"/api/v1/operator-availability/{slot_id}",
        json={"status": "ON_LEAVE", "note": "Personal emergency"},
        headers={"Authorization": f"Bearer {token_driver}"},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["status"] == "ON_LEAVE"

    # 5. Delete slot
    del_res = client.delete(
        f"/api/v1/operator-availability/{slot_id}",
        headers={"Authorization": f"Bearer {token_driver}"},
    )
    assert del_res.status_code == 204
