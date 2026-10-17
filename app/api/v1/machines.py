"""API endpoints for agricultural machinery management."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_db,
    require_roles,
    verify_resource_management_access,
)
from app.models.chc import CHC
from app.models.identity import User
from app.models.resource import Machine, ResourceOwner
from app.schemas.recovery import (
    BreakdownCreateRequest,
    BreakdownImpactResponse,
)
from app.schemas.resource import (
    MachineCreate,
    MachinePaginatedResponse,
    MachineResponse,
    MachineUpdate,
)
from app.services.breakdown import report_breakdown_and_analyze

router = APIRouter(prefix="/machines", tags=["Machinery Fleet"])


@router.post(
    "",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new machine in a CHC hub",
)
def register_machine(
    payload: MachineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Machine:
    """Register agricultural machinery.

    Enforces that only the manager of the target CHC, a verified resource owner,
    or a SUPERADMIN can register machines.
    """
    chc = db.execute(select(CHC).where(CHC.id == payload.chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC with ID {payload.chc_id} not found",
        )

    verify_resource_management_access(current_user, payload.chc_id, payload.owner_id, db)

    if payload.owner_id is not None:
        owner = db.execute(
            select(ResourceOwner).where(ResourceOwner.id == payload.owner_id)
        ).scalar_one_or_none()
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource owner with ID {payload.owner_id} not found",
            )

    reg_num = payload.registration_number.strip().upper()
    existing_reg = db.execute(
        select(Machine).where(Machine.registration_number == reg_num)
    ).scalar_one_or_none()
    if existing_reg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Machine with registration number '{reg_num}' already exists",
        )

    machine = Machine(
        chc_id=payload.chc_id,
        owner_id=payload.owner_id,
        registration_number=reg_num,
        make=payload.make.strip(),
        model=payload.model.strip(),
        category=payload.category.strip().upper(),
        horsepower=payload.horsepower,
        hourly_rate=payload.hourly_rate,
        status=payload.status.strip().upper(),
        current_lat=payload.current_lat,
        current_lng=payload.current_lng,
    )
    db.add(machine)
    db.commit()
    db.refresh(machine)
    return machine


@router.get(
    "",
    response_model=MachinePaginatedResponse,
    summary="List machines with filters (CHC, category, status) and pagination",
)
def list_machines(
    chc_id: int | None = Query(None, description="Filter by CHC hub ID"),
    category: str | None = Query(None, description="Filter by category (e.g. TRACTOR)"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List machines in the fleet with optional filters."""
    query = select(Machine)
    count_query = select(func.count(Machine.id))

    if chc_id is not None:
        query = query.where(Machine.chc_id == chc_id)
        count_query = count_query.where(Machine.chc_id == chc_id)
    if category:
        query = query.where(Machine.category == category.strip().upper())
        count_query = count_query.where(Machine.category == category.strip().upper())
    if status_filter:
        query = query.where(Machine.status == status_filter.strip().upper())
        count_query = count_query.where(Machine.status == status_filter.strip().upper())

    total = db.execute(count_query).scalar_one() or 0
    items = (
        db.execute(query.order_by(Machine.registration_number.asc()).offset(skip).limit(limit))
        .scalars()
        .all()
    )

    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Get details of a specific machine",
)
def get_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Machine:
    """Retrieve machine asset details by ID."""
    machine = db.execute(select(Machine).where(Machine.id == machine_id)).scalar_one_or_none()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {machine_id} not found",
        )
    return machine


@router.put(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Update machine details",
)
def update_machine(
    machine_id: int,
    payload: MachineUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Machine:
    """Update machine attributes.

    Restricted to authorized managers of the machine's CHC, verified resource owners,
    or SUPERADMIN.
    """
    machine = db.execute(select(Machine).where(Machine.id == machine_id)).scalar_one_or_none()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {machine_id} not found",
        )

    verify_resource_management_access(current_user, machine.chc_id, machine.owner_id, db)

    if payload.owner_id is not None:
        owner = db.execute(
            select(ResourceOwner).where(ResourceOwner.id == payload.owner_id)
        ).scalar_one_or_none()
        if not owner:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Resource owner with ID {payload.owner_id} not found",
            )
        machine.owner_id = payload.owner_id

    if payload.make is not None:
        machine.make = payload.make.strip()
    if payload.model is not None:
        machine.model = payload.model.strip()
    if payload.category is not None:
        machine.category = payload.category.strip().upper()
    if payload.horsepower is not None:
        machine.horsepower = payload.horsepower
    if payload.hourly_rate is not None:
        machine.hourly_rate = payload.hourly_rate
    if payload.status is not None:
        machine.status = payload.status.strip().upper()
    if payload.current_lat is not None:
        machine.current_lat = payload.current_lat
    if payload.current_lng is not None:
        machine.current_lng = payload.current_lng

    db.commit()
    db.refresh(machine)
    return machine


@router.post(
    "/{machine_id}/deactivate",
    response_model=MachineResponse,
    summary="Deactivate/retire a machine asset",
)
@router.delete(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Deactivate/retire a machine asset",
)
def deactivate_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Machine:
    """Deactivate or retire a machine from the active operational fleet."""
    machine = db.execute(select(Machine).where(Machine.id == machine_id)).scalar_one_or_none()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {machine_id} not found",
        )

    verify_resource_management_access(current_user, machine.chc_id, machine.owner_id, db)

    machine.status = "RETIRED"
    db.commit()
    db.refresh(machine)
    return machine


@router.post(
    "/{machine_id}/breakdown",
    response_model=BreakdownImpactResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Report a breakdown incident specifically for this machine asset",
)
def report_machine_specific_breakdown(
    machine_id: int,
    payload: BreakdownCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER")),
) -> BreakdownImpactResponse:
    """Report an operational failure for this machine asset and compute impact analysis."""
    payload.machine_id = machine_id
    return report_breakdown_and_analyze(
        db=db,
        payload=payload,
        current_user=current_user,
    )
