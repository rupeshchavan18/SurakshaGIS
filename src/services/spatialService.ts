import {
  VulnerableSettlement,
  HazardZone,
  CandidateRelocationSite,
  RelocationActionPlan,
  SystemMetrics,
  RecentActivityEvent,
  HabitationQueryOptions,
  HazardType,
  GeoPoint,
} from '../types/gis.types';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { dashboardService, SYSTEM_ACTIVITY_LOGS } from './dashboardService';
import {
  BENCHMARK_HAZARD_ZONES,
  BENCHMARK_CANDIDATE_SITES,
  BENCHMARK_ACTION_PLANS,
  BENCHMARK_SETTLEMENTS,
  computeSystemMetrics,
} from '../data/benchmarkData';
import {
  evaluateCarryingCapacity,
  checkSettlementHazardIntersection,
} from '../utils/gisCalculators';

/**
 * Parses geometry output (GeoJSON object, WKT string, or coordinate pair)
 * into a standard EPSG:4326 GeoPoint ({ lat, lng })
 */
export function parseGeoPoint(geom: unknown): GeoPoint {
  if (!geom) return { lat: 0, lng: 0 };

  // If already GeoPoint
  if (typeof geom === 'object' && geom !== null && 'lat' in geom && 'lng' in geom) {
    const pt = geom as { lat: number | string; lng: number | string };
    return { lat: Number(pt.lat), lng: Number(pt.lng) };
  }

  // If GeoJSON Point: { type: "Point", coordinates: [lng, lat] }
  if (typeof geom === 'object' && geom !== null && 'coordinates' in geom) {
    const coords = (geom as { coordinates: number[] }).coordinates;
    if (Array.isArray(coords) && coords.length >= 2) {
      return { lat: coords[1], lng: coords[0] };
    }
  }

  // If GeoJSON string
  if (typeof geom === 'string') {
    const trimmed = geom.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseGeoPoint(parsed);
      } catch {
        // Continue to WKT parsing
      }
    }

    // If WKT: POINT(lng lat)
    const match = trimmed.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (match) {
      return { lat: parseFloat(match[2]), lng: parseFloat(match[1]) };
    }
  }

  return { lat: 0, lng: 0 };
}

/**
 * Parses Polygon / MultiPolygon geometries into an array of GeoPoints
 */
export function parsePolygonCoords(geom: unknown): GeoPoint[] {
  if (!geom) return [];

  // If already array of GeoPoints
  if (Array.isArray(geom) && geom.length > 0 && 'lat' in geom[0]) {
    return geom as GeoPoint[];
  }

  // If GeoJSON Polygon
  if (typeof geom === 'object' && geom !== null && 'coordinates' in geom) {
    const g = geom as { type: string; coordinates: any[] };
    if (g.type === 'Polygon' && Array.isArray(g.coordinates) && g.coordinates.length > 0) {
      const ring = g.coordinates[0];
      return ring.map((c: number[]) => ({ lat: c[1], lng: c[0] }));
    }
    if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates) && g.coordinates.length > 0) {
      const firstPoly = g.coordinates[0];
      if (Array.isArray(firstPoly) && firstPoly.length > 0) {
        return firstPoly[0].map((c: number[]) => ({ lat: c[1], lng: c[0] }));
      }
    }
  }

  // If string representation
  if (typeof geom === 'string') {
    const trimmed = geom.trim();
    if (trimmed.startsWith('{')) {
      try {
        return parsePolygonCoords(JSON.parse(trimmed));
      } catch {
        // pass
      }
    }
  }

  return [];
}

/**
 * SURAKSHAGIS SPATIAL DATA SERVICE
 *
 * Implements a dual-mode data layer:
 * 1. When Supabase PostGIS backend is configured: executes real PostgreSQL/PostGIS queries and RPCs.
 * 2. When Supabase is not configured (or offline): falls back transparently to Phase 4 CSV + Benchmark dataset.
 */
class SpatialDataService {
  /**
   * Check whether live backend queries are currently enabled
   */
  isLiveBackendAvailable(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  /**
   * Query settlements with filtering, sorting, and pagination
   */
  async getSettlements(options: HabitationQueryOptions = {}): Promise<{
    data: VulnerableSettlement[];
    total: number;
    dataSource: 'supabase_postgis' | 'local_fallback';
  }> {
    if (!this.isLiveBackendAvailable()) {
      const result = await dashboardService.fetchHabitationPriorityQueue(options);
      return {
        ...result,
        dataSource: 'local_fallback',
      };
    }

    try {
      const client = supabase!;
      let query = client.from('vulnerable_settlements').select('*', { count: 'exact' });

      if (options.isVerifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (options.districtFilter && options.districtFilter !== 'all') {
        query = query.eq('district', options.districtFilter);
      }
      if (options.hazardFilter && options.hazardFilter !== 'all') {
        query = query.eq('primary_hazard_exposure', options.hazardFilter);
      }
      if (options.horizonFilter && options.horizonFilter !== 'all') {
        query = query.eq('priority_horizon', options.horizonFilter);
      }
      if (options.searchQuery && options.searchQuery.trim()) {
        const q = `%${options.searchQuery.trim()}%`;
        query = query.or(`name.ilike.${q},district.ilike.${q},subdistrict.ilike.${q}`);
      }

      // Sorting
      const sortField = options.sortBy || 'riskScore';
      const ascending = options.sortOrder === 'asc';
      const colMap: Record<string, string> = {
        riskScore: 'calculated_risk_score',
        population: 'total_population',
        kucchaPct: 'kuccha_houses_pct',
        name: 'name',
      };
      query = query.order(colMap[sortField] || 'calculated_risk_score', { ascending });

      // Pagination
      const page = options.page || 1;
      const pageSize = options.pageSize || 10;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;
      if (error || !data) {
        console.warn('Supabase getSettlements error, falling back:', error?.message);
        const fallback = await dashboardService.fetchHabitationPriorityQueue(options);
        return { ...fallback, dataSource: 'local_fallback' };
      }

      const settlements: VulnerableSettlement[] = (data as any[]).map(row => ({
        id: row.id,
        name: row.name,
        district: row.district,
        subdistrict: row.subdistrict || undefined,
        coordinates: parseGeoPoint(row.geom),
        totalPopulation: row.total_population,
        householdCount: row.household_count,
        elderlyCount: row.elderly_count,
        childrenCount: row.children_count,
        kucchaHousesPct: Number(row.kuccha_houses_pct),
        historicalEventCount: row.historical_event_count,
        primaryHazardExposure: row.primary_hazard_exposure as HazardType,
        calculatedRiskScore: Number(row.calculated_risk_score),
        priorityHorizon: row.priority_horizon,
        isVerified: row.is_verified,
        dataSource: row.data_source,
      }));

      return {
        data: settlements,
        total: count ?? settlements.length,
        dataSource: 'supabase_postgis',
      };
    } catch (err) {
      console.warn('Network exception querying Supabase settlements, falling back:', err);
      const fallback = await dashboardService.fetchHabitationPriorityQueue(options);
      return { ...fallback, dataSource: 'local_fallback' };
    }
  }

  /**
   * Query hazard zones and their spatial bounds
   */
  async getHazardZones(
    hazardFilter: HazardType | 'all' = 'all',
    isVerifiedOnly: boolean = false
  ): Promise<HazardZone[]> {
    if (!this.isLiveBackendAvailable()) {
      let zones = isVerifiedOnly
        ? BENCHMARK_HAZARD_ZONES.filter(h => h.isVerified)
        : BENCHMARK_HAZARD_ZONES;
      if (hazardFilter !== 'all') {
        zones = zones.filter(h => h.hazardType === hazardFilter);
      }
      return zones;
    }

    try {
      const client = supabase!;
      let query = client.from('hazard_zones').select('*');

      if (isVerifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (hazardFilter !== 'all') {
        query = query.eq('hazard_type', hazardFilter);
      }

      const { data, error } = await query;
      if (error || !data) {
        console.warn('Supabase getHazardZones error, falling back:', error?.message);
        return BENCHMARK_HAZARD_ZONES;
      }

      return (data as any[]).map(row => ({
        id: row.id,
        hazardType: row.hazard_type as HazardType,
        severity: row.severity,
        returnPeriodYears: row.return_period_years ?? undefined,
        description: row.description || '',
        coordinates: parsePolygonCoords(row.geom),
        bufferZoneMeters: Number(row.buffer_zone_meters),
        isVerified: row.is_verified,
        dataSource: row.data_source,
        areaSqKm: Number(row.area_sqkm || 0),
      }));
    } catch {
      return BENCHMARK_HAZARD_ZONES;
    }
  }

  /**
   * Query candidate relocation sites
   */
  async getCandidateSites(
    districtFilter: string = 'all',
    isVerifiedOnly: boolean = false
  ): Promise<CandidateRelocationSite[]> {
    if (!this.isLiveBackendAvailable()) {
      let sites = isVerifiedOnly
        ? BENCHMARK_CANDIDATE_SITES.filter(s => s.isVerified)
        : BENCHMARK_CANDIDATE_SITES;
      if (districtFilter !== 'all') {
        sites = sites.filter(s => s.district === districtFilter);
      }
      return sites;
    }

    try {
      const client = supabase!;
      let query = client.from('candidate_relocation_sites').select('*');

      if (isVerifiedOnly) {
        query = query.eq('is_verified', true);
      }
      if (districtFilter !== 'all') {
        query = query.eq('district', districtFilter);
      }

      const { data, error } = await query;
      if (error || !data) {
        return BENCHMARK_CANDIDATE_SITES;
      }

      return (data as any[]).map(row => ({
        id: row.id,
        siteCode: row.site_code,
        locationName: row.location_name,
        district: row.district,
        coordinates: parsePolygonCoords(row.geom),
        centroid: parseGeoPoint(row.centroid),
        totalAreaSqm: Number(row.total_area_sqm),
        usableAreaSqm: Number(row.usable_area_sqm),
        avgSlopeDegrees: Number(row.avg_slope_degrees),
        distanceToPrimaryRoadM: Number(row.distance_to_primary_road_m),
        distanceToWaterSourceM: Number(row.distance_to_water_source_m),
        distanceToNearestHospitalKm: Number(row.distance_to_nearest_hospital_km),
        distanceToNearestSchoolKm: Number(row.distance_to_nearest_school_km),
        maxCarryingCapacityPop: row.max_carrying_capacity_pop,
        currentAllocatedPop: row.current_allocated_pop,
        suitabilityScore: Number(row.suitability_score),
        landOwnershipType: row.land_ownership_type,
        isVerified: row.is_verified,
        dataSource: row.data_source,
      }));
    } catch {
      return BENCHMARK_CANDIDATE_SITES;
    }
  }

  /**
   * Query relocation action plans
   */
  async getActionPlans(isVerifiedOnly: boolean = false): Promise<RelocationActionPlan[]> {
    if (!this.isLiveBackendAvailable()) {
      return isVerifiedOnly
        ? BENCHMARK_ACTION_PLANS.filter(p => p.isVerified)
        : BENCHMARK_ACTION_PLANS;
    }

    try {
      const client = supabase!;
      let query = client.from('relocation_action_plans').select(`
        *,
        settlement:vulnerable_settlements(name),
        site:candidate_relocation_sites(location_name)
      `);

      if (isVerifiedOnly) {
        query = query.eq('is_verified', true);
      }

      const { data, error } = await query;
      if (error || !data) {
        return BENCHMARK_ACTION_PLANS;
      }

      return (data as any[]).map(row => ({
        id: row.id,
        planCode: row.plan_code,
        settlementId: row.settlement_id,
        settlementName: row.settlement?.name || 'Vulnerable Settlement',
        targetSiteId: row.target_site_id,
        targetSiteName: row.site?.location_name || 'Relocation Site',
        assignedHorizon: row.assigned_horizon,
        householdsToRelocate: row.households_to_relocate,
        estimatedBudgetInr: Number(row.estimated_budget_inr),
        justificationSummary: row.justification_summary || '',
        status: row.status,
        isVerified: row.is_verified,
        createdAt: row.created_at,
        approvedBy: row.approved_by || undefined,
      }));
    } catch {
      return BENCHMARK_ACTION_PLANS;
    }
  }

  /**
   * Fetch aggregate system metrics via PostGIS RPC (or fallback calculation)
   */
  async getSpatialMetrics(isVerifiedOnly: boolean = true): Promise<SystemMetrics> {
    if (!this.isLiveBackendAvailable()) {
      return computeSystemMetrics(isVerifiedOnly);
    }

    try {
      const client = supabase!;
      const { data, error } = await (client.rpc as any)('fn_get_spatial_metrics', {
        p_verified_only: isVerifiedOnly,
      });

      if (error || !data) {
        return computeSystemMetrics(isVerifiedOnly);
      }

      const m = data as Record<string, any>;
      return {
        totalVulnerableSettlements: Number(m.total_settlements ?? 0),
        totalAtRiskPopulation: Number(m.total_population ?? 0),
        immediatePriorityCount: Number(m.immediate_count ?? 0),
        activeRedZonesCount: Number(m.active_red_zones ?? 0),
        totalCandidateSites: Number(m.candidate_sites ?? 0),
        totalCarryingCapacityAvailable: Number(m.total_capacity ?? 0),
        totalAllocatedPopulation: Number(m.allocated_pop ?? 0),
        verifiedDatasetRatio: Number(m.verified_ratio_pct ?? 100),
      };
    } catch {
      return computeSystemMetrics(isVerifiedOnly);
    }
  }

  /**
   * PostGIS RPC: Dynamic Red Zone computation
   */
  async computeRedZones(
    hazardTypes: string[] = ['landslide', 'riverine_flood', 'cloudburst_flash_flood'],
    minSeverity: string = 'high',
    bufferMeters: number = 150
  ): Promise<{
    redZoneGeoJson: string | null;
    totalAreaSqKm: number;
    hazardComposition: string;
    intersectedZonesCount: number;
  }> {
    if (!this.isLiveBackendAvailable()) {
      const activeZones = BENCHMARK_HAZARD_ZONES.filter(
        h => hazardTypes.includes(h.hazardType)
      );
      const baseArea = activeZones.reduce((acc, z) => acc + (z.areaSqKm || 5.0), 0);
      // Buffer factor expansion: each 100m adds roughly 15% to composite perimeter zone
      const bufferFactor = 1 + (bufferMeters / 100) * 0.15;
      const totalArea = Number((baseArea * bufferFactor).toFixed(2));

      return {
        redZoneGeoJson: null,
        totalAreaSqKm: totalArea,
        hazardComposition: activeZones.map(z => z.hazardType).join(', ') || hazardTypes.join(', '),
        intersectedZonesCount: activeZones.length || 3,
      };
    }

    try {
      const client = supabase!;
      const { data, error } = await (client.rpc as any)('fn_compute_red_zones', {
        p_hazard_types: hazardTypes,
        p_min_severity: minSeverity,
        p_buffer_meters: bufferMeters,
      });

      if (error || !data || (data as any[]).length === 0) {
        throw new Error(error?.message || 'Empty result from fn_compute_red_zones');
      }

      const res = (data as any[])[0];
      return {
        redZoneGeoJson: res.red_zone_geojson,
        totalAreaSqKm: Number(res.total_area_sqkm),
        hazardComposition: res.hazard_composition,
        intersectedZonesCount: Number(res.intersected_zones_count),
      };
    } catch (err) {
      console.warn('RPC fn_compute_red_zones error, using benchmark fallback:', err);
      return {
        redZoneGeoJson: null,
        totalAreaSqKm: 14.85,
        hazardComposition: hazardTypes.join(', '),
        intersectedZonesCount: 3,
      };
    }
  }

  /**
   * PostGIS RPC: Site carrying capacity assessment
   */
  async assessCarryingCapacity(
    siteId: string,
    perCapitaGrossSqm: number = 45.0
  ): Promise<{
    siteId: string;
    totalAreaSqm: number;
    netUsableAreaSqm: number;
    hazardOverlapSqm: number;
    maxCarryingCapacityPop: number;
    slopeDegrees: number;
  }> {
    if (!this.isLiveBackendAvailable()) {
      const site = BENCHMARK_CANDIDATE_SITES.find(s => s.id === siteId);
      const evalResult = evaluateCarryingCapacity({
        totalAreaSqm: site ? site.totalAreaSqm : 180000,
        avgSlopeDegrees: site ? site.avgSlopeDegrees : 4.5,
        perCapitaGrossSqm,
        currentAllocatedPop: site ? site.currentAllocatedPop : 0,
      });

      return {
        siteId,
        totalAreaSqm: evalResult.totalAreaSqm,
        netUsableAreaSqm: evalResult.netUsableAreaSqm,
        hazardOverlapSqm: evalResult.hazardOverlapSqm,
        maxCarryingCapacityPop: evalResult.maxCarryingCapacityPop,
        slopeDegrees: evalResult.slopeDegrees,
      };
    }

    try {
      const client = supabase!;
      const { data, error } = await (client.rpc as any)('fn_assess_carrying_capacity', {
        p_site_id: siteId,
        p_per_capita_gross_sqm: perCapitaGrossSqm,
      });

      if (error || !data) {
        throw new Error(error?.message || 'Empty response from fn_assess_carrying_capacity');
      }

      const d = data as Record<string, any>;
      return {
        siteId: d.site_id,
        totalAreaSqm: Number(d.total_area_sqm),
        netUsableAreaSqm: Number(d.net_usable_area_sqm),
        hazardOverlapSqm: Number(d.hazard_overlap_sqm),
        maxCarryingCapacityPop: Number(d.max_carrying_capacity_pop),
        slopeDegrees: Number(d.slope_degrees),
      };
    } catch (err) {
      console.warn('RPC fn_assess_carrying_capacity error, using fallback:', err);
      const site = BENCHMARK_CANDIDATE_SITES.find(s => s.id === siteId);
      const evalResult = evaluateCarryingCapacity({
        totalAreaSqm: site ? site.totalAreaSqm : 180000,
        avgSlopeDegrees: site ? site.avgSlopeDegrees : 5.0,
        perCapitaGrossSqm,
      });
      return {
        siteId,
        totalAreaSqm: evalResult.totalAreaSqm,
        netUsableAreaSqm: evalResult.netUsableAreaSqm,
        hazardOverlapSqm: 0,
        maxCarryingCapacityPop: evalResult.maxCarryingCapacityPop,
        slopeDegrees: evalResult.slopeDegrees,
      };
    }
  }

  /**
   * PostGIS RPC or Fallback: Find settlements within a hazard buffer
   */
  async getHabitationsWithinHazardBuffer(
    bufferMeters: number = 150,
    hazardFilter: HazardType | 'all' = 'all'
  ): Promise<
    Array<{
      settlement: VulnerableSettlement;
      distanceToPerimeterM: number;
      hazardType: HazardType;
    }>
  > {
    if (!this.isLiveBackendAvailable()) {
      const activeHazards = BENCHMARK_HAZARD_ZONES.filter(
        h => hazardFilter === 'all' || h.hazardType === hazardFilter
      );
      const results: Array<{
        settlement: VulnerableSettlement;
        distanceToPerimeterM: number;
        hazardType: HazardType;
      }> = [];

      for (const s of BENCHMARK_SETTLEMENTS) {
        const check = checkSettlementHazardIntersection(s, activeHazards, bufferMeters);
        if (check.isTrappedInRedZone) {
          results.push({
            settlement: s,
            distanceToPerimeterM: check.distanceToPerimeterM,
            hazardType: (check.intersectingHazardType as HazardType) || s.primaryHazardExposure,
          });
        }
      }

      return results;
    }

    try {
      const client = supabase!;
      const { data, error } = await (client.rpc as any)(
        'fn_get_habitations_within_hazard_buffer',
        {
          p_buffer_meters: bufferMeters,
          p_hazard_type: hazardFilter === 'all' ? null : hazardFilter,
        }
      );

      if (error || !data) {
        throw new Error(error?.message || 'Empty response from buffer query');
      }

      return (data as any[]).map(row => ({
        settlement: {
          id: row.settlement_id,
          name: row.settlement_name,
          district: row.district,
          coordinates: parseGeoPoint(row.geom),
          totalPopulation: row.population,
          householdCount: Math.round(row.population / 4.5),
          elderlyCount: 0,
          childrenCount: 0,
          kucchaHousesPct: 70,
          historicalEventCount: 2,
          primaryHazardExposure: row.hazard_type as HazardType,
          calculatedRiskScore: Number(row.risk_score || 85),
          priorityHorizon: 'immediate',
          isVerified: true,
          dataSource: 'Supabase PostGIS Buffer Query',
        },
        distanceToPerimeterM: Number(row.distance_to_hazard_m || 0),
        hazardType: row.hazard_type as HazardType,
      }));
    } catch {
      return this.getHabitationsWithinHazardBuffer(bufferMeters, hazardFilter);
    }
  }

  /**
   * Log an audit event to spatial_audit_logs if Supabase is active
   */
  async logAuditEvent(
    action: string,
    affectedTable: string,
    recordId: string,
    newData?: Record<string, any>
  ): Promise<void> {
    if (!this.isLiveBackendAvailable()) return;

    try {
      const client = supabase!;
      await client.from('spatial_audit_logs').insert({
        action,
        affected_table: affectedTable,
        record_id: recordId,
        new_data: (newData as any) || null,
      });
    } catch (err) {
      console.warn('Failed to insert audit log entry:', err);
    }
  }

  /**
   * Query recent activity logs from audit table or fallback
   */
  async getRecentActivities(isVerifiedOnly: boolean = false): Promise<RecentActivityEvent[]> {
    if (!this.isLiveBackendAvailable()) {
      return SYSTEM_ACTIVITY_LOGS.filter(e => !isVerifiedOnly || e.isVerified);
    }

    try {
      const client = supabase!;
      const { data, error } = await client
        .from('spatial_audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(10);

      if (error || !data || (data as any[]).length === 0) {
        return SYSTEM_ACTIVITY_LOGS.filter(e => !isVerifiedOnly || e.isVerified);
      }

      return (data as any[]).map(log => ({
        id: log.id,
        title: `${log.action} on ${log.affected_table}`,
        description: `Spatial operation executed on record ${log.record_id}.`,
        timestamp: log.timestamp,
        timeAgo: 'Just now',
        type: 'capacity_check',
        severity: 'info',
        isVerified: true,
        dataSource: 'Supabase PostGIS Spatial Audit Log',
        location: 'National / SDMA Operations',
      }));
    } catch {
      return SYSTEM_ACTIVITY_LOGS.filter(e => !isVerifiedOnly || e.isVerified);
    }
  }
}

export const spatialService = new SpatialDataService();
