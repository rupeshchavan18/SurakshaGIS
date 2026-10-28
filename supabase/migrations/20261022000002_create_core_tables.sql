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
