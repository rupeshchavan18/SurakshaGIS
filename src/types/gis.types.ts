export type HazardType =
  | 'landslide'
  | 'riverine_flood'
  | 'cloudburst_flash_flood'
  | 'coastal_erosion'
  | 'cyclone_surge';

export type SeverityLevel = 'low' | 'moderate' | 'high' | 'severe' | 'catastrophic';

export type PriorityHorizon = 'immediate' | 'short_term' | 'medium_term' | 'monitoring';

export type UserRole = 'sdma_admin' | 'district_planner' | 'field_surveyor' | 'public_viewer';

export type NavRoute =
  | 'dashboard'
  | 'hazard-map'
  | 'risk-assessment'
  | 'relocation-sites'
  | 'priority-planning'
  | 'reports'
  | 'dataset-integration';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface HazardZone {
  id: string;
  hazardType: HazardType;
  severity: SeverityLevel;
  returnPeriodYears?: number;
  description: string;
  coordinates: GeoPoint[];
  bufferZoneMeters: number;
  isVerified: boolean;
  dataSource: string;
  verifiedBy?: string;
  areaSqKm: number;
}

export interface VulnerableSettlement {
  id: string;
  name: string;
  district: string;
  subdistrict?: string;
  coordinates: GeoPoint;
  totalPopulation: number;
  householdCount: number;
  elderlyCount: number;
  childrenCount: number;
  kucchaHousesPct: number;
  historicalEventCount: number;
  primaryHazardExposure: HazardType;
  calculatedRiskScore: number; // 0 - 100
  priorityHorizon: PriorityHorizon;
  isVerified: boolean;
  dataSource: string;
}

export interface CandidateRelocationSite {
  id: string;
  siteCode: string;
  locationName: string;
  district: string;
  coordinates: GeoPoint[];
  centroid: GeoPoint;
  totalAreaSqm: number;
  usableAreaSqm: number;
  avgSlopeDegrees: number;
  distanceToPrimaryRoadM: number;
  distanceToWaterSourceM: number;
  distanceToNearestHospitalKm: number;
  distanceToNearestSchoolKm: number;
  maxCarryingCapacityPop: number;
  currentAllocatedPop: number;
  suitabilityScore: number; // 0 - 100
  landOwnershipType: string;
  isVerified: boolean;
  dataSource: string;
}

export interface RelocationActionPlan {
  id: string;
  planCode: string;
  settlementId: string;
  settlementName: string;
  targetSiteId: string;
  targetSiteName: string;
  assignedHorizon: PriorityHorizon;
  householdsToRelocate: number;
  estimatedBudgetInr: number;
  justificationSummary: string;
  status: 'DRAFT' | 'UNDER_REVIEW' | 'SDMA_APPROVED' | 'EXECUTING' | 'COMPLETED';
  isVerified: boolean;
  createdAt: string;
  approvedBy?: string;
}

export interface SystemMetrics {
  totalVulnerableSettlements: number;
  totalAtRiskPopulation: number;
  immediatePriorityCount: number;
  activeRedZonesCount: number;
  totalCandidateSites: number;
  totalCarryingCapacityAvailable: number;
  totalAllocatedPopulation: number;
  verifiedDatasetRatio: number; // 0 - 100
}

export interface DashboardMetrics {
  totalHabitations: number;
  highRiskSettlements: number;
  exposedPopulation: number;
  candidateRelocationSites: number;
  totalCarryingCapacityAvailable: number;
  totalAllocatedPopulation: number;
  remainingAbsorptiveCapacity: number;
  verifiedDatasetRatio: number;
  districtsCoveredCount: number;
  immediateHouseholdsCount: number;
}

export interface HazardDistributionItem {
  hazardType: HazardType;
  label: string;
  settlementCount: number;
  populationExposed: number;
  percentage: number;
  color: string;
}

export interface HorizonDistributionItem {
  horizon: PriorityHorizon;
  label: string;
  count: number;
  percentage: number;
  color: string;
}

export interface RecentActivityEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  timeAgo: string;
  type: 'alert' | 'rezoning' | 'capacity_check' | 'plan_update' | 'field_survey';
  severity: 'critical' | 'warning' | 'info' | 'success';
  isVerified: boolean;
  dataSource: string;
  location: string;
}

export interface HabitationQueryOptions {
  searchQuery?: string;
  hazardFilter?: HazardType | 'all';
  horizonFilter?: PriorityHorizon | 'all';
  districtFilter?: string;
  isVerifiedOnly?: boolean;
  sortBy?: 'riskScore' | 'population' | 'kucchaPct' | 'name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}
