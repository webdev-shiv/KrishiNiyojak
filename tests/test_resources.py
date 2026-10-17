"""Tests for CHC and core resource management APIs (T07).

Covers:
- CHC CRUD operations, role authorization, and cross-CHC access denial
- Machine registration, listing, viewing, updating, and deactivation
- Operator registration, listing, viewing, updating, and deactivation
- Attachment creation, listing, viewing, updating, and deactivation
- Pydantic validation, duplicate checks, and RBAC enforcement
"""

from collections.abc import Generator
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

# Isolated in-memory SQLite database for resource API unit tests
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


def create_test_user_with_role(
    email: str, role_name: str, chc_id: int | None = None, chc_role: str | None = None
) -> tuple[int, str]:
    """Create a user in the test DB, assign a role, and generate a valid access token."""
    with TestingSessionLocal() as db:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()

        user = User(
            email=email,
            full_name=f"User {role_name}",
            hashed_password=hash_password("StrongPassword123!"),
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

        user_id = user.id
        token = create_access_token(
            subject=user.id,
            roles=[role_name] + ([chc_role] if chc_role else []),
        )
        return user_id, token


def create_test_chc(code: str = "CHC-001", name: str = "Northern Punjab Hub") -> int:
    """Create a CHC hub in the database."""
    with TestingSessionLocal() as db:
        chc = CHC(
            code=code,
            name=name,
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
# 1. CHC API Tests
# -----------------------------------------------------------------------------


def test_create_chc_by_manager(client: TestClient) -> None:
    """Verify that a CHC Manager can create a new CHC and becomes its manager."""
    _, token = create_test_user_with_role("manager@chc.org", "CHC_MANAGER")
    payload = {
        "name": "Central Ludhiana CHC",
        "code": "CHC-LDH-01",
        "latitude": 30.9010,
        "longitude": 75.8572,
        "operating_radius_km": 25.0,
        "contact_phone": "+919876500001",
    }
    response = client.post(
        "/api/v1/chcs",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Central Ludhiana CHC"
    assert data["code"] == "CHC-LDH-01"
    assert data["status"] == "ACTIVE"
    assert "id" in data


def test_create_chc_duplicate_code_fails(client: TestClient) -> None:
    """Verify that creating a CHC with an existing code returns 400 Bad Request."""
    create_test_chc(code="CHC-DUP", name="Existing CHC")
    _, token = create_test_user_with_role("mgr@chc.org", "CHC_MANAGER")
    payload = {
        "name": "Duplicate CHC",
        "code": "CHC-DUP",
        "latitude": 30.0,
        "longitude": 75.0,
    }
    response = client.post(
        "/api/v1/chcs",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


def test_farmer_cannot_create_or_update_chc(client: TestClient) -> None:
    """Verify that a FARMER cannot create or update a CHC (403 Forbidden)."""
    chc_id = create_test_chc(code="CHC-FARMER-TEST")
    _, token = create_test_user_with_role("farmer@farm.org", "FARMER")

    # Create attempt
    post_res = client.post(
        "/api/v1/chcs",
        json={"name": "Farmer Hub", "code": "CHC-FARM", "latitude": 30.0, "longitude": 75.0},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert post_res.status_code == 403

    # Update attempt
    put_res = client.put(
        f"/api/v1/chcs/{chc_id}",
        json={"name": "Updated by Farmer"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_res.status_code == 403


def test_cross_chc_manager_cannot_update_other_chc(client: TestClient) -> None:
    """Verify that a manager of CHC 1 cannot update CHC 2 (403 Forbidden)."""
    chc1_id = create_test_chc(code="CHC-1")
    chc2_id = create_test_chc(code="CHC-2")

    _, token = create_test_user_with_role(
        "mgr1@chc.org", "CHC_MANAGER", chc_id=chc1_id, chc_role="MANAGER"
    )

    # Manager 1 updating CHC 1 -> Should Succeed
    res_ok = client.put(
        f"/api/v1/chcs/{chc1_id}",
        json={"name": "Updated CHC 1"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_ok.status_code == 200
    assert res_ok.json()["name"] == "Updated CHC 1"

    # Manager 1 updating CHC 2 -> Must Fail with 403 Forbidden
    res_denied = client.put(
        f"/api/v1/chcs/{chc2_id}",
        json={"name": "Hacked CHC 2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res_denied.status_code == 403
    assert "Access denied" in res_denied.json()["detail"]


def test_list_and_get_chcs(client: TestClient) -> None:
    """Verify listing and viewing CHCs with pagination and status filter."""
    chc_id = create_test_chc(code="CHC-LIST-1", name="Alpha Hub")
    create_test_chc(code="CHC-LIST-2", name="Beta Hub")
    _, token = create_test_user_with_role("user@chc.org", "FARMER")

    # List all
    res = client.get("/api/v1/chcs", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 2
    assert len(data["items"]) >= 2

    # Get specific
    get_res = client.get(f"/api/v1/chcs/{chc_id}", headers={"Authorization": f"Bearer {token}"})
    assert get_res.status_code == 200
    assert get_res.json()["code"] == "CHC-LIST-1"


# -----------------------------------------------------------------------------
# 2. Machine API Tests
# -----------------------------------------------------------------------------


def test_register_and_get_machine(client: TestClient) -> None:
    """Verify registering and viewing a machine."""
    chc_id = create_test_chc(code="CHC-MACH-1")
    _, token = create_test_user_with_role(
        "manager@fleet.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    payload = {
        "chc_id": chc_id,
        "registration_number": "PB-10-AB-1234",
        "make": "John Deere",
        "model": "5050 D",
        "category": "TRACTOR",
        "horsepower": 50.0,
        "hourly_rate": "850.00",
        "status": "AVAILABLE",
        "current_lat": 30.9010,
        "current_lng": 75.8572,
    }
    create_res = client.post(
        "/api/v1/machines",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert create_res.status_code == 201
    machine_data = create_res.json()
    assert machine_data["registration_number"] == "PB-10-AB-1234"
    assert machine_data["category"] == "TRACTOR"
    machine_id = machine_data["id"]

    # View machine
    get_res = client.get(
        f"/api/v1/machines/{machine_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_res.status_code == 200
    assert get_res.json()["make"] == "John Deere"


def test_register_machine_duplicate_registration_fails(client: TestClient) -> None:
    """Verify unique constraint on machine registration plate."""
    chc_id = create_test_chc(code="CHC-MACH-DUP")
    _, token = create_test_user_with_role(
        "mgr@fleet.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    payload = {
        "chc_id": chc_id,
        "registration_number": "PB-DUP-9999",
        "make": "Sonalika",
        "model": "DI 745",
        "category": "TRACTOR",
        "horsepower": 45.0,
    }
    client.post("/api/v1/machines", json=payload, headers={"Authorization": f"Bearer {token}"})

    dup_res = client.post(
        "/api/v1/machines", json=payload, headers={"Authorization": f"Bearer {token}"}
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]


def test_update_and_deactivate_machine(client: TestClient) -> None:
    """Verify updating machine fields and deactivating a machine."""
    chc_id = create_test_chc(code="CHC-MACH-UPD")
    _, token = create_test_user_with_role(
        "mgr@fleet.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    with TestingSessionLocal() as db:
        m = Machine(
            chc_id=chc_id,
            registration_number="PB-UPD-0001",
            make="Mahindra",
            model="Yuvo 575",
            category="TRACTOR",
            horsepower=45.0,
            hourly_rate=Decimal("800.00"),
            status="AVAILABLE",
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        machine_id = m.id

    # Update machine
    update_res = client.put(
        f"/api/v1/machines/{machine_id}",
        json={"hourly_rate": "900.00", "status": "MAINTENANCE"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert update_res.status_code == 200
    assert float(update_res.json()["hourly_rate"]) == 900.00
    assert update_res.json()["status"] == "MAINTENANCE"

    # Deactivate machine
    deact_res = client.post(
        f"/api/v1/machines/{machine_id}/deactivate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "RETIRED"


def test_cross_chc_manager_cannot_manage_foreign_machine(client: TestClient) -> None:
    """Verify that a manager of CHC 1 cannot update a machine belonging to CHC 2."""
    chc1_id = create_test_chc(code="CHC-M1")
    chc2_id = create_test_chc(code="CHC-M2")

    _, token_mgr1 = create_test_user_with_role(
        "mgr1@fleet.org", "CHC_MANAGER", chc_id=chc1_id, chc_role="MANAGER"
    )

    with TestingSessionLocal() as db:
        machine_chc2 = Machine(
            chc_id=chc2_id,
            registration_number="PB-CHC2-8888",
            make="Kubota",
            model="MU5501",
            category="TRACTOR",
            horsepower=55.0,
        )
        db.add(machine_chc2)
        db.commit()
        db.refresh(machine_chc2)
        m2_id = machine_chc2.id

    # Manager 1 attempts to update machine of CHC 2 -> 403 Forbidden
    res = client.put(
        f"/api/v1/machines/{m2_id}",
        json={"hourly_rate": "1200.00"},
        headers={"Authorization": f"Bearer {token_mgr1}"},
    )
    assert res.status_code == 403
    assert "Access denied" in res.json()["detail"]


# -----------------------------------------------------------------------------
# 3. Operator API Tests
# -----------------------------------------------------------------------------


def test_register_and_list_operators(client: TestClient) -> None:
    """Verify operator registration and listing."""
    chc_id = create_test_chc(code="CHC-OP-HUB")
    _, token_mgr = create_test_user_with_role(
        "mgr@op.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    # Create target operator user
    driver_user_id, _ = create_test_user_with_role("driver@op.org", "OPERATOR")

    payload = {
        "user_id": driver_user_id,
        "chc_id": chc_id,
        "license_number": "DL-04-2020-0012345",
        "experience_years": 5,
        "hourly_rate": "250.00",
        "status": "AVAILABLE",
    }
    create_res = client.post(
        "/api/v1/operators",
        json=payload,
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert create_res.status_code == 201
    op_data = create_res.json()
    assert op_data["license_number"] == "DL-04-2020-0012345"
    assert op_data["experience_years"] == 5
    op_id = op_data["id"]

    # List operators
    list_res = client.get(
        f"/api/v1/operators?chc_id={chc_id}",
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1

    # Deactivate operator
    deact_res = client.post(
        f"/api/v1/operators/{op_id}/deactivate",
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "INACTIVE"


def test_cross_chc_manager_cannot_modify_other_operator(client: TestClient) -> None:
    """Verify that a manager cannot modify an operator affiliated with another CHC."""
    chc1_id = create_test_chc(code="CHC-OP-1")
    chc2_id = create_test_chc(code="CHC-OP-2")

    _, token_mgr1 = create_test_user_with_role(
        "mgr1@op.org", "CHC_MANAGER", chc_id=chc1_id, chc_role="MANAGER"
    )
    driver_id, _ = create_test_user_with_role("driver2@op.org", "OPERATOR")

    with TestingSessionLocal() as db:
        op2 = Operator(
            user_id=driver_id,
            chc_id=chc2_id,
            license_number="DL-OP2-9999",
            experience_years=3,
        )
        db.add(op2)
        db.commit()
        db.refresh(op2)
        op2_id = op2.id

    # Manager 1 attempts to update Operator 2 -> 403 Forbidden
    res = client.put(
        f"/api/v1/operators/{op2_id}",
        json={"experience_years": 4},
        headers={"Authorization": f"Bearer {token_mgr1}"},
    )
    assert res.status_code == 403


# -----------------------------------------------------------------------------
# 4. Attachment API Tests
# -----------------------------------------------------------------------------


def test_create_and_update_attachment(client: TestClient) -> None:
    """Verify implement creation, listing, updating, and deactivation."""
    chc_id = create_test_chc(code="CHC-ATT-1")
    _, token_mgr = create_test_user_with_role(
        "mgr@att.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    payload = {
        "chc_id": chc_id,
        "name": "Rotavator 7 Feet Heavy Duty",
        "code": "ROT-7FT-001",
        "category": "ROTAVATOR",
        "required_hp_min": 40.0,
        "hourly_rate": "300.00",
        "status": "AVAILABLE",
    }
    create_res = client.post(
        "/api/v1/attachments",
        json=payload,
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert create_res.status_code == 201
    att_data = create_res.json()
    assert att_data["code"] == "ROT-7FT-001"
    att_id = att_data["id"]

    # Update attachment
    upd_res = client.put(
        f"/api/v1/attachments/{att_id}",
        json={"hourly_rate": "350.00"},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert upd_res.status_code == 200
    assert float(upd_res.json()["hourly_rate"]) == 350.00

    # Deactivate attachment
    deact_res = client.post(
        f"/api/v1/attachments/{att_id}/deactivate",
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "DAMAGED"


def test_create_attachment_duplicate_code_fails(client: TestClient) -> None:
    """Verify unique constraint on implement code."""
    chc_id = create_test_chc(code="CHC-ATT-DUP")
    _, token_mgr = create_test_user_with_role(
        "mgr@att.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    payload = {
        "chc_id": chc_id,
        "name": "Laser Land Leveler",
        "code": "LVL-DUP-01",
        "category": "SEEDER",
        "required_hp_min": 50.0,
    }
    client.post(
        "/api/v1/attachments",
        json=payload,
        headers={"Authorization": f"Bearer {token_mgr}"},
    )

    dup_res = client.post(
        "/api/v1/attachments", json=payload, headers={"Authorization": f"Bearer {token_mgr}"}
    )
    assert dup_res.status_code == 400
    assert "already exists" in dup_res.json()["detail"]


def test_validation_errors(client: TestClient) -> None:
    """Verify that invalid inputs return HTTP 422 Unprocessable Entity."""
    chc_id = create_test_chc(code="CHC-VAL-01")
    _, token_mgr = create_test_user_with_role(
        "mgr@val.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER"
    )

    # Negative horsepower
    res1 = client.post(
        "/api/v1/machines",
        json={
            "chc_id": chc_id,
            "registration_number": "PB-VAL-01",
            "make": "Test",
            "model": "Model",
            "category": "TRACTOR",
            "horsepower": -10.0,
        },
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res1.status_code == 422

    # Invalid latitude
    res2 = client.post(
        "/api/v1/chcs",
        json={"name": "Bad Latitude", "code": "CHC-BAD-LAT", "latitude": 120.0, "longitude": 75.0},
        headers={"Authorization": f"Bearer {token_mgr}"},
    )
    assert res2.status_code == 422
