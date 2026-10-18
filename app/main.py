from contextlib import asynccontextmanager
from pathlib import Path

import psycopg
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import OperationalError

from app.api.deps import require_roles
from app.api.v1.attachments import router as attachments_router
from app.api.v1.auth import router as auth_router
from app.api.v1.auth_niti import router as auth_niti_router
from app.api.v1.availability import router as availability_router
from app.api.v1.bookings import router as bookings_router
from app.api.v1.breakdowns import router as breakdowns_router
from app.api.v1.chc_dashboard import router as chc_dashboard_router
from app.api.v1.chcs import router as chcs_router
from app.api.v1.machines import router as machines_router
from app.api.v1.niti_bookings import router as niti_bookings_router
from app.api.v1.offers import router as offers_router
from app.api.v1.operator_dashboard import router as operator_dashboard_router
from app.api.v1.operators import router as operators_router
from app.api.v1.recovery_plans import router as recovery_plans_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.scheduling import router as scheduling_router
from app.api.v1.service_requests import router as service_requests_router
from app.api.v1.voice_assistant import router as voice_assistant_router
from app.core.config import settings
from app.db.init_db import init_db
from app.models.identity import User


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan context manager for startup and shutdown hooks."""
    try:
        init_db()
    except Exception as e:
        print(f"Database startup initialization note: {e}")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="NITI — Voice-First Agricultural Machinery Scheduling & Management Platform",
    lifespan=lifespan,
)

# Enable CORS for frontend web and mobile clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(OperationalError)
async def db_operational_error_handler(request: Request, exc: OperationalError) -> JSONResponse:
    """Handle SQLAlchemy database connectivity failures gracefully."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database connection failed. "
                "Please ensure PostgreSQL is reachable and DATABASE_URL is configured in .env."
            )
        },
    )


@app.exception_handler(psycopg.OperationalError)
async def psycopg_operational_error_handler(
    request: Request, exc: psycopg.OperationalError
) -> JSONResponse:
    """Handle direct psycopg connection failures gracefully."""
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Database connection failed. "
                "Please ensure PostgreSQL is reachable and DATABASE_URL is configured in .env."
            )
        },
    )


# Mount API v1 routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(auth_niti_router, prefix=settings.API_V1_STR)
app.include_router(voice_assistant_router, prefix=settings.API_V1_STR)
app.include_router(offers_router, prefix=settings.API_V1_STR)
app.include_router(niti_bookings_router, prefix=settings.API_V1_STR)
app.include_router(chc_dashboard_router, prefix=settings.API_V1_STR)
app.include_router(operator_dashboard_router, prefix=settings.API_V1_STR)
app.include_router(chcs_router, prefix=settings.API_V1_STR)
app.include_router(machines_router, prefix=settings.API_V1_STR)
app.include_router(operators_router, prefix=settings.API_V1_STR)
app.include_router(attachments_router, prefix=settings.API_V1_STR)
app.include_router(service_requests_router, prefix=settings.API_V1_STR)
app.include_router(availability_router, prefix=settings.API_V1_STR)
app.include_router(bookings_router, prefix=settings.API_V1_STR)
app.include_router(scheduling_router, prefix=settings.API_V1_STR)
app.include_router(schedules_router, prefix=settings.API_V1_STR)
app.include_router(breakdowns_router, prefix=settings.API_V1_STR)
app.include_router(recovery_plans_router, prefix=settings.API_V1_STR)


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


# Mount built frontend single-page application if dist exists
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

