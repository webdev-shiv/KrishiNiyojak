"""Application configuration module."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core settings for Machine-Day Composer."""

    PROJECT_NAME: str = "Machine-Day Composer"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore",
    )


settings = Settings()
