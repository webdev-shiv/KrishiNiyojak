<!-- ========================================================================= -->
<!-- 🖼️ THUMBNAIL / BANNER IMAGE AREA                                          -->
<!-- ========================================================================= -->
<div align="center">
  <img src="docs/assets/banner.svg" alt="NITI — Agricultural Machinery Scheduling & Breakdown Recovery" width="100%" />

  <h2>🌾 NITI (नीति) — Agricultural Machinery Scheduling & Management Platform</h2>
  <p align="center">
    <strong>Agricultural Machinery-Day Scheduling, Feasibility Engine & Breakdown-Recovery Platform for Custom Hiring Centres (CHCs)</strong>
  </p>

  <p align="center">
    <a href="#-operational-flowcharts"><img src="https://img.shields.io/badge/Architecture-Flowcharts-blue?style=flat-square" alt="Flowcharts" /></a>
    <a href="#-working-features--capabilities"><img src="https://img.shields.io/badge/Working_Features-T01--T12_Verified-emerald?style=flat-square" alt="Features" /></a>
    <a href="#-api-endpoint-reference"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi" alt="FastAPI" /></a>
    <a href="#-getting-started"><img src="https://img.shields.io/badge/SQLAlchemy-2.0+-red?style=flat-square&logo=sqlalchemy" alt="SQLAlchemy" /></a>
    <a href="#-getting-started"><img src="https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" /></a>
    <a href="#-running-tests"><img src="https://img.shields.io/badge/Tests-104_Passing-brightgreen?style=flat-square" alt="Tests" /></a>
    <a href="https://frontend-five-gamma-lpn1jh8m7z.vercel.app"><img src="https://img.shields.io/badge/Live_Deployment-Vercel-success?style=flat-square&logo=vercel" alt="Vercel Live" /></a>
  </p>
</div>

---

## 📌 Project Overview

**NITI** is an enterprise-grade operational platform engineered for agricultural **Custom Hiring Centres (CHCs)**. It bridges the gap between regional farmer equipment demand and centralized agricultural machinery fleets (tractors, harvesters, rotavators, sprayers, seeders).

The platform:
1. **Validates Technical Compatibility:** Evaluates machine-to-implement horsepower thresholds, implements matching, and rural road transit travel times with Haversine distance.
2. **Generates Candidate Schedules:** Automates non-destructive Earliest Deadline First (EDF) scheduling with intra-schedule collision avoidance and managerial sign-off gates.
3. **Automates Breakdown Recovery:** Reacts immediately to field breakdowns, transitions machine status, blocks maintenance calendars, and calculates transparent, algorithmic customer priority scores (1–100) based on crop urgency and repair downtime.

---

## 🔄 Operational Flowcharts

### 1. End-to-End Operational Lifecycle Workflow
This flowchart demonstrates the complete operational lifecycle from farmer demand intake through scheduling feasibility evaluation, booking execution, and recovery workflows:

```mermaid
flowchart TD
    classDef farmer fill:#e0f2fe,stroke:#0284c7,stroke-width:2px,color:#0369a1;
    classDef chc fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#92400e;
    classDef engine fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#15803d;
    classDef alert fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#b91c1c;

    FarmerInput(["👨‍🌾 Farmer Submits Service Request<br/>(Acreage, Crop, Dates, Location)"]):::farmer --> CHCReview["🏢 CHC Manager Reviews Request"]:::chc
    
    CHCReview --> DecisionApprove{Request Approved?}:::chc
    DecisionApprove -- No --> Rejected(["❌ Request Rejected"]):::alert
    DecisionApprove -- Yes --> FeasibilityCheck["⚙️ Feasibility Evaluation Engine<br/>POST /api/v1/scheduling/feasibility"]:::engine

    FeasibilityCheck --> EvaluationResult{Feasible Assignment?}:::engine
    EvaluationResult -- No (Violations) --> ResolveIssues["⚠️ Review Blocking Reasons<br/>(HP Deficit / Overlap / Radius / Leave)"]:::alert
    ResolveIssues --> FeasibilityCheck

    EvaluationResult -- Yes --> CreateBooking["📅 Create Operational Booking<br/>POST /api/v1/bookings"]:::chc
    CreateBooking --> ScheduledState["📌 Status: SCHEDULED / CONFIRMED"]:::engine
    
    ScheduledState --> InProgress["🚜 Field Execution: IN_PROGRESS"]:::engine
    InProgress --> BreakdownCheck{In-Field Breakdown?}:::engine

    BreakdownCheck -- Yes --> TriggerRecovery["🚨 Report Machine Breakdown<br/>Status: DISRUPTED & Trigger Recovery"]:::alert
    TriggerRecovery --> ImpactScoring["📊 Calculate Customer Priority Score<br/>GET /api/v1/breakdowns/{id}/impact"]:::alert
    ImpactScoring --> Reschedule["🔄 Reallocate Replacement Asset / Reschedule"]:::chc
    Reschedule --> InProgress

    BreakdownCheck -- No --> Completion(["✅ Job Finished: Status COMPLETED"]):::engine
```

---

### 2. Scheduling Feasibility Engine Evaluation Flowchart
This flowchart details the multi-constraint validation rules evaluated by `app/services/feasibility.py` without persisting state:

```mermaid
flowchart LR
    classDef check fill:#f1f5f9,stroke:#475569,stroke-width:1.5px;
    classDef pass fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#15803d;
    classDef fail fill:#fee2e2,stroke:#dc2626,stroke-width:2px,color:#b91c1c;

    Input["Proposed Assignment<br/>• CHC ID<br/>• Target Date & Slot<br/>• Machine & Operator<br/>• Attachments<br/>• Field Lat/Lng & Acreage"] --> C1{"1. CHC Status & Radius<br/>Haversine Distance <= Radius?"}:::check

    C1 -- Exceeds Radius --> R1["❌ Block: Exceeds CHC Radius"]:::fail
    C1 -- Within Radius --> C2{"2. Date Window<br/>Start <= Date <= Deadline?"}:::check

    C2 -- Out of Window --> R2["❌ Block: Outside Request Dates"]:::fail
    C2 -- Valid Window --> C3{"3. Implement Power<br/>Machine HP >= Required HP?"}:::check

    C3 -- Power Deficit --> R3["❌ Block: Horsepower Deficit"]:::fail
    C3 -- Sufficient Power --> C4{"4. Resource Availability<br/>Maintenance / Leave Slots?"}:::check

    C4 -- Blocked / Leave --> R4["❌ Block: Maintenance or Leave"]:::fail
    C4 -- Free Slots --> C5{"5. Booking Collisions<br/>Existing Active Booking?"}:::check

    C5 -- Slot Collision --> R5["❌ Block: Active Booking Collision"]:::fail
    C5 -- No Collision --> C6{"6. Acreage Capacity<br/>Est. Work Hours <= Slot Hours?"}:::check

    C6 -- Exceeds Capacity --> W1["⚠️ Advisory Warning:<br/>Work Exceeds Slot Capacity"]:::pass
    C6 -- Within Capacity --> Pass["✅ FEASIBLE: Ready to Schedule"]:::pass
    W1 --> Pass
```

---

### 3. Booking Lifecycle State Transitions
State machine governing operational bookings:

```mermaid
stateDiagram-v2
    [*] --> PENDING : Booking Created from Approved Request
    PENDING --> SCHEDULED : Machine & Operator Assigned
    PENDING --> CONFIRMED : Customer / CHC Confirmed
    PENDING --> CANCELLED : Cancelled by Farmer / Manager

    SCHEDULED --> CONFIRMED : Verified
    SCHEDULED --> IN_PROGRESS : Machinery Deployed to Field
    SCHEDULED --> CANCELLED : Cancelled
    SCHEDULED --> DISRUPTED : In-Field Machinery Breakdown

    CONFIRMED --> IN_PROGRESS : Operation Started
    CONFIRMED --> CANCELLED : Cancelled
    CONFIRMED --> DISRUPTED : Machinery Breakdown

    IN_PROGRESS --> COMPLETED : Field Work Finished
    IN_PROGRESS --> DISRUPTED : Machinery Breakdown
    IN_PROGRESS --> CANCELLED : Emergency Abort

    DISRUPTED --> SCHEDULED : Recovery Plan Reassignment
    DISRUPTED --> CANCELLED : Recovery Not Possible

    COMPLETED --> [*] : Terminal State
    CANCELLED --> [*] : Terminal State
```

---

## 🚀 Working Features & Capabilities (Verified T01–T12)

The backend is fully operational and verified through automated pytest test suites (78 passing tests) and isolated database fixtures:

| Module / Domain | Status | Key Implemented Features |
|:---|:---:|:---|
| **Identity & Auth (T06)** | ✅ Verified | Argon2id password hashing, short-lived JWT access tokens (15m), opaque cryptographically random refresh tokens with SHA-256 hash storage (7d), rotation, revocation, and role-based access control (`SUPERADMIN`, `CHC_MANAGER`, `RESOURCE_OWNER`, `OPERATOR`, `FARMER`). |
| **CHC & Resources (T07)** | ✅ Verified | Full CRUD and lifecycle management for Custom Hiring Centres, Fleet Machinery (tractors, harvesters, sprayers), Certified Operators (licenses, experience), and Agricultural Implements (rotavators, seeders). |
| **Availability & Demand (T08)** | ✅ Verified | Farmer Service Request intake (GPS coordinates, crop type, acreage, requested date windows). Calendar slot tracking for machines and operators across `FULL_DAY`, `HALF_DAY_MORNING`, and `HALF_DAY_AFTERNOON` with conflict rejection. |
| **Booking Lifecycle (T09)** | ✅ Verified | Conversion of approved requests into machine-day agreements, unique booking codes, conflict validation, role-scoped queries, cancellation workflows, and state-machine transitions. |
| **Scheduling Feasibility (T10)** | ✅ Verified | Modular business engine evaluating compatibility without database side-effects (`POST /api/v1/scheduling/feasibility` & `GET /api/v1/scheduling/feasibility/{booking_id}`). Checks HP thresholds, availability slots, booking collisions, Haversine travel distance, road transit time, and operational radius limits. |
| **Schedule Generation & Approval (T11)** | ✅ Verified | Automated candidate schedule generation with Earliest Deadline First (EDF) matching and intra-schedule collision avoidance (`POST /api/v1/schedules/generate`). Review, list, non-destructive rejection, and transactional approval (`POST /api/v1/schedules/{id}/approve`) with live concurrency conflict detection (409) and audit logging. |
| **Breakdown Impact & Customer Priority (T12)** | ✅ Verified | In-field breakdown incident reporting (`POST /api/v1/breakdowns`), machine status transition (`BROKEN_DOWN`), maintenance slot blocking, dependent booking identification, status transition to `DISRUPTED`, and transparent customer priority scoring (1-100) based on deadline urgency, downtime, crop criticality, and acreage with explanatory rationales (`GET /api/v1/breakdowns/{id}/impact`). |
| **CORS & Frontend Readiness** | ✅ Verified | Native FastAPI `CORSMiddleware` configured in `app/main.py` allowing frontend connections from Vite (`5173`), React/Next.js (`3000`), and mobile development servers (`8080`). |
| **Developer Tooling** | ✅ Verified | One-command PowerShell script ([run.ps1](run.ps1)) with dependency validation, automated `.env` handling, and non-blocking verification (`.\run.ps1 -CheckOnly`). |

---

## 📂 Repository Structure

```
.
├── docs/
│   ├── assets/
│   │   └── banner.svg                  # 🖼️ README Banner / Thumbnail Graphic
│   ├── ARCHITECTURE.md                 # Detailed domain architecture documentation
│   ├── IMPLEMENTATION_CHECKLIST.md     # Production milestone verification checklist
│   └── README.md
├── app/
│   ├── main.py                         # FastAPI app entrypoint, CORS & global exception handlers
│   ├── api/
│   │   ├── deps.py                     # Authentication & granular RBAC dependencies
│   │   └── v1/
│   │       ├── auth.py                 # Registration, login, token refresh, logout
│   │       ├── chcs.py                 # CHC hub management endpoints
│   │       ├── machines.py             # Machinery fleet inventory endpoints
│   │       ├── operators.py            # Certified operator endpoints
│   │       ├── attachments.py          # Implement & tool endpoints
│   │       ├── service_requests.py     # Farmer demand intake endpoints
│   │       ├── availability.py         # Machine & operator calendar slots
│   │       ├── bookings.py             # Operational booking lifecycle endpoints
│   │       ├── scheduling.py           # Feasibility checking endpoints
│   │       ├── schedules.py            # Schedule generation, review, approval & rejection
│   │       └── breakdowns.py           # Breakdown reporting & impact analysis endpoints
│   ├── core/
│   │   ├── config.py                   # Pydantic Settings, CORS origins & scoring weights
│   │   └── security.py                 # Argon2id hashing & JWT token issuance
│   ├── db/
│   │   ├── base.py                     # SQLAlchemy 2.x declarative Base
│   │   └── session.py                  # Database engine & sessionmaker
│   ├── models/                         # 21 Relational SQLAlchemy models
│   │   ├── chc.py                      # CHCs, CHCMemberships
│   │   ├── identity.py                 # Users, Roles, UserRoles
│   │   ├── resource.py                 # ResourceOwners, Machines, Operators, Attachments
│   │   ├── booking.py                  # ServiceRequests, Bookings, BookingAttachments
│   │   ├── availability.py             # MachineAvailability, OperatorAvailability
│   │   ├── recovery.py                 # Breakdowns, RecoveryPlans, Priorities
│   │   └── supporting.py               # RefreshTokens, AuditLogs, Notifications
│   ├── schemas/                        # Pydantic v2 schemas for all domains
│   │   ├── auth.py                     # Authentication & token schemas
│   │   ├── chc.py                      # CHC schemas
│   │   ├── resource.py                 # Machinery, operators & implements schemas
│   │   ├── service_request.py          # Demand intake schemas
│   │   ├── availability.py             # Shift & slot schemas
│   │   ├── booking.py                  # Booking state machine schemas
│   │   ├── scheduling.py               # Feasibility and schedule proposal models
│   │   └── recovery.py                 # Breakdown reporting and impact analysis models
│   └── services/
│       ├── breakdown.py                # Breakdown reporting & customer priority scoring
│       ├── feasibility.py              # Modular scheduling rules & travel estimation
│       ├── scheduler.py                # Candidate schedule generation & approval engine
│       └── schedule_store.py           # Thread-safe in-memory schedule proposal registry
├── tests/
│   ├── test_auth.py                    # 12 Authentication & RBAC unit tests
│   ├── test_models.py                  # 5 Schema, metadata & relationship tests
│   ├── test_health.py                  # 3 Health check & OpenAPI registration tests
│   ├── test_resources.py               # 14 CHC, machine, operator & attachment tests
│   ├── test_service_requests_and_availability.py # 8 Demand intake & slot tests
│   ├── test_bookings.py                # 8 Booking state machine & lifecycle tests
│   ├── test_scheduling_feasibility.py  # 13 Feasibility checker & travel tests
│   ├── test_scheduling_generation.py   # 8 Schedule generation & approval tests
│   └── test_breakdown_impact.py        # 7 Breakdown reporting & customer priority tests
├── alembic/                            # Alembic database migrations
├── run.ps1                             # Automated PowerShell startup & test script
├── pyproject.toml                      # Project metadata & Python dependencies
└── .env.example                        # Safe configuration template
```

---

## ⚡ Getting Started

### Prerequisites

- **Python 3.12 or newer** (tested on Python 3.14)
- **PowerShell** (Windows) or **Bash** (Linux/macOS)
- Optional: PostgreSQL / Supabase account for live database persistence

---

### One-Command Startup (Windows PowerShell)

From the project root:

```powershell
.\run.ps1
```

The script automatically prepares `.venv`, installs/verifies all dependencies, configures `.env`, and launches the FastAPI application at **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

To run non-blocking pre-flight checks:
```powershell
.\run.ps1 -CheckOnly
```

---

### Interactive Documentation & Testing Endpoints

Once the application is running, open:
- **Interactive Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc API Reference:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

### Running Tests

Execute the automated test suite (78 tests):

```powershell
# Run all independent unit tests
pytest tests/test_auth.py tests/test_models.py tests/test_health.py tests/test_resources.py tests/test_service_requests_and_availability.py tests/test_bookings.py tests/test_scheduling_feasibility.py tests/test_scheduling_generation.py tests/test_breakdown_impact.py -v

# Run code style & lint checks with Ruff
ruff check .
ruff format --check .
```

---

## 💻 Frontend Integration Guide

1. **API Base URL:** Connect your HTTP client (Axios, Fetch, TanStack Query) to:
   ```
   http://127.0.0.1:8000/api/v1
   ```
2. **CORS:** Pre-configured in `app/main.py` for `http://localhost:3000`, `http://localhost:5173`, and `http://localhost:8080`.
3. **Authentication Header:** Pass the JWT token on every protected route:
   ```
   Authorization: Bearer <access_token>
   ```
4. **Feasibility Dry-Run:** In the booking UI, call `POST /api/v1/scheduling/feasibility` before committing a booking to warn the user about horsepower deficits, route distance, or schedule conflicts.

---

## 🗺️ Map & Routing Integration Guide (Leaflet + OpenStreetMap + OSRM)

NITI incorporates a production-grade GIS, field mapping, and routing system built on top of **Leaflet** and **OpenStreetMap (OSM)**, powered by the **Open Source Routing Machine (OSRM)** road routing engine.

### Key Capabilities
1. **Interactive Field & CHC Mapping:**
   - Visualizes Custom Hiring Centre (CHC) dispatch hubs with operational coverage radius boundary circles (default 25 km).
   - Displays authentic farmer field pins with farmer names, villages, districts, operations, and acreage.
   - Interactive field location pin picker for farmers submitting machinery requests with GPS detection (`navigator.geolocation`) and OSM Nominatim reverse geocoding.
2. **Turn-by-Turn Road Routing:**
   - Calculates actual driving road transit distance (in km) and agricultural machinery transit duration (in minutes, calibrated for tractor/harvester transit speeds at ~25 km/h).
   - Renders exact road geometry paths on the Leaflet map between CHC hubs and farmer field parcels.
   - Fully integrated into both the CHC manager dashboard and worker/operator dispatch interface.
3. **Graceful Fallback & Accuracy Protection:**
   - If network connectivity is lost, rate limits are hit, or invalid coordinates are supplied, the platform falls back to Haversine great-circle distance with a 1.3 rural road winding factor.
   - Clearly flags fallback routes with `isEstimated: true` and amber visual styling. NITI never invents coordinates or falsely claims an estimated route is a verified road route.

### Environment Configuration & Variables

Add the following to your `frontend/.env` file:

```env
# Map Tile Provider (OpenStreetMap)
VITE_MAP_TILES_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
VITE_MAP_ATTRIBUTION=&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors

# Road Routing Engine (OSRM)
VITE_ROUTING_API_URL=https://router.project-osrm.org/route/v1/driving

# Geocoding & Village Lookup (OSM Nominatim)
VITE_GEOCODING_API_URL=https://nominatim.openstreetmap.org
```

Backend configuration in `.env` (FastAPI):
```env
ROUTING_SERVICE_URL=https://router.project-osrm.org/route/v1/driving
ROUTING_API_KEY=""
ENABLE_REAL_ROUTING=True
ROUTING_TIMEOUT_SECONDS=3.0
```

### Provider Usage Policies & Production Scaling

- **Development / Demonstration:**
  - **Provider:** Public OpenStreetMap tile servers & Project OSRM demo server.
  - **Cost:** **100% Free** (No credit card or paid subscription required).
  - **Policy & Limits:** Follows standard OSM tile usage guidelines (caching enabled, descriptive User-Agent, max ~1 req/sec per client for routing).
- **Production-Scale Deployment:**
  - For high-volume production deployments (>50,000 queries/day), deploy a self-hosted OSRM Docker container:
    ```bash
    docker run -t -i -p 5000:5000 -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend osrm-routed --algorithm mld /data/uttar-pradesh-latest.osrm
    ```
    Then point `VITE_ROUTING_API_URL=http://your-osrm-host:5000/route/v1/driving`.
  - Alternatively, configure commercial routing services such as Mapbox or GraphHopper by providing their base URL and setting the API key in `VITE_ROUTING_API_KEY` or `ROUTING_API_KEY`.

---

## 🚀 Vercel Deployment Guide

NITI is configured for instant, zero-config deployment to **Vercel** with full client-side routing support.

### 1. Instant Deployment via Vercel CLI or GitHub

1. Push your repository to GitHub or run Vercel CLI from the project root:
   ```bash
   vercel
   ```
2. The included [`vercel.json`](file:///d:/KRISHINIYOJAK/vercel.json) automatically instructs Vercel to:
   - Build the frontend bundle: `cd frontend && npm install && npm run build`
   - Serve output from: `frontend/dist`
   - Handle client-side routing (`/*` -> `/index.html`) so refreshing on any route (`/#dashboard`, `/#login`, `/#schedule`) never causes 404 errors.

### 2. Required Environment Variables on Vercel

In your Vercel Project Dashboard (**Settings -> Environment Variables**), configure:

| Variable | Description | Example / Production Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Your Supabase Project REST/Realtime URL | `https://rbvfxapcyybnlhpwfekg.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Anon Public API Key | `sb_publishable_KYR5ghy_8SDg_Db56eYZXQ_OtST98nK` |
| `VITE_MAP_TILES_URL` | OpenStreetMap Tile Layer | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `VITE_MAP_ATTRIBUTION` | Map Attribution Notice | `&copy; OpenStreetMap contributors` |
| `VITE_ROUTING_API_URL` | OSRM Driving Route Engine | `https://router.project-osrm.org/route/v1/driving` |
| `VITE_GEOCODING_API_URL` | OSM Nominatim Geocoder | `https://nominatim.openstreetmap.org` |

---

## 📱 Live Multi-Device Realtime Synchronization (Two Phones)

NITI supports **live, instantaneous two-way synchronization between devices** (e.g. Phone 1 = Farmer, Phone 2 = CHC Manager).

### Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as 👨‍🌾 Phone 1 (Farmer)
    participant RT as ⚡ Supabase Realtime (WebSocket)
    participant DB as 🗄️ Supabase PostgreSQL
    actor CHC as 🏢 Phone 2 (CHC Manager)

    Farmer->>RT: Broadcast: new_booking (1.19 acres, Wheat, Tractor)
    RT-->>CHC: Push: new_booking event (0ms latency)
    Note over CHC: CHC Dashboard immediately displays new request & alerts manager!
    Farmer->>DB: INSERT into public.bookings
    CHC->>RT: Broadcast: booking_status_updated (Approved)
    RT-->>Farmer: Push: booking_status_updated
    Note over Farmer: Farmer Dashboard live-updates booking status to "Approved"!
```

### Enable Database Row-Level Security & Realtime Replication (Run Once in Supabase SQL Editor)

To ensure persistent live inserts and updates across all mobile devices, paste and run this idempotent snippet in your **Supabase Dashboard -> SQL Editor**:

```sql
-- 1. Enable RLS and grant public access for live booking creation
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public select bookings" ON public.bookings;
CREATE POLICY "Public select bookings" ON public.bookings 
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Public insert bookings" ON public.bookings;
CREATE POLICY "Public insert bookings" ON public.bookings 
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Public update bookings" ON public.bookings;
CREATE POLICY "Public update bookings" ON public.bookings 
FOR UPDATE TO anon, authenticated USING (true);

-- 2. Add bookings table to Supabase Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
```

---

## 🎨 Design System & Authentication Experience

- **Sky-Blue Glassmorphic Login:** Centered translucent glass card (`backdrop-blur-xl bg-white/70`), soft cloud layers, glowing atmospheric concentric rings, and 1-click instant demo access for Farmers, CHC Managers, and Operators.
- **Farmer Dashboard:** Dark forest-green header banner with verified farmer status, voice assistant machine search, farm area decimal inputs (`step="any"`), and real-time dispatch tracking.
- **CHC Manager Portal:** Complete operational command center with real-time service requests table, dispatch scheduling, interactive Leaflet field route maps, and machinery fleet inventory.


