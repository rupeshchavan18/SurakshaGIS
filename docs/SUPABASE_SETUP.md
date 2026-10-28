# SurakshaGIS: Supabase Backend & PostgreSQL/PostGIS Architecture (Phase 5)

## 1. Architectural Overview

SurakshaGIS implements a production-grade, enterprise geospatial backend powered by **Supabase**, **PostgreSQL 16**, and **PostGIS 3.4**. It is engineered to support high-performance spatial queries, multi-hazard buffer intersections, carrying capacity assessments, and Row Level Security (RLS) under least-privilege principles.

### Key Technical Specifications
- **Database Engine:** PostgreSQL 16
- **Spatial Extension:** PostGIS 3.4 (`postgis`, `uuid-ossp`)
- **Geographic Coordinate System:** EPSG:4326 (WGS84 standard: latitude, longitude)
- **Geodesic Calculation Engine:** PostGIS `geography` type casting (`ST_Buffer`, `ST_DWithin`, `ST_Area`, `ST_Distance`) for accurate metric calculations across Indian latitudes
- **Spatial Indexing:** GiST (`Generalized Search Tree`) on all geometry and bounding box columns
- **Client Security:** Public Anonymous Key only; zero exposure of service-role keys or database credentials in client bundles
- **Dual-Mode Architecture:** Transparent, graceful degradation to Phase 4 CSV dataset (`10,000` records) and authentic benchmark records whenever remote Supabase credentials are not configured or offline.

---

## 2. Database Schema & Tables

The schema is organized across 9 core relational tables located in `supabase/migrations/`:

| Table Name | Geometry Column | Spatial Index | Description |
| :--- | :--- | :--- | :--- |
| `profiles` | N/A | B-Tree (`role`, `district`) | User roles linked to `auth.users(id)`: `sdma_admin`, `district_planner`, `field_surveyor`, `public_viewer` |
| `administrative_boundaries` | `geom` (MultiPolygon, 4326) | GiST (`geom`) | State, district, and taluk cadastral boundaries |
| `vulnerable_settlements` | `geom` (Point, 4326), `boundary_geom` (Polygon) | GiST (`geom`, `boundary_geom`) | At-risk hamlets, demographics, kuccha % and calculated risk score |
| `hazard_zones` | `geom` (Polygon, 4326), `centroid` (Point) | GiST (`geom`) | Landslide scarps, flood inundation extents, flash flood corridors |
| `candidate_relocation_sites`| `geom` (Polygon, 4326), `centroid` (Point) | GiST (`geom`) | Safe buildable land parcels, slope, road access, and carrying capacities |
| `risk_assessments` | N/A | B-Tree (`settlement_id`, `date`) | Multi-criteria factor breakdowns (hazard, vulnerability, coping capacity) |
| `relocation_action_plans` | N/A | B-Tree (`settlement_id`, `status`)| Official relocation orders, assigned horizons, budgets, and approval status |
| `dataset_imports` | N/A | B-Tree (`status`, `imported_at`) | Ingestion logs for batch CSV imports (e.g. `flood_risk_dataset_india.csv`) |
| `spatial_audit_logs` | N/A | B-Tree (`performed_at`, `action`)| Cryptographic/audit history of spatial rezoning, capacity re-evaluations |

---

## 3. PostGIS Stored Procedures (RPCs)

Five custom PostGIS stored procedures execute complex spatial analytics directly inside the database engine, minimizing data transfer:

1. **`fn_compute_red_zones(p_hazard_types, p_min_severity, p_buffer_meters)`**
   - Applies `ST_Buffer(geom::geography, p_buffer_meters)::geometry` around active hazards.
   - Performs `ST_UnaryUnion` to dissolve overlapping hazard zones into a unified composite polygon.
   - Calculates geodesic area in sq km (`ST_Area(geom::geography) / 1000000.0`).

2. **`fn_assess_carrying_capacity(p_site_id, p_per_capita_gross_sqm)`**
   - Inspects terrain slope (`avg_slope_degrees`) and applies terrain suitability penalties:
     - Slope > 15°: reduces buildable layout by 40%.
     - Slope > 10°: reduces buildable layout by 15%.
   - Computes real-time spatial intersection with active hazard buffers (`ST_Intersects`) and deducts 100% of hazard overlap from usable area.
   - Deducts 25% for mandatory civic infrastructure corridors (roads, drainage, utilities) per National Building Code (NBC) guidelines.
   - Updates `usable_area_sqm` and `max_carrying_capacity_pop` atomically.

3. **`fn_rank_relocation_priority(p_weight_hazard, p_weight_demographic, p_weight_history)`**
   - Executes multi-criteria Analytic Hierarchy Process (AHP) factor synthesis on vulnerable settlements.
   - Categorizes each settlement into an actionable Priority Horizon:
     - Composite Score ≥ 80: `immediate` (0 - 6 months)
     - Composite Score ≥ 60: `short_term` (6 - 18 months)
     - Composite Score ≥ 40: `medium_term` (18 - 36 months)
     - Composite Score < 40: `monitoring` (In-situ mitigation)

4. **`fn_get_habitations_within_hazard_buffer(p_hazard_id, p_buffer_meters)`**
   - Uses `ST_DWithin(s.geom::geography, h.geom::geography, p_buffer_meters)` to locate all habitations within a hazard's dynamic buffer.
   - Calculates exact geodesic distance in meters (`ST_Distance`).

5. **`fn_get_spatial_metrics(p_verified_only)`**
   - Aggregates system-wide key performance indicators (KPIs) in a single optimized pass.

---

## 4. Row Level Security (RLS) & Access Control Matrix

Row Level Security is enabled across all 9 tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). Access is partitioned by user role:

| Table | Public Viewer | Field Surveyor | District Planner | SDMA Administrator |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | View self | View self | View district | Full access |
| `administrative_boundaries` | Read only | Read only | Read only | Full access |
| `vulnerable_settlements` | Read (verified only)| Read + Insert/Update | Full in district | Full access |
| `hazard_zones` | Read (verified only)| Read + Insert | Full in district | Full access |
| `candidate_relocation_sites`| Read (verified only)| Read only | Full in district | Full access |
| `risk_assessments` | Read only | Read + Insert | Full in district | Full access |
| `relocation_action_plans` | Read (approved only)| Read only | Create/Edit (Drafts)| Full (Approve/Reject) |
| `dataset_imports` | No access | View own imports | District imports | Full access |
| `spatial_audit_logs` | No access | View own actions | Read only | Full access |

### Security Safeguards
- **Zero Frontend Privileged Keys:** The frontend only uses `VITE_SUPABASE_ANON_KEY`. The service-role key is never stored or used in client code.
- **Security Definer Function:** `is_sdma_admin()` checks the calling user's role securely in PostgreSQL without relying on client-supplied claims.

---

## 5. Step-by-Step Setup & Migration Instructions

### Step 1: Create a Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New Project**.
3. Choose a name (e.g. `surakshagis-dss`), set a strong database password, and select a region near your deployments (e.g., `ap-south-1` Mumbai).
4. Wait 1-2 minutes for the database cluster to finish provisioning.

### Step 2: Execute SQL Migrations
In the Supabase Studio dashboard, open the **SQL Editor** from the left navigation. Execute the migration scripts in the exact sequence shown below:

```
1. supabase/migrations/20261022000001_enable_postgis_and_types.sql
2. supabase/migrations/20261022000002_create_core_tables.sql
3. supabase/migrations/20261022000003_create_spatial_functions.sql
4. supabase/migrations/20261022000004_create_rls_policies.sql
```

*(Alternatively, if using the Supabase CLI, run `supabase db push` or `supabase migration up`).*

### Step 3: Populate Seed Data (Ground-Truth & Demo)
In the SQL Editor, paste and execute:
```
supabase/seed/seed_data.sql
```
This loads verified ground-truth geometries for:
- **Wayanad, Kerala:** Chooralmala & Mundakkai slip corridors, Meppadi habitation, Kalpetta relocation sites.
- **Chamoli, Uttarakhand:** Raini village rock-ice detachment zone, Joshimath plateau parcels.
- **Majuli, Assam:** Kamar Gaon alluvial riverbank erosion hazard zones, Kamalabari safe mound sites.

### Step 4: Configure Frontend Environment Variables
1. In Supabase Studio, navigate to **Project Settings** -> **API**.
2. Copy the **Project URL** and the **`anon` `public`** key.
3. In your local repository root, copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
4. Populate `.env`:
   ```env
   VITE_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   VITE_CSV_DATASET_PATH=/docs/flood_risk_dataset_india.csv
   ```
5. Ensure `.env` is NOT tracked by Git (`git status` should not show `.env`).

---

## 6. Testing & Connection Verification

### Automated Integration Script
Run the automated backend integration verification script:
```bash
node scripts/test_backend_integration.mjs
```
This validates:
- Presence and syntax of all 4 SQL migration files and the seed file.
- Correct PostGIS spatial indexes and column types.
- Strict absence of exposed service-role keys in codebase.
- Graceful offline fallback when running without remote credentials.

### In-App Verification
1. Start the Vite dev server:
   ```bash
   npm run dev
   ```
2. In the header bar, click the **PostGIS Status Badge** (`PostGIS Connected` or `PostGIS Fallback`).
3. An interactive diagnostic modal will open displaying:
   - Live Supabase connection test result and round-trip latency.
   - List of all 5 migrations and their schemas.
   - Current data routing layer (`supabase_postgis` vs `local_fallback`).
