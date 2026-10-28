import React, { useState, useMemo } from 'react';
import {
  Search,
  AlertTriangle,
  Users,
  Shield,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { VulnerableSettlement, PriorityHorizon } from '../types/gis.types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { VerificationBadge } from '../components/common/VerificationBadge';
import { EmptyState } from '../components/common/EmptyState';

export const RiskAssessmentView: React.FC = () => {
  const { settlements, isVerifiedOnly, setCurrentRoute } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [horizonFilter, setHorizonFilter] = useState<PriorityHorizon | 'all'>('all');
  const [selectedSettlement, setSelectedSettlement] = useState<VulnerableSettlement | null>(null);

  const filteredSettlements = useMemo(() => {
    return settlements.filter(s => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = s.name.toLowerCase().includes(query);
        const matchesDist = s.district.toLowerCase().includes(query);
        if (!matchesName && !matchesDist) return false;
      }
      if (horizonFilter !== 'all' && s.priorityHorizon !== horizonFilter) return false;
      return true;
    });
  }, [settlements, searchQuery, horizonFilter]);

  const totalFilteredPop = filteredSettlements.reduce((acc, s) => acc + s.totalPopulation, 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Search and Filter Controls */}
      <div className="bg-gis-card border border-gis-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 transition-colors duration-200">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search settlement name or district..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs sm:text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-gis-accent placeholder:text-slate-500"
          />
        </div>

        {/* Horizon Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {(['all', 'immediate', 'short_term', 'medium_term'] as const).map(horizon => (
            <button
              key={horizon}
              onClick={() => setHorizonFilter(horizon)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${horizonFilter === horizon
                  ? 'bg-gis-accent text-white shadow-sm'
                  : 'bg-gis-surface/80 text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
                }`}
            >
              {horizon === 'all'
                ? 'All Horizons'
                : horizon === 'immediate'
                  ? 'Immediate (0-6M)'
                  : horizon === 'short_term'
                    ? 'Short-Term (6-24M)'
                    : 'Medium-Term (2-5Y)'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono">Matched Settlements</p>
            <p className="text-xl font-bold text-gis-textPrimary font-mono mt-0.5">{filteredSettlements.length}</p>
          </div>
          <AlertTriangle className="w-6 h-6 text-amber-500" />
        </div>
        <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono">Vulnerable Citizens</p>
            <p className="text-xl font-bold text-gis-textPrimary font-mono mt-0.5">{totalFilteredPop.toLocaleString()}</p>
          </div>
          <Users className="w-6 h-6 text-blue-500" />
        </div>
        <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-mono">Dataset Filter</p>
            <p className="text-xs font-bold text-emerald-500 mt-1">
              {isVerifiedOnly ? 'Ground-Truth Verified Only' : 'Simulation Benchmarks Included'}
            </p>
          </div>
          <Shield className="w-6 h-6 text-emerald-500" />
        </div>
      </div>

      {/* Settlements Table */}
      <Card
        title="Settlement Vulnerability & Risk Directory"
        subtitle="Evaluated across physical slope stability, housing material type, and demographic dependencies"
      >
        {filteredSettlements.length === 0 ? (
          <EmptyState
            title="No Settlements Found"
            description="No settlements match your current search criteria or horizon filter. Try resetting search or switching to include simulation data."
            actionLabel="Clear Filters"
            onAction={() => {
              setSearchQuery('');
              setHorizonFilter('all');
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gis-surface/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-gis-border">
                <tr>
                  <th className="py-3 px-4">Settlement & District</th>
                  <th className="py-3 px-3">Population</th>
                  <th className="py-3 px-3">Kuccha Houses</th>
                  <th className="py-3 px-3">Primary Exposure</th>
                  <th className="py-3 px-3">Calculated Risk</th>
                  <th className="py-3 px-3">Assigned Horizon</th>
                  <th className="py-3 px-3">Data Provenance</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gis-border/50 text-gis-textPrimary">
                {filteredSettlements.map(settlement => {
                  const isImmediate = settlement.priorityHorizon === 'immediate';
                  return (
                    <tr
                      key={settlement.id}
                      className="hover:bg-gis-surface/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedSettlement(settlement)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gis-textPrimary">{settlement.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {settlement.district} • {settlement.subdistrict || 'Main Tehsil'}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <div className="text-gis-textPrimary font-medium">{settlement.totalPopulation.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400">
                          {settlement.elderlyCount} elderly, {settlement.childrenCount} kids
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        <span
                          className={`font-semibold ${
                            settlement.kucchaHousesPct >= 70 ? 'text-red-500' : 'text-gis-textSecondary'
                          }`}
                        >
                          {settlement.kucchaHousesPct}%
                        </span>
                      </td>
                      <td className="py-3 px-3 uppercase text-[11px] font-semibold text-gis-textPrimary">
                        {settlement.primaryHazardExposure.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono font-bold ${settlement.calculatedRiskScore >= 90
                                ? 'text-red-500'
                                : settlement.calculatedRiskScore >= 75
                                  ? 'text-amber-500'
                                  : 'text-blue-500'
                              }`}
                          >
                            {settlement.calculatedRiskScore}
                          </span>
                          <div className="w-16 h-1.5 rounded-full bg-gis-surface overflow-hidden">
                            <div
                              className={`h-full ${settlement.calculatedRiskScore >= 90
                                  ? 'bg-red-500'
                                  : settlement.calculatedRiskScore >= 75
                                    ? 'bg-amber-500'
                                    : 'bg-blue-500'
                                }`}
                              style={{ width: `${settlement.calculatedRiskScore}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            isImmediate
                              ? 'danger'
                              : settlement.priorityHorizon === 'short_term'
                                ? 'warning'
                                : 'primary'
                          }
                          size="sm"
                          pulse={isImmediate}
                        >
                          {settlement.priorityHorizon}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <VerificationBadge
                          isVerified={settlement.isVerified}
                          dataSource={settlement.dataSource}
                          size="sm"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5" />}
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedSettlement(settlement);
                          }}
                          className="text-xs"
                        >
                          Profile
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detailed Modal/Drawer for Selected Settlement */}
      {selectedSettlement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-gis-textPrimary">{selectedSettlement.name}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  District: {selectedSettlement.district} • Primary Risk: {selectedSettlement.primaryHazardExposure}
                </p>
              </div>
              <button
                onClick={() => setSelectedSettlement(null)}
                className="text-slate-400 hover:text-gis-textPrimary p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">TOTAL HOUSEHOLDS</span>
                <strong className="text-base text-gis-textPrimary font-mono">{selectedSettlement.householdCount}</strong>
              </div>
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">TOTAL RESIDENTS</span>
                <strong className="text-base text-gis-textPrimary font-mono">{selectedSettlement.totalPopulation.toLocaleString()}</strong>
              </div>
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">HIGH-VULNERABILITY RATIO</span>
                <strong className="text-base text-red-500 font-mono">
                  {Math.round(((selectedSettlement.elderlyCount + selectedSettlement.childrenCount) / selectedSettlement.totalPopulation) * 100)}%
                </strong>
                <span className="text-[10px] text-slate-400 block">(Children & Elderly)</span>
              </div>
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">HISTORICAL DISASTERS</span>
                <strong className="text-base text-amber-500 font-mono">{selectedSettlement.historicalEventCount} recorded</strong>
              </div>
            </div>

            <div className="space-y-1 pt-2 border-t border-gis-border">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Dataset Provenance & Verification</span>
              <VerificationBadge
                isVerified={selectedSettlement.isVerified}
                dataSource={selectedSettlement.dataSource}
                showSource
              />
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gis-border">
              <Button
                variant="primary"
                size="sm"
                icon={<ArrowRight className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedSettlement(null);
                  setCurrentRoute('reports');
                }}
              >
                Draft Relocation Action Plan
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedSettlement(null)}>
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
