"""FastAPI main application entrypoint."""

from fastapi import FastAPI

from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Agricultural machinery scheduling and breakdown-recovery platform for CHCs",
)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Health check endpoint to verify backend operational readiness."""
    return {"status": "ok"}
