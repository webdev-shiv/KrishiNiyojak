"""Tests for model imports, metadata registration, relationships, and migration structure."""

import importlib
from pathlib import Path

from sqlalchemy.orm import RelationshipDirection

import app.models as models
from app.db.base import Base

EXPECTED_TABLES = {
    "roles",
    "users",
    "user_roles",
    "chcs",
    "chc_memberships",
    "resource_owners",
    "machines",
    "operators",
    "attachments",
    "service_requests",
    "bookings",
    "booking_attachments",
    "machine_availability",
    "operator_availability",
    "machine_breakdowns",
    "recovery_plans",
    "recovery_plan_items",
    "booking_priority",
    "notifications",
    "refresh_tokens",
    "audit_logs",
}


def test_model_imports() -> None:
    """Verify all domain models are importable from app.models package."""
    assert models.User is not None
    assert models.Role is not None
    assert models.UserRole is not None
    assert models.CHC is not None
    assert models.CHCMembership is not None
    assert models.ResourceOwner is not None
    assert models.Machine is not None
    assert models.Operator is not None
    assert models.Attachment is not None
    assert models.ServiceRequest is not None
    assert models.Booking is not None
    assert models.BookingAttachment is not None
    assert models.MachineAvailability is not None
    assert models.OperatorAvailability is not None
    assert models.MachineBreakdown is not None
    assert models.RecoveryPlan is not None
    assert models.RecoveryPlanItem is not None
    assert models.BookingPriority is not None
    assert models.Notification is not None
    assert models.RefreshToken is not None
    assert models.AuditLog is not None


def test_metadata_table_registration() -> None:
    """Verify that all 21 expected domain tables are registered in Base.metadata."""
    registered_tables = set(Base.metadata.tables.keys())
    assert EXPECTED_TABLES.issubset(registered_tables), (
        f"Missing tables: {EXPECTED_TABLES - registered_tables}"
    )
    assert len(registered_tables) == 21


def test_model_primary_keys_and_columns() -> None:
    """Verify primary keys and key constraints across core models."""
    users_table = Base.metadata.tables["users"]
    assert "id" in users_table.c
    assert users_table.c["id"].primary_key
    assert users_table.c["email"].unique

    chcs_table = Base.metadata.tables["chcs"]
    assert "code" in chcs_table.c
    assert chcs_table.c["code"].unique

    bookings_table = Base.metadata.tables["bookings"]
    assert "booking_code" in bookings_table.c
    assert bookings_table.c["booking_code"].unique
    assert "total_cost" in bookings_table.c


def test_model_relationships() -> None:
    """Verify relationships and back-populates configurations on mapper relationships."""
    user_mapper = models.User.__mapper__
    assert "user_roles" in user_mapper.relationships
    assert "chc_memberships" in user_mapper.relationships
    assert "service_requests" in user_mapper.relationships
    assert "refresh_tokens" in user_mapper.relationships

    chc_mapper = models.CHC.__mapper__
    assert "machines" in chc_mapper.relationships
    assert "operators" in chc_mapper.relationships
    assert "attachments" in chc_mapper.relationships
    assert "bookings" in chc_mapper.relationships

    booking_mapper = models.Booking.__mapper__
    assert "service_request" in booking_mapper.relationships
    assert "machine" in booking_mapper.relationships
    assert "operator" in booking_mapper.relationships
    assert "booking_attachments" in booking_mapper.relationships
    assert "priority" in booking_mapper.relationships
    assert (
        booking_mapper.relationships["priority"].direction == RelationshipDirection.ONETOMANY
        or not booking_mapper.relationships["priority"].uselist
    )

    breakdown_mapper = models.MachineBreakdown.__mapper__
    assert "recovery_plans" in breakdown_mapper.relationships
    assert "machine" in breakdown_mapper.relationships


def test_migration_structure() -> None:
    """Verify Alembic migration file structure, revisions chain, and function declarations."""
    versions_dir = Path("alembic/versions")
    assert versions_dir.exists()

    migration_files = list(versions_dir.glob("*_create_domain_models.py"))
    assert len(migration_files) == 1
    migration_file = migration_files[0]

    # Import the module dynamically to inspect symbols
    spec = importlib.util.spec_from_file_location("create_domain_models_migration", migration_file)
    assert spec is not None and spec.loader is not None
    migration_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration_mod)

    assert hasattr(migration_mod, "revision")
    assert hasattr(migration_mod, "down_revision")
    assert migration_mod.down_revision == "814e8227b8d4"
    assert callable(getattr(migration_mod, "upgrade", None))
    assert callable(getattr(migration_mod, "downgrade", None))
