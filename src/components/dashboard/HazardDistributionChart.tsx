import React from 'react';
import { HazardDistributionItem } from '../../types/gis.types';
import { Card } from '../common/Card';
import { Flame, Users } from 'lucide-react';

interface HazardDistributionChartProps {
  data: HazardDistributionItem[];
  isLoading?: boolean;
}

export const HazardDistributionChart: React.FC<HazardDistributionChartProps> = ({
  data,
  isLoading = false,
}) => {
  const totalExposedPop = data.reduce((acc, d) => acc + d.populationExposed, 0);

  return (
    <Card
      title="Multi-Hazard Habitation Exposure"
      subtitle="Habitations categorized by dominant geophysical risk vector"
      action={
        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          {totalExposedPop.toLocaleString()} Citizens
        </span>
      }
    >
      {isLoading ? (
        <div className="space-y-4 py-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="space-y-1.5 animate-pulse">
              <div className="h-3 w-32 bg-gis-surface rounded" />
              <div className="h-2 w-full bg-gis-surface rounded-full" />
            </div>
          ))}
        </div>
      ) : data.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No hazard records available.</p>
      ) : (
        <div className="space-y-4 py-1">
          {data.map(item => (
            <div key={item.hazardType} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-gis-textPrimary font-medium">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.label}
                </span>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-gis-textSecondary text-[11px]">
                    {item.settlementCount} habitations ({item.percentage}%)
                  </span>
                  <span className="text-gis-textPrimary font-semibold text-[11px] bg-gis-surface px-1.5 py-0.5 rounded border border-gis-border">
                    {item.populationExposed.toLocaleString()} pop
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-gis-darkest overflow-hidden border border-gis-border/40">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(5, item.percentage)}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}

          <div className="pt-3 border-t border-gis-border/60 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Primary Sources: GSI NLSM • CWC Flood Inundation Atlas</span>
            <span className="flex items-center gap-1 text-slate-300">
              <Flame className="w-3 h-3 text-red-400" /> Multi-Hazard Synthesis
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
