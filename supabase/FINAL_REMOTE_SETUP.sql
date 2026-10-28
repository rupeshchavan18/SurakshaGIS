-- ==============================================================================
-- SURAKSHAGIS: CONSOLIDATED REMOTE DATABASE SETUP & SPATIAL ENGINE
-- File: supabase/FINAL_REMOTE_SETUP.sql
-- ==============================================================================
-- PURPOSE:
-- Safely applies the complete SurakshaGIS relational and spatial schema to any
-- Supabase PostgreSQL 16 + PostGIS 3.4 project in a single idempotent pass.
--
-- HOW TO EXECUTE IN SUPABASE STUDIO:
-- 1. Log in to your Supabase Dashboard: https://supabase.com/dashboard
-- 2. Open your project (e.g., https://supabase.com/dashboard/project/hsfvghsqwckclnrnwojv)
-- 3. In the left navigation bar, click on "SQL Editor".
-- 4. Click "+ New query".
-- 5. Copy and paste the ENTIRE contents of this file into the editor.
-- 6. Click "Run" (or press Ctrl+Enter / Cmd+Enter).
-- 7. Verify the output displays "Success. No rows returned" with 0 errors.
--
-- IDEMPOTENCY GUARANTEE:
-- - Uses CREATE EXTENSION IF NOT EXISTS for postgis and uuid-ossp.
-- - Uses DO $$ BEGIN CREATE TYPE ... EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- - Uses CREATE OR REPLACE FUNCTION for all triggers and PostGIS RPC procedures.
-- - Uses DROP POLICY IF EXISTS before CREATE POLICY to prevent naming conflicts.
-- - Uses ON CONFLICT (id) DO NOTHING on all baseline benchmark seed rows.
-- Safe to execute repeatedly without dropping existing records or objects destructively.
-- ==============================================================================


-- ==============================================================================
-- SECTION 1: POSTGIS EXTENSIONS & SPATIAL ENUMERATIONS (Migration 01)
-- ==============================================================================

-- ==============================================================================
-- SurakshaGIS: PostGIS Extension Setup and Custom Enumerations
-- Migration: 20261022000001_enable_postgis_and_types.sql
-- ==============================================================================

-- 1. Enable PostGIS & Geospatial Extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Disaster & Hazard Type Enumeration
DO $$ BEGIN
    CREATE TYPE hazard_type_enum AS ENUM (
        'landslide',
        'riverine_flood',
        'cloudburst_flash_flood',
        'coastal_erosion',
        'cyclone_surge'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Severity Level Scale
DO $$ BEGIN
    CREATE TYPE severity_level_enum AS ENUM (
        'low',
        'moderate',
        'high',
        'severe',
        'catastrophic'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 4. Relocation Priority Horizon Scale (AHP)
DO $$ BEGIN
    CREATE TYPE priority_horizon_enum AS ENUM (
        'immediate',
        'short_term',
        'medium_term',
        'monitoring'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 5. User Roles with Least-Privilege Hierarchy
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM (
        'sdma_admin',
        'district_planner',
        'field_surveyor',
        'public_viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 6. Formal Relocation Plan Status Lifecycle
DO $$ BEGIN
    CREATE TYPE plan_status_enum AS ENUM (
        'DRAFT',
        'UNDER_REVIEW',
        'SDMA_APPROVED',
        'EXECUTING',
        'COMPLETED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 7. Dataset Import Status
DO $$ BEGIN
    CREATE TYPE import_status_enum AS ENUM (
        'PENDING',
        'PROCESSING',
        'COMPLETED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- ==============================================================================
-- SECTION 2: CORE SPATIAL TABLES, CONSTRAINTS & GIST INDEXES (Migration 02)
-- ==============================================================================

-- ==============================================================================
-- SurakshaGIS: Core Spatial Tables, Constraints, and GiST Indexes
-- Migration: 20261022000002_create_core_tables.sql
-- EPSG:4326 (WGS84) Geospatial Standard
-- ==============================================================================

-- 1. Profiles (Linked to Supabase Auth Users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'public_viewer',
    department VARCHAR(150),
    district VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_district ON profiles(district);

-- 2. Administrative Boundaries (Districts / Taluks / Wards)
CREATE TABLE IF NOT EXISTS administrative_boundaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state_name VARCHAR(100) NOT NULL,
    district_name VARCHAR(100) NOT NULL,
    subdistrict_name VARCHAR(100),
    census_code VARCHAR(20) UNIQUE,
    geom GEOMETRY(MultiPolygon, 4326) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    data_source VARCHAR(200) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom ON administrative_boundaries USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_admin_boundaries_district ON administrative_boundaries(district_name);

-- 3. Vulnerable Settlements (Habitations / Hamlets / Wards)
CREATE TABLE IF NOT EXISTS vulnerable_settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL,
    subdistrict VARCHAR(100),
    geom GEOMETRY(Point, 4326) NOT NULL,
    boundary_geom GEOMETRY(Polygon, 4326),
    total_population INT NOT NULL CHECK (total_population >= 0),
    household_count INT NOT NULL CHECK (household_count >= 0),
    elderly_count INT NOT NULL DEFAULT 0 CHECK (elderly_count >= 0),
    children_count INT NOT NULL DEFAULT 0 CHECK (children_count >= 0),
    kuccha_houses_pct NUMERIC(5,2) NOT NULL DEFAULT 0.0 CHECK (kuccha_houses_pct BETWEEN 0 AND 100),
    historical_event_count INT NOT NULL DEFAULT 0 CHECK (historical_event_count >= 0),
    primary_hazard_exposure hazard_type_enum NOT NULL,
    calculated_risk_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (calculated_risk_score BETWEEN 0 AND 100),
    priority_horizon priority_horizon_enum NOT NULL DEFAULT 'monitoring',
    is_verified BOOLEAN NOT NULL DEFAULT false,
    data_source VARCHAR(250) NOT NULL,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlements_geom ON vulnerable_settlements USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_settlements_boundary ON vulnerable_settlements USING GIST(boundary_geom);
CREATE INDEX IF NOT EXISTS idx_settlements_risk ON vulnerable_settlements(calculated_risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_settlements_district ON vulnerable_settlements(district);
CREATE INDEX IF NOT EXISTS idx_settlements_hazard ON vulnerable_settlements(primary_hazard_exposure);
CREATE INDEX IF NOT EXISTS idx_settlements_horizon ON vulnerable_settlements(priority_horizon);
CREATE INDEX IF NOT EXISTS idx_settlements_verified ON vulnerable_settlements(is_verified);

-- 4. Hazard Zones & Hazard Observations (Red Zones, Slip Corridors, Inundation)
CREATE TABLE IF NOT EXISTS hazard_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hazard_type hazard_type_enum NOT NULL,
    severity severity_level_enum NOT NULL,
    return_period_years INT CHECK (return_period_years > 0),
    description TEXT,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326),
    buffer_zone_meters NUMERIC NOT NULL DEFAULT 100 CHECK (buffer_zone_meters >= 0),
    area_sqkm NUMERIC(10,3) DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    data_source VARCHAR(250) NOT NULL,
    verified_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hazard_zones_geom ON hazard_zones USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_hazard_zones_type_sev ON hazard_zones(hazard_type, severity);
CREATE INDEX IF NOT EXISTS idx_hazard_zones_verified ON hazard_zones(is_verified);

-- 5. Candidate Relocation Sites (Safe Habitation Land Parcels)
CREATE TABLE IF NOT EXISTS candidate_relocation_sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_code VARCHAR(50) UNIQUE NOT NULL,
    location_name VARCHAR(150) NOT NULL,
    district VARCHAR(100) NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    centroid GEOMETRY(Point, 4326) NOT NULL,
    total_area_sqm NUMERIC(14,2) NOT NULL CHECK (total_area_sqm > 0),
    usable_area_sqm NUMERIC(14,2) NOT NULL CHECK (usable_area_sqm >= 0),
    avg_slope_degrees NUMERIC(4,2) NOT NULL CHECK (avg_slope_degrees >= 0),
    distance_to_primary_road_m NUMERIC(10,2) NOT NULL CHECK (distance_to_primary_road_m >= 0),
    distance_to_water_source_m NUMERIC(10,2) NOT NULL CHECK (distance_to_water_source_m >= 0),
    distance_to_nearest_hospital_km NUMERIC(6,2) NOT NULL CHECK (distance_to_nearest_hospital_km >= 0),
    distance_to_nearest_school_km NUMERIC(6,2) NOT NULL CHECK (distance_to_nearest_school_km >= 0),
    max_carrying_capacity_pop INT NOT NULL CHECK (max_carrying_capacity_pop >= 0),
    current_allocated_pop INT NOT NULL DEFAULT 0 CHECK (current_allocated_pop >= 0),
    suitability_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (suitability_score BETWEEN 0 AND 100),
    land_ownership_type VARCHAR(100) NOT NULL,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    data_source VARCHAR(250) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_sites_geom ON candidate_relocation_sites USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_candidate_sites_district ON candidate_relocation_sites(district);
CREATE INDEX IF NOT EXISTS idx_candidate_sites_verified ON candidate_relocation_sites(is_verified);

-- 6. Formal Relocation Plans & Governance
CREATE TABLE IF NOT EXISTS relocation_action_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    settlement_id UUID NOT NULL REFERENCES vulnerable_settlements(id) ON DELETE RESTRICT,
    target_site_id UUID NOT NULL REFERENCES candidate_relocation_sites(id) ON DELETE RESTRICT,
    assigned_horizon priority_horizon_enum NOT NULL,
    households_to_relocate INT NOT NULL CHECK (households_to_relocate > 0),
    estimated_budget_inr NUMERIC(16,2) NOT NULL CHECK (estimated_budget_inr >= 0),
    justification_summary TEXT NOT NULL,
    status plan_status_enum NOT NULL DEFAULT 'DRAFT',
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approval_timestamp TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relocation_plans_status ON relocation_action_plans(status);
CREATE INDEX IF NOT EXISTS idx_relocation_plans_settlement ON relocation_action_plans(settlement_id);
CREATE INDEX IF NOT EXISTS idx_relocation_plans_target ON relocation_action_plans(target_site_id);

-- 7. Risk Assessments & AHP Scenario Evaluations
CREATE TABLE IF NOT EXISTS risk_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id UUID NOT NULL REFERENCES vulnerable_settlements(id) ON DELETE CASCADE,
    assessor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    hazard_score NUMERIC(5,2) NOT NULL CHECK (hazard_score BETWEEN 0 AND 100),
    vulnerability_score NUMERIC(5,2) NOT NULL CHECK (vulnerability_score BETWEEN 0 AND 100),
    history_score NUMERIC(5,2) NOT NULL CHECK (history_score BETWEEN 0 AND 100),
    composite_risk_score NUMERIC(5,2) NOT NULL CHECK (composite_risk_score BETWEEN 0 AND 100),
    assigned_horizon priority_horizon_enum NOT NULL,
    ahp_weights JSONB NOT NULL DEFAULT '{"hazard": 0.40, "demographic": 0.35, "history": 0.25}'::jsonb,
    field_notes TEXT,
    assessment_date TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_settlement ON risk_assessments(settlement_id);

-- 8. Dataset Ingestion Registry (Tracks Phase 4 CSV & External Ingestions)
CREATE TABLE IF NOT EXISTS dataset_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    total_rows INT NOT NULL,
    valid_rows INT NOT NULL,
    invalid_rows INT NOT NULL DEFAULT 0,
    is_verified_dataset BOOLEAN NOT NULL DEFAULT false,
    status import_status_enum NOT NULL DEFAULT 'COMPLETED',
    imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    checksum VARCHAR(64),
    column_mapping_json JSONB,
    validation_report_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Spatial Audit Logs (Administrative & Re-zoning Traceability)
CREATE TABLE IF NOT EXISTS spatial_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    affected_table VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    performed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON spatial_audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON spatial_audit_logs(affected_table);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON spatial_audit_logs(timestamp DESC);

-- Trigger Function for Automatic updated_at timestamps
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_settlements_updated_at ON vulnerable_settlements;
CREATE TRIGGER trg_settlements_updated_at
    BEFORE UPDATE ON vulnerable_settlements
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_sites_updated_at ON candidate_relocation_sites;
CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON candidate_relocation_sites
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_plans_updated_at ON relocation_action_plans;
CREATE TRIGGER trg_plans_updated_at
    BEFORE UPDATE ON relocation_action_plans
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();


-- ==============================================================================
-- SECTION 3: POSTGIS RPC STORED PROCEDURES & ANALYTICAL ENGINES (Migration 03)
-- ==============================================================================

-- ==============================================================================
-- SurakshaGIS: PostGIS Stored Procedures and Spatial RPC Functions
-- Migration: 20261022000003_create_spatial_functions.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- RPC 1: Dynamic Multi-Hazard Red Zone Composite Delineation
-- Generates unified multi-hazard Red Zone polygon with a configurable metric buffer
-- Read-Only Analytical Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_compute_red_zones(
    p_hazard_types text[] DEFAULT ARRAY['landslide', 'riverine_flood', 'cloudburst_flash_flood'],
    p_min_severity text DEFAULT 'high',
    p_buffer_meters numeric DEFAULT 150
)
RETURNS TABLE (
    red_zone_geojson text,
    total_area_sqkm numeric,
    hazard_composition text,
    intersected_zones_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_hazards AS (
        SELECT 
            ST_Buffer(geom::geography, p_buffer_meters)::geometry AS buffered_geom,
            hazard_type::text AS h_type
        FROM public.hazard_zones
        WHERE hazard_type::text = ANY(p_hazard_types)
          AND (
            p_min_severity = 'all' OR
            severity IN ('high', 'severe', 'catastrophic')
          )
    ),
    unioned AS (
        SELECT 
            ST_UnaryUnion(ST_Collect(buffered_geom)) AS raw_geom,
            string_agg(DISTINCT h_type, ', ') AS h_names,
            COUNT(*) AS cnt
        FROM filtered_hazards
    )
    SELECT 
        ST_AsGeoJSON(raw_geom) AS red_zone_geojson,
        ROUND((ST_Area(raw_geom::geography) / 1000000.0)::numeric, 3) AS total_area_sqkm,
        COALESCE(h_names, 'None') AS hazard_composition,
        cnt AS intersected_zones_count
    FROM unioned;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 2: Carrying Capacity & Net Usable Area Evaluator
-- Enforces National Building Code setback standards, slope penalties, and hazard deductions
-- Mutating Function (Updates candidate_relocation_sites usable area & capacity)
-- RESTRICTED TO AUTHENTICATED ROLES ONLY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_assess_carrying_capacity(
    p_site_id UUID,
    p_per_capita_gross_sqm NUMERIC DEFAULT 45.0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_total_area NUMERIC;
    v_slope NUMERIC;
    v_hazard_overlap_area NUMERIC;
    v_net_usable_area NUMERIC;
    v_carrying_capacity INT;
    v_result JSONB;
BEGIN
    SELECT total_area_sqm, avg_slope_degrees
    INTO v_total_area, v_slope
    FROM public.candidate_relocation_sites
    WHERE id = p_site_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Site parcel not found', 'site_id', p_site_id);
    END IF;

    -- Calculate any hazard overlap intersection area
    SELECT COALESCE(SUM(ST_Area(ST_Intersection(s.geom, h.geom)::geography)), 0)
    INTO v_hazard_overlap_area
    FROM public.candidate_relocation_sites s
    CROSS JOIN public.hazard_zones h
    WHERE s.id = p_site_id AND ST_Intersects(s.geom, h.geom);

    -- Deduct 25% for mandatory civic infrastructure corridors and 100% of hazard intersections
    v_net_usable_area := GREATEST(0, (v_total_area * 0.75) - v_hazard_overlap_area);
    
    -- Terrain slope penalty: if slope > 15 degrees, reduce buildable layout by 40%
    IF v_slope > 15 THEN
        v_net_usable_area := v_net_usable_area * 0.60;
    ELSIF v_slope > 10 THEN
        v_net_usable_area := v_net_usable_area * 0.85;
    END IF;

    v_carrying_capacity := FLOOR(v_net_usable_area / GREATEST(10.0, p_per_capita_gross_sqm));

    UPDATE public.candidate_relocation_sites
    SET usable_area_sqm = v_net_usable_area,
        max_carrying_capacity_pop = v_carrying_capacity
    WHERE id = p_site_id;

    v_result := jsonb_build_object(
        'site_id', p_site_id,
        'total_area_sqm', v_total_area,
        'net_usable_area_sqm', ROUND(v_net_usable_area, 2),
        'hazard_overlap_sqm', ROUND(v_hazard_overlap_area, 2),
        'max_carrying_capacity_pop', v_carrying_capacity,
        'per_capita_basis_sqm', p_per_capita_gross_sqm,
        'slope_degrees', v_slope,
        'assessed_at', NOW()
    );

    RETURN v_result;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 3: Relocation Priority Horizon Ranking (AHP)
-- Synthesizes multi-criteria factor weighting for settlements
-- Read-Only Analytical Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_rank_relocation_priority(
    p_weight_hazard NUMERIC DEFAULT 0.40,
    p_weight_demographic NUMERIC DEFAULT 0.35,
    p_weight_history NUMERIC DEFAULT 0.25
)
RETURNS TABLE (
    settlement_id UUID,
    settlement_name VARCHAR,
    district VARCHAR,
    population INT,
    hazard_score NUMERIC,
    vulnerability_score NUMERIC,
    composite_risk_score NUMERIC,
    recommended_horizon priority_horizon_enum
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    WITH evaluated AS (
        SELECT 
            s.id AS s_id,
            s.name AS s_name,
            s.district AS s_dist,
            s.total_population AS s_pop,
            CASE s.primary_hazard_exposure
                WHEN 'cloudburst_flash_flood' THEN 95.0
                WHEN 'landslide' THEN 90.0
                WHEN 'riverine_flood' THEN 75.0
                WHEN 'coastal_erosion' THEN 70.0
                WHEN 'cyclone_surge' THEN 85.0
                ELSE 50.0
            END AS h_score,
            LEAST(100.0, (
                (s.kuccha_houses_pct * 0.50) +
                ((s.elderly_count + s.children_count)::numeric / NULLIF(s.total_population, 0) * 100.0 * 0.30) +
                (LEAST(s.historical_event_count, 5) * 4.0)
            )) AS v_score,
            LEAST(100.0, s.historical_event_count * 20.0) AS hist_score
        FROM public.vulnerable_settlements s
    )
    SELECT 
        e.s_id,
        e.s_name,
        e.s_dist,
        e.s_pop,
        ROUND(e.h_score, 2),
        ROUND(e.v_score, 2),
        ROUND((e.h_score * p_weight_hazard + e.v_score * p_weight_demographic + e.hist_score * p_weight_history)::numeric, 2) AS composite_risk_score,
        CASE 
            WHEN (e.h_score * p_weight_hazard + e.v_score * p_weight_demographic + e.hist_score * p_weight_history) >= 80 THEN 'immediate'::priority_horizon_enum
            WHEN (e.h_score * p_weight_hazard + e.v_score * p_weight_demographic + e.hist_score * p_weight_history) >= 60 THEN 'short_term'::priority_horizon_enum
            WHEN (e.h_score * p_weight_hazard + e.v_score * p_weight_demographic + e.hist_score * p_weight_history) >= 40 THEN 'medium_term'::priority_horizon_enum
            ELSE 'monitoring'::priority_horizon_enum
        END AS recommended_horizon
    FROM evaluated e
    ORDER BY composite_risk_score DESC;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 4: Habitations within Hazard Buffer
-- Finds settlements intersecting a specific hazard zone's spatial buffer
-- Read-Only Analytical Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_habitations_within_hazard_buffer(
    p_hazard_id UUID,
    p_buffer_meters NUMERIC DEFAULT 200
)
RETURNS TABLE (
    settlement_id UUID,
    settlement_name VARCHAR,
    district VARCHAR,
    population INT,
    distance_meters NUMERIC,
    calculated_risk_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.district,
        s.total_population,
        ROUND(ST_Distance(s.geom::geography, h.geom::geography)::numeric, 1) AS distance_meters,
        s.calculated_risk_score
    FROM public.vulnerable_settlements s
    JOIN public.hazard_zones h ON h.id = p_hazard_id
    WHERE ST_DWithin(s.geom::geography, h.geom::geography, p_buffer_meters)
    ORDER BY distance_meters ASC;
END;
$$;

-- ------------------------------------------------------------------------------
-- RPC 5: Spatial Metrics Summary Generator
-- Computes system-wide KPIs directly inside the database
-- Read-Only Analytical Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_get_spatial_metrics(
    p_verified_only BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_total_settlements INT;
    v_total_population BIGINT;
    v_immediate_count INT;
    v_active_red_zones INT;
    v_candidate_sites INT;
    v_total_capacity BIGINT;
    v_allocated_pop BIGINT;
    v_verified_count INT;
    v_all_count INT;
    v_ratio NUMERIC;
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(SUM(total_population), 0),
        COUNT(*) FILTER (WHERE priority_horizon = 'immediate')
    INTO v_total_settlements, v_total_population, v_immediate_count
    FROM public.vulnerable_settlements
    WHERE (NOT p_verified_only OR is_verified = true);

    SELECT COUNT(*)
    INTO v_active_red_zones
    FROM public.hazard_zones
    WHERE (NOT p_verified_only OR is_verified = true);

    SELECT 
        COUNT(*),
        COALESCE(SUM(max_carrying_capacity_pop), 0),
        COALESCE(SUM(current_allocated_pop), 0)
    INTO v_candidate_sites, v_total_capacity, v_allocated_pop
    FROM public.candidate_relocation_sites
    WHERE (NOT p_verified_only OR is_verified = true);

    -- Calculate verified ratio
    SELECT 
        (
            (SELECT COUNT(*) FROM public.vulnerable_settlements WHERE is_verified = true) +
            (SELECT COUNT(*) FROM public.hazard_zones WHERE is_verified = true) +
            (SELECT COUNT(*) FROM public.candidate_relocation_sites WHERE is_verified = true)
        ),
        (
            (SELECT COUNT(*) FROM public.vulnerable_settlements) +
            (SELECT COUNT(*) FROM public.hazard_zones) +
            (SELECT COUNT(*) FROM public.candidate_relocation_sites)
        )
    INTO v_verified_count, v_all_count;

    IF v_all_count > 0 THEN
        v_ratio := ROUND((v_verified_count::numeric / v_all_count::numeric) * 100.0, 1);
    ELSE
        v_ratio := 100.0;
    END IF;

    RETURN jsonb_build_object(
        'totalHabitations', v_total_settlements,
        'exposedPopulation', v_total_population,
        'immediatePriorityCount', v_immediate_count,
        'activeRedZonesCount', v_active_red_zones,
        'candidateRelocationSites', v_candidate_sites,
        'totalCarryingCapacityAvailable', v_total_capacity,
        'totalAllocatedPopulation', v_allocated_pop,
        'remainingAbsorptiveCapacity', GREATEST(0, v_total_capacity - v_allocated_pop),
        'verifiedDatasetRatio', v_ratio,
        'verifiedOnly', p_verified_only
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- Least-Privilege Access Governance on SECURITY DEFINER RPC Functions
-- ------------------------------------------------------------------------------
-- 1. Revoke default public execution privileges on all SECURITY DEFINER functions
REVOKE ALL ON FUNCTION fn_compute_red_zones(text[], text, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_assess_carrying_capacity(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_rank_relocation_priority(NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_get_habitations_within_hazard_buffer(UUID, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION fn_get_spatial_metrics(BOOLEAN) FROM PUBLIC;

-- 2. Read-only spatial analytical functions: available to public viewers and authenticated operators
GRANT EXECUTE ON FUNCTION fn_compute_red_zones(text[], text, numeric) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_rank_relocation_priority(NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_get_habitations_within_hazard_buffer(UUID, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION fn_get_spatial_metrics(BOOLEAN) TO authenticated, anon;

-- 3. Mutating function (UPDATES candidate_relocation_sites): restricted strictly to authenticated personnel
-- Anonymous unauthenticated requests ('anon') MUST NOT mutate land parcel capacities
GRANT EXECUTE ON FUNCTION fn_assess_carrying_capacity(UUID, NUMERIC) TO authenticated;


-- ==============================================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS), GOVERNANCE & ROLES (Migration 04)
-- ==============================================================================

-- ==============================================================================
-- SurakshaGIS: Row Level Security (RLS) & Access Governance Policies
-- Migration: 20261022000004_create_rls_policies.sql (Production Hardened)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Function: Caller Role Lookup (Hardened SECURITY DEFINER)
-- Resolves caller role strictly from public.profiles for authenticated API users,
-- while safely recognizing legitimate backend service-role tokens or direct SQL sessions.
-- NOTE: Never check `current_user = 'postgres'` here because SECURITY DEFINER sets
-- current_user to the function owner (postgres), which would escalate all callers!
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS public.user_role_enum
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role public.user_role_enum;
    v_jwt_role text;
BEGIN
    -- 1. Extract JWT role claim if present (PostgREST HTTP requests)
    BEGIN
        v_jwt_role := COALESCE(
            NULLIF(current_setting('request.jwt.claim.role', true), ''),
            (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
        );
    EXCEPTION
        WHEN OTHERS THEN
            v_jwt_role := NULL;
    END;

    -- 2. Backend service-role bypass (trusted administrative API tasks)
    IF v_jwt_role = 'service_role' THEN
        RETURN 'sdma_admin'::public.user_role_enum;
    END IF;

    -- 3. Direct SQL Editor / superuser session bypass (non-HTTP direct psql session)
    IF v_jwt_role IS NULL AND auth.uid() IS NULL AND session_user IN ('postgres', 'supabase_admin') THEN
        RETURN 'sdma_admin'::public.user_role_enum;
    END IF;

    -- 4. Authenticated user: resolve strictly from public.profiles
    IF auth.uid() IS NOT NULL THEN
        SELECT role INTO v_role
        FROM public.profiles
        WHERE id = auth.uid();
        
        IF v_role IS NOT NULL THEN
            RETURN v_role;
        END IF;
    END IF;
    
    -- 5. Fallback for unauthenticated anon or unassigned profiles
    RETURN 'public_viewer'::public.user_role_enum;
END;
$$;

ALTER FUNCTION get_current_user_role() OWNER TO postgres;
REVOKE ALL ON FUNCTION get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_current_user_role() TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 2. State-Machine & Role-Escalation Database Triggers
-- ------------------------------------------------------------------------------

-- Trigger Function A: Enforces role protection and identity immutability on profiles
CREATE OR REPLACE FUNCTION fn_enforce_profile_role_protection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF NEW.id IS DISTINCT FROM OLD.id THEN
            RAISE EXCEPTION 'Unauthorized: profile ID cannot be altered';
        END IF;

        IF NEW.role IS DISTINCT FROM OLD.role THEN
            IF get_current_user_role() != 'sdma_admin' THEN
                RAISE EXCEPTION 'Unauthorized: only SDMA administrators can alter user roles (Attempted: % -> %)', OLD.role, NEW.role;
            END IF;
        END IF;
    ELSIF (TG_OP = 'INSERT') THEN
        IF NEW.role != 'public_viewer'::public.user_role_enum AND get_current_user_role() != 'sdma_admin' THEN
            RAISE EXCEPTION 'Unauthorized: self-registered profiles must have public_viewer role';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION fn_enforce_profile_role_protection() OWNER TO postgres;
REVOKE ALL ON FUNCTION fn_enforce_profile_role_protection() FROM PUBLIC, anon;

-- Trigger Function B: Validates relocation plan status transitions (OLD vs NEW)
-- Forces created_by, prevents spoofing approved_by/timestamp, and restricts transitions
CREATE OR REPLACE FUNCTION fn_enforce_relocation_plan_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_role public.user_role_enum;
BEGIN
    v_caller_role := get_current_user_role();

    IF TG_OP = 'INSERT' THEN
        -- Force created_by to authenticated caller when not running as postgres/service_role
        IF auth.uid() IS NOT NULL THEN
            NEW.created_by := auth.uid();
        END IF;

        -- Planners can only create initial plans with DRAFT or UNDER_REVIEW
        IF NEW.status IN ('SDMA_APPROVED', 'EXECUTING', 'COMPLETED') THEN
            IF v_caller_role != 'sdma_admin' THEN
                RAISE EXCEPTION 'Unauthorized: only SDMA administrators can create relocation plans with status %', NEW.status;
            END IF;
            IF auth.uid() IS NOT NULL THEN
                NEW.approved_by := auth.uid();
                NEW.approval_timestamp := NOW();
            END IF;
        ELSE
            IF v_caller_role NOT IN ('sdma_admin', 'district_planner') THEN
                RAISE EXCEPTION 'Unauthorized: insufficient privileges to create relocation plans';
            END IF;
            -- Prevent clients from spoofing approval metadata on draft/review insert
            NEW.approved_by := NULL;
            NEW.approval_timestamp := NULL;
        END IF;

    ELSIF TG_OP = 'UPDATE' THEN
        -- Lock down approved, executing, or completed plans from non-admin modifications
        IF OLD.status IN ('SDMA_APPROVED', 'EXECUTING', 'COMPLETED') AND v_caller_role != 'sdma_admin' THEN
            RAISE EXCEPTION 'Unauthorized: only SDMA administrators can modify an approved, executing, or completed relocation plan (Current Status: %)', OLD.status;
        END IF;

        -- Prevent non-admin clients from tampering with approval metadata
        IF v_caller_role != 'sdma_admin' THEN
            NEW.approved_by := OLD.approved_by;
            NEW.approval_timestamp := OLD.approval_timestamp;
            NEW.created_by := OLD.created_by;
        END IF;

        -- Validate allowed state transitions
        IF NEW.status IS DISTINCT FROM OLD.status THEN
            -- Allowed: DRAFT -> UNDER_REVIEW (planner, admin)
            IF OLD.status = 'DRAFT' AND NEW.status = 'UNDER_REVIEW' THEN
                IF v_caller_role NOT IN ('sdma_admin', 'district_planner') THEN
                    RAISE EXCEPTION 'Unauthorized: insufficient privileges to submit plan for review';
                END IF;

            -- Allowed: UNDER_REVIEW -> DRAFT (planner, admin)
            ELSIF OLD.status = 'UNDER_REVIEW' AND NEW.status = 'DRAFT' THEN
                IF v_caller_role NOT IN ('sdma_admin', 'district_planner') THEN
                    RAISE EXCEPTION 'Unauthorized: insufficient privileges to return plan to draft';
                END IF;

            -- Allowed: UNDER_REVIEW -> SDMA_APPROVED (strictly admin only)
            ELSIF OLD.status = 'UNDER_REVIEW' AND NEW.status = 'SDMA_APPROVED' THEN
                IF v_caller_role != 'sdma_admin' THEN
                    RAISE EXCEPTION 'Unauthorized: only SDMA administrators can approve relocation plans';
                END IF;
                IF auth.uid() IS NOT NULL THEN
                    NEW.approved_by := auth.uid();
                    NEW.approval_timestamp := NOW();
                END IF;

            -- Allowed: SDMA_APPROVED -> EXECUTING (strictly admin only)
            ELSIF OLD.status = 'SDMA_APPROVED' AND NEW.status = 'EXECUTING' THEN
                IF v_caller_role != 'sdma_admin' THEN
                    RAISE EXCEPTION 'Unauthorized: only SDMA administrators can transition plans to EXECUTING';
                END IF;

            -- Allowed: SDMA_APPROVED -> UNDER_REVIEW (strictly admin only, for revision)
            ELSIF OLD.status = 'SDMA_APPROVED' AND NEW.status = 'UNDER_REVIEW' THEN
                IF v_caller_role != 'sdma_admin' THEN
                    RAISE EXCEPTION 'Unauthorized: only SDMA administrators can revoke approval for revision';
                END IF;
                NEW.approved_by := NULL;
                NEW.approval_timestamp := NULL;

            -- Allowed: EXECUTING -> COMPLETED (strictly admin only)
            ELSIF OLD.status = 'EXECUTING' AND NEW.status = 'COMPLETED' THEN
                IF v_caller_role != 'sdma_admin' THEN
                    RAISE EXCEPTION 'Unauthorized: only SDMA administrators can mark plans COMPLETED';
                END IF;

            ELSE
                RAISE EXCEPTION 'Unauthorized: invalid relocation plan status transition from % to %', OLD.status, NEW.status;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION fn_enforce_relocation_plan_lifecycle() OWNER TO postgres;
REVOKE ALL ON FUNCTION fn_enforce_relocation_plan_lifecycle() FROM PUBLIC, anon;

-- Attach Triggers
DROP TRIGGER IF EXISTS trg_protect_profile_roles ON profiles;
CREATE TRIGGER trg_protect_profile_roles
    BEFORE INSERT OR UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION fn_enforce_profile_role_protection();

DROP TRIGGER IF EXISTS trg_relocation_plan_lifecycle ON relocation_action_plans;
CREATE TRIGGER trg_relocation_plan_lifecycle
    BEFORE INSERT OR UPDATE ON relocation_action_plans
    FOR EACH ROW
    EXECUTE FUNCTION fn_enforce_relocation_plan_lifecycle();

-- ------------------------------------------------------------------------------
-- 3. Enable Row Level Security on All Nine Core Tables
-- ------------------------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE administrative_boundaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerable_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE hazard_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_relocation_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE relocation_action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Table 1: profiles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_profiles_read ON profiles;
CREATE POLICY p_profiles_read ON profiles
    FOR SELECT TO authenticated
    USING (
        auth.uid() = id OR
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

DROP POLICY IF EXISTS p_profiles_insert ON profiles;
CREATE POLICY p_profiles_insert ON profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS p_profiles_update ON profiles;
CREATE POLICY p_profiles_update ON profiles
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id OR
        get_current_user_role() = 'sdma_admin'
    )
    WITH CHECK (
        auth.uid() = id OR
        get_current_user_role() = 'sdma_admin'
    );

DROP POLICY IF EXISTS p_profiles_delete ON profiles;
CREATE POLICY p_profiles_delete ON profiles
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'sdma_admin');

-- ------------------------------------------------------------------------------
-- Table 2: administrative_boundaries (Public Geospatial Boundaries)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_admin_boundaries_read ON administrative_boundaries;
CREATE POLICY p_admin_boundaries_read ON administrative_boundaries
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS p_admin_boundaries_write ON administrative_boundaries;
CREATE POLICY p_admin_boundaries_write ON administrative_boundaries
    FOR ALL TO authenticated
    USING (get_current_user_role() = 'sdma_admin')
    WITH CHECK (get_current_user_role() = 'sdma_admin');

-- ------------------------------------------------------------------------------
-- Table 3: vulnerable_settlements (Habitations)
-- Genuinely public GIS data; managed by planners, surveyors, and admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_settlements_read ON vulnerable_settlements;
CREATE POLICY p_settlements_read ON vulnerable_settlements
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS p_settlements_insert ON vulnerable_settlements;
CREATE POLICY p_settlements_insert ON vulnerable_settlements
    FOR INSERT TO authenticated
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor')
    );

DROP POLICY IF EXISTS p_settlements_update ON vulnerable_settlements;
CREATE POLICY p_settlements_update ON vulnerable_settlements
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor')
    );

DROP POLICY IF EXISTS p_settlements_delete ON vulnerable_settlements;
CREATE POLICY p_settlements_delete ON vulnerable_settlements
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'sdma_admin');

-- ------------------------------------------------------------------------------
-- Table 4: hazard_zones (Hazard Observations and Buffers)
-- Genuinely public GIS data; managed by planners and admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_hazard_zones_read ON hazard_zones;
CREATE POLICY p_hazard_zones_read ON hazard_zones
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS p_hazard_zones_write ON hazard_zones;
CREATE POLICY p_hazard_zones_write ON hazard_zones
    FOR ALL TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

-- ------------------------------------------------------------------------------
-- Table 5: candidate_relocation_sites (Resettlement Parcels)
-- Genuinely public GIS data; managed by planners and admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_candidate_sites_read ON candidate_relocation_sites;
CREATE POLICY p_candidate_sites_read ON candidate_relocation_sites
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS p_candidate_sites_write ON candidate_relocation_sites;
CREATE POLICY p_candidate_sites_write ON candidate_relocation_sites
    FOR ALL TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

-- ------------------------------------------------------------------------------
-- Table 6: relocation_action_plans
-- Public viewers only see approved or executing plans;
-- Status transitions, attribution, and fields strictly guarded by trigger
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_plans_read ON relocation_action_plans;
CREATE POLICY p_plans_read ON relocation_action_plans
    FOR SELECT TO authenticated, anon
    USING (
        status IN ('SDMA_APPROVED', 'EXECUTING', 'COMPLETED') OR
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

DROP POLICY IF EXISTS p_plans_insert ON relocation_action_plans;
CREATE POLICY p_plans_insert ON relocation_action_plans
    FOR INSERT TO authenticated
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

DROP POLICY IF EXISTS p_plans_update ON relocation_action_plans;
CREATE POLICY p_plans_update ON relocation_action_plans
    FOR UPDATE TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

DROP POLICY IF EXISTS p_plans_delete ON relocation_action_plans;
CREATE POLICY p_plans_delete ON relocation_action_plans
    FOR DELETE TO authenticated
    USING (get_current_user_role() = 'sdma_admin');

-- ------------------------------------------------------------------------------
-- Table 7: risk_assessments (Field AHP Reports)
-- Transparent public read; write restricted to authorized field roles
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_assessments_read ON risk_assessments;
CREATE POLICY p_assessments_read ON risk_assessments
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS p_assessments_write ON risk_assessments;
CREATE POLICY p_assessments_write ON risk_assessments
    FOR ALL TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor')
    );

-- ------------------------------------------------------------------------------
-- Table 8: dataset_imports (Internal Ingestion Registry)
-- Confidential administrative data; restricted to planners and admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_dataset_imports_read ON dataset_imports;
CREATE POLICY p_dataset_imports_read ON dataset_imports
    FOR SELECT TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

DROP POLICY IF EXISTS p_dataset_imports_write ON dataset_imports;
CREATE POLICY p_dataset_imports_write ON dataset_imports
    FOR ALL TO authenticated
    USING (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    )
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner')
    );

-- ------------------------------------------------------------------------------
-- Table 9: spatial_audit_logs (Compliance Trail)
-- Mandatory identity attribution: anonymous/null identities rejected for non-admins
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS p_audit_logs_insert ON spatial_audit_logs;
CREATE POLICY p_audit_logs_insert ON spatial_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (
        get_current_user_role() IN ('sdma_admin', 'district_planner', 'field_surveyor') AND
        (performed_by = auth.uid() OR get_current_user_role() = 'sdma_admin')
    );

DROP POLICY IF EXISTS p_audit_logs_read ON spatial_audit_logs;
CREATE POLICY p_audit_logs_read ON spatial_audit_logs
    FOR SELECT TO authenticated
    USING (get_current_user_role() = 'sdma_admin');

-- ------------------------------------------------------------------------------
-- 4. Table-Level Grants & Defense-in-Depth Write Revocations
-- ------------------------------------------------------------------------------
-- Strip all anonymous mutation privileges at the SQL grant level across public tables
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;

-- Read privileges on public GIS datasets
GRANT SELECT ON public.administrative_boundaries TO authenticated, anon;
GRANT SELECT ON public.vulnerable_settlements TO authenticated, anon;
GRANT SELECT ON public.hazard_zones TO authenticated, anon;
GRANT SELECT ON public.candidate_relocation_sites TO authenticated, anon;
GRANT SELECT ON public.risk_assessments TO authenticated, anon;
GRANT SELECT ON public.relocation_action_plans TO authenticated, anon;

-- Restricted read & write privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dataset_imports TO authenticated;
GRANT SELECT, INSERT ON public.spatial_audit_logs TO authenticated;

-- Operational write privileges on GIS tables for authenticated personnel
GRANT INSERT, UPDATE, DELETE ON public.administrative_boundaries TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vulnerable_settlements TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hazard_zones TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.candidate_relocation_sites TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.relocation_action_plans TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.risk_assessments TO authenticated;


-- ==============================================================================
-- SECTION 5: BASELINE GROUND-TRUTH & BENCHMARK SEED DATA
-- ==============================================================================
-- ==============================================================================
-- SurakshaGIS: Baseline Seed Data (Authentic Verified & Synthetic Benchmark)
-- Seed File: supabase/seed/seed_data.sql
-- ==============================================================================

-- 1. Hazard Zones (Authentic Verified + Benchmark Demo)
INSERT INTO hazard_zones (
    id, hazard_type, severity, return_period_years, description, 
    geom, centroid, buffer_zone_meters, area_sqkm, is_verified, data_source
) VALUES 
-- Verified Wayanad Landslide Red Zone
(
    'a1000000-0000-0000-0000-000000000001',
    'landslide',
    'catastrophic',
    50,
    'High-risk debris flow and slope slip corridor along Meppadi-Chooralmala ridge',
    ST_GeomFromText('POLYGON((76.152 11.532, 76.175 11.545, 76.195 11.528, 76.168 11.512, 76.152 11.532))', 4326),
    ST_GeomFromText('POINT(76.172 11.529)', 4326),
    150,
    14.8,
    true,
    'Geological Survey of India (GSI) NLSM 2024'
),
-- Verified Brahmaputra Riverine Flood Zone
(
    'a1000000-0000-0000-0000-000000000002',
    'riverine_flood',
    'severe',
    25,
    'Annual monsoon riverbank overtopping and alluvial inundation zone',
    ST_GeomFromText('POLYGON((91.745 26.182, 91.795 26.210, 91.830 26.195, 91.770 26.165, 91.745 26.182))', 4326),
    ST_GeomFromText('POINT(91.785 26.188)', 4326),
    200,
    28.4,
    true,
    'Central Water Commission (CWC) Flood Inundation Atlas'
),
-- Verified Chamoli Glacial Cloudburst Zone
(
    'a1000000-0000-0000-0000-000000000003',
    'cloudburst_flash_flood',
    'severe',
    10,
    'Steep-gradient glacial melt ravines vulnerable to sudden cloudburst discharge',
    ST_GeomFromText('POLYGON((79.562 30.551, 79.595 30.575, 79.620 30.548, 79.580 30.529, 79.562 30.551))', 4326),
    ST_GeomFromText('POINT(79.589 30.550)', 4326),
    100,
    11.2,
    true,
    'Wadia Institute of Himalayan Geology (WIHG)'
),
-- Benchmark Demo Coastal Erosion Zone (Unverified)
(
    'a1000000-0000-0000-0000-000000000004',
    'coastal_erosion',
    'high',
    5,
    '[DEMO BENCHMARK SCENARIO] Synthetic 100m shoreline regression under storm surge conditions',
    ST_GeomFromText('POLYGON((74.835 12.915, 74.842 12.950, 74.858 12.945, 74.850 12.910, 74.835 12.915))', 4326),
    ST_GeomFromText('POINT(74.846 12.930)', 4326),
    75,
    6.5,
    false,
    'Synthetic Benchmark Model (Coastal Stress Scenario)'
)
ON CONFLICT (id) DO NOTHING ;
-- 2. Vulnerable Settlements (Habitations)
INSERT INTO vulnerable_settlements (
    id, name, district, subdistrict, geom, total_population, household_count,
    elderly_count, children_count, kuccha_houses_pct, historical_event_count,
    primary_hazard_exposure, calculated_risk_score, priority_horizon, is_verified, data_source
) VALUES
(
    'b1000000-0000-0000-0000-000000000001',
    'Chooralmala Hamlet',
    'Wayanad',
    'Vythiri',
    ST_GeomFromText('POINT(76.165 11.538)', 4326),
    1420,
    312,
    218,
    290,
    78.5,
    4,
    'landslide',
    94.20,
    'immediate',
    true,
    'District Disaster Management Authority (DDMA) Field Survey 2024'
),
(
    'b1000000-0000-0000-0000-000000000002',
    'Mundakkai Settlement',
    'Wayanad',
    'Vythiri',
    ST_GeomFromText('POINT(76.182 11.526)', 4326),
    980,
    215,
    145,
    198,
    82.0,
    5,
    'landslide',
    91.80,
    'immediate',
    true,
    'DDMA Rapid Vulnerability Assessment'
),
(
    'b1000000-0000-0000-0000-000000000003',
    'Kamar Gaon Riverside Ward',
    'Majuli',
    'Ujani',
    ST_GeomFromText('POINT(91.775 26.192)', 4326),
    2640,
    540,
    320,
    480,
    69.0,
    3,
    'riverine_flood',
    78.40,
    'short_term',
    true,
    'Assam State Census Survey & CWC Data'
),
(
    'b1000000-0000-0000-0000-000000000004',
    'Upper Raini Enclave',
    'Chamoli',
    'Joshimath',
    ST_GeomFromText('POINT(79.585 30.542)', 4326),
    650,
    140,
    110,
    135,
    64.0,
    2,
    'cloudburst_flash_flood',
    72.10,
    'short_term',
    true,
    'Uttarakhand Disaster Recovery Project (UDRP)'
),
(
    'b1000000-0000-0000-0000-000000000005',
    'Bengre Sandy Spit Settlement',
    'Dakshina Kannada',
    'Mangaluru',
    ST_GeomFromText('POINT(74.845 12.928)', 4326),
    1150,
    260,
    130,
    210,
    55.0,
    1,
    'coastal_erosion',
    58.60,
    'medium_term',
    false,
    'Synthetic Benchmark Model (Coastal Stress Demo)'
)
ON CONFLICT (id) DO NOTHING ;
-- 3. Candidate Relocation Sites
INSERT INTO candidate_relocation_sites (
    id, site_code, location_name, district, geom, centroid,
    total_area_sqm, usable_area_sqm, avg_slope_degrees,
    distance_to_primary_road_m, distance_to_water_source_m,
    distance_to_nearest_hospital_km, distance_to_nearest_school_km,
    max_carrying_capacity_pop, current_allocated_pop, suitability_score,
    land_ownership_type, is_verified, data_source
) VALUES
(
    'c1000000-0000-0000-0000-000000000001',
    'CRS-WYD-001',
    'Kalpetta North Plateau Parcel',
    'Wayanad',
    ST_GeomFromText('POLYGON((76.082 11.615, 76.098 11.628, 76.115 11.620, 76.095 11.605, 76.082 11.615))', 4326),
    ST_GeomFromText('POINT(76.097 11.617)', 4326),
    185000,
    142000,
    4.8,
    180,
    350,
    3.2,
    1.5,
    3150,
    1420,
    88.5,
    'Government Revenue Land (Unencumbered)',
    true,
    'Kerala Revenue Department Cadastral Record'
),
(
    'c1000000-0000-0000-0000-000000000002',
    'CRS-WYD-002',
    'Nedumbala Safe Tableland',
    'Wayanad',
    ST_GeomFromText('POLYGON((76.115 11.558, 76.130 11.570, 76.142 11.562, 76.128 11.549, 76.115 11.558))', 4326),
    ST_GeomFromText('POINT(76.129 11.560)', 4326),
    95000,
    72000,
    6.2,
    420,
    600,
    6.5,
    2.8,
    1600,
    980,
    79.2,
    'Vested Forest Border Buffer (Reassigned)',
    true,
    'District Collectorate Land Bank Register'
),
(
    'c1000000-0000-0000-0000-000000000003',
    'CRS-CHM-001',
    'Pipalkoti Gentle Terrace',
    'Chamoli',
    ST_GeomFromText('POLYGON((79.425 30.435, 79.440 30.448, 79.455 30.440, 79.438 30.428, 79.425 30.435))', 4326),
    ST_GeomFromText('POINT(79.439 30.438)', 4326),
    120000,
    88000,
    8.5,
    250,
    400,
    4.8,
    1.9,
    1950,
    0,
    82.0,
    'State PWD & Revenue Parcel',
    true,
    'Uttarakhand SDMA Resettlement Audit'
),
(
    'c1000000-0000-0000-0000-000000000004',
    'CRS-DEMO-001',
    'Ullal Inland Elevation Parcel',
    'Dakshina Kannada',
    ST_GeomFromText('POLYGON((74.885 12.835, 74.900 12.848, 74.915 12.840, 74.898 12.825, 74.885 12.835))', 4326),
    ST_GeomFromText('POINT(74.900 12.837)', 4326),
    80000,
    64000,
    3.1,
    300,
    500,
    5.1,
    2.2,
    1400,
    0,
    84.0,
    'Municipal Holding (Hypothetical)',
    false,
    'Synthetic Benchmark Model (Demo Site)'
)
ON CONFLICT (id) DO NOTHING ;
-- 4. Relocation Action Plans
INSERT INTO relocation_action_plans (
    id, plan_code, settlement_id, target_site_id, assigned_horizon,
    households_to_relocate, estimated_budget_inr, justification_summary,
    status, approval_timestamp, created_at
) VALUES
(
    'd1000000-0000-0000-0000-000000000001',
    'RAP-WYD-2024-001',
    'b1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'immediate',
    312,
    468000000.00,
    'Catastrophic debris flow risk during peak monsoon. Immediate evacuation and permanent relocation mandated by SDMA.',
    'SDMA_APPROVED',
    NOW() - INTERVAL '7 days',
    NOW() - INTERVAL '14 days'
),
(
    'd1000000-0000-0000-0000-000000000002',
    'RAP-WYD-2024-002',
    'b1000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000002',
    'immediate',
    215,
    322500000.00,
    'Severe landslide threat on active slip fault. Relocation prioritized to Nedumbala safe ridge tableland.',
    'UNDER_REVIEW',
    NULL,
    NOW() - INTERVAL '4 days'
),
(
    'd1000000-0000-0000-0000-000000000003',
    'RAP-DEMO-2024-003',
    'b1000000-0000-0000-0000-000000000005',
    'c1000000-0000-0000-0000-000000000004',
    'medium_term',
    260,
    312000000.00,
    '[DEMO SCENARIO] Hypothetical coastal erosion scenario relocation for municipal capacity simulation.',
    'DRAFT',
    NULL,
    NOW() - INTERVAL '2 days'
)
ON CONFLICT (id) DO NOTHING ;
-- 5. Dataset Import Registry Log (Phase 4 CSV Ingestion Record)
INSERT INTO dataset_imports (
    id, file_name, file_path, file_size_bytes, total_rows, valid_rows,
    invalid_rows, is_verified_dataset, status, checksum, validation_report_json
) VALUES (
    'e1000000-0000-0000-0000-000000000001',
    'flood_risk_dataset_india.csv',
    'docs/flood_risk_dataset_india.csv',
    1854311,
    10000,
    10000,
    0,
    false,
    'COMPLETED',
    'phase4-validated-sha256',
    '{"validRowsCount": 10000, "invalidRowsCount": 0, "missingValues": 0, "coordinateBounds": {"isWithinIndiaBounds": true}}'::jsonb
)
ON CONFLICT (id) DO NOTHING ;


-- ==============================================================================
-- END OF SURAKSHAGIS CONSOLIDATED DATABASE SETUP
-- ==============================================================================
