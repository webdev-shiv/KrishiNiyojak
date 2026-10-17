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

### [x] One-Command Run Setup (Windows PowerShell)
- **Scope:**
  - Automated root-level PowerShell startup script ([run.ps1](file:///e:/PROJECTS/hackshift/run.ps1)) verifying Python 3.12+, configuring `.venv`, installing dependencies on demand without redundant reinstallations, ensuring safe `.env` creation from template without overwriting existing configs, and launching Uvicorn.
  - Added `-CheckOnly` switch parameter for non-blocking pre-flight checks and automated validation.
  - Hardened backend startup in [app/main.py](file:///e:/PROJECTS/hackshift/app/main.py) with global exception handlers for `sqlalchemy.exc.OperationalError` and `psycopg.OperationalError` returning a clean HTTP 503 Service Unavailable when the database is offline, preventing unhandled crashes or false success claims.
  - Verified independent execution of `/health`, `/docs`, and `/redoc` without requiring an active live database.
  - Enhanced [.env.example](file:///e:/PROJECTS/hackshift/.env.example) and [README.md](file:///e:/PROJECTS/hackshift/README.md) clearly distinguishing required database configurations from optional startup defaults.
- **Verification:**
  - `.\run.ps1 -CheckOnly`: **PASS** (Detected Python 3.14, verified `.venv`, verified dependencies, detected `.env`, validated application imports).
  - Pytest independent suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py -v`): **PASS** (20 passed in 3.65s).
  - Full pytest suite (`pytest -v`): 21 passed, 1 expected failure (`test_database_connectivity` fails clearly due to unconfigured live Supabase database, as designed).
  - Ruff linter check (`ruff check .`): **PASS** (0 errors).
  - Alembic migration discovery (`alembic history`): **PASS** (`814e8227b8d4 -> 6df59861962b (head)`).
- **Status:** **PASS** (Completed & Verified)

### [x] Task T07: Core Resource Management APIs
- **Scope:**
  - **CHC APIs ([app/api/v1/chcs.py](file:///e:/PROJECTS/hackshift/app/api/v1/chcs.py)):** Create, list (paginated, status filter), view, and update Custom Hiring Centre hubs. Manager auto-membership on creation.
  - **Machine APIs ([app/api/v1/machines.py](file:///e:/PROJECTS/hackshift/app/api/v1/machines.py)):** Register, list (paginated, CHC/category/status filters), view, update, and deactivate/retire machinery assets. Unique registration number constraint enforcement.
  - **Operator APIs ([app/api/v1/operators.py](file:///e:/PROJECTS/hackshift/app/api/v1/operators.py)):** Register, list, view, update, and deactivate certified operators. Automatic `OPERATOR` CHC membership association.
  - **Attachment APIs ([app/api/v1/attachments.py](file:///e:/PROJECTS/hackshift/app/api/v1/attachments.py)):** Create, list, view, update, and deactivate implements/attachments. Unique code constraint enforcement.
  - **Granular RBAC & Cross-CHC Isolation ([app/api/deps.py](file:///e:/PROJECTS/hackshift/app/api/deps.py)):** CHC Managers are strictly restricted to managing resources of their assigned CHC (`verify_chc_manager_access`). Resource owners can only manage their permitted assets (`verify_resource_management_access`). Unauthorized cross-CHC or cross-owner access is rejected with HTTP 403 Forbidden. Farmers are denied management access.
  - **Pydantic Validation ([app/schemas/chc.py](file:///e:/PROJECTS/hackshift/app/schemas/chc.py), [app/schemas/resource.py](file:///e:/PROJECTS/hackshift/app/schemas/resource.py)):** Type checks, GPS coordinate validation, positive horsepower/rate validation, and paginated response models.
  - **Router Integration:** All endpoints mounted under `/api/v1` in [app/main.py](file:///e:/PROJECTS/hackshift/app/main.py); OpenAPI schema verified.
  - **Unit Test Suite ([tests/test_resources.py](file:///e:/PROJECTS/hackshift/tests/test_resources.py)):** 14 tests covering all CRUD paths, cross-CHC manager rejection, duplicate constraints, and Pydantic validation errors.
- **Verification:**
  - Independent unit test suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py -v`): **PASS** (34 passed in 5.69s).
  - Full pytest suite (`pytest -v`): 35 passed, 1 expected failure (`test_database_connectivity` fails due to unconfigured cloud database credentials, as designed).
  - Ruff linter check (`ruff check .`): **PASS** (0 errors).
  - API documentation (`/docs`, `/redoc`): Verified operational and reflecting all new resource paths.
- **Status:** **PASS** (Completed & Verified)

### [x] Task T08: Availability & Farmer Service Requests
- **Scope:**
  - **Farmer Service Requests ([app/api/v1/service_requests.py](file:///e:/PROJECTS/hackshift/app/api/v1/service_requests.py)):** Endpoints for submission (`POST`), scoped listing (`GET`), retrieval (`GET /{id}`), and modification/cancellation (`PUT /{id}`). Strict farmer ownership scoping (farmers only access their own requests). CHC Managers can view and approve/reject requests submitted to their managed hubs. Farmers cannot self-approve requests.
  - **Machine Availability ([app/api/v1/availability.py](file:///e:/PROJECTS/hackshift/app/api/v1/availability.py)):** Endpoints for scheduling (`POST`), listing (`GET`), viewing (`GET /{id}`), updating (`PUT /{id}`), and deleting (`DELETE /{id}`) machine-day slots (`FULL_DAY`, `HALF_DAY_MORNING`, `HALF_DAY_AFTERNOON`). Enforces conflict detection to prevent overlapping or duplicate reservations. Enforces manager/owner authorization.
  - **Operator Availability ([app/api/v1/availability.py](file:///e:/PROJECTS/hackshift/app/api/v1/availability.py)):** Endpoints for scheduling, listing, viewing, updating, and removing operator duty/leave slots. Supports operator self-scheduling and CHC manager scheduling with slot conflict rejection.
  - **Pydantic Validation ([app/schemas/service_request.py](file:///e:/PROJECTS/hackshift/app/schemas/service_request.py), [app/schemas/availability.py](file:///e:/PROJECTS/hackshift/app/schemas/availability.py)):** Validates coordinates, positive acreage, date ordering (`end_date >= start_date`), and allowed slot types.
  - **Router Integration:** All endpoints mounted under `/api/v1` in [app/main.py](file:///e:/PROJECTS/hackshift/app/main.py); OpenAPI documentation confirmed operational.
  - **Unit Test Suite ([tests/test_service_requests_and_availability.py](file:///e:/PROJECTS/hackshift/tests/test_service_requests_and_availability.py)):** 8 comprehensive tests verifying valid submission, date validation, cross-farmer isolation, manager approval, machine availability scheduling, conflict checks, and operator duty management.
- **Verification:**
  - Independent unit test suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py tests/test_service_requests_and_availability.py -v`): **PASS** (42 passed in 6.53s).
  - Full pytest suite (`pytest -v`): 43 passed, 1 expected failure (`test_database_connectivity` fails due to unconfigured cloud database credentials, as designed).
  - Ruff linter check (`ruff check .`): **PASS** (0 errors).
  - Startup check (`.\run.ps1 -CheckOnly`): **PASS** (imports and configuration verified).
- **Status:** **PASS** (Completed & Verified)

### [x] Task T09: Booking Lifecycle
- **Scope:**
  - **Booking Creation ([app/api/v1/bookings.py](file:///e:/PROJECTS/hackshift/app/api/v1/bookings.py)):** Endpoint (`POST /api/v1/bookings`) to create operational bookings from approved service requests. Enforces service request existence, `APPROVED` status, single active booking constraint (preventing duplicate bookings), CHC resource alignment (verifying that machines and operators belong to the request's CHC), and date window compliance.
  - **Booking Management & Retrieval:** Endpoints for role-scoped listing (`GET`), detailed retrieval (`GET /{id}`), and modification (`PUT /{id}`). Farmers are restricted to their own requests; operators access only assigned bookings; CHC Managers access bookings for their authorized hubs.
  - **Status Transition State Machine:** Enforces valid lifecycle state transitions across `PENDING`, `SCHEDULED`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, and `DISRUPTED`. Rejects invalid transitions or transitions from terminal states (`COMPLETED`, `CANCELLED`) with HTTP 400 Bad Request.
  - **Cancellation Lifecycle:** Dedicated cancellation endpoint (`POST /{id}/cancel`) supporting optional cancellation reasons. Enforces farmer and manager permissions and blocks cancellation of completed bookings.
  - **Pydantic Schemas ([app/schemas/booking.py](file:///e:/PROJECTS/hackshift/app/schemas/booking.py)):** Models for creation, updates, cancellation, paginated listing, and detailed representation including implement attachments.
  - **Router Integration:** Mounted under `/api/v1` in [app/main.py](file:///e:/PROJECTS/hackshift/app/main.py); OpenAPI documentation confirmed operational.
  - **Unit Test Suite ([tests/test_bookings.py](file:///e:/PROJECTS/hackshift/tests/test_bookings.py)):** 8 comprehensive tests verifying successful booking creation, unapproved request rejection, duplicate booking prevention, date window checks, valid and terminal status transitions, cancellation lifecycle, cross-farmer isolation, and denial of direct farmer booking creation.
- **Verification:**
  - Independent unit test suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py tests/test_service_requests_and_availability.py tests/test_bookings.py -v`): **PASS** (50 passed in 11.75s).
  - Full pytest suite (`pytest -v`): 51 passed, 1 expected failure (`test_database_connectivity` fails due to unconfigured cloud database credentials, as designed).
  - Ruff linter check (`ruff check .`): **PASS** (0 errors).
  - Startup check (`.\run.ps1 -CheckOnly`): **PASS** (imports and configuration verified).
- **Status:** **PASS** (Completed & Verified)

### [x] Task T10: Scheduling Rules & Feasibility Checker
- **Scope:**
  - **Modular Feasibility Service ([app/services/feasibility.py](file:///e:/PROJECTS/hackshift/app/services/feasibility.py)):** Dedicated business logic evaluating proposed machine-day assignments and existing bookings against operational constraints without modifying state or creating persistent records.
  - **Machinery & Horsepower Compatibility:** Enforces that machine horsepower meets or exceeds maximum required horsepower threshold across all requested implements (`machine.horsepower >= attachment.required_hp_min`), flagging power deficits as blocking violations.
  - **Attachment Validation:** Verifies attachment existence, CHC ownership, and operational readiness (rejects `DAMAGED` or `MAINTENANCE` implements).
  - **Calendar Availability Slots:** Integrates with T08 `MachineAvailability` and `OperatorAvailability` to detect conflicts on target dates and slots (blocking on machine maintenance or operator leave).
  - **Active Booking Collisions:** Enforces cross-assignment collision prevention with active non-cancelled bookings (`Booking.status.notin_(["CANCELLED", "COMPLETED"])`) for both machinery and operators across `FULL_DAY`, `HALF_DAY_MORNING`, and `HALF_DAY_AFTERNOON` time slots.
  - **Operator Eligibility & Licensing:** Validates operator active duty status, license registration, and flags experience advisories.
  - **Configurable Haversine Travel Estimation:** Calculates straight-line distance (km) and estimated road transit time (minutes) using configurable rural road winding factor (`ROAD_WINDING_FACTOR = 1.3`) and machinery transit speed (`TRANSIT_SPEED_KMH = 25.0 km/h`) from [app/core/config.py](file:///e:/PROJECTS/hackshift/app/core/config.py). Enforces CHC operational radius boundary (`operating_radius_km`).
  - **Acreage, Date Window & Deadline Constraints:** Enforces scheduling within farmer's requested start date and deadline. Calculates estimated work duration and issues advisory warnings if work exceeds half-day slot capacity.
  - **API Endpoints ([app/api/v1/scheduling.py](file:///e:/PROJECTS/hackshift/app/api/v1/scheduling.py)):**
    - `POST /api/v1/scheduling/feasibility` — Evaluates proposed assignments with zero persistent side effects.
    - `GET /api/v1/scheduling/feasibility/{booking_id}` — Evaluates an existing booking excluding self-collision.
  - **Granular RBAC & Tenant Isolation:** Farmers can only evaluate proposals linked to their own service requests and inspect their own bookings; CHC Managers are restricted to their managed hubs; cross-tenant access is rejected with HTTP 403 Forbidden.
  - **Pydantic Schemas ([app/schemas/scheduling.py](file:///e:/PROJECTS/hackshift/app/schemas/scheduling.py)):** Structured schemas with explicit units (`distance_km`, `estimated_travel_time_minutes`, `machine_horsepower`, `acreage`, `estimated_work_duration_hours`, `slot_duration_hours`), blocking `reasons`, and advisory `warnings`.
  - **Unit Test Suite ([tests/test_scheduling_feasibility.py](file:///e:/PROJECTS/hackshift/tests/test_scheduling_feasibility.py)):** 13 comprehensive tests covering calculations, slot overlap, horsepower compatibility, missing/cross-CHC implements, maintenance/leave blocking, booking collisions, deadline violations, radius bounds, capacity warnings, existing booking evaluation, and authorization.
- **Verification:**
  - Independent unit test suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py tests/test_service_requests_and_availability.py tests/test_bookings.py tests/test_scheduling_feasibility.py -v`): **PASS** (63 passed in 16.23s).
  - Full pytest suite (`pytest -v`): 64 passed, 1 expected failure (`test_database_connectivity` fails due to unconfigured cloud database credentials, as designed).
  - Ruff linter & format check (`ruff check .` & `ruff format --check .`): **PASS** (0 errors, 54 files formatted).
  - Startup check (`.\run.ps1 -CheckOnly`): **PASS** (imports and configuration verified).
- **Status:** **PASS** (Completed & Verified)

### [x] Task T11: Schedule Generation & Manager Approval
- **Scope:**
  - **Schedule Generation Engine ([app/services/scheduler.py](file:///e:/PROJECTS/hackshift/app/services/scheduler.py)):** Automated scheduler matching eligible approved service requests and pending bookings to available CHC machinery, certified operators, and agricultural implements using the T10 Feasibility Checker. Employs Earliest Deadline First (EDF) prioritization.
  - **Intra-Schedule Collision Tracking:** Tracks tentative machine and operator assignments across dates and slots within a candidate plan, preventing double-allocation within the same schedule.
  - **Infeasible Demand Reporting:** Gathers and reports distinct blocking reasons in `unscheduled_jobs` (such as horsepower deficits, deadline breaches, or leave conflicts) without silently bypassing constraints.
  - **Non-Destructive Candidate Proposals ([app/services/schedule_store.py](file:///e:/PROJECTS/hackshift/app/services/schedule_store.py)):** Generates `PROPOSED` schedules in a thread-safe registry with zero mutations to confirmed bookings or database state before manager sign-off.
  - **Transactional Approval & Live Conflict Re-checking:** Re-verifies all candidate slots against live database availability during approval to detect concurrent booking conflicts (HTTP 409 Conflict). Atomically transitions operational bookings to `SCHEDULED`, updates/creates `MachineAvailability` and `OperatorAvailability` slots, records immutable `AuditLog` entries, and prevents duplicate approval or approval of rejected schedules (HTTP 400).
  - **Rejection Lifecycle:** Allows managers to reject proposed schedules with optional reasons, recording audit trails while leaving all operational bookings untouched.
  - **CHC Manager Endpoints ([app/api/v1/schedules.py](file:///e:/PROJECTS/hackshift/app/api/v1/schedules.py)):**
    - `POST /api/v1/schedules/generate` — Generate candidate machine-day schedule.
    - `GET /api/v1/schedules` — List candidate and approved schedules for a CHC.
    - `GET /api/v1/schedules/{schedule_id}` — Review candidate schedule details and feasibility metrics.
    - `POST /api/v1/schedules/{schedule_id}/approve` — Transactionally commit approved schedule assignments.
    - `POST /api/v1/schedules/{schedule_id}/reject` — Reject candidate schedule without modifying bookings.
  - **Granular RBAC & Tenant Isolation:** Exclusively accessible to `SUPERADMIN` and authorized `CHC_MANAGER` users managing the specific CHC hub. Farmers and unauthorized managers receive HTTP 403 Forbidden.
  - **Pydantic Schemas ([app/schemas/scheduling.py](file:///e:/PROJECTS/hackshift/app/schemas/scheduling.py)):** `CandidateAssignmentResponse`, `UnscheduledJobResponse`, `ScheduleGenerateRequest`, `ScheduleRejectRequest`, `ScheduleResponse`, `ScheduleSummaryResponse`.
  - **Unit Test Suite ([tests/test_scheduling_generation.py](file:///e:/PROJECTS/hackshift/tests/test_scheduling_generation.py)):** 8 comprehensive tests covering automated generation, infeasible job reasons, existing booking avoidance, transactional approval, duplicate approval prevention, rejection workflow, concurrent conflict detection (409), and RBAC/cross-CHC isolation.
- **Verification:**
  - Independent unit test suite (`pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py tests/test_service_requests_and_availability.py tests/test_bookings.py tests/test_scheduling_feasibility.py tests/test_scheduling_generation.py -v`): **PASS** (71 passed in 13.66s).
  - Full pytest suite (`pytest -v`): 72 passed, 1 expected failure (`test_database_connectivity` fails due to unconfigured cloud database credentials, as designed).
  - Ruff linter & format check (`ruff check .` & `ruff format --check .`): **PASS** (0 errors, 58 files formatted).
  - Startup check (`.\run.ps1 -CheckOnly`): **PASS** (imports and configuration verified).
- **Status:** **PASS** (Completed & Verified)

---

## Future Tasks (Pending Explicit Instruction)

- [ ] **Task T12:** Breakdown Recovery & Dynamic Reallocation Workflows
- [ ] **Task T13:** REST API Router Layer & Documentation
- [ ] **Task T14:** React Native / Expo Mobile Client Scaffolding


