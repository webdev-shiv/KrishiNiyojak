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

### 1. Environment Setup

1. Copy the example environment configuration:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# Linux / macOS
cp .env.example .env
```

2. Open `.env` and set `DATABASE_URL` with your Supabase connection string:
   - Navigate to **Supabase Dashboard -> Project Settings -> Database**.
   - Under **Connection string**, select **URI**.
   - Copy the URI (Session mode or Transaction pooler), replace `[YOUR-PASSWORD]` with your actual password, and paste it into `DATABASE_URL`.
   - Both `postgresql://` and `postgresql+psycopg://` formats are automatically supported.

3. Create and activate a virtual environment:

```bash
# Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate
```

### 2. Dependency Installation

Install the project along with development and database dependencies:

```bash
pip install -e ".[dev]"
```

### 3. Database Connectivity Verification

Once `.env` is configured with your Supabase credentials, verify the live connection safely:

```bash
# Safe live connectivity check
pytest tests/test_database.py
```

### 4. Database Migrations (Alembic)

Apply database schema migrations to the latest revision (`head`):

```bash
alembic upgrade head
```

To view migration history:

```bash
alembic history
```

### 5. Running the Development Server

Start the local FastAPI development server with Uvicorn:

```bash
uvicorn app.main:app --reload
```

The application will be accessible at:
- API Root / Swagger UI: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### 6. Running Tests & Quality Checks

Run the pytest test suite:

```bash
# Run all tests (requires active DATABASE_URL in .env)
pytest

# Run health check unit tests only (independent of database)
pytest tests/test_health.py
```

Run code formatting and linting checks with Ruff:

```bash
ruff check .
```


