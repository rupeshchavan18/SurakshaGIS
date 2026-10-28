import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  NavRoute,
  UserRole,
  HazardType,
  HazardZone,
  VulnerableSettlement,
  CandidateRelocationSite,
  RelocationActionPlan,
  SystemMetrics,
} from '../types/gis.types';
import {
  BENCHMARK_HAZARD_ZONES,
  BENCHMARK_SETTLEMENTS,
  BENCHMARK_CANDIDATE_SITES,
  BENCHMARK_ACTION_PLANS,
  computeSystemMetrics,
} from '../data/benchmarkData';
import {
  CsvLoadState,
  CsvValidationReport,
  ValidatedFloodRiskRecord,
} from '../types/csvDataset.types';
import { csvDatasetService } from '../services/csvDatasetService';
import {
  isSupabaseConfigured as checkSupabaseConfigured,
  testSupabaseConnection,
  ConnectionTestResult,
  supabase,
} from '../services/supabaseClient';
import { computeSettlementAhpScore } from '../utils/gisCalculators';

export type AppTheme = 'dark' | 'light';

export interface AuditLogEntry {
  id: string;
  action: string;
  title: string;
  details: string;
  timestamp: string;
  role: string;
}

interface AppContextType {
  currentRoute: NavRoute;
  setCurrentRoute: (route: NavRoute) => void;
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  isVerifiedOnly: boolean;
  setIsVerifiedOnly: (val: boolean) => void;
  selectedDistrict: string;
  setSelectedDistrict: (dist: string) => void;
  selectedHazard: HazardType | 'all';
  setSelectedHazard: (hazard: HazardType | 'all') => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean | ((prev: boolean) => boolean)) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;

  // Theme Management (Phase 5)
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (t: AppTheme) => void;

  // Filtered data accessors
  hazardZones: HazardZone[];
  settlements: VulnerableSettlement[];
  candidateSites: CandidateRelocationSite[];
  actionPlans: RelocationActionPlan[];
  metrics: SystemMetrics;
  districts: string[];

  // Phase 4 CSV Dataset Integration properties
  csvStatus: CsvLoadState;
  csvError: string | null;
  csvValidationReport: CsvValidationReport | null;
  csvRecordCount: number;
  csvSourcePath: string;
  reloadCsvDataset: (customPath?: string) => Promise<void>;
  csvRawRecords: ValidatedFloodRiskRecord[];

  // Phase 5 Backend & PostGIS Database state
  isSupabaseConfigured: boolean;
  supabaseConnected: boolean | null;
  backendMode: 'supabase_postgis' | 'local_fallback';
  backendMessage: string;
  backendLatencyMs: number | null;
  isTestingBackend: boolean;
  testBackendConnection: () => Promise<ConnectionTestResult>;
  persistenceStorageType: 'remote_supabase' | 'browser_local_storage';

  // Phase 6 SDMA Governance, Dynamic AHP & Spatial Evaluation
  ahpWeights: { hazard: number; demographic: number; history: number };
  setAhpWeights: (w: { hazard: number; demographic: number; history: number }) => void;
  hazardBufferMeters: number;
  setHazardBufferMeters: (buffer: number) => void;
  addCandidateSite: (site: CandidateRelocationSite) => void;
  addActionPlan: (plan: RelocationActionPlan) => void;
  updateActionPlanStatus: (planId: string, status: RelocationActionPlan['status'], approvedBy?: string) => void;
  auditLogs: AuditLogEntry[];
  addAuditLog: (action: string, title: string, details: string) => void;
  resetAllCustomData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_THEME = 'suraksha_theme';
const LOCAL_STORAGE_KEY_PLANS = 'suraksha_action_plans';
const LOCAL_STORAGE_KEY_SITES = 'suraksha_candidate_sites';
const LOCAL_STORAGE_KEY_LOGS = 'suraksha_audit_logs';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<NavRoute>('dashboard');
  const [userRole, setUserRole] = useState<UserRole>('sdma_admin');
  const [isVerifiedOnly, setIsVerifiedOnly] = useState<boolean>(true);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
  const [selectedHazard, setSelectedHazard] = useState<HazardType | 'all'>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // 1. Theme State Initialization with local storage persistence
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_THEME, newTheme);
    } catch {}
    if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Sync HTML root on initial mount
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  // Phase 6 Dynamic AHP Criteria Weights (default: 40% hazard, 35% demographics, 25% history)
  const [ahpWeights, setAhpWeights] = useState({ hazard: 40, demographic: 35, history: 25 });
  const [hazardBufferMeters, setHazardBufferMeters] = useState<number>(150);

  // Relocation Action Plans & Candidate Sites State with localStorage Persistence
  const [actionPlansList, setActionPlansList] = useState<RelocationActionPlan[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PLANS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return BENCHMARK_ACTION_PLANS;
  });

  const [candidateSitesList, setCandidateSitesList] = useState<CandidateRelocationSite[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_SITES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return BENCHMARK_CANDIDATE_SITES;
  });

  // Administrative Audit Logs with Persistence
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'log-001',
        action: 'SDMA_FINAL_ENDORSEMENT',
        title: 'RAP-WYD-2024-001 Endorsed under DM Act 2005',
        details: 'Digital sign-off for Chooralmala Hamlet relocation to Kalpetta North Plateau Parcel.',
        timestamp: '2026-10-15 09:30 IST',
        role: 'SDMA Member Secretary',
      },
      {
        id: 'log-002',
        action: 'POSTGIS_RED_ZONE_CALCULATION',
        title: 'PostGIS Red Zone Recalculation (150m buffer)',
        details: 'Spatial union evaluated on Wayanad debris-flow corridor.',
        timestamp: '2026-10-18 14:15 IST',
        role: 'System PostGIS RPC',
      },
      {
        id: 'log-003',
        action: 'PARCEL_VALIDATION',
        title: 'Candidate Parcel CRS-WYD-002 Cleared',
        details: 'Nedumbala Safe Tableland slope clearance validated at 6.2° (≤ 15° threshold).',
        timestamp: '2026-10-19 11:00 IST',
        role: 'District Disaster Planner',
      },
    ];
  });

  // Sync changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PLANS, JSON.stringify(actionPlansList));
    } catch {}
  }, [actionPlansList]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_SITES, JSON.stringify(candidateSitesList));
    } catch {}
  }, [candidateSitesList]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  const addAuditLog = useCallback((action: string, title: string, details: string) => {
    const newEntry: AuditLogEntry = {
      id: `log-${Date.now()}`,
      action,
      title,
      details,
      timestamp:
        new Date().toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }) +
        ' ' +
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
        }) +
        ' IST',
      role:
        userRole === 'sdma_admin'
          ? 'SDMA Administrator'
          : userRole === 'district_planner'
          ? 'District Planner'
          : 'Field Surveyor',
    };
    setAuditLogs(prev => [newEntry, ...prev]);
  }, [userRole]);

  // Phase 5 Backend & PostGIS State
  const isConfigured = useMemo(() => checkSupabaseConfigured(), []);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [backendLatencyMs, setBackendLatencyMs] = useState<number | null>(null);
  const [isTestingBackend, setIsTestingBackend] = useState<boolean>(false);
  const [backendMessage, setBackendMessage] = useState<string>(
    isConfigured
      ? 'Supabase URL/Anon key configured; verifying connection...'
      : 'Running in local CSV/benchmark fallback mode (VITE_SUPABASE_URL unconfigured).'
  );

  const testBackendConnection = useCallback(async (): Promise<ConnectionTestResult> => {
    setIsTestingBackend(true);
    try {
      const res = await testSupabaseConnection();
      setSupabaseConnected(res.success);
      setBackendMessage(res.message);
      setBackendLatencyMs(res.latencyMs ?? null);
      return res;
    } finally {
      setIsTestingBackend(false);
    }
  }, []);

  useEffect(() => {
    if (isConfigured) {
      testBackendConnection();
    } else {
      setSupabaseConnected(false);
    }
  }, [isConfigured, testBackendConnection]);

  const backendMode: 'supabase_postgis' | 'local_fallback' =
    isConfigured && supabaseConnected ? 'supabase_postgis' : 'local_fallback';

  const persistenceStorageType = backendMode === 'supabase_postgis' ? 'remote_supabase' : 'browser_local_storage';

  const addCandidateSite = useCallback(async (site: CandidateRelocationSite) => {
    setCandidateSitesList(prev => [site, ...prev]);
    addAuditLog(
      'PARCEL_PROPOSED',
      `New Relocation Parcel Proposed: ${site.locationName} (${site.siteCode})`,
      `District: ${site.district}, Usable Area: ${(site.usableAreaSqm / 1000).toFixed(0)}k m², Max Capacity: ${site.maxCarryingCapacityPop} pop, Avg Slope: ${site.avgSlopeDegrees}°. Persisted to ${persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Browser Storage'}.`
    );

    // If Supabase is connected, attempt remote insert
    if (supabase && backendMode === 'supabase_postgis') {
      try {
        await supabase.from('candidate_relocation_sites').insert({
          site_code: site.siteCode,
          location_name: site.locationName,
          district: site.district,
          total_area_sqm: site.totalAreaSqm,
          usable_area_sqm: site.usableAreaSqm,
          avg_slope_degrees: site.avgSlopeDegrees,
          distance_to_primary_road_m: site.distanceToPrimaryRoadM,
          distance_to_water_source_m: site.distanceToWaterSourceM,
          distance_to_nearest_hospital_km: site.distanceToNearestHospitalKm,
          distance_to_nearest_school_km: site.distanceToNearestSchoolKm,
          max_carrying_capacity_pop: site.maxCarryingCapacityPop,
          current_allocated_pop: site.currentAllocatedPop,
          suitability_score: site.suitabilityScore,
          land_ownership_type: site.landOwnershipType,
          is_verified: site.isVerified,
          data_source: site.dataSource,
          geom: `POINT(${site.centroid.lng} ${site.centroid.lat})` as unknown as Record<string, unknown>,
          centroid: `POINT(${site.centroid.lng} ${site.centroid.lat})` as unknown as Record<string, unknown>,
        });
      } catch (err) {
        console.warn('Could not persist site to remote Supabase; preserved in local storage:', err);
      }
    }
  }, [addAuditLog, backendMode, persistenceStorageType]);

  const addActionPlan = useCallback(async (newPlan: RelocationActionPlan) => {
    setActionPlansList(prev => [newPlan, ...prev]);
    addAuditLog(
      'PLAN_CREATED',
      `Relocation Action Plan ${newPlan.planCode} Created`,
      `Allocated ${newPlan.settlementName} (${newPlan.householdsToRelocate} families) to ${newPlan.targetSiteName} under horizon ${newPlan.assignedHorizon.toUpperCase()}. Budget: ₹${(newPlan.estimatedBudgetInr / 10000000).toFixed(2)} Cr. Persisted to ${persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Browser Storage'}.`
    );

    // If Supabase is connected, attempt remote insert
    if (supabase && backendMode === 'supabase_postgis') {
      try {
        await supabase.from('relocation_action_plans').insert({
          plan_code: newPlan.planCode,
          settlement_id: newPlan.settlementId,
          target_site_id: newPlan.targetSiteId,
          assigned_horizon: newPlan.assignedHorizon,
          households_to_relocate: newPlan.householdsToRelocate,
          estimated_budget_inr: newPlan.estimatedBudgetInr,
          justification_summary: newPlan.justificationSummary,
          status: newPlan.status,
          is_verified: newPlan.isVerified,
        });
      } catch (err) {
        console.warn('Could not persist action plan to remote Supabase; preserved in local storage:', err);
      }
    }
  }, [addAuditLog, backendMode, persistenceStorageType]);

  const updateActionPlanStatus = useCallback(async (
    planId: string,
    status: RelocationActionPlan['status'],
    approvedBy?: string
  ) => {
    setActionPlansList(prev =>
      prev.map(p =>
        p.id === planId
          ? {
              ...p,
              status,
              approvedBy: approvedBy || p.approvedBy,
            }
          : p
      )
    );
    addAuditLog(
      'PLAN_ENDORSED',
      `Plan ${planId} Status Updated to ${status}`,
      `Digital sign-off performed by ${approvedBy || userRole}. Persisted to ${persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Browser Storage'}.`
    );

    if (supabase && backendMode === 'supabase_postgis') {
      try {
        await supabase
          .from('relocation_action_plans')
          .update({
            status,
            approved_by: approvedBy || null,
            approval_date: new Date().toISOString(),
          })
          .eq('id', planId);
      } catch (err) {
        console.warn('Could not update plan status in remote Supabase; preserved in local storage:', err);
      }
    }
  }, [addAuditLog, userRole, backendMode, persistenceStorageType]);

  const resetAllCustomData = useCallback(() => {
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY_PLANS);
      localStorage.removeItem(LOCAL_STORAGE_KEY_SITES);
      localStorage.removeItem(LOCAL_STORAGE_KEY_LOGS);
    } catch {}
    setActionPlansList(BENCHMARK_ACTION_PLANS);
    setCandidateSitesList(BENCHMARK_CANDIDATE_SITES);
    addAuditLog('DATA_RESET', 'Relocation Data Reset to Benchmark Baseline', 'User restored original cadastral benchmark parcels and statutory plans.');
  }, [addAuditLog]);

  // CSV dataset state
  const [csvStatus, setCsvStatus] = useState<CsvLoadState>('idle');
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvValidationReport, setCsvValidationReport] = useState<CsvValidationReport | null>(null);
  const [csvSettlements, setCsvSettlements] = useState<VulnerableSettlement[]>([]);
  const [csvHazardZones, setCsvHazardZones] = useState<HazardZone[]>([]);
  const [csvRawRecords, setCsvRawRecords] = useState<ValidatedFloodRiskRecord[]>([]);
  const [csvSourcePath, setCsvSourcePath] = useState<string>(csvDatasetService.getSourcePath());

  // Function to load / reload CSV dataset
  const reloadCsvDataset = useCallback(async (customPath?: string) => {
    setCsvStatus('loading');
    setCsvError(null);
    try {
      if (customPath) {
        csvDatasetService.setSourcePath(customPath);
        setCsvSourcePath(customPath);
      }
      const records = await csvDatasetService.loadDataset({
        forceReload: true,
        path: customPath,
      });
      setCsvRawRecords(records);
      setCsvSettlements(csvDatasetService.getMappedSettlements());
      setCsvHazardZones(csvDatasetService.getMappedHazardZones(30));
      setCsvValidationReport(csvDatasetService.getValidationReport());
      setCsvStatus(records.length === 0 ? 'empty' : 'success');
    } catch (err) {
      setCsvStatus('error');
      setCsvError(err instanceof Error ? err.message : 'Failed to parse CSV dataset');
      setCsvSettlements([]);
      setCsvHazardZones([]);
      setCsvValidationReport(null);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    reloadCsvDataset();
  }, [reloadCsvDataset]);

  // Combined available districts from dataset (benchmark + CSV demo sectors when in demo mode)
  const districts = useMemo(() => {
    const set = new Set<string>();
    BENCHMARK_SETTLEMENTS.forEach(s => {
      if (!isVerifiedOnly || s.isVerified) set.add(s.district);
    });
    candidateSitesList.forEach(s => {
      if (!isVerifiedOnly || s.isVerified) set.add(s.district);
    });
    if (!isVerifiedOnly && csvSettlements.length > 0) {
      csvSettlements.forEach(s => set.add(s.district));
    }
    return ['all', ...Array.from(set)];
  }, [isVerifiedOnly, csvSettlements, candidateSitesList]);

  // Combined & Filtered Hazard Zones
  const hazardZones = useMemo(() => {
    const base = isVerifiedOnly
      ? BENCHMARK_HAZARD_ZONES.filter(h => h.isVerified)
      : [...BENCHMARK_HAZARD_ZONES, ...csvHazardZones];

    return base.filter(h => {
      if (selectedHazard !== 'all' && h.hazardType !== selectedHazard) return false;
      return true;
    });
  }, [isVerifiedOnly, selectedHazard, csvHazardZones]);

  // Combined & Filtered Settlements with Dynamic AHP Multi-Criteria Scoring
  const settlements = useMemo(() => {
    const base = isVerifiedOnly
      ? BENCHMARK_SETTLEMENTS.filter(s => s.isVerified)
      : [...BENCHMARK_SETTLEMENTS, ...csvSettlements.slice(0, 200)]; // Top 200 representative demo points

    return base
      .map(s => {
        const { score, horizon } = computeSettlementAhpScore(
          s,
          ahpWeights.hazard,
          ahpWeights.demographic,
          ahpWeights.history
        );
        return {
          ...s,
          calculatedRiskScore: score,
          priorityHorizon: horizon,
        };
      })
      .filter(s => {
        if (selectedDistrict !== 'all' && s.district !== selectedDistrict) return false;
        if (selectedHazard !== 'all' && s.primaryHazardExposure !== selectedHazard) return false;
        return true;
      });
  }, [isVerifiedOnly, selectedDistrict, selectedHazard, csvSettlements, ahpWeights]);

  // Filtered Candidate Sites
  const candidateSites = useMemo(() => {
    return candidateSitesList.filter(s => {
      if (isVerifiedOnly && !s.isVerified) return false;
      if (selectedDistrict !== 'all' && s.district !== selectedDistrict) return false;
      return true;
    });
  }, [isVerifiedOnly, selectedDistrict, candidateSitesList]);

  // Filtered Action Plans
  const actionPlans = useMemo(() => {
    return actionPlansList.filter(p => {
      if (isVerifiedOnly && !p.isVerified) return false;
      return true;
    });
  }, [isVerifiedOnly, actionPlansList]);

  // Metrics based on verified filter & dynamic AHP prioritization
  const metrics = useMemo(() => {
    if (isVerifiedOnly) {
      return computeSystemMetrics(true);
    }

    // Extended system metrics including all loaded CSV records
    const allSettlements = [...BENCHMARK_SETTLEMENTS, ...csvSettlements];
    const sites = candidateSitesList;
    const hazards = [...BENCHMARK_HAZARD_ZONES, ...csvHazardZones];

    const totalPop = allSettlements.reduce((acc, s) => acc + s.totalPopulation, 0);
    const immCount = settlements.filter(s => s.priorityHorizon === 'immediate').length;
    const totalCapacity = sites.reduce((acc, s) => acc + s.maxCarryingCapacityPop, 0);
    const allocatedPop = sites.reduce((acc, s) => acc + s.currentAllocatedPop, 0);

    const totalItems = allSettlements.length + hazards.length + sites.length;
    const verifiedItems = [
      ...BENCHMARK_SETTLEMENTS,
      ...BENCHMARK_HAZARD_ZONES,
      ...candidateSitesList,
    ].filter(i => i.isVerified).length;

    return {
      totalVulnerableSettlements: allSettlements.length,
      totalAtRiskPopulation: totalPop,
      immediatePriorityCount: immCount,
      activeRedZonesCount: hazards.length,
      totalCandidateSites: sites.length,
      totalCarryingCapacityAvailable: totalCapacity,
      totalAllocatedPopulation: allocatedPop,
      verifiedDatasetRatio: Math.max(1, Math.round((verifiedItems / totalItems) * 100)),
    };
  }, [isVerifiedOnly, csvSettlements, csvHazardZones, settlements, candidateSitesList]);

  const value: AppContextType = {
    currentRoute,
    setCurrentRoute,
    userRole,
    setUserRole,
    isVerifiedOnly,
    setIsVerifiedOnly,
    selectedDistrict,
    setSelectedDistrict,
    selectedHazard,
    setSelectedHazard,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileMenuOpen,
    setMobileMenuOpen,

    // Theme
    theme,
    toggleTheme,
    setTheme,

    hazardZones,
    settlements,
    candidateSites,
    actionPlans,
    metrics,
    districts,
    csvStatus,
    csvError,
    csvValidationReport,
    csvRecordCount: csvRawRecords.length,
    csvSourcePath,
    reloadCsvDataset,
    csvRawRecords,

    // Phase 5 Backend & PostGIS Database state
    isSupabaseConfigured: isConfigured,
    supabaseConnected,
    backendMode,
    backendMessage,
    backendLatencyMs,
    isTestingBackend,
    testBackendConnection,
    persistenceStorageType,

    // Phase 6 SDMA Governance, Dynamic AHP & Spatial Evaluation
    ahpWeights,
    setAhpWeights,
    hazardBufferMeters,
    setHazardBufferMeters,
    addCandidateSite,
    addActionPlan,
    updateActionPlanStatus,
    auditLogs,
    addAuditLog,
    resetAllCustomData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
