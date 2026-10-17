"""Notification Service Abstraction (T14).

Handles persisting and queuing notifications in the database for farmers and operators.
Note: Live external gateway integrations (Twilio SMS, Firebase Cloud Messaging, SendGrid Email)
are not yet connected in the current milestone; notifications are persisted as PENDING records.
"""

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.models.supporting import Notification


def send_dispatch_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    channel: str = "PUSH",
) -> Notification:
    """Queue a notification in the database for an actor (farmer, operator, manager).

    Persists an immutable Notification record with status PENDING.
    External dispatch adapters will poll or subscribe to this table in future milestones.
    """
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        channel=channel.upper(),
        status="PENDING",
        sent_at=datetime.now(UTC),
    )
    db.add(notification)
    return notification
