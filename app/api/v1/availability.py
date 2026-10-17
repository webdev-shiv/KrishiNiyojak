"""API endpoints for Machine and Operator Availability slots."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_db,
    require_roles,
    verify_chc_manager_access,
    verify_resource_management_access,
)
from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.identity import User
from app.models.resource import Machine, Operator
from app.schemas.availability import (
    MachineAvailabilityCreate,
    MachineAvailabilityPaginatedResponse,
    MachineAvailabilityResponse,
    MachineAvailabilityUpdate,
    OperatorAvailabilityCreate,
    OperatorAvailabilityPaginatedResponse,
    OperatorAvailabilityResponse,
    OperatorAvailabilityUpdate,
)

router = APIRouter(tags=["Availability Management"])

# ==============================================================================
# Machine Availability Endpoints
# ==============================================================================


def check_machine_slot_conflict(
    db: Session, machine_id: int, slot_date: date, slot_type: str, exclude_id: int | None = None
) -> None:
    """Validate that the requested machine slot does not conflict with existing slots."""
    query = select(MachineAvailability).where(
        MachineAvailability.machine_id == machine_id,
        MachineAvailability.slot_date == slot_date,
    )
    if exclude_id is not None:
        query = query.where(MachineAvailability.id != exclude_id)

    existing_slots = db.execute(query).scalars().all()
    if not existing_slots:
        return

    slot_type_upper = slot_type.upper()
    existing_types = {s.slot_type.upper() for s in existing_slots}

    # FULL_DAY conflicts with any existing slot on that date
    if slot_type_upper == "FULL_DAY" and existing_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicting slot on {slot_date}: Machine already has "
                f"'{', '.join(sorted(existing_types))}' scheduled."
            ),
        )

    # Half day slots conflict with FULL_DAY or duplicate of itself
    if "FULL_DAY" in existing_types or slot_type_upper in existing_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicting slot on {slot_date}: Machine already has "
                f"'{', '.join(sorted(existing_types))}' scheduled."
            ),
        )


@router.post(
    "/machine-availability",
    response_model=MachineAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule a machine availability slot",
)
def create_machine_availability(
    payload: MachineAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> MachineAvailability:
    """Set availability calendar slot for a machine.

    Enforces CHC manager or resource owner authorization and prevents slot conflicts.
    """
    machine = db.execute(
        select(Machine).where(Machine.id == payload.machine_id)
    ).scalar_one_or_none()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {payload.machine_id} not found",
        )

    verify_resource_management_access(current_user, machine.chc_id, machine.owner_id, db)

    slot_type_upper = payload.slot_type.strip().upper()
    if slot_type_upper not in ("FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="slot_type must be FULL_DAY, HALF_DAY_MORNING, or HALF_DAY_AFTERNOON",
        )

    check_machine_slot_conflict(db, payload.machine_id, payload.slot_date, slot_type_upper)

    slot = MachineAvailability(
        machine_id=payload.machine_id,
        slot_date=payload.slot_date,
        slot_type=slot_type_upper,
        status=payload.status.strip().upper(),
        note=payload.note.strip() if payload.note else None,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get(
    "/machine-availability",
    response_model=MachineAvailabilityPaginatedResponse,
    summary="List machine availability slots with date and status filters",
)
def list_machine_availability(
    machine_id: int | None = Query(None, description="Filter by machine ID"),
    start_date: date | None = Query(None, description="Start date filter"),
    end_date: date | None = Query(None, description="End date filter"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List machine availability slots."""
    query = select(MachineAvailability)
    count_query = select(func.count(MachineAvailability.id))

    if machine_id is not None:
        query = query.where(MachineAvailability.machine_id == machine_id)
        count_query = count_query.where(MachineAvailability.machine_id == machine_id)
    if start_date is not None:
        query = query.where(MachineAvailability.slot_date >= start_date)
        count_query = count_query.where(MachineAvailability.slot_date >= start_date)
    if end_date is not None:
        query = query.where(MachineAvailability.slot_date <= end_date)
        count_query = count_query.where(MachineAvailability.slot_date <= end_date)
    if status_filter:
        query = query.where(MachineAvailability.status == status_filter.strip().upper())
        count_query = count_query.where(MachineAvailability.status == status_filter.strip().upper())

    total = db.execute(count_query).scalar_one() or 0
    items = (
        db.execute(
            query.order_by(MachineAvailability.slot_date.asc(), MachineAvailability.id.asc())
            .offset(skip)
            .limit(limit)
        )
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
    "/machine-availability/{availability_id}",
    response_model=MachineAvailabilityResponse,
    summary="Get machine availability slot details",
)
def get_machine_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MachineAvailability:
    """Retrieve details of a machine availability slot."""
    slot = db.execute(
        select(MachineAvailability).where(MachineAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine availability slot {availability_id} not found",
        )
    return slot


@router.put(
    "/machine-availability/{availability_id}",
    response_model=MachineAvailabilityResponse,
    summary="Update machine availability slot status or notes",
)
def update_machine_availability(
    availability_id: int,
    payload: MachineAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> MachineAvailability:
    """Update machine availability slot."""
    slot = db.execute(
        select(MachineAvailability).where(MachineAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine availability slot {availability_id} not found",
        )

    machine = db.execute(select(Machine).where(Machine.id == slot.machine_id)).scalar_one_or_none()
    if machine:
        verify_resource_management_access(current_user, machine.chc_id, machine.owner_id, db)

    if payload.status is not None:
        slot.status = payload.status.strip().upper()
    if payload.note is not None:
        slot.note = payload.note.strip() if payload.note else None

    db.commit()
    db.refresh(slot)
    return slot


@router.delete(
    "/machine-availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a machine availability slot",
)
def delete_machine_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> None:
    """Delete a machine availability slot."""
    slot = db.execute(
        select(MachineAvailability).where(MachineAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine availability slot {availability_id} not found",
        )

    machine = db.execute(select(Machine).where(Machine.id == slot.machine_id)).scalar_one_or_none()
    if machine:
        verify_resource_management_access(current_user, machine.chc_id, machine.owner_id, db)

    db.delete(slot)
    db.commit()


# ==============================================================================
# Operator Availability Endpoints
# ==============================================================================


def check_operator_slot_conflict(
    db: Session, operator_id: int, slot_date: date, slot_type: str, exclude_id: int | None = None
) -> None:
    """Validate that the requested operator slot does not conflict with existing slots."""
    query = select(OperatorAvailability).where(
        OperatorAvailability.operator_id == operator_id,
        OperatorAvailability.slot_date == slot_date,
    )
    if exclude_id is not None:
        query = query.where(OperatorAvailability.id != exclude_id)

    existing_slots = db.execute(query).scalars().all()
    if not existing_slots:
        return

    slot_type_upper = slot_type.upper()
    existing_types = {s.slot_type.upper() for s in existing_slots}

    # FULL_DAY conflicts with any existing slot on that date
    if slot_type_upper == "FULL_DAY" and existing_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicting slot on {slot_date}: Operator already has "
                f"'{', '.join(sorted(existing_types))}' scheduled."
            ),
        )

    # Half day slots conflict with FULL_DAY or duplicate of itself
    if "FULL_DAY" in existing_types or slot_type_upper in existing_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Conflicting slot on {slot_date}: Operator already has "
                f"'{', '.join(sorted(existing_types))}' scheduled."
            ),
        )


@router.post(
    "/operator-availability",
    response_model=OperatorAvailabilityResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Schedule an operator availability or duty slot",
)
def create_operator_availability(
    payload: OperatorAvailabilityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> OperatorAvailability:
    """Set availability or duty slot for an operator."""
    operator = db.execute(
        select(Operator).where(Operator.id == payload.operator_id)
    ).scalar_one_or_none()
    if not operator:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator with ID {payload.operator_id} not found",
        )

    # Permission: self, CHC manager of operator's CHC, or superadmin
    is_self = operator.user_id == current_user.id
    if not is_self:
        verify_chc_manager_access(current_user, operator.chc_id)

    slot_type_upper = payload.slot_type.strip().upper()
    if slot_type_upper not in ("FULL_DAY", "HALF_DAY_MORNING", "HALF_DAY_AFTERNOON"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="slot_type must be FULL_DAY, HALF_DAY_MORNING, or HALF_DAY_AFTERNOON",
        )

    check_operator_slot_conflict(db, payload.operator_id, payload.slot_date, slot_type_upper)

    slot = OperatorAvailability(
        operator_id=payload.operator_id,
        slot_date=payload.slot_date,
        slot_type=slot_type_upper,
        status=payload.status.strip().upper(),
        note=payload.note.strip() if payload.note else None,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.get(
    "/operator-availability",
    response_model=OperatorAvailabilityPaginatedResponse,
    summary="List operator availability slots with filters",
)
def list_operator_availability(
    operator_id: int | None = Query(None, description="Filter by operator ID"),
    start_date: date | None = Query(None, description="Start date filter"),
    end_date: date | None = Query(None, description="End date filter"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List operator availability slots."""
    query = select(OperatorAvailability)
    count_query = select(func.count(OperatorAvailability.id))

    if operator_id is not None:
        query = query.where(OperatorAvailability.operator_id == operator_id)
        count_query = count_query.where(OperatorAvailability.operator_id == operator_id)
    if start_date is not None:
        query = query.where(OperatorAvailability.slot_date >= start_date)
        count_query = count_query.where(OperatorAvailability.slot_date >= start_date)
    if end_date is not None:
        query = query.where(OperatorAvailability.slot_date <= end_date)
        count_query = count_query.where(OperatorAvailability.slot_date <= end_date)
    if status_filter:
        query = query.where(OperatorAvailability.status == status_filter.strip().upper())
        count_query = count_query.where(
            OperatorAvailability.status == status_filter.strip().upper()
        )

    total = db.execute(count_query).scalar_one() or 0
    items = (
        db.execute(
            query.order_by(OperatorAvailability.slot_date.asc(), OperatorAvailability.id.asc())
            .offset(skip)
            .limit(limit)
        )
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
    "/operator-availability/{availability_id}",
    response_model=OperatorAvailabilityResponse,
    summary="Get operator availability slot details",
)
def get_operator_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> OperatorAvailability:
    """Retrieve details of an operator availability slot."""
    slot = db.execute(
        select(OperatorAvailability).where(OperatorAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator availability slot {availability_id} not found",
        )
    return slot


@router.put(
    "/operator-availability/{availability_id}",
    response_model=OperatorAvailabilityResponse,
    summary="Update operator availability slot status or notes",
)
def update_operator_availability(
    availability_id: int,
    payload: OperatorAvailabilityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> OperatorAvailability:
    """Update operator availability slot."""
    slot = db.execute(
        select(OperatorAvailability).where(OperatorAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator availability slot {availability_id} not found",
        )

    operator = db.execute(
        select(Operator).where(Operator.id == slot.operator_id)
    ).scalar_one_or_none()
    if operator:
        is_self = operator.user_id == current_user.id
        if not is_self:
            verify_chc_manager_access(current_user, operator.chc_id)

    if payload.status is not None:
        slot.status = payload.status.strip().upper()
    if payload.note is not None:
        slot.note = payload.note.strip() if payload.note else None

    db.commit()
    db.refresh(slot)
    return slot


@router.delete(
    "/operator-availability/{availability_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an operator availability slot",
)
def delete_operator_availability(
    availability_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "OPERATOR")),
) -> None:
    """Delete an operator availability slot."""
    slot = db.execute(
        select(OperatorAvailability).where(OperatorAvailability.id == availability_id)
    ).scalar_one_or_none()
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Operator availability slot {availability_id} not found",
        )

    operator = db.execute(
        select(Operator).where(Operator.id == slot.operator_id)
    ).scalar_one_or_none()
    if operator:
        is_self = operator.user_id == current_user.id
        if not is_self:
            verify_chc_manager_access(current_user, operator.chc_id)

    db.delete(slot)
    db.commit()
