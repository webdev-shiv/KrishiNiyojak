"""Application configuration module."""

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings for Machine-Day Composer."""

    PROJECT_NAME: str = "Machine-Day Composer"
    VERSION: str = "0.1.0"
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

    # Scheduling & Feasibility estimation settings
    ROAD_WINDING_FACTOR: float = 1.3
    TRANSIT_SPEED_KMH: float = 25.0
    ESTIMATED_HOURS_PER_ACRE: float = 0.8

    # Breakdown & Customer Priority scoring settings (T12)
    PRIORITY_WEIGHT_URGENCY: float = 0.40
    PRIORITY_WEIGHT_CRITICALITY: float = 0.25
    PRIORITY_WEIGHT_DELAY_RISK: float = 0.20
    PRIORITY_WEIGHT_ACREAGE: float = 0.15
    DEFAULT_ACREAGE_BASELINE: float = 5.0
    DEFAULT_REPAIR_HOURS_LOW: float = 8.0
    DEFAULT_REPAIR_HOURS_MEDIUM: float = 24.0
    DEFAULT_REPAIR_HOURS_CRITICAL: float = 72.0

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        """Ensure DATABASE_URL uses the postgresql+psycopg driver required by SQLAlchemy 2.x."""
        if isinstance(v, str):
            val = v.strip().strip("'\"")
            if val.startswith("postgres://"):
                return "postgresql+psycopg://" + val[len("postgres://") :]
            if val.startswith("postgresql://"):
                return "postgresql+psycopg://" + val[len("postgresql://") :]
            return val
        return v

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
