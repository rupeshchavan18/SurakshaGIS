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
