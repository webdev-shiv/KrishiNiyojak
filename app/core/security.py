"""Security utilities: Argon2id password hashing, JWT tokens, and refresh token hashing."""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, VerifyMismatchError

from app.core.config import settings

# Initialize Argon2id password hasher with RFC 9106 recommended parameters
_password_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _password_hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _password_hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, VerificationError):
        return False


def create_access_token(
    subject: str | int,
    roles: list[str] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Generate a signed JWT access token containing subject and assigned roles."""
    now = datetime.now(UTC)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    payload: dict[str, Any] = {
        "sub": str(subject),
        "roles": roles or [],
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }

    return jwt.encode(
        payload,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token."""
    return jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
        options={"require": ["exp", "iat", "sub"]},
    )


def generate_refresh_token() -> str:
    """Generate a cryptographically secure opaque refresh token string."""
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    """Compute a SHA-256 hash of a raw refresh token for secure database storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
