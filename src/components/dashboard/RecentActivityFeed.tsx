import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Layers,
  CheckCircle2,
  FileCheck2,
  MapPin,
  Clock,
} from 'lucide-react';
import { RecentActivityEvent } from '../../types/gis.types';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { VerificationBadge } from '../common/VerificationBadge';

interface RecentActivityFeedProps {
  activities: RecentActivityEvent[];
  isLoading?: boolean;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  isLoading = false,
}) => {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning'>('all');

  const filtered = activities.filter(a => {
    if (filter === 'critical') return a.severity === 'critical';
    if (filter === 'warning') return a.severity === 'warning';
    return true;
  });

  const getEventIcon = (type: RecentActivityEvent['type']) => {
    switch (type) {
      case 'alert':
        return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'rezoning':
        return <Layers className="w-4 h-4 text-amber-400" />;
      case 'capacity_check':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'plan_update':
        return <FileCheck2 className="w-4 h-4 text-gis-accent" />;
      default:
        return <Activity className="w-4 h-4 text-purple-400" />;
    }
  };

  return (
    <Card
      title="Recent Spatial & Governance Activity"
      subtitle="Real-time audit log of multi-hazard alerts, re-zoning updates, and field surveys"
      action={
        <div className="flex items-center gap-1 bg-gis-surface/80 p-0.5 rounded-lg border border-gis-border">
          {(['all', 'critical', 'warning'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                filter === tab
                  ? 'bg-gis-accent text-white'
                  : 'text-slate-400 hover:text-gis-textPrimary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-3 py-3">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-16 bg-gis-surface/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-400 py-6 text-center">No recent activity matching filter.</p>
      ) : (
        <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
          {filtered.map(event => (
            <div
              key={event.id}
              className="p-3 rounded-xl bg-gis-surface/40 border border-gis-border hover:border-gis-borderLight transition-all space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gis-darkest border border-gis-border shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-gis-textPrimary tracking-wide">
                      {event.title}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-slate-500" />
                        {event.location}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5 text-slate-400">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {event.timeAgo}
                      </span>
                    </div>
                  </div>
                </div>

                <Badge
                  variant={
                    event.severity === 'critical'
                      ? 'danger'
                      : event.severity === 'warning'
                      ? 'warning'
                      : event.severity === 'success'
                      ? 'success'
                      : 'primary'
                  }
                  size="sm"
                  pulse={event.severity === 'critical'}
                >
                  {event.severity}
                </Badge>
              </div>

              <p className="text-xs text-gis-textSecondary leading-relaxed pl-8">
                {event.description}
              </p>

              <div className="pt-1.5 border-t border-gis-border/40 flex items-center justify-between pl-8 text-[10px]">
                <span className="font-mono text-slate-500 truncate max-w-[200px]" title={event.dataSource}>
                  Source: {event.dataSource}
                </span>
                <VerificationBadge
                  isVerified={event.isVerified}
                  dataSource={event.dataSource}
                  size="sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};
