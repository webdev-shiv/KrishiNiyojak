"""create_domain_models.

Revision ID: 6df59861962b
Revises: 814e8227b8d4
Create Date: 2026-10-17 18:52:12.054746
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6df59861962b"
down_revision: str | Sequence[str] | None = "814e8227b8d4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create all domain tables, constraints, and indexes."""
    # 1. roles
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_roles_name"), "roles", ["name"], unique=True)

    # 2. users
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("phone_number", sa.String(length=30), nullable=True),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_phone_number"), "users", ["phone_number"], unique=True)

    # 3. user_roles
    op.create_table(
        "user_roles",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "role_id", name="uq_user_roles_user_role"),
    )
    op.create_index(op.f("ix_user_roles_role_id"), "user_roles", ["role_id"], unique=False)
    op.create_index(op.f("ix_user_roles_user_id"), "user_roles", ["user_id"], unique=False)

    # 4. chcs
    op.create_table(
        "chcs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("operating_radius_km", sa.Float(), nullable=False, server_default="25.0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="ACTIVE"),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chcs_code"), "chcs", ["code"], unique=True)
    op.create_index(op.f("ix_chcs_status"), "chcs", ["status"], unique=False)

    # 5. chc_memberships
    op.create_table(
        "chc_memberships",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chc_id", "user_id", name="uq_chc_memberships_chc_user"),
    )
    op.create_index(op.f("ix_chc_memberships_chc_id"), "chc_memberships", ["chc_id"], unique=False)
    op.create_index(
        op.f("ix_chc_memberships_user_id"), "chc_memberships", ["user_id"], unique=False
    )

    # 6. resource_owners
    op.create_table(
        "resource_owners",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_phone", sa.String(length=30), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("owner_type", sa.String(length=50), nullable=False, server_default="CHC"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # 7. machines
    op.create_table(
        "machines",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("registration_number", sa.String(length=100), nullable=False),
        sa.Column("make", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("horsepower", sa.Float(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column("current_lat", sa.Float(), nullable=True),
        sa.Column("current_lng", sa.Float(), nullable=True),
        sa.Column(
            "hourly_rate", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["resource_owners.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_machines_category"), "machines", ["category"], unique=False)
    op.create_index(op.f("ix_machines_chc_id"), "machines", ["chc_id"], unique=False)
    op.create_index(op.f("ix_machines_owner_id"), "machines", ["owner_id"], unique=False)
    op.create_index(
        op.f("ix_machines_registration_number"), "machines", ["registration_number"], unique=True
    )
    op.create_index(op.f("ix_machines_status"), "machines", ["status"], unique=False)

    # 8. operators
    op.create_table(
        "operators",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("license_number", sa.String(length=100), nullable=False),
        sa.Column("experience_years", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column(
            "hourly_rate", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_operators_chc_id"), "operators", ["chc_id"], unique=False)
    op.create_index(op.f("ix_operators_status"), "operators", ["status"], unique=False)
    op.create_index(op.f("ix_operators_user_id"), "operators", ["user_id"], unique=True)

    # 9. attachments
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("code", sa.String(length=100), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("required_hp_min", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column(
            "hourly_rate", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_id"], ["resource_owners.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_attachments_category"), "attachments", ["category"], unique=False)
    op.create_index(op.f("ix_attachments_chc_id"), "attachments", ["chc_id"], unique=False)
    op.create_index(op.f("ix_attachments_code"), "attachments", ["code"], unique=True)
    op.create_index(op.f("ix_attachments_owner_id"), "attachments", ["owner_id"], unique=False)
    op.create_index(op.f("ix_attachments_status"), "attachments", ["status"], unique=False)

    # 10. service_requests
    op.create_table(
        "service_requests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("farmer_id", sa.Integer(), nullable=False),
        sa.Column("field_latitude", sa.Float(), nullable=False),
        sa.Column("field_longitude", sa.Float(), nullable=False),
        sa.Column("acreage", sa.Float(), nullable=False),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column("crop_type", sa.String(length=100), nullable=True),
        sa.Column("requested_start_date", sa.Date(), nullable=False),
        sa.Column("requested_end_date", sa.Date(), nullable=False),
        sa.Column(
            "estimated_cost",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="SUBMITTED"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["farmer_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_service_requests_chc_id"), "service_requests", ["chc_id"], unique=False
    )
    op.create_index(
        op.f("ix_service_requests_farmer_id"), "service_requests", ["farmer_id"], unique=False
    )
    op.create_index(
        op.f("ix_service_requests_status"), "service_requests", ["status"], unique=False
    )

    # 11. bookings
    op.create_table(
        "bookings",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("service_request_id", sa.Integer(), nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=True),
        sa.Column("operator_id", sa.Integer(), nullable=True),
        sa.Column("booking_code", sa.String(length=50), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("scheduled_slot", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column(
            "total_cost", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0.00"
        ),
        sa.Column("payment_status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["operator_id"], ["operators.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(
            ["service_request_id"], ["service_requests.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_bookings_booking_code"), "bookings", ["booking_code"], unique=True)
    op.create_index(op.f("ix_bookings_chc_id"), "bookings", ["chc_id"], unique=False)
    op.create_index(op.f("ix_bookings_machine_id"), "bookings", ["machine_id"], unique=False)
    op.create_index(op.f("ix_bookings_operator_id"), "bookings", ["operator_id"], unique=False)
    op.create_index(
        op.f("ix_bookings_scheduled_date"), "bookings", ["scheduled_date"], unique=False
    )
    op.create_index(
        op.f("ix_bookings_service_request_id"), "bookings", ["service_request_id"], unique=False
    )
    op.create_index(op.f("ix_bookings_status"), "bookings", ["status"], unique=False)

    # 12. booking_attachments
    op.create_table(
        "booking_attachments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("attachment_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["attachment_id"], ["attachments.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "booking_id", "attachment_id", name="uq_booking_attachments_booking_attachment"
        ),
    )
    op.create_index(
        op.f("ix_booking_attachments_attachment_id"),
        "booking_attachments",
        ["attachment_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_booking_attachments_booking_id"),
        "booking_attachments",
        ["booking_id"],
        unique=False,
    )

    # 13. machine_availability
    op.create_table(
        "machine_availability",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("slot_date", sa.Date(), nullable=False),
        sa.Column("slot_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="FREE"),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "machine_id", "slot_date", "slot_type", name="uq_machine_avail_machine_date_slot"
        ),
    )
    op.create_index(
        op.f("ix_machine_availability_machine_id"),
        "machine_availability",
        ["machine_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_machine_availability_slot_date"),
        "machine_availability",
        ["slot_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_machine_availability_status"), "machine_availability", ["status"], unique=False
    )

    # 14. operator_availability
    op.create_table(
        "operator_availability",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("operator_id", sa.Integer(), nullable=False),
        sa.Column("slot_date", sa.Date(), nullable=False),
        sa.Column("slot_type", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["operator_id"], ["operators.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "operator_id", "slot_date", "slot_type", name="uq_operator_avail_operator_date_slot"
        ),
    )
    op.create_index(
        op.f("ix_operator_availability_operator_id"),
        "operator_availability",
        ["operator_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operator_availability_slot_date"),
        "operator_availability",
        ["slot_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operator_availability_status"), "operator_availability", ["status"], unique=False
    )

    # 15. machine_breakdowns
    op.create_table(
        "machine_breakdowns",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("machine_id", sa.Integer(), nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=True),
        sa.Column("reported_by_id", sa.Integer(), nullable=False),
        sa.Column(
            "reported_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("failure_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=30), nullable=False, server_default="MEDIUM"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("field_latitude", sa.Float(), nullable=True),
        sa.Column("field_longitude", sa.Float(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="REPORTED"),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["reported_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_machine_breakdowns_booking_id"), "machine_breakdowns", ["booking_id"], unique=False
    )
    op.create_index(
        op.f("ix_machine_breakdowns_failure_type"),
        "machine_breakdowns",
        ["failure_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_machine_breakdowns_machine_id"), "machine_breakdowns", ["machine_id"], unique=False
    )
    op.create_index(
        op.f("ix_machine_breakdowns_reported_by_id"),
        "machine_breakdowns",
        ["reported_by_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_machine_breakdowns_severity"), "machine_breakdowns", ["severity"], unique=False
    )
    op.create_index(
        op.f("ix_machine_breakdowns_status"), "machine_breakdowns", ["status"], unique=False
    )

    # 16. recovery_plans
    op.create_table(
        "recovery_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("breakdown_id", sa.Integer(), nullable=False),
        sa.Column("strategy", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PROPOSED"),
        sa.Column("estimated_delay_hours", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "estimated_cost",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="0.00",
        ),
        sa.Column("created_by_id", sa.Integer(), nullable=False),
        sa.Column("approved_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["breakdown_id"], ["machine_breakdowns.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recovery_plans_breakdown_id"), "recovery_plans", ["breakdown_id"], unique=False
    )
    op.create_index(op.f("ix_recovery_plans_status"), "recovery_plans", ["status"], unique=False)

    # 17. recovery_plan_items
    op.create_table(
        "recovery_plan_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("recovery_plan_id", sa.Integer(), nullable=False),
        sa.Column("affected_booking_id", sa.Integer(), nullable=False),
        sa.Column("replacement_machine_id", sa.Integer(), nullable=True),
        sa.Column("replacement_operator_id", sa.Integer(), nullable=True),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("new_scheduled_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["affected_booking_id"], ["bookings.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recovery_plan_id"], ["recovery_plans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["replacement_machine_id"], ["machines.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["replacement_operator_id"], ["operators.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_recovery_plan_items_affected_booking_id"),
        "recovery_plan_items",
        ["affected_booking_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_recovery_plan_items_recovery_plan_id"),
        "recovery_plan_items",
        ["recovery_plan_id"],
        unique=False,
    )

    # 18. booking_priority
    op.create_table(
        "booking_priority",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("booking_id", sa.Integer(), nullable=False),
        sa.Column("priority_score", sa.Integer(), nullable=False, server_default="50"),
        sa.Column(
            "agronomic_urgency", sa.String(length=30), nullable=False, server_default="MEDIUM"
        ),
        sa.Column("weather_risk_score", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_booking_priority_booking_id"), "booking_priority", ["booking_id"], unique=True
    )

    # 19. notifications
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(length=30), nullable=False, server_default="PUSH"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="PENDING"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_notifications_status"), "notifications", ["status"], unique=False)
    op.create_index(op.f("ix_notifications_user_id"), "notifications", ["user_id"], unique=False)

    # 20. refresh_tokens
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_expires_at"), "refresh_tokens", ["expires_at"], unique=False
    )
    op.create_index(
        op.f("ix_refresh_tokens_token_hash"), "refresh_tokens", ["token_hash"], unique=True
    )
    op.create_index(op.f("ix_refresh_tokens_user_id"), "refresh_tokens", ["user_id"], unique=False)

    # 21. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("chc_id", sa.Integer(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", sa.String(length=100), nullable=False),
        sa.Column("payload_before", sa.Text(), nullable=True),
        sa.Column("payload_after", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chc_id"], ["chcs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_audit_logs_action"), "audit_logs", ["action"], unique=False)
    op.create_index(op.f("ix_audit_logs_chc_id"), "audit_logs", ["chc_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_id"), "audit_logs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_audit_logs_entity_type"), "audit_logs", ["entity_type"], unique=False)
    op.create_index(op.f("ix_audit_logs_user_id"), "audit_logs", ["user_id"], unique=False)


def downgrade() -> None:
    """Drop all domain tables in reverse dependency order."""
    op.drop_table("audit_logs")
    op.drop_table("refresh_tokens")
    op.drop_table("notifications")
    op.drop_table("booking_priority")
    op.drop_table("recovery_plan_items")
    op.drop_table("recovery_plans")
    op.drop_table("machine_breakdowns")
    op.drop_table("operator_availability")
    op.drop_table("machine_availability")
    op.drop_table("booking_attachments")
    op.drop_table("bookings")
    op.drop_table("service_requests")
    op.drop_table("attachments")
    op.drop_table("operators")
    op.drop_table("machines")
    op.drop_table("resource_owners")
    op.drop_table("chc_memberships")
    op.drop_table("chcs")
    op.drop_table("user_roles")
    op.drop_table("users")
    op.drop_table("roles")
