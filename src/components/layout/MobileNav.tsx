import {
  X,
  Shield,
  LayoutDashboard,
  Map as MapIcon,
  AlertTriangle,
  Home,
  SlidersHorizontal,
  FileCheck2,
  Globe,
  Flame,
  FileSpreadsheet,
  Sun,
  Moon,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { NavRoute, HazardType, UserRole } from '../../types/gis.types';

export const MobileNav: React.FC = () => {
  const {
    currentRoute,
    setCurrentRoute,
    mobileMenuOpen,
    setMobileMenuOpen,
    userRole,
    setUserRole,
    selectedDistrict,
    setSelectedDistrict,
    selectedHazard,
    setSelectedHazard,
    districts,
    metrics,
    theme,
    toggleTheme,
  } = useApp();

  if (!mobileMenuOpen) return null;

  const navItems: { id: NavRoute; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Operations Center', icon: <LayoutDashboard className="w-5 h-5" /> },
    { id: 'hazard-map', label: 'Multi-Hazard Map', icon: <MapIcon className="w-5 h-5" />, badge: `${metrics.activeRedZonesCount}` },
    { id: 'risk-assessment', label: 'Risk Assessment', icon: <AlertTriangle className="w-5 h-5" />, badge: `${metrics.immediatePriorityCount}` },
    { id: 'relocation-sites', label: 'Relocation Sites', icon: <Home className="w-5 h-5" />, badge: `${metrics.totalCandidateSites}` },
    { id: 'priority-planning', label: 'Relocation Horizons', icon: <SlidersHorizontal className="w-5 h-5" /> },
    { id: 'reports', label: 'Plans & Governance', icon: <FileCheck2 className="w-5 h-5" /> },
    { id: 'dataset-integration', label: 'CSV Dataset (10k)', icon: <FileSpreadsheet className="w-5 h-5" />, badge: '10k' },
  ];

  const hazardOptions: { id: HazardType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Hazards' },
    { id: 'landslide', label: 'Landslides' },
    { id: 'riverine_flood', label: 'Riverine Floods' },
    { id: 'cloudburst_flash_flood', label: 'Cloudbursts' },
    { id: 'coastal_erosion', label: 'Coastal Erosion' },
  ];

  return (
    <div className="fixed inset-0 z-50 md:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[85%] bg-gis-dark border-r border-gis-border flex flex-col h-full z-10 shadow-2xl">
        <div className="h-16 flex items-center justify-between px-4 border-b border-gis-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gis-accent flex items-center justify-center text-white">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-gis-textPrimary text-base">
              सुरक्षा<span className="text-gis-accent">GIS</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-gis-surface text-gis-textPrimary border border-gis-border"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-500" />}
            </button>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Filters */}
        <div className="p-3 border-b border-gis-border space-y-2 bg-gis-surface/40">
          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Globe className="w-3 h-3" /> District Filter
            </label>
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5"
            >
              {districts.map(d => (
                <option key={d} value={d} className="bg-gis-card text-gis-textPrimary">
                  {d === 'all' ? 'All Districts' : d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
              <Flame className="w-3 h-3" /> Hazard Exposure
            </label>
            <select
              value={selectedHazard}
              onChange={e => setSelectedHazard(e.target.value as HazardType | 'all')}
              className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5"
            >
              {hazardOptions.map(h => (
                <option key={h.id} value={h.id} className="bg-gis-card text-gis-textPrimary">
                  {h.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = currentRoute === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentRoute(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gis-accent text-white shadow-gis-glow'
                    : 'text-gis-textSecondary hover:text-gis-textPrimary hover:bg-gis-surface'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20 text-white font-semibold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role Selector */}
        <div className="p-3 border-t border-gis-border bg-gis-surface/50">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Governance Role
          </label>
          <select
            value={userRole}
            onChange={e => setUserRole(e.target.value as UserRole)}
            className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg px-2.5 py-1.5"
          >
            <option value="sdma_admin">SDMA Administrator</option>
            <option value="district_planner">District Planner</option>
            <option value="field_surveyor">Field Surveyor</option>
            <option value="public_viewer">Public Citizen</option>
          </select>
        </div>
      </div>
    </div>
  );
};
