"""API endpoints for Custom Hiring Centre (CHC) management."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_user, get_db, require_roles, verify_chc_manager_access
from app.models.chc import CHC, CHCMembership
from app.models.identity import User
from app.schemas.chc import CHCCreate, CHCPaginatedResponse, CHCResponse, CHCUpdate

router = APIRouter(prefix="/chcs", tags=["Custom Hiring Centres (CHCs)"])


@router.post(
    "",
    response_model=CHCResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new Custom Hiring Centre hub",
)
def create_chc(
    payload: CHCCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> CHC:
    """Create a new CHC hub.

    Only SUPERADMIN or CHC_MANAGER users can create CHCs.
    If created by a CHC_MANAGER, an active manager membership is automatically established.
    """
    existing_code = db.execute(
        select(CHC).where(CHC.code == payload.code.strip())
    ).scalar_one_or_none()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CHC with code '{payload.code}' already exists",
        )

    chc = CHC(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        operating_radius_km=payload.operating_radius_km,
        contact_phone=payload.contact_phone.strip() if payload.contact_phone else None,
        status="ACTIVE",
    )
    db.add(chc)
    db.flush()

    # If created by a manager, bind them to this CHC
    user_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    if "CHC_MANAGER" in user_roles and "SUPERADMIN" not in user_roles:
        membership = CHCMembership(
            chc_id=chc.id,
            user_id=current_user.id,
            role="MANAGER",
            is_active=True,
        )
        db.add(membership)

    db.commit()
    db.refresh(chc)
    return chc


@router.get(
    "",
    response_model=CHCPaginatedResponse,
    summary="List Custom Hiring Centres with optional status filter and pagination",
)
def list_chcs(
    skip: int = Query(0, ge=0, description="Offset for pagination"),
    limit: int = Query(20, ge=1, le=100, description="Page limit"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List CHCs available in the system."""
    query = select(CHC)
    count_query = select(func.count(CHC.id))

    if status_filter:
        query = query.where(CHC.status == status_filter.upper())
        count_query = count_query.where(CHC.status == status_filter.upper())

    total = db.execute(count_query).scalar_one() or 0
    items = db.execute(query.order_by(CHC.name.asc()).offset(skip).limit(limit)).scalars().all()

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get(
    "/{chc_id}",
    response_model=CHCResponse,
    summary="Get details of a specific CHC hub",
)
def get_chc(
    chc_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> CHC:
    """Retrieve CHC hub information by ID."""
    chc = db.execute(select(CHC).where(CHC.id == chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC with ID {chc_id} not found",
        )
    return chc


@router.put(
    "/{chc_id}",
    response_model=CHCResponse,
    summary="Update details of a CHC hub",
)
def update_chc(
    chc_id: int,
    payload: CHCUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> CHC:
    """Update CHC hub metadata.

    Enforces that only the designated CHC Manager for this hub or a SUPERADMIN can update it.
    """
    chc = db.execute(select(CHC).where(CHC.id == chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC with ID {chc_id} not found",
        )

    verify_chc_manager_access(current_user, chc_id)

    if payload.name is not None:
        chc.name = payload.name.strip()
    if payload.latitude is not None:
        chc.latitude = payload.latitude
    if payload.longitude is not None:
        chc.longitude = payload.longitude
    if payload.operating_radius_km is not None:
        chc.operating_radius_km = payload.operating_radius_km
    if payload.status is not None:
        chc.status = payload.status.upper()
    if payload.contact_phone is not None:
        chc.contact_phone = payload.contact_phone.strip() if payload.contact_phone else None

    db.commit()
    db.refresh(chc)
    return chc
