# Machine-Day Composer

> **Status:** Under initial development.

Machine-Day Composer is an agricultural machinery scheduling and breakdown-recovery platform designed for Custom Hiring Centres (CHCs). It enables efficient allocation of shared farming equipment, optimizes operational machine-days across regional farmer requests, and provides resilient recovery strategies when in-field machinery breakdowns occur.

---

## Planned Technology Stack

- **Backend Framework:** [Python](https://www.python.org/) with [FastAPI](https://fastapi.tiangolo.com/) and [Pydantic](https://docs.pydantic.dev/)
- **Database:** [PostgreSQL](https://www.postgresql.org/)
- **Object-Relational Mapping (ORM):** [SQLAlchemy 2.x](https://www.sqlalchemy.org/)
- **Database Migrations:** [Alembic](https://alembic.sqlalchemy.org/)
- **Authentication & Security:** Argon2id password hashing, JWT access tokens, and refresh-token rotation
- **Testing:** [pytest](https://docs.pytest.org/)
- **Local Infrastructure & Orchestration:** [Docker Compose](https://docs.docker.com/compose/)
- **Mobile Frontend (Planned):** [React Native](https://reactnative.dev/) with [Expo](https://expo.dev/) and [TypeScript](https://www.typescriptlang.org/)

---

## High-Level Development Phases

1. **Phase 1 — Project Initialization & Infrastructure:** Repository initialization, directory layout, Docker Compose setup, and developer tooling.
2. **Phase 2 — Domain Modeling & Database Schema:** PostgreSQL schemas, SQLAlchemy 2.x models, and Alembic migrations.
3. **Phase 3 — Core Scheduling Engine:** Machine-day capacity planning, booking requests, and allocation algorithms for CHCs.
4. **Phase 4 — Breakdown-Recovery System:** Incident reporting, automated impact analysis, and rescheduling/reallocation workflows.
5. **Phase 5 — API Layer & Authentication:** FastAPI REST endpoints, Argon2id hashing, JWT auth, and role-based access control.
6. **Phase 6 — Mobile Application & Integration:** React Native / Expo client for CHC operators, technicians, and farmers.

---

## Repository Structure

```
.
├── .env.example
├── .gitignore
├── docker-compose.yml
├── pyproject.toml
├── alembic.ini
├── README.md
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 814e8227b8d4_initial_infrastructure_setup.py
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py
│   └── db/
│       ├── __init__.py
│       ├── base.py
│       └── session.py
├── docs/
│   ├── README.md
│   ├── ARCHITECTURE.md
│   └── IMPLEMENTATION_CHECKLIST.md
└── tests/
    ├── __init__.py
    ├── test_database.py
    └── test_health.py
```

---

## Getting Started

### Prerequisites

- Python 3.12 or newer
- Free PostgreSQL instance on [Supabase](https://supabase.com/) (or optional local Docker Compose)

---

### One-Command Startup (Windows PowerShell)

From the project root, simply run:

```powershell
.\run.ps1
```

The `run.ps1` script automatically:
1. Detects system Python (verifying version >= 3.12).
2. Creates the `.venv` virtual environment if not present.
3. Installs or verifies all required project and developer dependencies without redundant reinstalls.
4. Checks `.env` configuration, generating a fresh template from `.env.example` if missing without overwriting existing files.
5. Launches the FastAPI development server with hot-reloading at **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

To run verification without starting the server:
```powershell
.\run.ps1 -CheckOnly
```

---

### Manual Setup & Configuration

#### 1. Configuration & `.env` Setup

Copy the example environment configuration:

```powershell
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

**Configuration Reference:**
- **Required for Database-Backed Features:** `DATABASE_URL` must point to your PostgreSQL / Supabase instance.
  - In your Supabase Dashboard: **Project Settings -> Database -> Connection string (URI)**.
  - Choose Transaction Pooler (port 6543) or Session Mode (port 5432).
  - Both `postgresql://` and `postgresql+psycopg://` formats are automatically normalized.
- **Optional for Startup & Health Checks:** `PROJECT_NAME`, `VERSION`, `API_V1_STR`, `ENVIRONMENT`, and `JWT_SECRET_KEY` use safe development defaults. Basic server startup, `/health`, and Swagger UI run without a live database.

#### 2. Virtual Environment & Dependencies

```powershell
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install project and development dependencies
pip install -e ".[dev]"
```

#### 3. Running the Development Server Manually

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Interactive documentation is available at:
- **Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

#### 4. Running Tests & Quality Checks

```powershell
# Run independent unit tests (health, Swagger docs, domain models, and auth fixtures)
pytest tests/test_auth.py tests/test_models.py tests/test_health.py -v

# Run full pytest suite (includes live database connectivity check)
pytest -v

# Run code formatting and linting checks with Ruff
ruff check .
```

#### 5. Database Migrations (Alembic)

Once `.env` is configured with valid Supabase credentials:

```powershell
# Inspect migration history
alembic history

# Apply migrations to head
alembic upgrade head
```


