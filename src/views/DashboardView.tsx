import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  MapPin,
  Home,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DashboardMetrics,
  HazardDistributionItem,
  HorizonDistributionItem,
  RecentActivityEvent,
  VulnerableSettlement,
} from '../types/gis.types';
import { dashboardService } from '../services/dashboardService';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { HazardDistributionChart } from '../components/dashboard/HazardDistributionChart';
import { RiskSeverityDonut } from '../components/dashboard/RiskSeverityDonut';
import { HabitationPriorityTable } from '../components/dashboard/HabitationPriorityTable';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { QuickNavLaunchpad } from '../components/dashboard/QuickNavLaunchpad';
import { SettlementDossierModal } from '../components/dashboard/SettlementDossierModal';

export const DashboardView: React.FC = () => {
  const {
    isVerifiedOnly,
    setIsVerifiedOnly,
    selectedDistrict,
    selectedHazard,
    setCurrentRoute,
  } = useApp();

  // Async state loaded from DashboardService
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [hazardDist, setHazardDist] = useState<HazardDistributionItem[]>([]);
  const [horizonDist, setHorizonDist] = useState<HorizonDistributionItem[]>([]);
  const [activities, setActivities] = useState<RecentActivityEvent[]>([]);
  const [priorityHabitations, setPriorityHabitations] = useState<VulnerableSettlement[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Selected settlement modal
  const [inspectedSettlement, setInspectedSettlement] = useState<VulnerableSettlement | null>(null);

  // Load dashboard data via service layer
  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [m, hz, hr, act, queue] = await Promise.all([
        dashboardService.fetchDashboardMetrics(isVerifiedOnly, selectedDistrict),
        dashboardService.fetchHazardDistribution(isVerifiedOnly, selectedDistrict),
        dashboardService.fetchHorizonDistribution(isVerifiedOnly, selectedDistrict),
        dashboardService.fetchRecentActivities(isVerifiedOnly),
        dashboardService.fetchHabitationPriorityQueue({
          isVerifiedOnly,
          districtFilter: selectedDistrict,
          hazardFilter: selectedHazard,
        }),
      ]);
      setMetrics(m);
      setHazardDist(hz);
      setHorizonDist(hr);
      setActivities(act);
      setPriorityHabitations(queue.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to query disaster operations data.');
    } finally {
      setIsLoading(false);
    }
  }, [isVerifiedOnly, selectedDistrict, selectedHazard]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Operations Control Bar & Provenance Banner */}
      <div className={`rounded-2xl border p-4 sm:p-5 transition-all shadow-lg ${
        isVerifiedOnly
          ? 'bg-gradient-to-r from-emerald-950/40 via-gis-surface/80 to-gis-card border-emerald-800/60'
          : 'bg-gradient-to-r from-amber-950/40 via-gis-surface/80 to-gis-card border-amber-800/60'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isVerifiedOnly
                ? 'bg-emerald-900/70 text-emerald-300 border border-emerald-700/60'
                : 'bg-amber-900/70 text-amber-300 border border-amber-700/60'
            }`}>
              {isVerifiedOnly ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gis-textPrimary tracking-wide">
                  {isVerifiedOnly
                    ? 'DISASTER OPERATIONS DASHBOARD — VERIFIED MODE'
                    : 'DISASTER OPERATIONS DASHBOARD — SIMULATION HARNESS'}
                </h2>
                <Badge variant={isVerifiedOnly ? 'success' : 'warning'} size="sm">
                  {metrics?.verifiedDatasetRatio || 80}% Authenticated
                </Badge>
                {selectedDistrict !== 'all' && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gis-surface text-slate-300 border border-gis-border">
                    District: {selectedDistrict}
                  </span>
                )}
                {selectedHazard !== 'all' && (
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-gis-surface text-slate-300 border border-gis-border">
                    Hazard: {selectedHazard.replace(/_/g, ' ')}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-3xl">
                {isVerifiedOnly
                  ? 'All spatial queries, habitations, and carrying capacity metrics are strictly filtered to official ground-truth records (GSI Landslide Atlas, CWC Inundation, Census of India). Synthetic scenarios are hidden.'
                  : 'Displaying authenticated ground-truth records combined with illustrative benchmark scenarios for emergency relocation capacity planning. Demo scenarios are clearly labelled.'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentRoute('dataset-integration')}
              className="text-xs text-cyan-400 border-cyan-800/60 hover:bg-cyan-950/40"
            >
              CSV Dataset (Phase 4)
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={loadDashboardData}
              isLoading={isLoading}
              icon={<RotateCcw className="w-3.5 h-3.5 text-slate-400" />}
              className="text-xs"
            >
              Sync Data
            </Button>

            <Button
              variant={isVerifiedOnly ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => setIsVerifiedOnly(!isVerifiedOnly)}
              className="text-xs"
            >
              {isVerifiedOnly ? 'Switch to Simulation Mode' : 'Enforce Verified Only'}
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner (if any) */}
      {error && (
        <ErrorBanner
          title="Operations Service Error"
          message={error}
          onRetry={loadDashboardData}
        />
      )}

      {/* KPI Stat Cards (4 Core Dimensions) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Habitations"
          value={metrics ? metrics.totalHabitations : '...'}
          subtitle={
            metrics
              ? `Across ${metrics.districtsCoveredCount} vulnerable districts`
              : 'Loading habitations...'
          }
          icon={<MapPin className="w-5 h-5" />}
          accentColor="blue"
          isLoading={isLoading}
        />

        <StatCard
          title="Critical Red Zone Habitations"
          value={metrics ? metrics.highRiskSettlements : '...'}
          subtitle={
            metrics
              ? `${metrics.immediateHouseholdsCount} families in immediate danger`
              : 'Assessing risk scores...'
          }
          icon={<AlertTriangle className="w-5 h-5" />}
          accentColor="red"
          isLoading={isLoading}
          trend={{ label: 'Immediate 0-6M Relocation Queue', positive: false }}
        />

        <StatCard
          title="Exposed Population"
          value={metrics ? metrics.exposedPopulation.toLocaleString() : '...'}
          subtitle="Identified across multi-hazard perimeters"
          icon={<Users className="w-5 h-5" />}
          accentColor="amber"
          isLoading={isLoading}
        />

        <StatCard
          title="Candidate Relocation Sites"
          value={metrics ? metrics.candidateRelocationSites : '...'}
          subtitle={
            metrics
              ? `${metrics.remainingAbsorptiveCapacity.toLocaleString()} absorptive margin`
              : 'Inspecting land parcels...'
          }
          icon={<Home className="w-5 h-5" />}
          accentColor="emerald"
          isLoading={isLoading}
          trend={{ label: 'Absorptive capacity viable', positive: true }}
        />
      </div>

      {/* Risk Distribution Charts Section (2-Column Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HazardDistributionChart data={hazardDist} isLoading={isLoading} />
        <RiskSeverityDonut data={horizonDist} isLoading={isLoading} />
      </div>

      {/* Searchable & Filterable Habitation Priority Queue */}
      <HabitationPriorityTable
        settlements={priorityHabitations}
        isLoading={isLoading}
        onSelectSettlement={s => setInspectedSettlement(s)}
        onNavigateToMap={() => setCurrentRoute('hazard-map')}
        onNavigateToPlanning={() => setCurrentRoute('priority-planning')}
      />

      {/* Two-Column Grid: Recent Activity Stream & Planned Sections Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Geospatial Activity Stream (2 Spans) */}
        <div className="lg:col-span-2">
          <RecentActivityFeed activities={activities} isLoading={isLoading} />
        </div>

        {/* Quick Strategic Launchpad (1 Span) */}
        <div>
          <QuickNavLaunchpad
            onNavigate={route => setCurrentRoute(route)}
            activeRedZonesCount={metrics?.highRiskSettlements || 3}
            candidateSitesCount={metrics?.candidateRelocationSites || 3}
            immediateCount={metrics?.highRiskSettlements || 2}
          />
        </div>
      </div>

      {/* Settlement Detail Modal */}
      <SettlementDossierModal
        settlement={inspectedSettlement}
        onClose={() => setInspectedSettlement(null)}
        onNavigateToMap={() => {
          setInspectedSettlement(null);
          setCurrentRoute('hazard-map');
        }}
        onNavigateToPlanning={() => {
          setInspectedSettlement(null);
          setCurrentRoute('priority-planning');
        }}
      />
    </div>
  );
};
