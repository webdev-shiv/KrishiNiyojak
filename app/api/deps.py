"""Reusable FastAPI dependencies for authentication and authorization."""

from collections.abc import Callable

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.identity import User

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Validate bearer token and resolve authenticated user from database."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = decode_access_token(token)
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception from None

    query = (
        select(User)
        .options(
            selectinload(User.user_roles),
            selectinload(User.chc_memberships),
        )
        .where(User.id == user_id)
    )
    user = db.execute(query).scalar_one_or_none()

    if user is None:
        raise credentials_exception

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure the authenticated user account is active."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return current_user


def require_roles(*allowed_roles: str) -> Callable[[User], User]:
    """Dependency factory enforcing that the user has at least one of the allowed roles."""

    def role_checker(
        current_user: User = Depends(get_current_active_user),
    ) -> User:
        user_roles: set[str] = set()

        # System and direct user roles
        for ur in current_user.user_roles:
            if ur.role:
                user_roles.add(ur.role.name.upper())

        # CHC organizational roles (e.g. CHC_MANAGER, OPERATOR)
        for membership in current_user.chc_memberships:
            if membership.is_active:
                user_roles.add(membership.role.upper())

        # Normalize allowed roles for comparison
        normalized_allowed = {role.upper() for role in allowed_roles}

        # SUPERADMIN always has access
        if "SUPERADMIN" in user_roles or bool(user_roles & normalized_allowed):
            return current_user

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Operation not permitted. Required roles: {', '.join(sorted(normalized_allowed))}"
            ),
        )

    return role_checker


def verify_chc_manager_access(current_user: User, chc_id: int) -> None:
    """Ensure current user is an active manager of the specified CHC, or superadmin."""
    # Check if SUPERADMIN
    for ur in current_user.user_roles:
        if ur.role and ur.role.name.upper() == "SUPERADMIN":
            return

    # Check CHC membership with role MANAGER
    for membership in current_user.chc_memberships:
        if (
            membership.is_active
            and membership.chc_id == chc_id
            and membership.role.upper() == "MANAGER"
        ):
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Access denied: You are not authorized to manage CHC {chc_id}",
    )


def verify_resource_management_access(
    current_user: User, chc_id: int, owner_id: int | None, db: Session
) -> None:
    """Ensure current user can manage a resource belonging to a CHC or resource owner."""
    # Check if SUPERADMIN
    for ur in current_user.user_roles:
        if ur.role and ur.role.name.upper() == "SUPERADMIN":
            return

    # Check if active manager of this CHC
    for membership in current_user.chc_memberships:
        if (
            membership.is_active
            and membership.chc_id == chc_id
            and membership.role.upper() == "MANAGER"
        ):
            return

    # Check if resource owner
    from app.models.resource import ResourceOwner

    user_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    if "RESOURCE_OWNER" in user_roles and owner_id is not None:
        owner = db.execute(
            select(ResourceOwner).where(ResourceOwner.id == owner_id)
        ).scalar_one_or_none()
        if owner and (
            owner.email == current_user.email
            or (owner.contact_phone and owner.contact_phone == current_user.phone_number)
        ):
            return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not have permission to manage this resource",
    )
