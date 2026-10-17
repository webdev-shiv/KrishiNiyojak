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
├── .gitignore
├── README.md
└── docs/              # Architecture and implementation documentation
```

---

## Getting Started

> This project is currently in early scaffolding. Application setup instructions and environment configurations will be published as development proceeds.
