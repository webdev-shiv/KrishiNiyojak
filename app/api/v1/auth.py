"""Authentication and authorization endpoints: register, login, refresh, logout, me."""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_active_user
from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)
from app.db.session import get_db
from app.models.identity import Role, User, UserRole
from app.models.supporting import RefreshToken
from app.schemas.auth import (
    LogoutRequest,
    MessageResponse,
    RefreshTokenRequest,
    TokenResponse,
    UserLoginRequest,
    UserRegisterRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _extract_user_roles(user: User) -> list[str]:
    """Helper to extract distinct role names across direct roles and active CHC memberships."""
    roles: set[str] = set()
    for ur in user.user_roles:
        if ur.role:
            roles.add(ur.role.name.upper())
    for membership in user.chc_memberships:
        if membership.is_active:
            roles.add(membership.role.upper())
    return sorted(roles)


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
def register(
    payload: UserRegisterRequest,
    db: Session = Depends(get_db),
) -> UserResponse:
    """Register a new user account.

    Users are assigned the base 'FARMER' role by default. Privileged roles
    (e.g., CHC_MANAGER, SUPERADMIN) cannot be self-assigned.
    """
    # Check if email is already taken
    existing_email = db.execute(
        select(User).where(User.email == payload.email)
    ).scalar_one_or_none()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists",
        )

    # Check if phone number is already taken
    if payload.phone_number:
        existing_phone = db.execute(
            select(User).where(User.phone_number == payload.phone_number)
        ).scalar_one_or_none()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A user with this phone number already exists",
            )

    # Create new user
    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        phone_number=payload.phone_number,
        is_active=True,
    )
    db.add(new_user)
    db.flush()

    # Ensure default 'FARMER' role exists
    farmer_role = db.execute(select(Role).where(Role.name == "FARMER")).scalar_one_or_none()
    if not farmer_role:
        farmer_role = Role(
            name="FARMER",
            description="Default agricultural producer and service requester",
        )
        db.add(farmer_role)
        db.flush()

    user_role = UserRole(user_id=new_user.id, role_id=farmer_role.id)
    db.add(user_role)
    db.commit()

    # Re-query with eagerly loaded relationships
    user = db.execute(
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.chc_memberships),
        )
        .where(User.id == new_user.id)
    ).scalar_one()

    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        phone_number=user.phone_number,
        is_active=user.is_active,
        roles=_extract_user_roles(user),
        created_at=user.created_at,
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Authenticate user and issue JWT and refresh tokens",
)
def login(
    payload: UserLoginRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Authenticate with email and password to receive access and refresh tokens."""
    query = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.chc_memberships),
        )
        .where(User.email == payload.email)
    )
    user = db.execute(query).scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    roles = _extract_user_roles(user)
    access_token = create_access_token(subject=user.id, roles=roles)

    # Generate opaque refresh token and store only its cryptographic hash
    raw_refresh_token = generate_refresh_token()
    token_hash = hash_refresh_token(raw_refresh_token)
    expires_at = datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_entry = RefreshToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
        is_revoked=False,
    )
    db.add(refresh_entry)
    db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=raw_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Rotate refresh token and issue a fresh access token",
)
def refresh_token_endpoint(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    """Exchange an active refresh token for a new access token and a rotated refresh token."""
    token_hash = hash_refresh_token(payload.refresh_token)

    query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    token_record = db.execute(query).scalar_one_or_none()

    now = datetime.now(UTC)

    expires_at = token_record.expires_at if token_record else None
    if expires_at and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if not token_record or token_record.is_revoked or (expires_at and expires_at < now):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Revoke old refresh token (rotation policy)
    token_record.is_revoked = True

    # Retrieve associated user
    user_query = (
        select(User)
        .options(
            selectinload(User.user_roles).selectinload(UserRole.role),
            selectinload(User.chc_memberships),
        )
        .where(User.id == token_record.user_id)
    )
    user = db.execute(user_query).scalar_one_or_none()

    if not user or not user.is_active:
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is invalid or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )

    roles = _extract_user_roles(user)
    new_access_token = create_access_token(subject=user.id, roles=roles)

    # Generate new refresh token
    new_raw_refresh_token = generate_refresh_token()
    new_token_hash = hash_refresh_token(new_raw_refresh_token)
    new_expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_refresh_entry = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hash,
        expires_at=new_expires_at,
        is_revoked=False,
    )
    db.add(new_refresh_entry)
    db.commit()

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_raw_refresh_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Revoke an active refresh token",
)
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Revoke the provided refresh token so it cannot be used again."""
    token_hash = hash_refresh_token(payload.refresh_token)

    query = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    token_record = db.execute(query).scalar_one_or_none()

    if token_record and not token_record.is_revoked:
        token_record.is_revoked = True
        db.commit()

    return MessageResponse(message="Successfully logged out")


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get authenticated user profile and roles",
)
def get_me(
    current_user: User = Depends(get_current_active_user),
) -> UserResponse:
    """Retrieve profile and assigned roles for the currently authenticated user."""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phone_number=current_user.phone_number,
        is_active=current_user.is_active,
        roles=_extract_user_roles(current_user),
        created_at=current_user.created_at,
    )
