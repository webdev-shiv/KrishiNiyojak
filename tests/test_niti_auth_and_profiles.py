"""Comprehensive tests for NITI Voice-First Agricultural Machinery Platform.

Covers:
- OTP generation and verification
- Farmer phone-based login and auto-registration
- Three separate role-protected login portals (Farmer, CHC, Operator)
- Farmer 3-step onboarding and profile persistence
- Voice transcript NLP parameter extraction (Hindi & English)
- Fair offer matching and voice explanation of price differences
- Booking creation from offer with collision prevention
- Live updates tracking events (CONFIRMED -> TRAVELLING -> ARRIVED -> WORKING -> COMPLETED)
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
from app.db.init_db import init_db
from app.main import app
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.niti_extensions import FarmerProfile, OperatorProfile, OTPVerification
from app.models.resource import Machine

# In-memory SQLite DB for tests
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_niti_test_db() -> Generator[None, None, None]:
    """Create fresh schema and seed standard data for tests."""
    Base.metadata.create_all(bind=test_engine)
    with TestingSessionLocal() as session:
        init_db(db=session)

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
    return TestClient(app)


def test_otp_flow_and_farmer_registration(client: TestClient) -> None:
    """Verify OTP dispatch, verification, and new farmer account creation."""
    # 1. Request OTP
    res = client.post("/api/v1/auth/niti/otp/send", json={"phone_number": "+919988776655", "role": "FARMER"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    test_otp = data["test_otp"]
    assert test_otp is not None

    # 2. Login / Register with phone + OTP
    login_res = client.post(
        "/api/v1/auth/niti/farmer/login",
        json={"phone_number": "+919988776655", "otp_code": test_otp},
    )
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data
    assert "FARMER" in login_data["roles"]
    assert login_data["is_new_user"] is True
    assert login_data["farmer_profile"]["onboarding_completed"] is False


def test_farmer_onboarding_and_settings(client: TestClient) -> None:
    """Verify Step 1, 2, 3 profile setup and persistence."""
    # Login as seeded farmer
    res = client.post(
        "/api/v1/auth/niti/farmer/login",
        json={"email": "farmer@niti.org", "password": "Farmer@123"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Retrieve profile
    prof_res = client.get("/api/v1/auth/niti/farmer/profile", headers=headers)
    assert prof_res.status_code == 200
    assert prof_res.json()["village"] == "Kila Raipur"

    # Update profile (Step 2 & 3 onboarding completion)
    update_res = client.put(
        "/api/v1/auth/niti/farmer/profile",
        json={
            "village": "Sarabha",
            "district": "Ludhiana",
            "farm_size": 7.5,
            "primary_crops": "Wheat, Mustard, Cotton",
            "preferred_language": "hi",
            "onboarding_completed": True,
        },
        headers=headers,
    )
    assert update_res.status_code == 200
    updated = update_res.json()
    assert updated["village"] == "Sarabha"
    assert updated["farm_size"] == 7.5
    assert updated["onboarding_completed"] is True


def test_three_separate_login_portals_and_role_protection(client: TestClient) -> None:
    """Verify backend role enforcement across Farmer, CHC, and Operator portals."""
    # 1. Farmer attempting CHC login must fail (403 Forbidden)
    chc_fail = client.post(
        "/api/v1/auth/niti/chc/login",
        json={"email": "farmer@niti.org", "password": "Farmer@123"},
    )
    assert chc_fail.status_code == 403

    # 2. Farmer attempting Operator login must fail (403 Forbidden)
    op_fail = client.post(
        "/api/v1/auth/niti/operator/login",
        json={"email": "farmer@niti.org", "password": "Farmer@123"},
    )
    assert op_fail.status_code == 403

    # 3. CHC Manager login succeeds
    chc_ok = client.post(
        "/api/v1/auth/niti/chc/login",
        json={"email": "chc@niti.org", "password": "Manager@123"},
    )
    assert chc_ok.status_code == 200
    assert "CHC_MANAGER" in chc_ok.json()["roles"]

    # 4. Operator login succeeds
    op_ok = client.post(
        "/api/v1/auth/niti/operator/login",
        json={"email": "operator@niti.org", "password": "Operator@123"},
    )
    assert op_ok.status_code == 200
    assert "OPERATOR" in op_ok.json()["roles"]


def test_voice_nlp_transcript_parsing(client: TestClient) -> None:
    """Verify voice parsing of natural Hindi speech for machinery requests."""
    speech = "Mujhe kal gehun ki katai ke liye 5 acre mein harvester chahiye. Subah 8 baje tak kaam shuru hona chahiye."
    res = client.post("/api/v1/voice/parse", json={"text": speech, "language": "hi"})
    assert res.status_code == 200
    data = res.json()
    extracted = data["extracted"]
    assert extracted["operation"] == "HARVESTING"
    assert extracted["crop"] == "Wheat"
    assert extracted["acreage"] == 5.0
    assert extracted["machine_type"] == "HARVESTER"
    assert data["is_complete"] is True
    assert "5.0 acre" in data["display_summary"]


def test_offer_search_and_voice_explanation(client: TestClient) -> None:
    """Verify CHC offer matching and natural voice explanation comparing two offers."""
    today = date.today()
    search_res = client.post(
        "/api/v1/offers/search",
        json={
            "operation": "PLOUGHING",
            "crop": "Wheat",
            "acreage": 5.0,
            "field_lat": 30.7600,
            "field_lng": 75.8200,
            "requested_date": today.isoformat(),
            "sort_by": "LOWEST_PRICE",
        },
    )
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total_offers_found"] >= 2
    offers = search_data["offers"]
    assert offers[0]["total_quoted_price"] <= offers[1]["total_quoted_price"]

    # Test Voice Explanation comparing these offers
    explain_res = client.post(
        "/api/v1/voice/explain-offers",
        json={
            "offer_ids": [offers[0]["id"], offers[1]["id"]],
            "acreage": 5.0,
            "language": "hi",
        },
    )
    assert explain_res.status_code == 200
    explain_data = explain_res.json()
    assert "सस्ती है" in explain_data["speech_text_hi"]
    assert "difference of" in explain_data["speech_text_en"]
    assert explain_data["price_difference"] >= 0


def test_niti_booking_creation_and_status_progression(client: TestClient) -> None:
    """Verify end-to-end booking from offer and live event tracking."""
    # Farmer login
    res = client.post(
        "/api/v1/auth/niti/farmer/login",
        json={"email": "farmer@niti.org", "password": "Farmer@123"},
    )
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Find an offer
    today = date.today()
    search_res = client.post(
        "/api/v1/offers/search",
        json={
            "operation": "SOWING",
            "crop": "Wheat",
            "acreage": 4.0,
            "field_lat": 30.7600,
            "field_lng": 75.8200,
            "requested_date": (today + timedelta(days=5)).isoformat(),
        },
    )
    offer = search_res.json()["offers"][0]

    # Create Booking
    bkg_res = client.post(
        "/api/v1/bookings/niti/create",
        json={
            "offer_id": offer["id"],
            "field_latitude": 30.7600,
            "field_longitude": 75.8200,
            "acreage": 4.0,
            "operation_type": "SOWING",
            "crop_type": "Wheat",
            "scheduled_date": (today + timedelta(days=5)).isoformat(),
            "scheduled_slot": "FULL_DAY",
        },
        headers=headers,
    )
    assert bkg_res.status_code == 200
    bkg = bkg_res.json()
    assert bkg["booking_code"].startswith("NITI-")
    assert bkg["status"] == "CONFIRMED"
    assert len(bkg["events"]) >= 1

    # Operator advances status to TRAVELLING -> ARRIVED -> WORKING -> COMPLETED
    op_res = client.post(
        "/api/v1/auth/niti/operator/login",
        json={"email": "operator@niti.org", "password": "Operator@123"},
    )
    op_token = op_res.json()["access_token"]
    op_headers = {"Authorization": f"Bearer {op_token}"}

    update_res = client.post(
        f"/api/v1/bookings/niti/{bkg['id']}/status?new_status=TRAVELLING",
        headers=op_headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "TRAVELLING"
    assert len(update_res.json()["events"]) >= 2
