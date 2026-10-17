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
