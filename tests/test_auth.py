"""Tests for authentication and authorization: Argon2id, JWT, refresh rotation, and RBAC."""

from collections.abc import Generator
from datetime import timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.deps import get_db
from app.core.security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.base import Base
from app.main import app
from app.models.chc import CHC, CHCMembership
from app.models.identity import User

# Set up an isolated in-memory SQLite database specifically for auth unit tests
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
# 1. Password Security Tests (Argon2id)
# -----------------------------------------------------------------------------


def test_argon2id_password_hashing() -> None:
    """Verify Argon2id password hashing and verification."""
    password = "SuperSecretPassword123!"
    hashed = hash_password(password)

    # Argon2id hashes begin with $argon2id$
    assert hashed.startswith("$argon2id$")
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False


# -----------------------------------------------------------------------------
# 2. JWT Access Token Tests
# -----------------------------------------------------------------------------


def test_jwt_access_token_creation_and_validation() -> None:
    """Verify JWT token encoding, decoding, payload extraction, and expiration."""
    user_id = 42
    roles = ["FARMER", "OPERATOR"]
    token = create_access_token(subject=user_id, roles=roles)

    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["roles"] == roles
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_access_token_expired() -> None:
    """Verify expired token raises error during decoding."""
    expired_token = create_access_token(subject=100, expires_delta=timedelta(seconds=-10))
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(expired_token)


# -----------------------------------------------------------------------------
# 3. Refresh Token Generation and Hashing Tests
# -----------------------------------------------------------------------------


def test_refresh_token_generation_and_hashing() -> None:
    """Verify cryptographically random refresh token generation and SHA-256 hashing."""
    token1 = generate_refresh_token()
    token2 = generate_refresh_token()

    assert token1 != token2
    assert len(token1) >= 48

    hash1 = hash_refresh_token(token1)
    hash2 = hash_refresh_token(token1)
    assert hash1 == hash2  # Deterministic hash
    assert len(hash1) == 64  # SHA-256 hex string


# -----------------------------------------------------------------------------
# 4. User Registration API Tests
# -----------------------------------------------------------------------------


def test_user_registration_success(client: TestClient) -> None:
    """Verify successful user registration with default FARMER role."""
    payload = {
        "email": "farmer.ramesh@example.com",
        "password": "StrongPassword123",
        "full_name": "Ramesh Kumar",
        "phone_number": "+919876543210",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert data["email"] == payload["email"]
    assert data["full_name"] == payload["full_name"]
    assert data["roles"] == ["FARMER"]
    assert data["is_active"] is True
    assert "id" in data


def test_user_registration_duplicate_email(client: TestClient) -> None:
    """Verify registration fails when email is already registered."""
    payload = {
        "email": "duplicate@example.com",
        "password": "StrongPassword123",
        "full_name": "First User",
    }
    r1 = client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    r2 = client.post("/api/v1/auth/register", json=payload)
    assert r2.status_code == 400
    assert "already exists" in r2.json()["detail"]


# -----------------------------------------------------------------------------
# 5. User Login API Tests
# -----------------------------------------------------------------------------


def test_user_login_success_and_token_issue(client: TestClient) -> None:
    """Verify login with correct credentials issues access and refresh tokens."""
    # Register user
    reg_payload = {
        "email": "login.test@example.com",
        "password": "CorrectPassword123",
        "full_name": "Login Tester",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    # Login
    login_payload = {
        "email": "login.test@example.com",
        "password": "CorrectPassword123",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 200

    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


def test_user_login_invalid_password(client: TestClient) -> None:
    """Verify login fails with incorrect password."""
    reg_payload = {
        "email": "wrongpass@example.com",
        "password": "CorrectPassword123",
        "full_name": "Test User",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "wrongpass@example.com",
        "password": "IncorrectPassword999",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 6. Refresh Token Rotation & Revocation Tests
# -----------------------------------------------------------------------------


def test_refresh_token_rotation_and_single_use(client: TestClient) -> None:
    """Verify refresh token rotation and prevention of token reuse."""
    # Register & Login
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "refresh.test@example.com",
            "password": "Password12345",
            "full_name": "Refresh Tester",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "refresh.test@example.com", "password": "Password12345"},
    )
    tokens = login_res.json()
    initial_refresh_token = tokens["refresh_token"]

    # First rotation: Should succeed
    rotate_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": initial_refresh_token},
    )
    assert rotate_res.status_code == 200
    rotated_tokens = rotate_res.json()
    new_refresh_token = rotated_tokens["refresh_token"]
    assert new_refresh_token != initial_refresh_token

    # Second rotation with the OLD token: Must fail because it was revoked
    reuse_res = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": initial_refresh_token},
    )
    assert reuse_res.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    """Verify logout invalidates refresh token immediately."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "logout.test@example.com",
            "password": "Password12345",
            "full_name": "Logout Tester",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "logout.test@example.com", "password": "Password12345"},
    )
    refresh_token = login_res.json()["refresh_token"]

    # Logout
    logout_res = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 200

    # Attempt refresh with revoked token: Must fail
    refresh_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_res.status_code == 401


# -----------------------------------------------------------------------------
# 7. Authenticated User /me and Role-Based Access Control (RBAC) Tests
# -----------------------------------------------------------------------------


def test_get_current_user_me(client: TestClient) -> None:
    """Verify /me endpoint returns user profile and roles for valid bearer token."""
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "me.test@example.com",
            "password": "Password12345",
            "full_name": "Profile Tester",
        },
    )
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "me.test@example.com", "password": "Password12345"},
    )
    access_token = login_res.json()["access_token"]

    response = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "me.test@example.com"
    assert data["roles"] == ["FARMER"]


def test_role_based_access_control(client: TestClient) -> None:
    """Verify role enforcement blocks unauthorized roles and permits authorized roles."""
    # 1. Create a regular Farmer
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "farmer@example.com",
            "password": "Password12345",
            "full_name": "Farmer Joe",
        },
    )
    farmer_login = client.post(
        "/api/v1/auth/login",
        json={"email": "farmer@example.com", "password": "Password12345"},
    )
    farmer_token = farmer_login.json()["access_token"]

    # Farmer attempts accessing CHC Manager endpoint: Must receive 403 Forbidden
    denied_res = client.get(
        "/api/v1/protected/chc-manager-only",
        headers={"Authorization": f"Bearer {farmer_token}"},
    )
    assert denied_res.status_code == 403

    # 2. Grant CHC_MANAGER role to a user via database session
    db = TestingSessionLocal()
    mgr_user = User(
        email="manager@example.com",
        hashed_password=hash_password("ManagerPass123"),
        full_name="CHC Hub Manager",
        is_active=True,
    )
    db.add(mgr_user)
    db.flush()

    # Create CHC and membership
    chc = CHC(
        name="Central CHC Hub",
        code="CHC-001",
        latitude=28.7,
        longitude=77.1,
    )
    db.add(chc)
    db.flush()

    membership = CHCMembership(
        chc_id=chc.id,
        user_id=mgr_user.id,
        role="CHC_MANAGER",
        is_active=True,
    )
    db.add(membership)
    db.commit()
    db.close()

    # Manager logs in
    mgr_login = client.post(
        "/api/v1/auth/login",
        json={"email": "manager@example.com", "password": "ManagerPass123"},
    )
    mgr_token = mgr_login.json()["access_token"]

    # Manager accesses CHC Manager endpoint: Must succeed (200 OK)
    allowed_res = client.get(
        "/api/v1/protected/chc-manager-only",
        headers={"Authorization": f"Bearer {mgr_token}"},
    )
    assert allowed_res.status_code == 200
    assert "Welcome, Manager" in allowed_res.json()["message"]
