"""API endpoints for Farmer Service Requests."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_active_user,
    get_db,
    require_roles,
)
from app.models.booking import ServiceRequest
from app.models.chc import CHC
from app.models.identity import User
from app.models.resource import Machine
from app.schemas.service_request import (
    MachineOptionsResponse,
    MachineSelectionRequest,
    ServiceRequestCreate,
    ServiceRequestPaginatedResponse,
    ServiceRequestResponse,
    ServiceRequestUpdate,
)
from app.services.machine_options import generate_machine_options_for_request

router = APIRouter(prefix="/service-requests", tags=["Farmer Service Requests"])


@router.post(
    "",
    response_model=ServiceRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a new agricultural service request as a farmer",
)
def create_service_request(
    payload: ServiceRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("FARMER", "SUPERADMIN")),
) -> ServiceRequest:
    """Submit a service request for farm machinery allocation."""
    chc = db.execute(select(CHC).where(CHC.id == payload.chc_id)).scalar_one_or_none()
    if not chc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CHC hub with ID {payload.chc_id} not found",
        )

    service_request = ServiceRequest(
        chc_id=payload.chc_id,
        farmer_id=current_user.id,
        field_latitude=payload.field_latitude,
        field_longitude=payload.field_longitude,
        acreage=payload.acreage,
        operation_type=payload.operation_type.strip().upper(),
        crop_type=payload.crop_type.strip().upper() if payload.crop_type else None,
        requested_start_date=payload.requested_start_date,
        requested_end_date=payload.requested_end_date,
        estimated_cost=payload.estimated_cost,
        status="SUBMITTED",
    )
    db.add(service_request)
    db.commit()
    db.refresh(service_request)
    return service_request


@router.get(
    "",
    response_model=ServiceRequestPaginatedResponse,
    summary="List service requests with role-based ownership scoping",
)
def list_service_requests(
    chc_id: int | None = Query(None, description="Filter by CHC hub ID"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List service requests.

    Enforces that farmers only see their own requests.
    CHC Managers see requests submitted to their managed CHC hubs.
    SUPERADMINs can inspect all requests.
    """
    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles

    managed_chc_ids = [
        m.chc_id
        for m in current_user.chc_memberships
        if m.is_active and m.role.upper() == "MANAGER"
    ]

    query = select(ServiceRequest)
    count_query = select(func.count(ServiceRequest.id))

    if not is_superadmin:
        if managed_chc_ids:
            # CHC Manager: can view requests for their managed CHCs or their own as farmer
            query = query.where(
                (ServiceRequest.chc_id.in_(managed_chc_ids))
                | (ServiceRequest.farmer_id == current_user.id)
            )
            count_query = count_query.where(
                (ServiceRequest.chc_id.in_(managed_chc_ids))
                | (ServiceRequest.farmer_id == current_user.id)
            )
        else:
            # Regular farmer / user: only their own requests
            query = query.where(ServiceRequest.farmer_id == current_user.id)
            count_query = count_query.where(ServiceRequest.farmer_id == current_user.id)

    if chc_id is not None:
        query = query.where(ServiceRequest.chc_id == chc_id)
        count_query = count_query.where(ServiceRequest.chc_id == chc_id)
    if status_filter:
        query = query.where(ServiceRequest.status == status_filter.strip().upper())
        count_query = count_query.where(ServiceRequest.status == status_filter.strip().upper())

    total = db.execute(count_query).scalar_one() or 0
    items = (
        db.execute(query.order_by(ServiceRequest.created_at.desc()).offset(skip).limit(limit))
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
    "/{request_id}",
    response_model=ServiceRequestResponse,
    summary="Get details of a specific service request",
)
def get_service_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ServiceRequest:
    """Retrieve service request details.

    Access permitted only to the farmer who submitted it, a manager of the target CHC,
    or a SUPERADMIN.
    """
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {request_id} not found",
        )

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_owner = req.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == req.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    if not (is_superadmin or is_owner or is_chc_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view this service request",
        )

    return req


@router.put(
    "/{request_id}",
    response_model=ServiceRequestResponse,
    summary="Update or cancel a service request",
)
def update_service_request(
    request_id: int,
    payload: ServiceRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ServiceRequest:
    """Update service request fields or status.

    - Farmers can update fields or cancel their own requests while in DRAFT/SUBMITTED status.
    - CHC Managers can approve or reject requests for their CHC.
    - Cross-farmer modification is forbidden.
    """
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {request_id} not found",
        )

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_owner = req.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == req.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    if not (is_superadmin or is_owner or is_chc_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You cannot modify another farmer's service request",
        )

    # Farmers cannot self-approve requests
    if is_owner and not (is_superadmin or is_chc_manager):
        if payload.status is not None:
            new_status = payload.status.strip().upper()
            if new_status not in ("CANCELLED", "DRAFT", "SUBMITTED"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Farmers can only cancel or submit their own requests",
                )
            req.status = new_status
    elif (is_chc_manager or is_superadmin) and payload.status is not None:
        req.status = payload.status.strip().upper()

    if payload.field_latitude is not None:
        req.field_latitude = payload.field_latitude
    if payload.field_longitude is not None:
        req.field_longitude = payload.field_longitude
    if payload.acreage is not None:
        req.acreage = payload.acreage
    if payload.operation_type is not None:
        req.operation_type = payload.operation_type.strip().upper()
    if payload.crop_type is not None:
        req.crop_type = payload.crop_type.strip().upper()
    if payload.requested_start_date is not None:
        req.requested_start_date = payload.requested_start_date
    if payload.requested_end_date is not None:
        req.requested_end_date = payload.requested_end_date

    # Validate final date consistency
    if req.requested_end_date < req.requested_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="requested_end_date cannot be earlier than requested_start_date",
        )

    db.commit()
    db.refresh(req)
    return req


@router.get(
    "/{request_id}/machine-options",
    response_model=MachineOptionsResponse,
    summary="Get feasible machine options for farmer comparison and selection",
)
def get_service_request_machine_options(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MachineOptionsResponse:
    """Retrieve all available and compatible machine options for a service request.

    Includes working speed, coverage width, effective field capacity (ha/h),
    estimated total duration (with setup, turning, and travel time), rental rate,
    estimated total cost, compatible attachments, and available calendar slots.

    Enforces authorization:
    - Farmers: can view options only for their own service requests.
    - CHC Managers: can view options for requests in their managed CHCs.
    - SUPERADMINs: full access.
    """
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {request_id} not found",
        )

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_owner = req.farmer_id == current_user.id
    is_chc_manager = any(
        m.chc_id == req.chc_id and m.role.upper() == "MANAGER" and m.is_active
        for m in current_user.chc_memberships
    )

    if not (is_superadmin or is_owner or is_chc_manager):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view machine options for this request",
        )

    return generate_machine_options_for_request(db, request_id)


@router.post(
    "/{request_id}/select-machine",
    response_model=ServiceRequestResponse,
    summary="Farmer selects preferred machine option",
)
def select_machine_option(
    request_id: int,
    payload: MachineSelectionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> ServiceRequest:
    """Explicitly record the farmer's preferred machine selection.

    Authority rules:
    - Farmer makes the final machine choice.
    - Neither the system nor manager may silently substitute another machine.
    - Selection validates machine belongs to the CHC and is in an operational state.
    """
    req = db.execute(
        select(ServiceRequest).where(ServiceRequest.id == request_id)
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service request with ID {request_id} not found",
        )

    user_system_roles = {ur.role.name.upper() for ur in current_user.user_roles if ur.role}
    is_superadmin = "SUPERADMIN" in user_system_roles
    is_owner = req.farmer_id == current_user.id

    if not (is_superadmin or is_owner):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Only the requesting farmer can select their preferred machine",
        )

    # Validate target machine
    machine = db.execute(
        select(Machine).where(Machine.id == payload.machine_id)
    ).scalar_one_or_none()
    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine with ID {payload.machine_id} not found",
        )
    if machine.chc_id != req.chc_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected machine {payload.machine_id} does not belong to CHC {req.chc_id}",
        )
    if machine.status in ("RETIRED", "BROKEN_DOWN"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Selected machine is currently {machine.status} and cannot be scheduled",
        )

    # Validate selected date within window if provided
    if payload.selected_date is not None:
        if payload.selected_date < req.requested_start_date or payload.selected_date > req.requested_end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Selected date {payload.selected_date} falls outside the requested window ({req.requested_start_date} to {req.requested_end_date})",
            )
        req.selected_date = payload.selected_date

    req.selected_machine_id = machine.id
    if payload.selected_slot:
        req.selected_slot = payload.selected_slot.strip().upper()

    db.commit()
    db.refresh(req)
    return req

