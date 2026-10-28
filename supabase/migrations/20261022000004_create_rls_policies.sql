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
