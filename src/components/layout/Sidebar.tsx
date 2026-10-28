import {
  LayoutDashboard,
  Map as MapIcon,
  AlertTriangle,
  Home,
  SlidersHorizontal,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Layers,
  FileSpreadsheet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavRoute, UserRole } from '../../types/gis.types';

interface NavItemConfig {
  id: NavRoute;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  badge?: string;
  badgeVariant?: 'danger' | 'warning' | 'primary';
}

export const Sidebar: React.FC = () => {
  const {
    currentRoute,
    setCurrentRoute,
    sidebarCollapsed,
    setSidebarCollapsed,
    userRole,
    setUserRole,
    metrics,
    csvRecordCount,
  } = useApp();

  const navItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'Operations Center',
      shortLabel: 'Overview',
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'hazard-map',
      label: 'Multi-Hazard Map',
      shortLabel: 'GIS Map',
      icon: <MapIcon className="w-5 h-5 shrink-0" />,
      badge: `${metrics.activeRedZonesCount} Active`,
      badgeVariant: 'danger',
    },
    {
      id: 'risk-assessment',
      label: 'Risk Assessment',
      shortLabel: 'Risk',
      icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
      badge: `${metrics.immediatePriorityCount} Critical`,
      badgeVariant: 'warning',
    },
    {
      id: 'relocation-sites',
      label: 'Relocation Sites',
      shortLabel: 'Sites',
      icon: <Home className="w-5 h-5 shrink-0" />,
      badge: `${metrics.totalCandidateSites} Sites`,
      badgeVariant: 'primary',
    },
    {
      id: 'priority-planning',
      label: 'Relocation Horizons',
      shortLabel: 'Horizons',
      icon: <SlidersHorizontal className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'reports',
      label: 'Plans & Governance',
      shortLabel: 'Gov',
      icon: <FileCheck2 className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'dataset-integration',
      label: 'CSV Dataset (Phase 4)',
      shortLabel: 'CSV Data',
      icon: <FileSpreadsheet className="w-5 h-5 shrink-0" />,
      badge: csvRecordCount > 0 ? `${(csvRecordCount / 1000).toFixed(0)}k Rows` : '10k Rows',
      badgeVariant: 'warning',
    },
  ];

  const roles: { id: UserRole; label: string }[] = [
    { id: 'sdma_admin', label: 'SDMA Administrator' },
    { id: 'district_planner', label: 'District Planner' },
    { id: 'field_surveyor', label: 'Field Surveyor' },
    { id: 'public_viewer', label: 'Public Citizen' },
  ];

  return (
    <aside
      className={`hidden md:flex flex-col bg-gis-dark border-r border-gis-border transition-all duration-300 ease-in-out z-20 ${
        sidebarCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gis-border shrink-0">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-gis-accent to-blue-500 flex items-center justify-center text-white shadow-gis-glow shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-gis-textPrimary flex items-center gap-1.5">
                सुरक्षा<span className="text-gis-accent">GIS</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono tracking-wider">
                SIH26191 • DSS
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setSidebarCollapsed(prev => !prev)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface transition-colors"
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className={`px-2 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider ${sidebarCollapsed ? 'text-center' : ''}`}>
          {sidebarCollapsed ? <Layers className="w-4 h-4 mx-auto text-slate-400" /> : 'Spatial Decision Tools'}
        </div>

        {navItems.map(item => {
          const isActive = currentRoute === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentRoute(item.id)}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative ${
                isActive
                  ? 'bg-gis-accent text-white shadow-gis-glow'
                  : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface/80'
              } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              <span className={`${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`}>
                {item.icon}
              </span>

              {!sidebarCollapsed && (
                <div className="flex-1 flex items-center justify-between text-left truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-semibold shrink-0 ml-2 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeVariant === 'danger'
                          ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800'
                          : item.badgeVariant === 'warning'
                          ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom Authority & Role Switcher */}
      <div className="p-3 border-t border-gis-border shrink-0 bg-gis-surface/30">
        {!sidebarCollapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Active Governance Role
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <select
              value={userRole}
              onChange={e => setUserRole(e.target.value as UserRole)}
              className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-gis-accent cursor-pointer"
            >
              {roles.map(r => (
                <option key={r.id} value={r.id} className="bg-gis-dark text-slate-200">
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex justify-center" title={`Active Role: ${userRole}`}>
            <div className="w-8 h-8 rounded-lg bg-gis-surface border border-gis-border flex items-center justify-center text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
