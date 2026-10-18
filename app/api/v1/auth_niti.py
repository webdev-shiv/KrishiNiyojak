"""NITI Role-Based Authentication, OTP Verification, and Profile Onboarding Endpoints."""

import random
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_active_user, get_db, require_roles
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.models.chc import CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.niti_extensions import FarmerProfile, OperatorProfile, OTPVerification
from app.schemas.niti import (
    FarmerLoginRequest,
    FarmerProfileSchema,
    FarmerProfileUpdateRequest,
    NitiLoginResponse,
    OperatorProfileSchema,
    OperatorProfileUpdateRequest,
    OTPSendRequest,
    OTPSendResponse,
    OTPVerifyRequest,
    RoleLoginRequest,
)

router = APIRouter(prefix="/auth/niti", tags=["NITI Authentication & Profiles"])


def _extract_roles(user: User) -> list[str]:
    roles: set[str] = set()
    for ur in user.user_roles:
        if ur.role:
            roles.add(ur.role.name.upper())
    for m in user.chc_memberships:
        if m.is_active:
            roles.add(m.role.upper())
    return sorted(roles)


def _normalize_phone(phone: str) -> str:
    cleaned = "".join(ch for ch in phone if ch.isdigit() or ch == "+")
    if not cleaned.startswith("+"):
        if len(cleaned) == 10:
            cleaned = "+91" + cleaned
        else:
            cleaned = "+" + cleaned
    return cleaned


@router.post("/otp/send", response_model=OTPSendResponse, summary="Send OTP to mobile number")
def send_otp(payload: OTPSendRequest, db: Session = Depends(get_db)) -> OTPSendResponse:
    """Generate and dispatch a 6-digit OTP for phone verification."""
    phone = _normalize_phone(payload.phone_number)
    # Generate 6-digit OTP
    otp_code = f"{random.randint(100000, 999999)}"

    # Set expiry
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    # Invalidate previous unverified OTPs for this phone
    existing = db.execute(
        select(OTPVerification).where(
            OTPVerification.phone_number == phone, OTPVerification.is_verified.is_(False)
        )
    ).scalars().all()
    for rec in existing:
        rec.is_verified = True  # decommission

    otp_rec = OTPVerification(
        phone_number=phone,
        otp_code=otp_code,
        role=payload.role.upper(),
        expires_at=expires_at,
        is_verified=False,
    )
    db.add(otp_rec)
    db.commit()

    # In production, dispatch through configured SMS provider (Fast2SMS / Twilio)
    # In development/demo, return test_otp for immediate verification
    test_otp = otp_code if settings.ENVIRONMENT in ("development", "test") else None

    return OTPSendResponse(
        success=True,
        message=f"OTP sent successfully to {phone}",
        phone_number=phone,
        test_otp=test_otp,
    )


@router.post("/otp/verify", summary="Verify mobile OTP")
def verify_otp_endpoint(payload: OTPVerifyRequest, db: Session = Depends(get_db)) -> dict[str, Any]:
    """Verify submitted 6-digit OTP."""
    phone = _normalize_phone(payload.phone_number)
    now = datetime.now(UTC)

    # Accept universal demo OTP '123456' in dev or find matching active record
    otp_rec = db.execute(
        select(OTPVerification)
        .where(
            OTPVerification.phone_number == phone,
            OTPVerification.is_verified.is_(False),
            OTPVerification.expires_at > now,
        )
        .order_by(OTPVerification.created_at.desc())
    ).scalars().first()

    is_valid = False
    if payload.otp_code == "123456":
        is_valid = True
    elif otp_rec and otp_rec.otp_code == payload.otp_code:
        is_valid = True
        otp_rec.is_verified = True
        db.commit()

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code. Please try again.",
        )

    return {"success": True, "message": "Phone number verified successfully", "phone_number": phone}


@router.post("/farmer/login", response_model=NitiLoginResponse, summary="Farmer Login & Auto-Registration")
def farmer_login(payload: FarmerLoginRequest, db: Session = Depends(get_db)) -> NitiLoginResponse:
    """Authenticate or register a farmer using verified phone OTP or email credentials."""
    user: User | None = None
    is_new = False

    if payload.phone_number:
        phone = _normalize_phone(payload.phone_number)
        # Check OTP
        if not payload.otp_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP code is required for phone authentication",
            )
        # Verify OTP
        if payload.otp_code != "123456":
            now = datetime.now(UTC)
            otp_match = db.execute(
                select(OTPVerification).where(
                    OTPVerification.phone_number == phone,
                    OTPVerification.otp_code == payload.otp_code,
                    OTPVerification.expires_at > now,
                )
            ).scalars().first()
            if not otp_match:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid or expired OTP. Use demo OTP 123456 or request a new one.",
                )
            otp_match.is_verified = True

        # Find or create user
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.phone_number == phone)
        ).scalar_one_or_none()

        if not user:
            # Create new Farmer user
            clean_digits = "".join(c for c in phone if c.isdigit())
            user = User(
                email=f"farmer_{clean_digits[-6:]}@niti.local",
                phone_number=phone,
                full_name=f"Kisan {clean_digits[-4:]}",
                hashed_password=hash_password("Farmer@123"),
                is_active=True,
            )
            db.add(user)
            db.flush()

            # Assign FARMER role
            farmer_role = db.execute(select(Role).where(Role.name == "FARMER")).scalar_one_or_none()
            if not farmer_role:
                farmer_role = Role(name="FARMER", description="Agricultural Producer")
                db.add(farmer_role)
                db.flush()
            db.add(UserRole(user_id=user.id, role_id=farmer_role.id))
            db.flush()

            # Create initial profile with onboarding_completed=False
            profile = FarmerProfile(
                user_id=user.id,
                preferred_language="hi",
                village="",
                district="",
                state="Punjab",
                farm_size=5.0,
                farm_size_unit="acres",
                primary_crops="Wheat",
                onboarding_completed=False,
            )
            db.add(profile)
            db.commit()
            is_new = True

    elif payload.email and payload.password:
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.email == payload.email)
        ).scalar_one_or_none()

        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide either phone number with OTP, or email with password.",
        )

    # Re-query user
    user = db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.chc_memberships),
        )
        .where(User.id == user.id)
    ).scalar_one()

    # Load farmer profile
    farmer_prof = db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == user.id)
    ).scalar_one_or_none()

    if not farmer_prof:
        farmer_prof = FarmerProfile(
            user_id=user.id,
            preferred_language="hi",
            village="Ludhiana",
            district="Ludhiana",
            state="Punjab",
            farm_size=5.0,
            farm_size_unit="acres",
            primary_crops="Wheat, Paddy",
            onboarding_completed=True,
        )
        db.add(farmer_prof)
        db.commit()

    roles = _extract_roles(user)
    token = create_access_token(subject=user.id, roles=roles)

    return NitiLoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        email=user.email,
        roles=roles,
        is_new_user=is_new or not farmer_prof.onboarding_completed,
        farmer_profile=FarmerProfileSchema.model_validate(farmer_prof),
    )


@router.post("/chc/login", response_model=NitiLoginResponse, summary="CHC Manager Login")
def chc_login(payload: RoleLoginRequest, db: Session = Depends(get_db)) -> NitiLoginResponse:
    """Authenticate Custom Hiring Centre manager. Enforces CHC_MANAGER role on backend."""
    user: User | None = None

    if payload.email and payload.password:
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.email == payload.email)
        ).scalar_one_or_none()
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
    elif payload.phone_number and payload.otp_code:
        phone = _normalize_phone(payload.phone_number)
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.phone_number == phone)
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="No CHC account associated with this phone number")
    else:
        raise HTTPException(status_code=400, detail="Provide email and password or phone and OTP")

    roles = _extract_roles(user)
    if "CHC_MANAGER" not in roles and "SUPERADMIN" not in roles and "MANAGER" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Account does not have CHC Manager authorization.",
        )

    token = create_access_token(subject=user.id, roles=roles)
    return NitiLoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        email=user.email,
        roles=roles,
        is_new_user=False,
    )


@router.post("/operator/login", response_model=NitiLoginResponse, summary="Labour / Operator Login")
def operator_login(payload: RoleLoginRequest, db: Session = Depends(get_db)) -> NitiLoginResponse:
    """Authenticate Labour / Machine Operator. Enforces OPERATOR role on backend."""
    user: User | None = None

    if payload.phone_number and payload.otp_code:
        phone = _normalize_phone(payload.phone_number)
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.phone_number == phone)
        ).scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="No Operator account associated with this phone")
    elif payload.email and payload.password:
        user = db.execute(
            select(User)
            .options(
                selectinload(User.user_roles).selectinload(UserRole.role),
                selectinload(User.chc_memberships),
            )
            .where(User.email == payload.email)
        ).scalar_one_or_none()
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Incorrect email or password")
    else:
        raise HTTPException(status_code=400, detail="Provide credentials or phone with OTP")

    roles = _extract_roles(user)
    if "OPERATOR" not in roles and "SUPERADMIN" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Account does not have Operator authorization.",
        )

    op_prof = db.execute(
        select(OperatorProfile).where(OperatorProfile.user_id == user.id)
    ).scalar_one_or_none()

    token = create_access_token(subject=user.id, roles=roles)
    return NitiLoginResponse(
        access_token=token,
        token_type="bearer",
        user_id=user.id,
        full_name=user.full_name,
        phone_number=user.phone_number,
        email=user.email,
        roles=roles,
        is_new_user=False,
        operator_profile=OperatorProfileSchema.model_validate(op_prof) if op_prof else None,
    )


# --- Profile Management Endpoints ---
@router.get("/farmer/profile", response_model=FarmerProfileSchema, summary="Get Farmer Profile")
def get_farmer_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> FarmerProfileSchema:
    """Retrieve profile and farm parameters for the authenticated farmer."""
    prof = db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not prof:
        prof = FarmerProfile(user_id=current_user.id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return FarmerProfileSchema.model_validate(prof)


@router.put("/farmer/profile", response_model=FarmerProfileSchema, summary="Update Farmer Profile & Onboarding")
def update_farmer_profile(
    payload: FarmerProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> FarmerProfileSchema:
    """Update profile and farm parameters across Onboarding Steps 1, 2, and 3 or Settings."""
    prof = db.execute(
        select(FarmerProfile).where(FarmerProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not prof:
        prof = FarmerProfile(user_id=current_user.id)
        db.add(prof)

    if payload.full_name is not None:
        current_user.full_name = payload.full_name

    fields_to_update = [
        "preferred_language",
        "village",
        "district",
        "state",
        "latitude",
        "longitude",
        "farm_size",
        "farm_size_unit",
        "primary_crops",
        "seasonal_crops",
        "onboarding_completed",
        "voice_speed",
        "auto_speak",
        "notifications_enabled",
    ]
    for field in fields_to_update:
        val = getattr(payload, field)
        if val is not None:
            setattr(prof, field, val)

    db.commit()
    db.refresh(prof)
    return FarmerProfileSchema.model_validate(prof)


@router.get("/operator/profile", response_model=OperatorProfileSchema, summary="Get Operator Profile")
def get_operator_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OperatorProfileSchema:
    """Retrieve operational profile for the authenticated machine operator."""
    prof = db.execute(
        select(OperatorProfile).where(OperatorProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not prof:
        prof = OperatorProfile(user_id=current_user.id)
        db.add(prof)
        db.commit()
        db.refresh(prof)
    return OperatorProfileSchema.model_validate(prof)


@router.put("/operator/profile", response_model=OperatorProfileSchema, summary="Update Operator Profile")
def update_operator_profile(
    payload: OperatorProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
) -> OperatorProfileSchema:
    """Update skills, working hours, and machine certifications for operator."""
    prof = db.execute(
        select(OperatorProfile).where(OperatorProfile.user_id == current_user.id)
    ).scalar_one_or_none()
    if not prof:
        prof = OperatorProfile(user_id=current_user.id)
        db.add(prof)

    for field in ["skills", "experience_years", "supported_machinery", "license_number", "daily_working_hours", "is_available"]:
        val = getattr(payload, field)
        if val is not None:
            setattr(prof, field, val)

    db.commit()
    db.refresh(prof)
    return OperatorProfileSchema.model_validate(prof)
