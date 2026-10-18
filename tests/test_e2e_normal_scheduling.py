"""Comprehensive End-to-End Verification of the Normal Scheduling Workflow.

Validates the full 8-step Machine-Day Composer lifecycle:
1. Farmer submits service request
2. Backend validates request and service area limits
3. Machine, attachment, and operator compatibility & availability checks
4. Travel time, job duration, conflict, and deadline feasibility
5. Candidate schedule generation with feasible and unscheduled jobs
6. CHC Manager review, rejection, and approval workflows
7. Persistence of approved bookings and availability slots
8. Full booking lifecycle state progression (SCHEDULED -> CONFIRMED -> IN_PROGRESS -> COMPLETED)
9. Verification of proposed feature: Farmer machine selection by model, working speed, coverage width
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

# Isolated in-memory database
test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(autouse=True)
def setup_test_db() -> Generator[None, None, None]:
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
    return TestClient(app)


def seed_user(email: str, role_name: str, chc_id: int | None = None, chc_role: str | None = None) -> tuple[int, str]:
    with TestingSessionLocal() as db:
        role = db.query(Role).filter(Role.name == role_name).first()
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()

        user = User(
            email=email,
            full_name=f"Test {role_name}",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(user)
        db.flush()

        db.add(UserRole(user_id=user.id, role_id=role.id))

        if chc_id and chc_role:
            db.add(
                CHCMembership(
                    user_id=user.id,
                    chc_id=chc_id,
                    role=chc_role,
                    is_active=True,
                )
            )

        db.commit()
        db.refresh(user)
        token = create_access_token(
            subject=user.id,
            roles=[role_name] + ([chc_role] if chc_role else []),
        )
        return user.id, token


def test_complete_normal_scheduling_workflow_end_to_end(client: TestClient):
    """Executes the full 8-step workflow sequentially and asserts all constraints."""
    today = date.today()
    start_date = today + timedelta(days=2)
    end_date = today + timedelta(days=4)

    # 0. Setup CHC Hub, Machine, Attachment, Operator
    with TestingSessionLocal() as db:
        chc = CHC(
            name="Karnal Agri Hub",
            code="CHC-KARNAL-01",
            latitude=29.6857,
            longitude=76.9905,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()
        chc_id = chc.id

        # 50 HP Tractor
        tractor = Machine(
            chc_id=chc.id,
            registration_number="HR05-T-1001",
            make="Mahindra",
            model="575 DI",
            category="TRACTOR",
            horsepower=50.0,
            status="AVAILABLE",
            hourly_rate=Decimal("600.00"),
        )
        db.add(tractor)

        # 35 HP Plow Attachment
        plow = Attachment(
            chc_id=chc.id,
            code="ATT-PLOW-01",
            name="Hydraulic Reversible Plow",
            category="PLOW",
            required_hp_min=35.0,
            status="AVAILABLE",
            hourly_rate=Decimal("150.00"),
        )
        db.add(plow)

        # Operator User
        op_user = User(
            email="operator.gurpreet@niti.org",
            full_name="Gurpreet Singh",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(op_user)
        db.flush()

        operator = Operator(
            chc_id=chc.id,
            user_id=op_user.id,
            license_number="DL-HR-8821",
            experience_years=6,
            status="AVAILABLE",
            hourly_rate=Decimal("120.00"),
        )
        db.add(operator)
        db.commit()
        tractor_id = tractor.id
        plow_id = plow.id
        operator_id = operator.id

    farmer_id, farmer_token = seed_user("farmer.ramesh@niti.org", "FARMER")
    manager_id, manager_token = seed_user("manager.singh@niti.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER")

    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    # STEP 1: Farmer submits a service request
    sr_payload = {
        "chc_id": chc_id,
        "field_latitude": 29.7000,
        "field_longitude": 77.0100,
        "acreage": 5.0,
        "operation_type": "PLOWING",
        "crop_type": "WHEAT",
        "requested_start_date": start_date.isoformat(),
        "requested_end_date": end_date.isoformat(),
        "estimated_cost": 2500.00,
    }
    sr_resp = client.post("/api/v1/service-requests", json=sr_payload, headers=farmer_headers)
    assert sr_resp.status_code == 201, f"Service request failed: {sr_resp.text}"
    service_request = sr_resp.json()
    sr_id = service_request["id"]
    assert service_request["status"] == "SUBMITTED"
    assert service_request["farmer_id"] == farmer_id

    # STEP 2: Service area validation
    # A: Within radius (2.5 km from CHC, radius is 30 km) -> Feasible
    feas_resp = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": chc_id,
            "scheduled_date": start_date.isoformat(),
            "scheduled_slot": "FULL_DAY",
            "service_request_id": sr_id,
        },
        headers=farmer_headers,
    )
    assert feas_resp.status_code == 200
    feas_data = feas_resp.json()
    assert feas_data["constraints"]["within_operating_radius"] is True
    assert feas_data["constraints"]["distance_km"] < 10.0

    # B: Outside radius (> 30 km away, e.g. Delhi coords 28.6139, 77.2090 is ~120 km) -> Non-feasible
    outside_resp = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": chc_id,
            "scheduled_date": start_date.isoformat(),
            "scheduled_slot": "FULL_DAY",
            "field_latitude": 28.6139,
            "field_longitude": 77.2090,
            "service_request_id": sr_id,
        },
        headers=farmer_headers,
    )
    assert outside_resp.status_code == 200
    outside_data = outside_resp.json()
    assert outside_data["feasible"] is False
    assert any("exceeding CHC operational radius limit" in r for r in outside_data["reasons"])

    # STEP 3 & 4: Feasibility checks (Compatibility, Availability, Conflicts, Deadlines)
    # Manager approves service request for scheduling intake
    appr_sr_resp = client.put(
        f"/api/v1/service-requests/{sr_id}",
        json={"status": "APPROVED"},
        headers=manager_headers,
    )
    assert appr_sr_resp.status_code == 200
    assert appr_sr_resp.json()["status"] == "APPROVED"

    # Incompatible attachment test: Attachment requiring 75 HP against a 50 HP tractor
    with TestingSessionLocal() as db:
        heavy_att = Attachment(
            chc_id=chc_id,
            code="ATT-HEAVY-01",
            name="Heavy Ripper 75HP",
            category="PLOW",
            required_hp_min=75.0,
            status="AVAILABLE",
            hourly_rate=Decimal("200.00"),
        )
        db.add(heavy_att)
        db.commit()
        heavy_att_id = heavy_att.id

    hp_check_resp = client.post(
        "/api/v1/scheduling/feasibility",
        json={
            "chc_id": chc_id,
            "scheduled_date": start_date.isoformat(),
            "scheduled_slot": "FULL_DAY",
            "service_request_id": sr_id,
            "machine_id": tractor_id,
            "attachment_ids": [heavy_att_id],
        },
        headers=manager_headers,
    )
    assert hp_check_resp.status_code == 200
    hp_data = hp_check_resp.json()
    assert hp_data["feasible"] is False
    assert any("less than required 75.0 HP" in r for r in hp_data["reasons"])

    # STEP 5: Generate Candidate Schedule
    gen_resp = client.post(
        "/api/v1/schedules/generate",
        json={
            "chc_id": chc_id,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        headers=manager_headers,
    )
    assert gen_resp.status_code == 201, f"Schedule generation failed: {gen_resp.text}"
    schedule = gen_resp.json()
    schedule_id = schedule["id"]
    assert schedule["status"] == "PROPOSED"
    assert schedule["total_scheduled"] == 1
    assert schedule["total_unscheduled"] == 0
    candidate_assignment = schedule["candidate_assignments"][0]
    assert candidate_assignment["service_request_id"] == sr_id
    assert candidate_assignment["feasible"] is True

    # Verify zero database mutations before approval
    with TestingSessionLocal() as db:
        bookings_count = db.query(Booking).count()
        assert bookings_count == 0, "No bookings should be created before schedule approval"

    # STEP 6: CHC Manager review, rejection, and approval
    # Test rejection workflow first with a separate candidate schedule
    gen_resp_2 = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers=manager_headers,
    )
    sched_to_reject_id = gen_resp_2.json()["id"]
    rej_resp = client.post(
        f"/api/v1/schedules/{sched_to_reject_id}/reject",
        json={"reason": "Fleet maintenance planned for that day"},
        headers=manager_headers,
    )
    assert rej_resp.status_code == 200
    assert rej_resp.json()["status"] == "REJECTED"

    # Verify cannot approve a rejected schedule
    appr_rej_resp = client.post(
        f"/api/v1/schedules/{sched_to_reject_id}/approve",
        headers=manager_headers,
    )
    assert appr_rej_resp.status_code == 400
    assert "Cannot approve a rejected schedule" in appr_rej_resp.json()["detail"]

    # STEP 7: Transactional Approval commits assignments and updates availability
    appr_resp = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers=manager_headers,
    )
    assert appr_resp.status_code == 200
    approved_sched = appr_resp.json()
    assert approved_sched["status"] == "APPROVED"
    committed_booking_id = approved_sched["candidate_assignments"][0]["booking_id"]
    assert committed_booking_id is not None

    # Verify database persistence
    with TestingSessionLocal() as db:
        db_booking = db.execute(select(Booking).where(Booking.id == committed_booking_id)).scalar_one_or_none()
        assert db_booking is not None
        assert db_booking.status == "SCHEDULED"
        assert db_booking.service_request_id == sr_id
        assert db_booking.machine_id == tractor_id

        # Verify MachineAvailability is BOOKED
        m_avail = db.execute(
            select(MachineAvailability).where(
                MachineAvailability.machine_id == tractor_id,
                MachineAvailability.slot_date == candidate_assignment["scheduled_date"],
            )
        ).scalar_one_or_none()
        assert m_avail is not None
        assert m_avail.status == "BOOKED"

        # Verify OperatorAvailability is ASSIGNED
        op_avail = db.execute(
            select(OperatorAvailability).where(
                OperatorAvailability.operator_id == operator_id,
                OperatorAvailability.slot_date == candidate_assignment["scheduled_date"],
            )
        ).scalar_one_or_none()
        assert op_avail is not None
        assert op_avail.status == "ASSIGNED"

    # Verify duplicate approval rejection
    dup_appr_resp = client.post(
        f"/api/v1/schedules/{schedule_id}/approve",
        headers=manager_headers,
    )
    assert dup_appr_resp.status_code == 400
    assert "already been approved" in dup_appr_resp.json()["detail"]

    # STEP 8: Booking lifecycle progression
    # SCHEDULED -> CONFIRMED
    conf_resp = client.put(
        f"/api/v1/bookings/{committed_booking_id}",
        json={"status": "CONFIRMED"},
        headers=manager_headers,
    )
    assert conf_resp.status_code == 200
    assert conf_resp.json()["status"] == "CONFIRMED"

    # CONFIRMED -> IN_PROGRESS
    inp_resp = client.put(
        f"/api/v1/bookings/{committed_booking_id}",
        json={"status": "IN_PROGRESS"},
        headers=manager_headers,
    )
    assert inp_resp.status_code == 200
    assert inp_resp.json()["status"] == "IN_PROGRESS"

    # IN_PROGRESS -> COMPLETED (Terminal State)
    comp_resp = client.put(
        f"/api/v1/bookings/{committed_booking_id}",
        json={"status": "COMPLETED"},
        headers=manager_headers,
    )
    assert comp_resp.status_code == 200
    assert comp_resp.json()["status"] == "COMPLETED"

    # COMPLETED is terminal: Attempting further mutation fails
    mut_resp = client.put(
        f"/api/v1/bookings/{committed_booking_id}",
        json={"status": "IN_PROGRESS"},
        headers=manager_headers,
    )
    assert mut_resp.status_code == 400
    assert "Invalid status transition from COMPLETED" in mut_resp.json()["detail"]


def test_farmer_machine_options_and_selection_workflow(client: TestClient):
    """Verifies that farmers can evaluate multiple machine options with capacity and duration,

    select their preferred machine, and have that selection strictly honored in scheduling.
    """
    today = date.today()
    start_date = today + timedelta(days=2)
    end_date = today + timedelta(days=5)

    with TestingSessionLocal() as db:
        chc = CHC(
            name="Yamunanagar Agri Cluster",
            code="CHC-YNR-01",
            latitude=30.1290,
            longitude=77.2674,
            operating_radius_km=35.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()
        chc_id = chc.id

        # Machine 1: Medium 45 HP Tractor (speed 5.0 km/h, width 1.8 m, eff 0.8)
        m1 = Machine(
            chc_id=chc_id,
            registration_number="HR02-T-2001",
            make="Sonalika",
            model="DI 745",
            category="TRACTOR",
            horsepower=45.0,
            working_speed_kmh=5.0,
            coverage_width_m=1.8,
            field_efficiency_factor=0.80,
            status="AVAILABLE",
            hourly_rate=Decimal("500.00"),
        )
        # Machine 2: Powerful 65 HP Tractor (speed 7.0 km/h, width 2.4 m, eff 0.82)
        m2 = Machine(
            chc_id=chc_id,
            registration_number="HR02-T-3001",
            make="John Deere",
            model="5310 4WD",
            category="TRACTOR",
            horsepower=65.0,
            working_speed_kmh=7.0,
            coverage_width_m=2.4,
            field_efficiency_factor=0.82,
            status="AVAILABLE",
            hourly_rate=Decimal("800.00"),
        )
        db.add_all([m1, m2])

        # Attachment
        plow = Attachment(
            chc_id=chc_id,
            code="ATT-PLOW-02",
            name="Disc Plow 3-Bottom",
            category="PLOW",
            required_hp_min=40.0,
            status="AVAILABLE",
            hourly_rate=Decimal("150.00"),
        )
        db.add(plow)

        # Operator
        op_user = User(
            email="op.baldev@niti.org",
            full_name="Baldev Kumar",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(op_user)
        db.flush()

        operator = Operator(
            chc_id=chc_id,
            user_id=op_user.id,
            license_number="DL-HR-9901",
            experience_years=8,
            status="AVAILABLE",
            hourly_rate=Decimal("150.00"),
        )
        db.add(operator)
        db.commit()
        m1_id = m1.id
        m2_id = m2.id

    farmer_id, farmer_token = seed_user("farmer.options@niti.org", "FARMER")
    manager_id, manager_token = seed_user("mgr.ynr@niti.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER")
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    # 1. Farmer submits service request (6 acres, PLOWING)
    sr_resp = client.post(
        "/api/v1/service-requests",
        json={
            "chc_id": chc_id,
            "field_latitude": 30.1400,
            "field_longitude": 77.2800,
            "acreage": 6.0,
            "operation_type": "PLOWING",
            "requested_start_date": start_date.isoformat(),
            "requested_end_date": end_date.isoformat(),
        },
        headers=farmer_headers,
    )
    assert sr_resp.status_code == 201
    sr_id = sr_resp.json()["id"]

    # 2. Manager approves request for scheduling
    appr_sr = client.put(f"/api/v1/service-requests/{sr_id}", json={"status": "APPROVED"}, headers=manager_headers)
    assert appr_sr.status_code == 200

    # 3. Farmer requests machine options
    opts_resp = client.get(f"/api/v1/service-requests/{sr_id}/machine-options", headers=farmer_headers)
    assert opts_resp.status_code == 200
    opts_data = opts_resp.json()
    assert opts_data["service_request_id"] == sr_id
    assert len(opts_data["options"]) == 2

    # Verify formula calculation on options:
    # 6.0 acres = 2.428116 ha
    # m1: capacity = 1.8 * 5.0 * 0.8 / 10 = 0.72 ha/h
    # m2: capacity = 2.4 * 7.0 * 0.82 / 10 = 1.3776 ha/h
    m1_opt = next(o for o in opts_data["options"] if o["machine_id"] == m1_id)
    m2_opt = next(o for o in opts_data["options"] if o["machine_id"] == m2_id)

    assert m1_opt["make"] == "Sonalika"
    assert m1_opt["model"] == "DI 745"
    assert m1_opt["working_speed_kmh"] == 5.0
    assert m1_opt["coverage_width_m"] == 1.8
    assert m1_opt["effective_capacity_ha_per_hour"] == pytest.approx(0.72, rel=1e-2)
    assert m1_opt["feasible"] is True
    assert len(m1_opt["available_slots"]) > 0

    assert m2_opt["make"] == "John Deere"
    assert m2_opt["model"] == "5310 4WD"
    assert m2_opt["working_speed_kmh"] == 7.0
    assert m2_opt["coverage_width_m"] == 2.4
    assert m2_opt["effective_capacity_ha_per_hour"] == pytest.approx(1.3776, rel=1e-2)
    assert m2_opt["estimated_duration_hours"] < m1_opt["estimated_duration_hours"]

    # 4. Farmer explicitly selects John Deere (m2) for preferred date and morning slot
    chosen_slot = m2_opt["available_slots"][0]
    select_resp = client.post(
        f"/api/v1/service-requests/{sr_id}/select-machine",
        json={
            "machine_id": m2_id,
            "selected_date": chosen_slot["date"],
            "selected_slot": chosen_slot["slot"],
        },
        headers=farmer_headers,
    )
    assert select_resp.status_code == 200
    sel_data = select_resp.json()
    assert sel_data["selected_machine_id"] == m2_id
    assert sel_data["selected_date"] == chosen_slot["date"]
    assert sel_data["selected_slot"] == chosen_slot["slot"]

    # 5. CHC Manager generates candidate schedule
    gen_resp = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers=manager_headers,
    )
    assert gen_resp.status_code == 201
    sched = gen_resp.json()
    assert sched["total_scheduled"] == 1
    assignment = sched["candidate_assignments"][0]
    # The assignment MUST use the farmer-selected machine (m2_id), NOT the cheaper m1_id!
    assert assignment["machine_id"] == m2_id
    assert assignment["service_request_id"] == sr_id

    # 6. Manager approves schedule
    appr_resp = client.post(f"/api/v1/schedules/{sched['id']}/approve", headers=manager_headers)
    assert appr_resp.status_code == 200
    booking_id = appr_resp.json()["candidate_assignments"][0]["booking_id"]

    # Final verification in database: booking finalized with m2
    with TestingSessionLocal() as db:
        bk = db.execute(select(Booking).where(Booking.id == booking_id)).scalar_one()
        assert bk.machine_id == m2_id


def test_farmer_machine_selection_authority_and_no_silent_substitution(client: TestClient):
    """Verifies authority rule: Neither system nor manager may silently substitute another machine.

    If selected machine becomes unavailable, job cannot be scheduled and requires farmer re-selection.
    """
    today = date.today()
    start_date = today + timedelta(days=2)
    end_date = today + timedelta(days=4)

    with TestingSessionLocal() as db:
        chc = CHC(
            name="Hisar Agri Centre",
            code="CHC-HSR-01",
            latitude=29.1492,
            longitude=75.7217,
            operating_radius_km=30.0,
            status="ACTIVE",
        )
        db.add(chc)
        db.flush()
        chc_id = chc.id

        m_chosen = Machine(
            chc_id=chc_id,
            registration_number="HR20-T-5001",
            make="Mahindra",
            model="Yuvo 575",
            category="TRACTOR",
            horsepower=45.0,
            status="AVAILABLE",
            hourly_rate=Decimal("600.00"),
        )
        m_other = Machine(
            chc_id=chc_id,
            registration_number="HR20-T-5002",
            make="Kubota",
            model="MU4501",
            category="TRACTOR",
            horsepower=45.0,
            status="AVAILABLE",
            hourly_rate=Decimal("550.00"),
        )
        db.add_all([m_chosen, m_other])

        plow = Attachment(
            chc_id=chc_id,
            code="ATT-PLOW-03",
            name="Rotavator 6ft",
            category="PLOW",
            required_hp_min=40.0,
            status="AVAILABLE",
            hourly_rate=Decimal("120.00"),
        )
        db.add(plow)

        op_user = User(
            email="op.sukhdev@niti.org",
            full_name="Sukhdev Singh",
            hashed_password=hash_password("Pass123!"),
            is_active=True,
        )
        db.add(op_user)
        db.flush()

        operator = Operator(
            chc_id=chc_id,
            user_id=op_user.id,
            license_number="DL-HR-3341",
            experience_years=5,
            status="AVAILABLE",
            hourly_rate=Decimal("120.00"),
        )
        db.add(operator)
        db.commit()
        chosen_id = m_chosen.id
        other_id = m_other.id

    farmer_id, farmer_token = seed_user("farmer.authority@niti.org", "FARMER")
    manager_id, manager_token = seed_user("mgr.hsr@niti.org", "CHC_MANAGER", chc_id=chc_id, chc_role="MANAGER")
    farmer_headers = {"Authorization": f"Bearer {farmer_token}"}
    manager_headers = {"Authorization": f"Bearer {manager_token}"}

    # Submit and approve service request
    sr_resp = client.post(
        "/api/v1/service-requests",
        json={
            "chc_id": chc_id,
            "field_latitude": 29.1550,
            "field_longitude": 75.7300,
            "acreage": 4.0,
            "operation_type": "PLOWING",
            "requested_start_date": start_date.isoformat(),
            "requested_end_date": end_date.isoformat(),
        },
        headers=farmer_headers,
    )
    sr_id = sr_resp.json()["id"]
    client.put(f"/api/v1/service-requests/{sr_id}", json={"status": "APPROVED"}, headers=manager_headers)

    # Farmer selects m_chosen
    client.post(
        f"/api/v1/service-requests/{sr_id}/select-machine",
        json={"machine_id": chosen_id},
        headers=farmer_headers,
    )

    # Now make m_chosen UNAVAILABLE (e.g. breakdown/maintenance)
    with TestingSessionLocal() as db:
        m = db.execute(select(Machine).where(Machine.id == chosen_id)).scalar_one()
        m.status = "MAINTENANCE"
        db.commit()

    # Generate schedule: Even though m_other is completely available, the system must NOT silently substitute it!
    gen_resp = client.post(
        "/api/v1/schedules/generate",
        json={"chc_id": chc_id},
        headers=manager_headers,
    )
    sched = gen_resp.json()
    assert sched["total_scheduled"] == 0
    assert sched["total_unscheduled"] == 1
    unscheduled = sched["unscheduled_jobs"][0]
    assert unscheduled["service_request_id"] == sr_id
    assert any("Silent substitution is prohibited" in r or "unavailable" in r for r in unscheduled["reasons"])
