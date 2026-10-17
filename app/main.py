"""FastAPI main application entrypoint."""

from fastapi import Depends, FastAPI

from app.api.deps import require_roles
from app.api.v1.auth import router as auth_router
from app.core.config import settings
from app.models.identity import User

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Agricultural machinery scheduling and breakdown-recovery platform for CHCs",
)

# Mount authentication router
app.include_router(auth_router, prefix=settings.API_V1_STR)


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    """Health check endpoint to verify backend operational readiness."""
    return {"status": "ok"}


@app.get(
    f"{settings.API_V1_STR}/protected/chc-manager-only",
    tags=["Authorization Demonstration"],
)
def protected_chc_manager_endpoint(
    current_user: User = Depends(require_roles("CHC_MANAGER")),
) -> dict[str, str]:
    """Demonstration endpoint accessible exclusively to CHC_MANAGER or SUPERADMIN."""
    return {
        "status": "authorized",
        "message": f"Welcome, Manager {current_user.full_name}",
    }


@app.get(
    f"{settings.API_V1_STR}/protected/operator-only",
    tags=["Authorization Demonstration"],
)
def protected_operator_endpoint(
    current_user: User = Depends(require_roles("OPERATOR")),
) -> dict[str, str]:
    """Demonstration endpoint accessible exclusively to OPERATOR or SUPERADMIN."""
    return {
        "status": "authorized",
        "message": f"Welcome, Operator {current_user.full_name}",
    }
