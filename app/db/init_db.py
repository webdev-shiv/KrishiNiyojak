"""Database auto-initialization and demo seeding service for NITI."""

import logging
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.niti_extensions import (
    BookingStatusEvent,
    FarmerProfile,
    OperatorProfile,
    RatingReview,
)
from app.models.resource import Attachment, Machine, Operator, ResourceOwner

logger = logging.getLogger("niti.init_db")


def init_db(db: Session | None = None) -> None:
    """Ensure database schema is created and populated with demo seed data."""
    try:
        # Create all tables if not present
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        logger.warning(f"Could not run create_all on startup (db may be offline): {e}")
        return

    close_session = False
    if db is None:
        db = SessionLocal()
        close_session = True

    try:
        _seed_roles_and_users(db)
    except Exception as e:
        logger.error(f"Error during NITI seeding: {e}")
        db.rollback()
    finally:
        if close_session:
            db.close()


def _seed_roles_and_users(db: Session) -> None:
    """Seed standard roles, users, CHC assets, and sample bookings."""
    # 1. Roles
    role_names = ["FARMER", "CHC_MANAGER", "OPERATOR", "SUPERADMIN"]
    roles_map: dict[str, Role] = {}
    for name in role_names:
        r = db.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
        if not r:
            r = Role(name=name, description=f"NITI System Role: {name}")
            db.add(r)
            db.flush()
        roles_map[name] = r

    # 2. Demo Farmer User
    farmer_user = db.execute(
        select(User).where(User.email == "farmer@niti.org")
    ).scalar_one_or_none()
    if not farmer_user:
        farmer_user = User(
            email="farmer@niti.org",
            phone_number="+919876543210",
            full_name="Ramesh Kumar",
            hashed_password=hash_password("Farmer@123"),
            is_active=True,
        )
        db.add(farmer_user)
        db.flush()
        db.add(UserRole(user_id=farmer_user.id, role_id=roles_map["FARMER"].id))
        db.flush()

        # Farmer Profile
        profile = FarmerProfile(
            user_id=farmer_user.id,
            preferred_language="hi",
            village="Kila Raipur",
            district="Ludhiana",
            state="Punjab",
            latitude=30.7600,
            longitude=75.8200,
            farm_size=5.0,
            farm_size_unit="acres",
            primary_crops="Wheat, Paddy, Mustard",
            seasonal_crops="Moong, Vegetables",
            onboarding_completed=True,
            voice_speed=1.0,
            auto_speak=True,
            notifications_enabled=True,
        )
        db.add(profile)
        db.flush()

    # 3. Demo CHC Manager User
    chc_user = db.execute(select(User).where(User.email == "chc@niti.org")).scalar_one_or_none()
    if not chc_user:
        chc_user = User(
            email="chc@niti.org",
            phone_number="+919876543211",
            full_name="Sukhdev Singh",
            hashed_password=hash_password("Manager@123"),
            is_active=True,
        )
        db.add(chc_user)
        db.flush()
        db.add(UserRole(user_id=chc_user.id, role_id=roles_map["CHC_MANAGER"].id))
        db.flush()

    # 4. Demo Operator User
    op_user = db.execute(select(User).where(User.email == "operator@niti.org")).scalar_one_or_none()
    if not op_user:
        op_user = User(
            email="operator@niti.org",
            phone_number="+919876543212",
            full_name="Gurpreet Singh",
            hashed_password=hash_password("Operator@123"),
            is_active=True,
        )
        db.add(op_user)
        db.flush()
        db.add(UserRole(user_id=op_user.id, role_id=roles_map["OPERATOR"].id))
        db.flush()

        op_profile = OperatorProfile(
            user_id=op_user.id,
            skills="Ploughing, Sowing, Harvesting, Land Levelling",
            experience_years=6.5,
            supported_machinery="TRACTOR, HARVESTER, ROTAVATOR, SUPER_SEEDER",
            license_number="PB-10-DL-2021-8842",
            daily_working_hours=8.0,
            is_available=True,
            rating=4.9,
            total_jobs_completed=28,
        )
        db.add(op_profile)
        db.flush()

    # 5. Primary CHC
    primary_chc = db.execute(
        select(CHC).where(CHC.code == "CHC-LDH-01")
    ).scalar_one_or_none()
    if not primary_chc:
        primary_chc = CHC(
            code="CHC-LDH-01",
            name="Kisan Seva Kendra CHC",
            latitude=30.9010,
            longitude=75.8573,
            operating_radius_km=45.0,
            status="ACTIVE",
        )
        db.add(primary_chc)
        db.flush()

        # Link manager membership
        db.add(
            CHCMembership(
                chc_id=primary_chc.id,
                user_id=chc_user.id,
                role="MANAGER",
                is_active=True,
            )
        )

        # Resource Owner
        owner = ResourceOwner(
            name="Kisan Seva Cooperative",
            contact_phone="+919876543211",
            email="chc@niti.org",
            owner_type="CHC",
        )
        db.add(owner)
        db.flush()

        # Operator Resource
        operator_res = Operator(
            chc_id=primary_chc.id,
            user_id=op_user.id,
            license_number="PB-10-DL-2021-8842",
            experience_years=6,
            status="AVAILABLE",
            hourly_rate=Decimal("150.00"),
        )
        db.add(operator_res)
        db.flush()

        # Attachments
        att_rotavator = Attachment(
            chc_id=primary_chc.id,
            owner_id=owner.id,
            code="ATT-ROTA-01",
            name="Shaktiman Rotavator 7ft",
            category="ROTAVATOR",
            required_hp_min=50.0,
            status="AVAILABLE",
            hourly_rate=Decimal("150.00"),
        )
        att_seeder = Attachment(
            chc_id=primary_chc.id,
            owner_id=owner.id,
            code="ATT-SEED-01",
            name="Happy Seeder / Super Seeder 8ft",
            category="SEEDER",
            required_hp_min=55.0,
            status="AVAILABLE",
            hourly_rate=Decimal("180.00"),
        )
        db.add_all([att_rotavator, att_seeder])
        db.flush()

        # Machines
        machines_data = [
            {
                "reg": "PB-10-ARJUN-605",
                "make": "Mahindra",
                "model": "Arjun Novo 605 DI-i",
                "category": "TRACTOR",
                "hp": 60.0,
                "rate": Decimal("350.00"),
            },
            {
                "reg": "PB-10-JD-5310",
                "make": "John Deere",
                "model": "5310 4WD PowerTech",
                "category": "TRACTOR",
                "hp": 55.0,
                "rate": Decimal("400.00"),
            },
            {
                "reg": "PB-10-PREET-987",
                "make": "Preet",
                "model": "987 Multi-Crop Combine Harvester",
                "category": "HARVESTER",
                "hp": 110.0,
                "rate": Decimal("1400.00"),
            },
            {
                "reg": "PB-10-SONA-65",
                "make": "Sonalika",
                "model": "Tiger DI 65 4WD",
                "category": "TRACTOR",
                "hp": 65.0,
                "rate": Decimal("380.00"),
            },
            {
                "reg": "PB-10-NH-3630",
                "make": "New Holland",
                "model": "3630 TX Super Special",
                "category": "TRACTOR",
                "hp": 55.0,
                "rate": Decimal("420.00"),
            },
        ]

        created_machines = []
        for m_info in machines_data:
            m = Machine(
                chc_id=primary_chc.id,
                owner_id=owner.id,
                registration_number=m_info["reg"],
                make=m_info["make"],
                model=m_info["model"],
                category=m_info["category"],
                horsepower=m_info["hp"],
                status="AVAILABLE",
                current_lat=30.9010,
                current_lng=75.8573,
                hourly_rate=m_info["rate"],
            )
            db.add(m)
            db.flush()
            created_machines.append(m)

        # Demo Bookings for Farmer Ramesh Kumar
        # 1. In-progress / upcoming booking
        today = date.today()
        sr1 = ServiceRequest(
            chc_id=primary_chc.id,
            farmer_id=farmer_user.id,
            field_latitude=30.7600,
            field_longitude=75.8200,
            acreage=5.0,
            operation_type="SOWING",
            crop_type="Wheat",
            requested_start_date=today,
            requested_end_date=today + timedelta(days=2),
            estimated_cost=Decimal("2000.00"),
            status="APPROVED",
        )
        db.add(sr1)
        db.flush()

        booking1 = Booking(
            service_request_id=sr1.id,
            chc_id=primary_chc.id,
            machine_id=created_machines[1].id,  # John Deere
            operator_id=operator_res.id,
            booking_code="NITI-2026-8821",
            scheduled_date=today,
            scheduled_slot="FULL_DAY",
            status="IN_PROGRESS",
            total_cost=Decimal("2000.00"),
            payment_status="PENDING",
        )
        db.add(booking1)
        db.flush()

        # Link attachment
        db.add(BookingAttachment(booking_id=booking1.id, attachment_id=att_seeder.id))

        # Booking Status Events
        events1 = [
            BookingStatusEvent(
                booking_id=booking1.id,
                status="CONFIRMED",
                title="बुकिंग कन्फर्म हो गई (Booking Confirmed)",
                description="किसान सेवा केंद्र ने 5 एकड़ गेहूं बुवाई की रिक्वेस्ट स्वीकार कर ली है।",
                actor_role="CHC_MANAGER",
                created_at=datetime.now(UTC) - timedelta(hours=3),
            ),
            BookingStatusEvent(
                booking_id=booking1.id,
                status="ASSIGNED",
                title="मशीन और ऑपरेटर नियुक्त (Machine & Operator Assigned)",
                description="John Deere 5310 और ऑपरेटर गुरप्रीत सिंह को नियुक्त किया गया।",
                actor_role="CHC_MANAGER",
                created_at=datetime.now(UTC) - timedelta(hours=2),
            ),
            BookingStatusEvent(
                booking_id=booking1.id,
                status="TRAVELLING",
                title="ऑपरेटर खेत के लिए रवाना (Operator On The Way)",
                description="गुरप्रीत सिंह लुधियाना केंद्र से आपके खेत (किला रायपुर) के लिए रवाना हो चुके हैं।",
                actor_role="OPERATOR",
                created_at=datetime.now(UTC) - timedelta(minutes=75),
            ),
            BookingStatusEvent(
                booking_id=booking1.id,
                status="ARRIVED",
                title="ऑपरेटर खेत पर पहुँच गया (Arrived at Farm)",
                description="मशीन खेत पर पहुँच चुकी है। प्रारंभिक निरीक्षण पूरा हुआ।",
                actor_role="OPERATOR",
                created_at=datetime.now(UTC) - timedelta(minutes=40),
            ),
            BookingStatusEvent(
                booking_id=booking1.id,
                status="WORKING",
                title="खेत में काम शुरू (Work in Progress)",
                description="सुपर सीडर से गेहूं की बुवाई शुरू हो चुकी है। अनुमानित समाप्ति 3 घंटे में।",
                actor_role="OPERATOR",
                created_at=datetime.now(UTC) - timedelta(minutes=15),
            ),
        ]
        db.add_all(events1)

        # 2. Completed booking from last week
        last_week = today - timedelta(days=7)
        sr2 = ServiceRequest(
            chc_id=primary_chc.id,
            farmer_id=farmer_user.id,
            field_latitude=30.7600,
            field_longitude=75.8200,
            acreage=4.0,
            operation_type="PLOUGHING",
            crop_type="Mustard",
            requested_start_date=last_week,
            requested_end_date=last_week,
            estimated_cost=Decimal("1400.00"),
            status="APPROVED",
        )
        db.add(sr2)
        db.flush()

        booking2 = Booking(
            service_request_id=sr2.id,
            chc_id=primary_chc.id,
            machine_id=created_machines[0].id,  # Mahindra Arjun
            operator_id=operator_res.id,
            booking_code="NITI-2026-7419",
            scheduled_date=last_week,
            scheduled_slot="FULL_DAY",
            status="COMPLETED",
            total_cost=Decimal("1400.00"),
            payment_status="PAID",
        )
        db.add(booking2)
        db.flush()

        db.add(
            BookingStatusEvent(
                booking_id=booking2.id,
                status="COMPLETED",
                title="काम सफलतापूर्वक संपन्न (Work Completed)",
                description="4 एकड़ खेत में रोटावेटर से जुताई का काम पूरा हुआ।",
                actor_role="OPERATOR",
                created_at=datetime.now(UTC) - timedelta(days=7),
            )
        )

        # Rating review
        review = RatingReview(
            booking_id=booking2.id,
            farmer_id=farmer_user.id,
            chc_id=primary_chc.id,
            machine_id=created_machines[0].id,
            rating=5.0,
            review_text="बहुत बढ़िया काम किया, समय पर पहुँचे और जुताई बहुत अच्छी तरह से की।",
            created_at=datetime.now(UTC) - timedelta(days=6),
        )
        db.add(review)

    db.commit()
    logger.info("NITI database initialized and seeded successfully.")
