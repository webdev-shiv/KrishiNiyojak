"""Pydantic schemas for authentication and user management."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserRegisterRequest(BaseModel):
    """Registration payload. Base role assigned; privileged roles cannot be self-granted."""

    email: EmailStr
    password: str = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str = Field(..., min_length=2, max_length=255)
    phone_number: str | None = Field(default=None, max_length=30)


class UserLoginRequest(BaseModel):
    """Login payload with user credentials."""

    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Authentication token response containing JWT access token and opaque refresh token."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int = Field(..., description="Access token expiration in seconds")


class RefreshTokenRequest(BaseModel):
    """Request payload to rotate an active refresh token."""

    refresh_token: str = Field(..., min_length=10)


class LogoutRequest(BaseModel):
    """Request payload to revoke a refresh token on logout."""

    refresh_token: str = Field(..., min_length=10)


class UserResponse(BaseModel):
    """Public user profile and role assignments."""

    id: int
    email: str
    full_name: str
    phone_number: str | None = None
    is_active: bool
    roles: list[str]
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    """Generic status response."""

    message: str
