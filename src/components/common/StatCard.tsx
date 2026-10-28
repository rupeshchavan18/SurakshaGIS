import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: 'blue' | 'red' | 'emerald' | 'amber' | 'purple';
  trend?: {
    label: string;
    positive?: boolean;
  };
  isLoading?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  accentColor = 'blue',
  trend,
  isLoading = false,
  className = '',
}) => {
  const colorMap = {
    blue: {
      border: 'border-blue-900/40 hover:border-blue-500/80',
      iconBg: 'bg-blue-500/10 text-blue-500 border border-blue-500/30',
      glow: 'hover:shadow-[0_0_20px_-3px_rgba(37,99,235,0.25)]',
    },
    red: {
      border: 'border-red-900/40 hover:border-red-500/80',
      iconBg: 'bg-red-500/10 text-red-500 border border-red-500/30',
      glow: 'hover:shadow-[0_0_20px_-3px_rgba(239,68,68,0.25)]',
    },
    emerald: {
      border: 'border-emerald-900/40 hover:border-emerald-500/80',
      iconBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30',
      glow: 'hover:shadow-[0_0_20px_-3px_rgba(16,185,129,0.25)]',
    },
    amber: {
      border: 'border-amber-900/40 hover:border-amber-500/80',
      iconBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/30',
      glow: 'hover:shadow-[0_0_20px_-3px_rgba(245,158,11,0.25)]',
    },
    purple: {
      border: 'border-purple-900/40 hover:border-purple-500/80',
      iconBg: 'bg-purple-500/10 text-purple-500 border border-purple-500/30',
      glow: 'hover:shadow-[0_0_20px_-3px_rgba(147,51,234,0.25)]',
    },
  };

  const scheme = colorMap[accentColor];

  return (
    <div
      className={`bg-gis-card border ${scheme.border} rounded-xl p-4 sm:p-5 transition-all duration-200 ${scheme.glow} ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
          {isLoading ? (
            <div className="h-8 w-24 bg-gis-surface animate-pulse rounded my-1" />
          ) : (
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-gis-textPrimary font-mono">
              {value}
            </h3>
          )}
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          {trend && (
            <span
              className={`inline-block text-[11px] font-medium mt-1 ${
                trend.positive ? 'text-emerald-500' : 'text-red-500'
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
        <div className={`p-2.5 rounded-xl shrink-0 ${scheme.iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
