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
