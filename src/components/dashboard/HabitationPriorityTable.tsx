import React, { useState } from 'react';
import {
  Search,
  ArrowUpDown,
  Compass,
  SlidersHorizontal,
  Eye,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import {
  VulnerableSettlement,
  HazardType,
  PriorityHorizon,
} from '../../types/gis.types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { VerificationBadge } from '../common/VerificationBadge';
import { EmptyState } from '../common/EmptyState';

interface HabitationPriorityTableProps {
  settlements: VulnerableSettlement[];
  isLoading?: boolean;
  onSelectSettlement: (settlement: VulnerableSettlement) => void;
  onNavigateToMap: () => void;
  onNavigateToPlanning: () => void;
}

export const HabitationPriorityTable: React.FC<HabitationPriorityTableProps> = ({
  settlements,
  isLoading = false,
  onSelectSettlement,
  onNavigateToMap,
  onNavigateToPlanning,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hazardFilter, setHazardFilter] = useState<HazardType | 'all'>('all');
  const [horizonFilter, setHorizonFilter] = useState<PriorityHorizon | 'all'>('all');
  const [sortBy, setSortBy] = useState<'riskScore' | 'population' | 'kucchaPct'>('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const handleToggleSort = (field: 'riskScore' | 'population' | 'kucchaPct') => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setHazardFilter('all');
    setHorizonFilter('all');
    setSortBy('riskScore');
    setSortOrder('desc');
  };

  // Filter & Sort
  const processedData = settlements
    .filter(s => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDist = s.district.toLowerCase().includes(q);
        const matchesSub = s.subdistrict?.toLowerCase().includes(q);
        if (!matchesName && !matchesDist && !matchesSub) return false;
      }
      if (hazardFilter !== 'all' && s.primaryHazardExposure !== hazardFilter) return false;
      if (horizonFilter !== 'all' && s.priorityHorizon !== horizonFilter) return false;
      return true;
    })
    .sort((a, b) => {
      let valA = a.calculatedRiskScore;
      let valB = b.calculatedRiskScore;
      if (sortBy === 'population') {
        valA = a.totalPopulation;
        valB = b.totalPopulation;
      } else if (sortBy === 'kucchaPct') {
        valA = a.kucchaHousesPct;
        valB = b.kucchaHousesPct;
      }
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

  return (
    <Card
      title="Habitation Relocation Priority Queue"
      subtitle="Evaluated multi-criteria ranking under the Disaster Management Framework (SIH26191)"
      action={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToPlanning}
            icon={<SlidersHorizontal className="w-3.5 h-3.5 text-gis-accent" />}
            className="text-xs"
          >
            AHP Weight Tuner
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToMap}
            icon={<Compass className="w-3.5 h-3.5 text-blue-400" />}
            className="text-xs"
          >
            Spatial View
          </Button>
        </div>
      }
    >
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-4 pb-3 border-b border-gis-border/60">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search habitation, district, tehsil..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-gis-accent placeholder:text-slate-500"
          />
        </div>

        {/* Hazard & Horizon Dropdowns */}
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {/* Hazard Filter */}
          <select
            value={hazardFilter}
            onChange={e => setHazardFilter(e.target.value as HazardType | 'all')}
            className="bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gis-accent cursor-pointer"
          >
            <option value="all">All Hazards</option>
            <option value="landslide">Landslide Slip</option>
            <option value="riverine_flood">Riverine Flood</option>
            <option value="cloudburst_flash_flood">Cloudburst</option>
            <option value="coastal_erosion">Coastal Erosion</option>
          </select>

          {/* Horizon Filter */}
          <select
            value={horizonFilter}
            onChange={e => setHorizonFilter(e.target.value as PriorityHorizon | 'all')}
            className="bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gis-accent cursor-pointer"
          >
            <option value="all">All Horizons</option>
            <option value="immediate">Immediate (0-6M)</option>
            <option value="short_term">Short-Term (6-24M)</option>
            <option value="medium_term">Medium-Term (2-5Y)</option>
          </select>

          {/* Reset button if active filters */}
          {(searchQuery || hazardFilter !== 'all' || horizonFilter !== 'all') && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetFilters}
              icon={<RotateCcw className="w-3 h-3" />}
              className="text-xs px-2 py-1 shrink-0"
              title="Reset Filters"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Table Content */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className="h-12 bg-gis-surface/50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : processedData.length === 0 ? (
        <EmptyState
          title="No Matching Habitations"
          description="No settlements match the active search term, hazard vector, or priority horizon criteria."
          actionLabel="Reset Search & Filters"
          onAction={handleResetFilters}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gis-surface/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-gis-border">
              <tr>
                <th className="py-3 px-3">Habitation & Location</th>
                <th className="py-3 px-3">Primary Hazard</th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-gis-textPrimary transition-colors"
                  onClick={() => handleToggleSort('population')}
                >
                  <div className="flex items-center gap-1">
                    <span>Population</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-gis-textPrimary transition-colors"
                  onClick={() => handleToggleSort('kucchaPct')}
                >
                  <div className="flex items-center gap-1">
                    <span>Kuccha Housing</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th
                  className="py-3 px-3 cursor-pointer hover:text-gis-textPrimary transition-colors"
                  onClick={() => handleToggleSort('riskScore')}
                >
                  <div className="flex items-center gap-1">
                    <span>Risk Score</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-500" />
                  </div>
                </th>
                <th className="py-3 px-3">Horizon Status</th>
                <th className="py-3 px-3">Data Provenance</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gis-border/50 text-gis-textPrimary">
              {processedData.map(item => {
                const isCritical = item.calculatedRiskScore >= 90;
                const isHigh = item.calculatedRiskScore >= 75;

                return (
                  <tr
                    key={item.id}
                    className="hover:bg-gis-surface/60 transition-colors cursor-pointer group"
                    onClick={() => onSelectSettlement(item)}
                  >
                    <td className="py-3 px-3">
                      <div className="font-semibold text-gis-textPrimary group-hover:text-gis-accent transition-colors">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.district} • {item.subdistrict || 'Main Tehsil'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-medium text-gis-textPrimary uppercase text-[11px] block">
                        {item.primaryHazardExposure.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {item.historicalEventCount} past disaster events
                      </span>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <div className="text-gis-textPrimary font-medium">{item.totalPopulation.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.elderlyCount + item.childrenCount} dependents ({Math.round(((item.elderlyCount + item.childrenCount) / item.totalPopulation) * 100)}%)
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono">
                      <span
                        className={`font-semibold ${
                          item.kucchaHousesPct >= 75
                            ? 'text-red-400'
                            : item.kucchaHousesPct >= 60
                            ? 'text-amber-400'
                            : 'text-gis-textPrimary'
                        }`}
                      >
                        {item.kucchaHousesPct}%
                      </span>
                      <span className="text-[10px] text-slate-500 block">mud & thatch</span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono font-bold text-sm ${
                            isCritical
                              ? 'text-red-400'
                              : isHigh
                              ? 'text-amber-400'
                              : 'text-blue-400'
                          }`}
                        >
                          {item.calculatedRiskScore}
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-gis-surface overflow-hidden">
                          <div
                            className={`h-full ${
                              isCritical
                                ? 'bg-red-500'
                                : isHigh
                                ? 'bg-amber-500'
                                : 'bg-blue-500'
                            }`}
                            style={{ width: `${item.calculatedRiskScore}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <Badge
                        variant={
                          item.priorityHorizon === 'immediate'
                            ? 'danger'
                            : item.priorityHorizon === 'short_term'
                            ? 'warning'
                            : 'primary'
                        }
                        size="sm"
                        pulse={item.priorityHorizon === 'immediate'}
                      >
                        {item.priorityHorizon}
                      </Badge>
                    </td>

                    <td className="py-3 px-3">
                      <VerificationBadge
                        isVerified={item.isVerified}
                        dataSource={item.dataSource}
                        size="sm"
                      />
                    </td>

                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={e => {
                          e.stopPropagation();
                          onSelectSettlement(item);
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

      {/* Footer Meta */}
      <div className="flex flex-col sm:flex-row items-center justify-between pt-3 mt-2 border-t border-gis-border/60 text-[11px] text-slate-400 font-mono gap-2">
        <span>
          Showing <strong className="text-gis-textPrimary">{processedData.length}</strong> of{' '}
          <strong className="text-gis-textPrimary">{settlements.length}</strong> total habitations
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          Scores evaluated via AHP: 40% Hazard, 35% Demographics, 25% History
        </span>
      </div>
    </Card>
  );
};
