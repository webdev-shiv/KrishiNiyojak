"""Domain models registration package."""

from app.models.availability import MachineAvailability, OperatorAvailability
from app.models.booking import Booking, BookingAttachment, ServiceRequest
from app.models.chc import CHC, CHCMembership
from app.models.identity import Role, User, UserRole
from app.models.recovery import (
    BookingPriority,
    MachineBreakdown,
    RecoveryPlan,
    RecoveryPlanItem,
)
from app.models.resource import Attachment, Machine, Operator, ResourceOwner
from app.models.supporting import AuditLog, Notification, RefreshToken

__all__ = [
    # Identity
    "Role",
    "User",
    "UserRole",
    # CHCs
    "CHC",
    "CHCMembership",
    # Resources
    "Attachment",
    "Machine",
    "Operator",
    "ResourceOwner",
    # Bookings
    "Booking",
    "BookingAttachment",
    "ServiceRequest",
    # Availability
    "MachineAvailability",
    "OperatorAvailability",
    # Recovery
    "BookingPriority",
    "MachineBreakdown",
    "RecoveryPlan",
    "RecoveryPlanItem",
    # Supporting
    "AuditLog",
    "Notification",
    "RefreshToken",
]
