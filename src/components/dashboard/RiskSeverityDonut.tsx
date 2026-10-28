import React from 'react';
import { HorizonDistributionItem } from '../../types/gis.types';
import { Card } from '../common/Card';
import { Clock } from 'lucide-react';

interface RiskSeverityDonutProps {
  data: HorizonDistributionItem[];
  isLoading?: boolean;
}

export const RiskSeverityDonut: React.FC<RiskSeverityDonutProps> = ({
  data,
  isLoading = false,
}) => {
  const totalCount = data.reduce((acc, d) => acc + d.count, 0);

  // SVG Donut calculation
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <Card
      title="Relocation Horizon Distribution"
      subtitle="Habitations stratified by urgency of resettlement mandate"
      action={
        <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          {totalCount} Total Evaluated
        </span>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-10 animate-pulse">
          <div className="w-28 h-28 rounded-full border-4 border-gis-surface border-t-gis-accent animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-around gap-6 py-2">
          {/* SVG Donut */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-gis-surface"
                strokeWidth="12"
                fill="transparent"
              />
              {data.map(item => {
                const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -accumulatedOffset;
                accumulatedOffset += (item.percentage / 100) * circumference;

                if (item.count === 0) return null;

                return (
                  <circle
                    key={item.horizon}
                    cx="50"
                    cy="50"
                    r={radius}
                    stroke={item.color}
                    strokeWidth="12"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    fill="transparent"
                    className="transition-all duration-700 hover:opacity-90 cursor-pointer"
                  />
                );
              })}
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-xl font-bold font-mono text-gis-textPrimary tracking-tight">{totalCount}</span>
              <span className="text-[10px] uppercase font-mono text-slate-400">Habitations</span>
            </div>
          </div>

          {/* Legend and Stats */}
          <div className="space-y-2.5 w-full sm:w-auto flex-1">
            {data.map(item => (
              <div
                key={item.horizon}
                className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-gis-surface/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-gis-textPrimary font-medium">{item.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="font-bold text-gis-textPrimary text-xs">{item.count}</span>
                  <span className="text-slate-400 text-[10px] w-8 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
