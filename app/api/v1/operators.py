"""API endpoints for CHC operator and driver fleet management."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_db,
    require_roles,
    verify_chc_manager_access,
)
from app.models.chc import CHC, CHCMembership
from app.models.identity import User
from app.models.resource import Operator
from app.schemas.resource import (
    OperatorCreate,
    OperatorPaginatedResponse,
    OperatorResponse,
    OperatorUpdate,
)

router = APIRouter(prefix="/operators", tags=["Operator Fleet"])


@router.post(
    "",
    response_model=OperatorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a certified operator for a CHC hub",
)
def register_operator(
    payload: OperatorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> Operator:
    """Register a certified driver/operator.

    Enforces that only a manager of the target CHC or a SUPERADMIN can onboard operators.
    """
    chc = db.execute(select(CHC).where(CHC.id == payload.chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC with ID {payload.chc_id} not found",
        )

    verify_chc_manager_access(current_user, payload.chc_id)

    target_user = db.execute(select(User).where(User.id == payload.user_id)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {payload.user_id} not found",
        )

    existing_op = db.execute(
        select(Operator).where(Operator.user_id == payload.user_id)
    ).scalar_one_or_none()
    if existing_op:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {payload.user_id} is already registered as an operator",
        )

    operator = Operator(
        user_id=payload.user_id,
        chc_id=payload.chc_id,
        license_number=payload.license_number.strip().upper(),
        experience_years=payload.experience_years,
        hourly_rate=payload.hourly_rate,
        status=payload.status.strip().upper(),
    )
    db.add(operator)

    # Automatically add or update CHCMembership with role OPERATOR
    existing_membership = db.execute(
        select(CHCMembership).where(
            CHCMembership.chc_id == payload.chc_id,
            CHCMembership.user_id == payload.user_id,
        )
    ).scalar_one_or_none()
    if not existing_membership:
        membership = CHCMembership(
            chc_id=payload.chc_id,
            user_id=payload.user_id,
            role="OPERATOR",
            is_active=True,
        )
        db.add(membership)

    db.commit()
    db.refresh(operator)
    return operator


@router.get(
    "",
    response_model=OperatorPaginatedResponse,
    summary="List operators with optional CHC and status filters",
)
def list_operators(
    chc_id: int | None = Query(None, description="Filter by CHC hub ID"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> dict[str, object]:
    """List operators registered in the CHC fleet."""
    query = select(Operator)
    count_query = select(func.count(Operator.id))

    if chc_id is not None:
        query = query.where(Operator.chc_id == chc_id)
        count_query = count_query.where(Operator.chc_id == chc_id)
    if status_filter:
        query = query.where(Operator.status == status_filter.strip().upper())
        count_query = count_query.where(Operator.status == status_filter.strip().upper())

    total = db.execute(count_query).scalar_one() or 0
    items = db.execute(query.order_by(Operator.id.asc()).offset(skip).limit(limit)).scalars().all()

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get(
    "/{operator_id}",
    response_model=OperatorResponse,
    summary="Get details of a specific operator",
)
def get_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> Operator:
    """Retrieve operator details by ID."""
    operator = db.execute(select(Operator).where(Operator.id == operator_id)).scalar_one_or_none()
    if not operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator with ID {operator_id} not found",
        )
    return operator


@router.put(
    "/{operator_id}",
    response_model=OperatorResponse,
    summary="Update operator credentials or status",
)
def update_operator(
    operator_id: int,
    payload: OperatorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> Operator:
    """Update operator record.

    Only the managing CHC Manager, the operator themselves, or a SUPERADMIN can edit this record.
    """
    operator = db.execute(select(Operator).where(Operator.id == operator_id)).scalar_one_or_none()
    if not operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator with ID {operator_id} not found",
        )

    # Check permission: self, CHC manager, or SUPERADMIN
    is_self = operator.user_id == current_user.id
    if not is_self:
        verify_chc_manager_access(current_user, operator.chc_id)

    if payload.license_number is not None:
        operator.license_number = payload.license_number.strip().upper()
    if payload.experience_years is not None:
        operator.experience_years = payload.experience_years
    if payload.hourly_rate is not None:
        operator.hourly_rate = payload.hourly_rate
    if payload.status is not None:
        operator.status = payload.status.strip().upper()

    db.commit()
    db.refresh(operator)
    return operator


@router.post(
    "/{operator_id}/deactivate",
    response_model=OperatorResponse,
    summary="Deactivate an operator",
)
@router.delete(
    "/{operator_id}",
    response_model=OperatorResponse,
    summary="Deactivate an operator",
)
def deactivate_operator(
    operator_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> Operator:
    """Deactivate an operator from active CHC dispatch."""
    operator = db.execute(select(Operator).where(Operator.id == operator_id)).scalar_one_or_none()
    if not operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator with ID {operator_id} not found",
        )

    verify_chc_manager_access(current_user, operator.chc_id)

    operator.status = "INACTIVE"
    db.commit()
    db.refresh(operator)
    return operator
