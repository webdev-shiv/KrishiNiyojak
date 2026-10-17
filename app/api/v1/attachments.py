"""API endpoints for agricultural implements and attachments management."""

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
from app.models.resource import Attachment, ResourceOwner
from app.schemas.resource import (
    AttachmentCreate,
    AttachmentPaginatedResponse,
    AttachmentResponse,
    AttachmentUpdate,
)

router = APIRouter(prefix="/attachments", tags=["Implement & Attachment Inventory"])


@router.post(
    "",
    response_model=AttachmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new implement or attachment in a CHC hub",
)
def create_attachment(
    payload: AttachmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Attachment:
    """Register an agricultural implement/attachment.

    Requires that the caller is the managing CHC Manager, a verified resource owner,
    or a SUPERADMIN.
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

    code = payload.code.strip().upper()
    existing_code = db.execute(
        select(Attachment).where(Attachment.code == code)
    ).scalar_one_or_none()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Attachment with code '{code}' already exists",
        )

    attachment = Attachment(
        chc_id=payload.chc_id,
        owner_id=payload.owner_id,
        name=payload.name.strip(),
        code=code,
        category=payload.category.strip().upper(),
        required_hp_min=payload.required_hp_min,
        hourly_rate=payload.hourly_rate,
        status=payload.status.strip().upper(),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


@router.get(
    "",
    response_model=AttachmentPaginatedResponse,
    summary="List attachments with filters and pagination",
)
def list_attachments(
    chc_id: int | None = Query(None, description="Filter by CHC hub ID"),
    category: str | None = Query(None, description="Filter by implement category"),
    status_filter: str | None = Query(None, alias="status", description="Filter by status"),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Pagination limit"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> dict[str, object]:
    """List attachments available in the system."""
    query = select(Attachment)
    count_query = select(func.count(Attachment.id))

    if chc_id is not None:
        query = query.where(Attachment.chc_id == chc_id)
        count_query = count_query.where(Attachment.chc_id == chc_id)
    if category:
        query = query.where(Attachment.category == category.strip().upper())
        count_query = count_query.where(Attachment.category == category.strip().upper())
    if status_filter:
        query = query.where(Attachment.status == status_filter.strip().upper())
        count_query = count_query.where(Attachment.status == status_filter.strip().upper())

    total = db.execute(count_query).scalar_one() or 0
    items = (
        db.execute(query.order_by(Attachment.name.asc()).offset(skip).limit(limit))
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
    "/{attachment_id}",
    response_model=AttachmentResponse,
    summary="Get details of a specific attachment",
)
def get_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> Attachment:
    """Retrieve attachment information by ID."""
    attachment = db.execute(
        select(Attachment).where(Attachment.id == attachment_id)
    ).scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment with ID {attachment_id} not found",
        )
    return attachment


@router.put(
    "/{attachment_id}",
    response_model=AttachmentResponse,
    summary="Update attachment details",
)
def update_attachment(
    attachment_id: int,
    payload: AttachmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Attachment:
    """Update attachment attributes.

    Restricted to authorized managers of the attachment's CHC, verified resource owners,
    or SUPERADMIN.
    """
    attachment = db.execute(
        select(Attachment).where(Attachment.id == attachment_id)
    ).scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment with ID {attachment_id} not found",
        )

    verify_resource_management_access(current_user, attachment.chc_id, attachment.owner_id, db)

    if payload.name is not None:
        attachment.name = payload.name.strip()
    if payload.category is not None:
        attachment.category = payload.category.strip().upper()
    if payload.required_hp_min is not None:
        attachment.required_hp_min = payload.required_hp_min
    if payload.hourly_rate is not None:
        attachment.hourly_rate = payload.hourly_rate
    if payload.status is not None:
        attachment.status = payload.status.strip().upper()

    db.commit()
    db.refresh(attachment)
    return attachment


@router.post(
    "/{attachment_id}/deactivate",
    response_model=AttachmentResponse,
    summary="Deactivate/retire an attachment",
)
@router.delete(
    "/{attachment_id}",
    response_model=AttachmentResponse,
    summary="Deactivate/retire an attachment",
)
def deactivate_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("SUPERADMIN", "CHC_MANAGER", "RESOURCE_OWNER")),
) -> Attachment:
    """Deactivate or retire an implement/attachment from service."""
    attachment = db.execute(
        select(Attachment).where(Attachment.id == attachment_id)
    ).scalar_one_or_none()
    if not attachment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Attachment with ID {attachment_id} not found",
        )

    verify_resource_management_access(current_user, attachment.chc_id, attachment.owner_id, db)

    attachment.status = "DAMAGED"
    db.commit()
    db.refresh(attachment)
    return attachment
