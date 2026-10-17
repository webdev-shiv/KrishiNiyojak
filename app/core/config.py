"""Application configuration module."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings for Machine-Day Composer."""

    PROJECT_NAME: str = "Machine-Day Composer"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Database connection string
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres_password@localhost:5432/machine_day_composer"
    )

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
