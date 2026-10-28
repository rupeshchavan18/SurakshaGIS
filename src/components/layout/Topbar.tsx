import React, { useState } from 'react';
import {
  Menu,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Flame,
  Sun,
  Moon,
  Database,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HazardType } from '../../types/gis.types';
import { BackendStatusModal } from '../backend/BackendStatusModal';

export const Topbar: React.FC = () => {
  const {
    currentRoute,
    isVerifiedOnly,
    setIsVerifiedOnly,
    selectedDistrict,
    setSelectedDistrict,
    selectedHazard,
    setSelectedHazard,
    districts,
    setMobileMenuOpen,
    backendMode,
    isSupabaseConfigured,
    theme,
    toggleTheme,
    persistenceStorageType,
  } = useApp();

  const [showBackendModal, setShowBackendModal] = useState<boolean>(false);

  const routeTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Disaster Risk Operations Center',
      subtitle: 'Real-time multi-hazard synthesis and relocation decision readiness',
    },
    'hazard-map': {
      title: 'Multi-Hazard Red Zone GIS Engine',
      subtitle: 'PostGIS spatial vector overlays (Landslides, Floods, Cloudbursts)',
    },
    'risk-assessment': {
      title: 'Settlement Vulnerability & Risk Directory',
      subtitle: 'Demographics, kuccha housing index, and hazard exposure metrics',
    },
    'relocation-sites': {
      title: 'Candidate Relocation Sites & Carrying Capacity',
      subtitle: 'Terrain buildability, slope thresholding, and infrastructure catchments',
    },
    'priority-planning': {
      title: 'Relocation Horizon Framework (AHP)',
      subtitle: 'Multi-criteria prioritization for Immediate, Short-term, and Medium-term plans',
    },
    reports: {
      title: 'SDMA Relocation Plans & Governance',
      subtitle: 'Official relocation orders, digital audit log, and executive dossiers',
    },
    'dataset-integration': {
      title: 'CSV Dataset Integration & Validation',
      subtitle: 'Ingestion of docs/flood_risk_dataset_india.csv (10k records, 14 columns)',
    },
  };

  const currentMeta = routeTitles[currentRoute] || {
    title: 'SurakshaGIS',
    subtitle: 'Decision Support System',
  };

  const hazardOptions: { id: HazardType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Hazards' },
    { id: 'landslide', label: 'Landslides' },
    { id: 'riverine_flood', label: 'Riverine Floods' },
    { id: 'cloudburst_flash_flood', label: 'Cloudburst Flash Floods' },
    { id: 'coastal_erosion', label: 'Coastal Erosion' },
  ];

  return (
    <header className="h-16 bg-gis-dark/95 backdrop-blur-md border-b border-gis-border px-3 sm:px-4 flex items-center justify-between shrink-0 z-10 transition-colors duration-200">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 rounded-lg text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface transition-colors"
          aria-label="Open Mobile Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base md:text-lg font-bold text-gis-textPrimary tracking-tight">
              {currentMeta.title}
            </h1>
            <button
              onClick={() => setShowBackendModal(true)}
              className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono font-medium px-2.5 py-1 rounded-full bg-gis-surface hover:bg-gis-card border border-gis-border transition-colors cursor-pointer text-slate-300 group"
              title={`Storage: ${persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS Remote' : 'Browser Local Storage'} (click to view)`}
            >
              <Database className="w-3 h-3 text-gis-accent" />
              <span
                className={`w-2 h-2 rounded-full ${backendMode === 'supabase_postgis'
                    ? 'bg-emerald-400 animate-pulse'
                    : isSupabaseConfigured
                      ? 'bg-amber-400'
                      : 'bg-blue-400'
                  }`}
              />
              <span className="group-hover:text-gis-textPrimary">
                {backendMode === 'supabase_postgis' ? 'PostGIS Live' : persistenceStorageType === 'remote_supabase' ? 'PostGIS' : 'Local Fallback'}
              </span>
            </button>
          </div>
          <p className="hidden md:block text-xs text-slate-400 truncate max-w-lg">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      {/* Right: Filters, Theme Switcher & Dataset Mode */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* District Selector Filter */}
        <div className="hidden lg:flex items-center gap-1.5 bg-gis-surface/80 border border-gis-border rounded-lg px-2.5 py-1">
          <Globe className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] text-slate-400">District:</span>
          <select
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            className="bg-transparent text-xs text-gis-textPrimary font-medium focus:outline-none cursor-pointer"
          >
            {districts.map(d => (
              <option key={d} value={d} className="bg-gis-card text-gis-textPrimary">
                {d === 'all' ? 'All Districts' : d}
              </option>
            ))}
          </select>
        </div>

        {/* Hazard Type Selector Filter */}
        <div className="hidden sm:flex items-center gap-1.5 bg-gis-surface/80 border border-gis-border rounded-lg px-2.5 py-1">
          <Flame className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedHazard}
            onChange={e => setSelectedHazard(e.target.value as HazardType | 'all')}
            className="bg-transparent text-xs text-gis-textPrimary font-medium focus:outline-none cursor-pointer"
          >
            {hazardOptions.map(h => (
              <option key={h.id} value={h.id} className="bg-gis-card text-gis-textPrimary">
                {h.label}
              </option>
            ))}
          </select>
        </div>

        {/* VERIFIED VS DEMO DATA MODE TOGGLE */}
        <div className="flex items-center gap-1 bg-gis-surface/90 border border-gis-border rounded-lg p-0.5 sm:p-1">
          <button
            onClick={() => setIsVerifiedOnly(true)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${isVerifiedOnly
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
              }`}
            title="Show only ground-truth verified datasets (GSI, CWC, Census)"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Verified Only</span>
            <span className="md:hidden">Verified</span>
          </button>

          <button
            onClick={() => setIsVerifiedOnly(false)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-all ${!isVerifiedOnly
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
              }`}
            title="Include synthetic benchmark scenarios for simulation and stress testing"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">All + Demo</span>
            <span className="md:hidden">Demo</span>
          </button>
        </div>

        {/* DARK / LIGHT THEME TOGGLE (PHASE 5) */}
        <button
          onClick={toggleTheme}
          aria-label="Toggle Dark and Light theme"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gis-surface hover:bg-gis-card border border-gis-border text-xs font-medium text-gis-textPrimary transition-all shadow-sm"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
              <span className="hidden sm:inline text-[11px] font-mono text-slate-300">Light</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-500" />
              <span className="hidden sm:inline text-[11px] font-mono text-slate-700">Dark</span>
            </>
          )}
        </button>
      </div>

      {/* Phase 5 Backend & PostGIS Architecture Modal */}
      <BackendStatusModal
        isOpen={showBackendModal}
        onClose={() => setShowBackendModal(false)}
      />
    </header>
  );
};
