# Implementation Checklist

This document tracks the execution, verification, and pass/fail status of tasks across development phases for Machine-Day Composer.

---

## Phase 1: Repository & Backend Foundation

### [x] Task T01: Initialize Machine-Day Composer Repository
- **Scope:** Root directory inspection, Git repository initialization, `.gitignore`, initial `README.md`, and `docs/` scaffold.
- **Verification:**
  - `git status` confirmed repository initialized and working tree clean.
  - `.gitignore` confirmed covering Python artifacts, virtual environments, `.env` files, tests, and IDEs.
  - `README.md` and `docs/README.md` established.
- **Status:** **PASS** (Completed & Verified)

### [x] Task T02: Backend Foundation
- **Scope:**
  - Python 3.12+ project configuration via `pyproject.toml` (FastAPI, Uvicorn, Pydantic, pydantic-settings, pytest, httpx, Ruff).
  - Backend directory structure (`app/main.py`, `app/core/config.py`, `tests/test_health.py`).
  - `GET /health` endpoint returning `{"status": "ok"}`.
  - Pytest suite verifying `GET /health`.
  - Ruff linter configuration & execution.
  - `README.md` updated with setup, execution, and test commands.
- **Verification:**
  - `pip install -e ".[dev]"` executed in dedicated virtual environment (`.venv`).
  - Application import check (`from app.main import app`) succeeded.
  - Pytest passed: `tests/test_health.py` (1 passed).
  - Ruff check passed: 0 errors detected.
- **Status:** **PASS** (Completed & Verified)

### [x] Task T03: Architecture Specification
- **Scope:**
  - Modular-monolith architecture definition utilizing FastAPI, PostgreSQL, SQLAlchemy 2.x, Alembic, Pydantic, pytest, Argon2id/JWT, Docker Compose, and React Native/Expo.
  - Comprehensive module boundaries defined: `auth`, `users`, `chcs`, `resources`, `service_requests`, `bookings`, `availability`, `scheduling`, `breakdown_recovery`, `notifications`, `audit_logs`.
  - Entity-relationship model mapped (ER diagram, ownership, CHC membership, multi-tenancy).
  - Lifecycles and workflows articulated: booking state machine, hard/soft scheduling constraints, manager approval gates, and breakdown recovery workflow.
  - API conventions, security/RBAC, testing strategy, configuration principles, and Alembic migration rules defined.
  - Explicit recording of unresolved business decisions (slot granularity, cross-CHC aid, payment handling, offline mobile sync).
- **Verification:**
  - `docs/ARCHITECTURE.md` verified complete and aligned with technology choices.
  - `docs/README.md` updated with links.
  - No application code, database models, or migrations prematurely introduced.
- **Status:** **PASS** (Completed & Verified)

---

### [x] Task T04: Database Infrastructure (Supabase Free Tier)
- **Scope:**
  - Transitioned database strategy to **Supabase Free Tier (PostgreSQL 16)** to remain strictly on free-tier, zero-cost tools without requiring Docker or paid infrastructure.
  - `.env.example` configured with safe Supabase URI placeholder and copy instructions from the Supabase Dashboard.
  - `app/core/config.py` updated with automatic connection string normalization: seamlessly converts dashboard-copied `postgresql://` and `postgres://` formats to `postgresql+psycopg://` for SQLAlchemy 2.x.
  - SQLAlchemy 2.x engine (`app/db/session.py`) and Alembic (`alembic/env.py`) configured with resilient 10s connection timeout for cloud network latency and SSL enforcement (`sslmode=require`).
  - Minimal initial migration (`alembic/versions/814e8227b8d4_initial_infrastructure_setup.py`) verified ready for upgrade.
  - Documentation in `README.md` and checklist updated with exact safe connectivity commands.
- **Verification:**
  - Configuration normalization verified via unit checks.
  - Ruff linter & format checks: **PASS** (16 files cleanly formatted).
  - Health check test (`pytest tests/test_health.py`): **PASS** (1 passed).
  - Live Supabase connectivity test: **PENDING USER SETUP** (Awaiting user to supply actual `.env` credentials; not claimed as verified).
- **Status:** **CONFIGURED FOR SUPABASE FREE** (Awaiting local `.env` setup by user)

---

### [x] Task T05: Domain Entities & Initial Migrations
- **Scope:**
  - Implemented 21 SQLAlchemy 2.x declarative models across 7 domain modules:
    - **Identity:** `users`, `roles`, `user_roles`
    - **CHCs:** `chcs`, `chc_memberships`
    - **Resources:** `resource_owners`, `machines`, `operators`, `attachments`
    - **Bookings:** `service_requests`, `bookings`, `booking_attachments`
    - **Availability:** `machine_availability`, `operator_availability`
    - **Recovery:** `machine_breakdowns`, `recovery_plans`, `recovery_plan_items`, `booking_priority`
    - **Supporting:** `notifications`, `refresh_tokens`, `audit_logs`
  - Explicit foreign keys, cascade deletes, composite unique constraints, indexes, UTC timestamps (`DateTime(timezone=True)`), and numeric money fields (`Numeric(10, 2)`).
  - Registered all models with `Base.metadata` in `app/models/__init__.py` and configured Alembic detection in `alembic/env.py`.
  - Created Alembic migration `6df59861962b_create_domain_models.py` chained to `814e8227b8d4`.
  - Created test suite `tests/test_models.py` verifying model imports, metadata registration of all 21 tables, mapper relationships, and migration script structure.
- **Verification:**
  - `Base.metadata.tables` verification: **PASS** (all 21 tables registered).
  - `alembic history`: **PASS** (`814e8227b8d4 -> 6df59861962b (head)`).
  - Pytest suite (`pytest tests/test_models.py tests/test_health.py`): **PASS** (6 passed in 1.57s).
  - Ruff linter & format check: **PASS** (all checks passed, 26 files formatted).
  - Live PostgreSQL database migration: **PENDING USER SETUP** (Not claimed as applied; awaits user `.env` database connection).
- **Status:** **PASS** (Models & Migration Verified; Live DB execution pending user `.env`)

### [x] Task T06: Authentication & Authorization
- **Scope:**
  - Argon2id password hashing and verification ([app/core/security.py](file:///e:/PROJECTS/hackshift/app/core/security.py)).
  - User registration (`POST /api/v1/auth/register`) with base 'FARMER' role; self-granting privileged roles is blocked.
  - User login (`POST /api/v1/auth/login`) with credential verification issuing JWT access tokens and opaque refresh tokens.
  - Short-lived JWT access tokens with configurable expiration, subject, and roles payload.
  - Cryptographically random opaque refresh tokens, storing only SHA-256 hashes in the database with rotation and revocation support.
  - Token refresh endpoint (`POST /api/v1/auth/refresh`) enforcing single-use rotation and invalidating old tokens.
  - Logout endpoint (`POST /api/v1/auth/logout`) explicitly revoking refresh tokens.
  - Reusable FastAPI dependencies ([app/api/deps.py](file:///e:/PROJECTS/hackshift/app/api/deps.py)): `get_current_user`, `get_current_active_user`, and `require_roles`.
  - Role-based authorization across system roles (`Role`, `UserRole`) and organizational roles (`CHCMembership`) supporting Farmer, CHC Manager, Resource Owner, Operator, and Superadmin.
  - Unit test suite ([tests/test_auth.py](file:///e:/PROJECTS/hackshift/tests/test_auth.py)) covering hashing, token validation, refresh rotation, revocation, and RBAC.
- **Verification:**
  - Pytest suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py`): **PASS** (18 passed in 3.37s).
  - Ruff linter & formatter check: **PASS** (All checks passed, 34 files formatted).
  - Security review: Zero hardcoded secrets; credentials read from environment variables; passwords hashed with Argon2id; refresh tokens stored as hashes.
- **Status:** **PASS** (Completed & Verified)

---

## Future Tasks (Pending Explicit Instruction)

- [ ] **Task T07:** Core Scheduling Engine & Capacity Planning
- [ ] **Task T08:** Breakdown Recovery & Dynamic Reallocation Workflows
- [ ] **Task T09:** REST API Router Layer & Documentation
- [ ] **Task T10:** React Native / Expo Mobile Client Scaffolding


