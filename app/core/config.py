"""Application configuration module."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings for NITI Agricultural Machinery Platform."""

    PROJECT_NAME: str = "NITI - Agricultural Machinery Scheduling & Management Platform"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database connection string (defaults to placeholder for Supabase PostgreSQL)
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@"
        "aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require"
    )

    # Security & JWT configuration
    JWT_SECRET_KEY: str = "insecure-development-secret-key-please-override-in-env-at-least-32-bytes"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS configuration for frontend clients
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8080",
    ]

    # Scheduling & Feasibility estimation settings
    ROAD_WINDING_FACTOR: float = 1.3
    TRANSIT_SPEED_KMH: float = 25.0
    ESTIMATED_HOURS_PER_ACRE: float = 0.8

    # Map & Real Routing Integration (Leaflet + OpenStreetMap + OSRM)
    ROUTING_SERVICE_URL: str = "https://router.project-osrm.org/route/v1/driving"
    ROUTING_API_KEY: str = ""
    ENABLE_REAL_ROUTING: bool = True
    ROUTING_TIMEOUT_SECONDS: float = 3.0

    # Breakdown & Customer Priority scoring settings (T12)
    PRIORITY_WEIGHT_URGENCY: float = 0.40
    PRIORITY_WEIGHT_CRITICALITY: float = 0.25
    PRIORITY_WEIGHT_DELAY_RISK: float = 0.20
    PRIORITY_WEIGHT_ACREAGE: float = 0.15
    DEFAULT_ACREAGE_BASELINE: float = 5.0
    DEFAULT_REPAIR_HOURS_LOW: float = 8.0
    DEFAULT_REPAIR_HOURS_MEDIUM: float = 24.0
    DEFAULT_REPAIR_HOURS_CRITICAL: float = 72.0

    # Recovery Alternatives & Ranking settings (T13)
    RECOVERY_WEIGHT_DELAY: float = 0.35
    RECOVERY_WEIGHT_TRANSIT: float = 0.25
    RECOVERY_WEIGHT_COST: float = 0.25
    RECOVERY_WEIGHT_AVAILABILITY: float = 0.15
    MAX_RECOVERY_SEARCH_DAYS: int = 7

    # OTP and SMS configuration
    OTP_EXPIRY_MINUTES: int = 10
    SMS_PROVIDER: str = "console"  # 'console', 'fast2sms', 'twilio', 'msg91'
    SMS_API_KEY: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Ensure DATABASE_URL is valid, falling back to SQLite if PostgreSQL placeholder is not configured."""
        if isinstance(v, str):
            val = v.strip().strip("'\"")
            # If default unconfigured template placeholder is present, fall back to SQLite
            if "[YOUR-PROJECT-REF]" in val or "[YOUR-PASSWORD]" in val or "[REGION]" in val:
                return "sqlite:///./niti.db"
            if val.startswith("postgres://"):
                return "postgresql+psycopg://" + val[len("postgres://") :]
            if val.startswith("postgresql://"):
                return "postgresql+psycopg://" + val[len("postgresql://") :]
            return val
        return "sqlite:///./niti.db"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
