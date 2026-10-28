# SurakshaGIS (सुरक्षाGIS)
> Real-World Proactive Disaster Risk & Relocation Planning Platform  
> **Problem Statement Reference:** SIH26191 (Ministry of Home Affairs / NDMA - Disaster Management)  
> **Status:** Final Submission Prototype — Verified Dual-Mode Architecture

---

## 1. Executive Summary & Problem Alignment

Current disaster management across India’s vulnerable geographies (Himalayan landslide corridors, Western Ghats escarpments, and riverine floodplains) remains predominantly **reactive**: emergency evacuations, temporary relief camps, and post-disaster rehabilitation.

**SIH26191** mandates a strategic shift from *reactive emergency relief* to **proactive, evidence-based relocation planning**. SurakshaGIS is a Spatial Decision Support System (SDSS) designed for State and District Disaster Management Authorities (SDMAs/DDMAs) to identify non-viable human settlements and execute planned, phased relocations before catastrophic failure occurs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                SurakshaGIS                                  │
└──────┬──────────────────────────────┬───────────────────────────────┬───────┘
       │                              │                               │
       ▼                              ▼                               ▼
┌──────────────┐              ┌──────────────┐               ┌────────────────┐
│   Pillar 1   │              │   Pillar 2   │               │    Pillar 3    │
│ Multi-Hazard │              │   Carrying   │               │ Prioritization │
│   Red Zone   │              │   Capacity   │               │   Framework    │
│   Mapping    │              │  Assessment  │               │     (AHP)      │
└──────────────┘              └──────────────┘               └────────────────┘
```

---

## 2. Dual-Mode Architecture: Local Prototype vs. Live Database

SurakshaGIS implements a **resilient dual-mode data layer**. To ensure zero external dependencies during evaluation, the application runs out of the box in **Local Prototype Fallback Mode**, while providing enterprise SQL migrations for **Live PostGIS Backend Mode**.

| Feature / Capability | Local Prototype Mode (Default / Offline) | Live PostGIS Backend Mode (Deferred / Production) |
| :--- | :--- | :--- |
| **Spatial Buffering & Union** | Deterministic client geometry (`gisCalculators.ts`) generating dynamic outer buffer halos and raycasting containment | Native PostGIS RPC `fn_compute_red_zones` via `ST_Buffer` and `ST_UnaryUnion` |
| **Settlement Red-Zone Check** | Haversine geodesic distance and point-to-polygon perimeter algorithms | PostGIS RPC `fn_get_habitations_within_hazard_buffer` with GiST spatial indexing |
| **Carrying Capacity Assessment** | Algorithmic NBC SP 7 evaluator: 25% civic setbacks, slope buildability penalties (&gt;15° reduces area by 40%) | PostGIS RPC `fn_assess_carrying_capacity` with spatial intersection deduction |
| **AHP Prioritization Scoring** | Saaty Pairwise Matrix engine calculating $\lambda_{max}$, $CI$, and Consistency Ratio ($CR < 0.10$) | PostGIS RPC `fn_rank_relocation_priority` with automated horizon ranking |
| **Relocation Plan Lifecycle** | In-memory session state with statutory sign-off, digital signature hashing, and audit trail ledger | PostgreSQL table `relocation_action_plans` with RLS security policies |
| **Data Ingestion** | 10,000-record Indian Flood Risk CSV (`docs/flood_risk_dataset_india.csv`) + Kerala/Uttarakhand cadastral seeds | PostgreSQL tables: `hazard_zones`, `vulnerable_settlements`, `candidate_relocation_sites` |
| **Live Database Claims** | **Zero live cloud claims**; transparently displays `local_fallback` status | Connects via `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` when configured |

> [!NOTE]
> **Database Activation Status:** All PostGIS SQL migrations, GiST indices, stored procedures, and Row Level Security policies are tested and verified (`npm run test:backend`). Live remote database connectivity is intentionally deferred to protect submission stability and allow 100% autonomous evaluation without cloud/network dependencies.

---

## 3. Core Features & Implemented Capabilities

### 3.1 Dynamic Multi-Hazard Red Zone Mapping
- **Interactive Multi-Layer Map:** Renders verified landslide slip zones, flood inundation plains, and cloudburst ravines on Leaflet GIS.
- **Dynamic PostGIS Buffer Slider:** 50m to 500m interactive slider calculates and draws real-time exclusion buffer halos.
- **Trapped Settlement Detection:** Real-time calculation alerts operators of human settlements caught inside active hazard buffer perimeters.
- **Multi-Base Map Switcher:** Instant toggling between **Dark Matter** (operations room default), **OpenStreetMap Topographic**, and **Esri World Satellite Imagery**.
- **Regional Focus Hot-Spots:** Single-click navigation to **Wayanad** (Western Ghats), **Chamoli** (Himalayas), **Majuli Island** (Brahmaputra), and **All-India Overview**.

### 3.2 National Building Code (NBC SP 7) Carrying Capacity Assessment
- **Civil Infrastructure Deductions:** Automatically deducts 25% gross area for arterial roads, utilities, and civic amenities.
- **Terrain Buildability Penalty:** Enforces national building safety norms: terrain slope $> 15^\circ$ triggers an automatic 40% reduction in net buildable area.
- **Dynamic Per-Capita Standards:** Live toggling between **30 m²** (Emergency shelter), **45 m²** (NBC standard norm), and **60 m²** (Extended permanent resettlement).
- **Candidate Parcel Proposal Wizard:** Enables district planners to evaluate, test, and register candidate parcels with immediate algorithmic capacity feedback.
- **Settlement Allocation Matcher:** Cadastral inspector pairs candidate parcels with unassigned immediate-priority settlements.

### 3.3 Analytic Hierarchy Process (AHP) Multi-Criteria Prioritization
- **3 Core Criteria:** Synthesizes Hazard Intensity, Demographic Vulnerability (children, elderly, kuccha housing), and Disaster Recurrence History.
- **Saaty Pairwise Comparison Matrix:** Evaluates pairwise judgment ratios and verifies mathematical consistency:
  $$\lambda_{max} \approx 3.0, \quad CI = \frac{\lambda_{max} - 3}{2}, \quad CR = \frac{CI}{0.58} < 0.10$$
- **System-Wide Propagation:** Applying AHP weights dynamically recalculates risk scores, priority horizons, and dashboard KPIs across the entire application.
- **Actionable Horizons:** Categorizes habitations into **Immediate (0-6M)**, **Short-Term (6-24M)**, **Medium-Term (2-5Y)**, and **Monitoring**.

### 3.4 SDMA Governance & Relocation Action Plan (RAP) Lifecycle
- **Statutory Relocation Orders:** Formal drafting wizard creating relocation directives under the Disaster Management Act, 2005.
- **Rehabilitation Budget Estimator:** Automatically computes budgets based on national norms (standard ₹15 Lakhs per displaced family unit).
- **SDMA Digital Sign-Off:** Digital endorsement dialog with role-based authorization for SDMA Member Secretaries.
- **Live Decision Audit Trail:** Cryptographic-style administrative audit trail logging rezoning actions, plan approvals, and parcel registrations.
- **Multi-Format Exports:**
  - **GeoJSON Spatial Package:** Export standard EPSG:4326 FeatureCollection for QGIS / ArcGIS.
  - **CSV Relocation Ledger:** RFC-compliant CSV containing plan codes, settlements, households, and budgets.
  - **Printable Executive Dossier:** Print-ready executive brief with NDMA/SDMA formatting.

### 3.5 Provenance Demarcation & CSV Ingestion
- **Iron-Clad Provenance Isolation:** Every record explicitly carries `isVerified` (`true`/`false`) and `dataSource`.
- **Verified Ground-Truth Mode:** Displays validated government records with solid green shield badges.
- **Simulation Benchmark Mode:** Ingests authentic 10,000-row Indian Flood Risk CSV (`docs/flood_risk_dataset_india.csv`) marked with striped amber warning badges for stress testing.

---

## 4. Primary Data Sources & Provenance

| Dataset Category | Primary Source Entity | Usage in Platform | Provenance Tag |
| :--- | :--- | :--- | :--- |
| **Landslide Susceptibility** | Geological Survey of India (GSI) NLSM 2024 | Wayanad & Western Ghats slip scarps | `isVerified: true` (GSI NLSM 2024) |
| **Flood Inundation Plains** | Central Water Commission (CWC) Flood Atlas | Majuli & Brahmaputra riverine corridors | `isVerified: true` (CWC Flood Inundation Atlas) |
| **Cloudburst Ravines** | Wadia Institute of Himalayan Geology (WIHG) | Chamoli & Joshimath steep ravines | `isVerified: true` (Uttarakhand SDMA / WIHG) |
| **Cadastral Land Bank** | Kerala & Uttarakhand Revenue Departments | Candidate safe resettlement tablelands | `isVerified: true` (State Revenue Cadastral Record) |
| **Demographics & Housing** | Census of India / WorldPop India | Village population, elderly/children, kuccha % | `isVerified: true` (District Census Survey) |
| **Hydrological Flood Grid** | India Flood Risk Dataset (10,000 rows) | Nationwide station stress testing | `isVerified: false` (Mock/Demo Scenario) |

---

## 5. Quickstart & Installation Guide

### Prerequisites
- **Node.js:** v18.0.0 or higher
- **npm:** v9.0.0 or higher

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/surakshagis.git
cd "END SEM DT"

# 2. Install dependencies
npm install

# 3. Environment Configuration (Optional)
# The application works out of the box in Local Fallback Mode without a .env file.
# To configure environment variables:
cp .env.example .env

# 4. Start the local development server
npm run dev
```

The application will be accessible at `http://localhost:5173/` (or the port indicated in terminal).

---

## 6. Development & Verification Commands

The repository contains an automated test harness covering all architectural layers:

```bash
# Run the complete test suite (71/71 tests: Prototype + PostGIS Backend + CSV Validation)
npm test

# Run Phase 6 GIS prototype verification & spatial evaluation test suite (23 tests)
npm run test:prototype

# Run Phase 5 Supabase/PostGIS architecture & security audit test suite (43 tests)
npm run test:backend

# Run Phase 4 CSV dataset validation & bounding integrity test suite (5 tests)
npm run test:csv

# Run strict TypeScript verification and production build
npm run build

# Preview production build locally
npm run preview
```

---

## 7. Step-by-Step Interactive Demo Walkthrough

Follow these 6 steps to demonstrate the full capabilities of SurakshaGIS:

1. **Operations Dashboard (`/`):**
   - Inspect top KPI metrics: Total Habitations, High-Risk Settlements, Exposed Population, and Relocation Capacity Margin.
   - Toggle the **Dataset Mode Switcher** in the top-bar between *Production (Verified Only)* and *Simulation Mode (Verified + Demo)* to observe strict provenance filtering.
   - Inspect the **Habitation Relocation Priority Queue** and click any row to open the full vulnerability dossier.

2. **Interactive Hazard Map (`/hazard-map`):**
   - Observe multi-hazard vector polygons and active exclusion buffer halos.
   - Use the **Base Map Switcher** to toggle between *Dark Matter*, *Satellite Imagery*, and *Topo OSM*.
   - Click the **Quick Focus** buttons (*Wayanad*, *Chamoli*, *Majuli*) to fly to specific disaster hot-spots.
   - Adjust the **Hazard Buffer Slider** from 50m to 500m: observe buffer halos expanding and the top **Red Zone Alert HUD** updating trapped settlements in real time.
   - Click on any vulnerable settlement marker: the **Spatial Entity Inspector** reveals its AHP risk score, buffer containment status, and nearest safe relocation parcel with geodesic distance.

3. **Multi-Criteria AHP Prioritization (`/priority-planning`):**
   - Adjust the three AHP weight sliders (*Hazard Intensity*, *Demographic Vulnerability*, *Disaster History*).
   - Click **"Pairwise Matrix"** to open the Saaty Pairwise Comparison tool. Observe live calculation of $\lambda_{max}$, Consistency Index ($CI$), and Consistency Ratio ($CR < 0.10$).
   - Click **"Apply Eigenvector Weights"** followed by **"Apply System-Wide"** to propagate the calibrated weights across all maps, tables, and dashboards.

4. **Carrying Capacity & Relocation Sites (`/relocation-sites`):**
   - Inspect candidate relocation parcels across Kerala and Uttarakhand.
   - Adjust the **Planning Standard** buttons (*30 m²*, *45 m²*, *60 m²*) to observe instant capacity recalculations.
   - Click **"Propose New Parcel"**: enter a parcel with slope $> 15^\circ$ to observe the automatic 40% buildability reduction penalty warning before saving.
   - Click **"Inspect Cadastral Details"** on any site to view the NBC carrying capacity breakdown and compatible immediate settlements.

5. **SDMA Relocation Action Plans & Governance (`/reports`):**
   - Review formal Relocation Action Plans (RAP) with household counts and budget disbursements in ₹ Crores.
   - Click **"Draft New RAP"**: pair an immediate-priority settlement with a safe candidate parcel, enter household counts, and submit for review.
   - Under the *SDMA Admin* role, click **"Sign & Approve"** to open the digital endorsement dialog and authorize the order under the Disaster Management Act, 2005.
   - Review the updated **Administrative Audit Trail**.
   - Click **"Export GeoJSON"** and **"Export CSV"** to download official spatial dossiers.

6. **CSV Dataset Explorer (`/dataset-integration`):**
   - Inspect all 10,000 hydrological observation records from `docs/flood_risk_dataset_india.csv`.
   - Test search by station index, filter by flood occurrence, sort by rainfall or river discharge, and inspect raw parameters.

---

## 8. Security & Environment Model

- **Zero Secret Exposure:** Client builds strictly use public anonymous keys; no database passwords, service-role secret keys, or cloud master credentials exist in the codebase.
- **Git Hygiene:** `.gitignore` strictly excludes `.env`, `.env.*.local`, credentials, log files, TypeScript cache files, and production build directories.
- **Row Level Security (RLS):** Production migrations (`supabase/migrations/20261022000004_create_rls_policies.sql`) enforce role-based access control across `sdma_admin`, `district_planner`, `field_surveyor`, and `public_viewer`.

---

## 9. Known Limitations & Troubleshooting

- **Live Database Activation:** Full PostGIS migrations and spatial stored procedures are included in `supabase/migrations/` and verified by `npm run test:backend`. Live cloud database activation is deferred to allow offline, autonomous evaluation.
- **Port Conflicts:** If port 5173 is occupied by another local service, run Vite on an alternate port:
  ```bash
  npx vite --port 5174
  ```
- **Map Tile Network Latency:** Leaflet raster tiles load from public CartoDB / OSM / Esri servers. In environments with restricted internet access, base tiles may load slowly, but all vector geometries, polygons, buffer halos, markers, and calculations remain 100% functional.
- **Print Layout:** When printing dossiers from `/reports`, select "Background graphics" in the browser print dialog for optimal styling of NDMA seals and badges.

---

## 10. Repository File Structure

```
END SEM DT/
├── docs/
│   ├── PROJECT_PLAN.md                  # Comprehensive architectural specification & blueprint
│   ├── CSV_INTEGRATION.md               # Phase 4 CSV dataset specification and mapping rules
│   ├── SUPABASE_SETUP.md                # Phase 5 Supabase/PostGIS deployment guide
│   └── flood_risk_dataset_india.csv     # Authentic 10,000-row Indian Flood Risk Dataset
├── scripts/
│   ├── test_phase6_prototype.mjs        # Phase 6 computational geometry, AHP & capacity tests
│   ├── test_backend_integration.mjs     # Phase 5 PostGIS migrations, RLS & secret audit tests
│   └── validate_csv_dataset.mjs         # Phase 4 CSV dataset validation test harness
├── src/
│   ├── components/
│   │   ├── backend/                     # PostGIS status modal & connection diagnostics
│   │   ├── common/                      # Badges, Buttons, Cards, Verification indicators
│   │   ├── dashboard/                   # KPIs, Habitation priority queue, Donut/Bar charts
│   │   └── layout/                      # Topbar, Sidebar, MobileNav, Layout wrapper
│   ├── context/
│   │   └── AppContext.tsx               # State management, AHP propagation, Audit trails
│   ├── data/
│   │   └── benchmarkData.ts             # Authentic Kerala/Uttarakhand cadastral seed records
│   ├── services/
│   │   ├── csvDatasetService.ts         # RFC 4180 CSV parser & domain transformation engine
│   │   ├── dashboardService.ts          # Aggregate query service & activity logging
│   │   ├── spatialService.ts            # Dual-mode spatial service (PostGIS RPC + Fallback)
│   │   └── supabaseClient.ts            # Typed Supabase client with anon public key
│   ├── types/
│   │   ├── csvDataset.types.ts          # CSV record & validation schema interfaces
│   │   ├── database.types.ts            # Database schema definitions
│   │   └── gis.types.ts                 # Geospatial types (HazardZone, Settlement, RelocationSite)
│   ├── utils/
│   │   └── gisCalculators.ts            # Computational geometry, AHP Saaty engine & NBC capacity
│   ├── views/
│   │   ├── DashboardView.tsx            # Operations command center & KPI breakdown
│   │   ├── DatasetIntegrationView.tsx   # 10,000-row CSV explorer with search, sort & inspector
│   │   ├── HazardMapView.tsx            # Leaflet GIS canvas, buffer halos, trapped alerts
│   │   ├── PriorityPlanningView.tsx     # AHP weight sliders & Saaty pairwise comparison
│   │   ├── RelocationSitesView.tsx      # NBC SP 7 carrying capacity & parcel proposal wizard
│   │   ├── ReportsView.tsx              # Relocation plans, SDMA digital sign-off & exports
│   │   └── RiskAssessmentView.tsx       # Settlement risk directory & cadastral dossiers
│   ├── App.tsx                          # Application router and provider tree
│   └── main.tsx                         # React entrypoint
├── supabase/
│   ├── migrations/                      # 4 production SQL migrations (PostGIS, tables, RPCs, RLS)
│   └── seed/                            # Authentic PostGIS geometry seed records
├── .env.example                         # Environment configuration template (zero secrets)
├── .gitignore                           # Excludes .env, build artifacts, and sensitive files
├── package.json                         # Dependencies & test scripts
└── README.md                            # Project documentation (this file)
```
