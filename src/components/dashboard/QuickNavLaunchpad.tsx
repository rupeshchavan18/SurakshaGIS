import {
  Compass,
  AlertTriangle,
  Home,
  SlidersHorizontal,
  FileCheck2,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';
import { NavRoute } from '../../types/gis.types';
import { Card } from '../common/Card';

interface QuickNavLaunchpadProps {
  onNavigate: (route: NavRoute) => void;
  activeRedZonesCount: number;
  candidateSitesCount: number;
  immediateCount: number;
}

export const QuickNavLaunchpad: React.FC<QuickNavLaunchpadProps> = ({
  onNavigate,
  activeRedZonesCount,
  candidateSitesCount,
  immediateCount,
}) => {
  const launchpadItems = [
    {
      route: 'hazard-map' as NavRoute,
      title: 'Multi-Hazard GIS Map Engine',
      description: 'Interactive Leaflet vector layers for Landslide and Flood Red Zones with buffer tools',
      icon: <Compass className="w-5 h-5 text-gis-accent" />,
      badge: `${activeRedZonesCount} Active Zones`,
      badgeColor: 'border-blue-200 text-blue-700 bg-blue-100 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/80',
    },
    {
      route: 'priority-planning' as NavRoute,
      title: 'Relocation Horizon Framework',
      description: 'AHP decision weighting matrix categorizing immediate vs short-term resettlement',
      icon: <SlidersHorizontal className="w-5 h-5 text-amber-500" />,
      badge: `${immediateCount} Critical Queue`,
      badgeColor: 'border-amber-200 text-amber-800 bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/80',
    },
    {
      route: 'relocation-sites' as NavRoute,
      title: 'Candidate Sites & Carrying Capacity',
      description: 'Evaluates slope buildability, road/water proximity, and absorbable population',
      icon: <Home className="w-5 h-5 text-emerald-500" />,
      badge: `${candidateSitesCount} Parcels Available`,
      badgeColor: 'border-emerald-200 text-emerald-800 bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/80',
    },
    {
      route: 'risk-assessment' as NavRoute,
      title: 'Demographic Risk Directory',
      description: 'Full database of habitations, kuccha housing vulnerabilities, and field census logs',
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      badge: 'Full Registry',
      badgeColor: 'border-red-200 text-red-800 bg-red-100 dark:border-red-800 dark:text-red-300 dark:bg-red-950/80',
    },
    {
      route: 'reports' as NavRoute,
      title: 'SDMA Orders & Governance',
      description: 'Official resettlement mandates, budget disbursements, and GeoJSON export',
      icon: <FileCheck2 className="w-5 h-5 text-purple-500" />,
      badge: 'Authority Dossiers',
      badgeColor: 'border-purple-200 text-purple-800 bg-purple-100 dark:border-purple-800 dark:text-purple-300 dark:bg-purple-950/80',
    },
    {
      route: 'dataset-integration' as NavRoute,
      title: 'CSV Dataset (Phase 4)',
      description: 'Typed ingestion service for docs/flood_risk_dataset_india.csv with 10k validated records',
      icon: <FileSpreadsheet className="w-5 h-5 text-cyan-500" />,
      badge: '10,000 Records',
      badgeColor: 'border-cyan-200 text-cyan-800 bg-cyan-100 dark:border-cyan-800 dark:text-cyan-300 dark:bg-cyan-950/80',
    },
  ];

  return (
    <Card
      title="Strategic Operations Navigation"
      subtitle="Quick-launch access into planned GIS and decision-support modules"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {launchpadItems.map(item => (
          <button
            key={item.route}
            onClick={() => onNavigate(item.route)}
            className="p-3.5 rounded-xl bg-gis-surface/50 border border-gis-border hover:border-gis-accent hover:bg-gis-surface transition-all text-left flex flex-col justify-between group space-y-3"
          >
            <div className="flex items-start justify-between w-full">
              <div className="p-2 rounded-lg bg-gis-darkest border border-gis-border group-hover:scale-105 transition-transform">
                {item.icon}
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${item.badgeColor} font-semibold`}>
                {item.badge}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gis-textPrimary group-hover:text-gis-accent transition-colors flex items-center justify-between">
                <span>{item.title}</span>
                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-gis-accent group-hover:translate-x-0.5 transition-all" />
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
};
