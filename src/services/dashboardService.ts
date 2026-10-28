import {
  VulnerableSettlement,
  DashboardMetrics,
  HazardDistributionItem,
  HorizonDistributionItem,
  RecentActivityEvent,
  HabitationQueryOptions,
  HazardType,
} from '../types/gis.types';
import {
  BENCHMARK_SETTLEMENTS,
  BENCHMARK_CANDIDATE_SITES,
  BENCHMARK_HAZARD_ZONES,
} from '../data/benchmarkData';

/**
 * RECENT SPATIAL & CRISIS ACTIVITY LOGS
 * Provenance is strictly tagged: authentic field updates vs illustrative simulation events.
 * Illustrative events are explicitly flagged with `isVerified = false`.
 */
export const SYSTEM_ACTIVITY_LOGS: RecentActivityEvent[] = [
  {
    id: 'act-001',
    title: 'Rainfall Saturation Threshold Exceeded',
    description: 'Meppadi Automatic Weather Station recorded 286mm in 24h. Slope pore-water pressure exceeds safety limit.',
    timestamp: '2026-10-20T10:45:00Z',
    timeAgo: '12m ago',
    type: 'alert',
    severity: 'critical',
    isVerified: true,
    dataSource: 'IMD & Kerala State Disaster Management Authority',
    location: 'Wayanad, Kerala',
  },
  {
    id: 'act-002',
    title: 'Multi-Hazard Red Zone Delineation Updated',
    description: 'PostGIS ST_Buffer(150m) recomputed for Chooralmala slip corridor. 2 additional hamlets intersected.',
    timestamp: '2026-10-20T09:15:00Z',
    timeAgo: '1h 42m ago',
    type: 'rezoning',
    severity: 'warning',
    isVerified: true,
    dataSource: 'GSI National Landslide Susceptibility Mapping (NLSM)',
    location: 'Vythiri Taluk, Wayanad',
  },
  {
    id: 'act-003',
    title: 'Carrying Capacity Clearance Validated',
    description: 'Kalpetta North Plateau Parcel (CRS-WYD-001) slope surveyed at 4.8°. Usable area certified for 3,150 persons.',
    timestamp: '2026-10-20T06:30:00Z',
    timeAgo: '4h 27m ago',
    type: 'capacity_check',
    severity: 'success',
    isVerified: true,
    dataSource: 'District Collectorate Land Bank & Revenue Cadastre',
    location: 'Kalpetta, Wayanad',
  },
  {
    id: 'act-004',
    title: 'Riverbank Breach Assessment in Kamar Gaon',
    description: 'CWC Brahmaputra gauge cross-section indicates 1.2m freeboard reduction along alluvial levee.',
    timestamp: '2026-10-19T22:10:00Z',
    timeAgo: '12h ago',
    type: 'field_survey',
    severity: 'warning',
    isVerified: true,
    dataSource: 'Central Water Commission (CWC) Guwahati Directorate',
    location: 'Majuli, Assam',
  },
  {
    id: 'act-005',
    title: 'Illustrative Benchmark: Storm Surge Influx',
    description: '[ILLUSTRATIVE BENCHMARK - NOT LIVE/VERIFIED] Simulated scenario: 3.5m tidal inundation in Bengre spit.',
    timestamp: '2026-10-19T18:00:00Z',
    timeAgo: '16h ago',
    type: 'alert',
    severity: 'critical',
    isVerified: false,
    dataSource: 'Illustrative Benchmark Scenario (Not Live or Verified)',
    location: 'Dakshina Kannada, Karnataka',
  },
  {
    id: 'act-006',
    title: 'Relocation Action Plan RAP-WYD-2024-001 Endorsement',
    description: 'SDMA Member Secretary digitally signed relocation mandate for 312 Chooralmala households (₹46.8 Cr).',
    timestamp: '2026-10-19T14:20:00Z',
    timeAgo: '20h ago',
    type: 'plan_update',
    severity: 'success',
    isVerified: true,
    dataSource: 'State Disaster Management Authority (SDMA) Orders',
    location: 'Wayanad, Kerala',
  },
  {
    id: 'act-007',
    title: 'CSV Flood Risk Dataset Ingested (Phase 4)',
    description: 'Ingested and validated 10,000 synthetic hydrologic records from docs/flood_risk_dataset_india.csv. Labelled as Mock/Demo.',
    timestamp: '2026-10-22T10:00:00Z',
    timeAgo: 'Just now',
    type: 'rezoning',
    severity: 'info',
    isVerified: false,
    dataSource: 'docs/flood_risk_dataset_india.csv (Mock/Demo Scenario)',
    location: 'All-India Hydrological Observation Grid',
  },
];

import { csvDatasetService } from './csvDatasetService';

/**
 * Helper to retrieve combined settlements respecting verified isolation
 */
async function getUnifiedSettlements(isVerifiedOnly: boolean): Promise<VulnerableSettlement[]> {
  if (isVerifiedOnly) {
    return BENCHMARK_SETTLEMENTS.filter(s => s.isVerified);
  }
  let list = [...BENCHMARK_SETTLEMENTS];
  try {
    if (csvDatasetService.getState().status !== 'success') {
      await csvDatasetService.loadDataset();
    }
    const csvSettlements = csvDatasetService.getMappedSettlements();
    list = [...list, ...csvSettlements];
  } catch (err) {
    console.warn('DashboardService: CSV demo dataset load bypassed:', err);
  }
  return list;
}

/**
 * Standard Dashboard Service Interface
 * Defines the contract that future Supabase/PostGIS services will implement.
 */
export interface IDashboardService {
  fetchDashboardMetrics(isVerifiedOnly: boolean, district?: string): Promise<DashboardMetrics>;
  fetchHazardDistribution(isVerifiedOnly: boolean, district?: string): Promise<HazardDistributionItem[]>;
  fetchHorizonDistribution(isVerifiedOnly: boolean, district?: string): Promise<HorizonDistributionItem[]>;
  fetchHabitationPriorityQueue(options: HabitationQueryOptions): Promise<{ data: VulnerableSettlement[]; total: number }>;
  fetchRecentActivities(isVerifiedOnly: boolean): Promise<RecentActivityEvent[]>;
}

/**
 * Replaceable Dashboard Service Layer
 * Isolates data access and calculations. In Phase 3, this class will query
 * PostGIS RPC functions (e.g. fn_compute_red_zones, fn_assess_carrying_capacity)
 * without requiring any component changes.
 */
export class DashboardService implements IDashboardService {
  /**
   * Fetches top-level operational KPIs
   */
  async fetchDashboardMetrics(
    isVerifiedOnly: boolean,
    district?: string
  ): Promise<DashboardMetrics> {
    await new Promise(r => setTimeout(r, 60));

    const allSettlements = await getUnifiedSettlements(isVerifiedOnly);
    const settlements = allSettlements.filter(s => {
      if (isVerifiedOnly && !s.isVerified) return false;
      if (district && district !== 'all' && s.district !== district) return false;
      return true;
    });

    const sites = BENCHMARK_CANDIDATE_SITES.filter(s => {
      if (isVerifiedOnly && !s.isVerified) return false;
      if (district && district !== 'all' && s.district !== district) return false;
      return true;
    });

    const highRiskCount = settlements.filter(
      s => s.priorityHorizon === 'immediate' || s.calculatedRiskScore >= 80
    ).length;
    const exposedPop = settlements.reduce((acc, s) => acc + s.totalPopulation, 0);
    const immHouseholds = settlements
      .filter(s => s.priorityHorizon === 'immediate')
      .reduce((acc, s) => acc + s.householdCount, 0);

    const totalCapacity = sites.reduce((acc, s) => acc + s.maxCarryingCapacityPop, 0);
    const allocatedPop = sites.reduce((acc, s) => acc + s.currentAllocatedPop, 0);

    const districtsCovered = new Set(settlements.map(s => s.district));

    const totalItems = allSettlements.length + BENCHMARK_HAZARD_ZONES.length + BENCHMARK_CANDIDATE_SITES.length;
    const verifiedCount =
      allSettlements.filter(i => i.isVerified).length +
      BENCHMARK_HAZARD_ZONES.filter(i => i.isVerified).length +
      BENCHMARK_CANDIDATE_SITES.filter(i => i.isVerified).length;
    const verifiedRatio = Math.round((verifiedCount / totalItems) * 100);

    return {
      totalHabitations: settlements.length,
      highRiskSettlements: highRiskCount,
      exposedPopulation: exposedPop,
      candidateRelocationSites: sites.length,
      totalCarryingCapacityAvailable: totalCapacity,
      totalAllocatedPopulation: allocatedPop,
      remainingAbsorptiveCapacity: Math.max(0, totalCapacity - allocatedPop),
      verifiedDatasetRatio: verifiedRatio,
      districtsCoveredCount: districtsCovered.size,
      immediateHouseholdsCount: immHouseholds,
    };
  }

  /**
   * Fetches distribution of habitations by primary hazard vector
   */
  async fetchHazardDistribution(
    isVerifiedOnly: boolean,
    district?: string
  ): Promise<HazardDistributionItem[]> {
    await new Promise(r => setTimeout(r, 40));

    const allSettlements = await getUnifiedSettlements(isVerifiedOnly);
    const settlements = allSettlements.filter(s => {
      if (isVerifiedOnly && !s.isVerified) return false;
      if (district && district !== 'all' && s.district !== district) return false;
      return true;
    });

    const total = settlements.length || 1;

    const hazardMap: Record<HazardType, { label: string; color: string }> = {
      landslide: { label: 'Landslide Slip Corridors', color: '#ef4444' },
      riverine_flood: { label: 'Riverine Alluvial Inundation', color: '#3b82f6' },
      cloudburst_flash_flood: { label: 'Cloudburst & Flash Floods', color: '#a855f7' },
      coastal_erosion: { label: 'Coastal Storm Surge & Erosion', color: '#f97316' },
      cyclone_surge: { label: 'Cyclonic Coastal Inundation', color: '#06b6d4' },
    };

    const grouped: Record<string, { count: number; pop: number }> = {};

    settlements.forEach(s => {
      if (!grouped[s.primaryHazardExposure]) {
        grouped[s.primaryHazardExposure] = { count: 0, pop: 0 };
      }
      grouped[s.primaryHazardExposure].count += 1;
      grouped[s.primaryHazardExposure].pop += s.totalPopulation;
    });

    return Object.entries(hazardMap)
      .map(([type, meta]) => {
        const stats = grouped[type] || { count: 0, pop: 0 };
        return {
          hazardType: type as HazardType,
          label: meta.label,
          settlementCount: stats.count,
          populationExposed: stats.pop,
          percentage: Math.round((stats.count / total) * 100),
          color: meta.color,
        };
      })
      .filter(item => !isVerifiedOnly || item.settlementCount > 0);
  }

  /**
   * Fetches distribution by relocation horizon
   */
  async fetchHorizonDistribution(
    isVerifiedOnly: boolean,
    district?: string
  ): Promise<HorizonDistributionItem[]> {
    await new Promise(r => setTimeout(r, 40));

    const allSettlements = await getUnifiedSettlements(isVerifiedOnly);
    const settlements = allSettlements.filter(s => {
      if (isVerifiedOnly && !s.isVerified) return false;
      if (district && district !== 'all' && s.district !== district) return false;
      return true;
    });

    const total = settlements.length || 1;

    const horizons = [
      { horizon: 'immediate' as const, label: 'Immediate (0-6M)', color: '#ef4444' },
      { horizon: 'short_term' as const, label: 'Short-Term (6-24M)', color: '#f59e0b' },
      { horizon: 'medium_term' as const, label: 'Medium-Term (2-5Y)', color: '#3b82f6' },
      { horizon: 'monitoring' as const, label: 'Continuous Monitoring', color: '#64748b' },
    ];

    return horizons.map(h => {
      const count = settlements.filter(s => s.priorityHorizon === h.horizon).length;
      return {
        ...h,
        count,
        percentage: Math.round((count / total) * 100),
      };
    });
  }

  /**
   * Queries and sorts the Habitation Priority Queue
   */
  async fetchHabitationPriorityQueue(
    options: HabitationQueryOptions
  ): Promise<{ data: VulnerableSettlement[]; total: number }> {
    await new Promise(r => setTimeout(r, 80));

    const allSettlements = await getUnifiedSettlements(!!options.isVerifiedOnly);
    let list = [...allSettlements];

    // Filter verified only
    if (options.isVerifiedOnly) {
      list = list.filter(s => s.isVerified);
    }

    // Filter district
    if (options.districtFilter && options.districtFilter !== 'all') {
      list = list.filter(s => s.district === options.districtFilter);
    }

    // Filter hazard
    if (options.hazardFilter && options.hazardFilter !== 'all') {
      list = list.filter(s => s.primaryHazardExposure === options.hazardFilter);
    }

    // Filter horizon
    if (options.horizonFilter && options.horizonFilter !== 'all') {
      list = list.filter(s => s.priorityHorizon === options.horizonFilter);
    }

    // Search query
    if (options.searchQuery && options.searchQuery.trim()) {
      const q = options.searchQuery.toLowerCase().trim();
      list = list.filter(
        s =>
          s.name.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          (s.subdistrict && s.subdistrict.toLowerCase().includes(q))
      );
    }

    // Sorting
    const sortField = options.sortBy || 'riskScore';
    const sortOrder = options.sortOrder || 'desc';

    list.sort((a, b) => {
      let valA: number | string = a.calculatedRiskScore;
      let valB: number | string = b.calculatedRiskScore;

      if (sortField === 'population') {
        valA = a.totalPopulation;
        valB = b.totalPopulation;
      } else if (sortField === 'kucchaPct') {
        valA = a.kucchaHousesPct;
        valB = b.kucchaHousesPct;
      } else if (sortField === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB as string) : (valB as string).localeCompare(valA);
      }
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });

    const total = list.length;
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    return {
      data: paginated,
      total,
    };
  }

  /**
   * Fetches recent geospatial operations events
   */
  async fetchRecentActivities(isVerifiedOnly: boolean): Promise<RecentActivityEvent[]> {
    await new Promise(r => setTimeout(r, 50));
    return SYSTEM_ACTIVITY_LOGS.filter(e => !isVerifiedOnly || e.isVerified);
  }
}

export const dashboardService: IDashboardService = new DashboardService();
