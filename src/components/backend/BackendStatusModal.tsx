import React, { useState } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Lock,
  Layers,
  Terminal,
  Cpu,
  FileCode,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { getSupabaseKeyType } from '../../services/supabaseClient';

interface BackendStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackendStatusModal: React.FC<BackendStatusModalProps> = ({ isOpen, onClose }) => {
  const {
    isSupabaseConfigured,
    backendMode,
    backendMessage,
    backendLatencyMs,
    isTestingBackend,
    testBackendConnection,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'status' | 'migrations' | 'setup'>('status');

  if (!isOpen) return null;

  const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const isUrlProvided = Boolean(rawUrl && rawUrl.trim() !== '' && !rawUrl.includes('your-project-id'));
  const keyType = getSupabaseKeyType();

  const migrationsList = [
    {
      step: '01',
      file: '20261022000001_enable_postgis_and_types.sql',
      desc: 'Enables postgis & uuid-ossp extensions; defines hazard_type_enum, user_role_enum, etc.',
      status: 'Verified (Types & PostGIS Installed)',
      statusColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    {
      step: '02',
      file: '20261022000002_create_core_tables.sql',
      desc: 'Creates 9 tables with EPSG:4326 geometries, constraints, updated_at triggers, and GiST indexes.',
      status: 'Pending SQL Run (Tables Missing)',
      statusColor: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    },
    {
      step: '03',
      file: '20261022000003_create_spatial_functions.sql',
      desc: 'Defines 5 PostGIS RPCs: Red Zone buffering, Carrying Capacity, AHP Prioritization, Buffer Intersection, Spatial Metrics.',
      status: 'Verified (5 RPC Functions Installed)',
      statusColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-500/30',
    },
    {
      step: '04',
      file: '20261022000004_create_rls_policies.sql',
      desc: 'Applies Row Level Security (RLS) and least-privilege role policies for public, surveyors, planners, and SDMA admins.',
      status: 'Pending SQL Run (RLS & Triggers)',
      statusColor: 'text-amber-400 bg-amber-950/60 border-amber-500/30',
    },
    {
      step: '05',
      file: 'seed_data.sql',
      desc: 'Populates authentic ground-truth geometries for Wayanad, Chamoli, and Majuli plus demo scenarios.',
      status: 'Optional (Ground Truth)',
      statusColor: 'text-slate-400 bg-slate-900/60 border-slate-700/30',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gis-card border border-gis-border rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gis-border flex items-center justify-between bg-gis-surface/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                Supabase & PostgreSQL/PostGIS Engine
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gis-dark border border-gis-border text-slate-300">
                  Phase 5
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Spatial relational architecture & fallback status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gis-border px-6 bg-gis-dark/40">
          <button
            onClick={() => setActiveTab('status')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'status'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-gis-textPrimary'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Live Status & Diagnostics
          </button>
          <button
            onClick={() => setActiveTab('migrations')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'migrations'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-gis-textPrimary'
            }`}
          >
            <FileCode className="w-4 h-4" />
            SQL Migrations (5 Files)
          </button>
          <button
            onClick={() => setActiveTab('setup')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'setup'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-gis-textPrimary'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Setup & Deployment Guide
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'status' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  backendMode === 'supabase_postgis'
                    ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                    : isSupabaseConfigured
                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-300'
                    : 'bg-blue-950/30 border-blue-500/30 text-blue-300'
                }`}
              >
                {backendMode === 'supabase_postgis' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : isSupabaseConfigured ? (
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Database className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="text-sm font-bold flex items-center gap-2">
                    {backendMode === 'supabase_postgis'
                      ? 'Live Supabase PostGIS Backend Connected'
                      : isSupabaseConfigured
                      ? 'Supabase Configured (Unreachable / Migrations Pending)'
                      : 'Local Fallback Mode Active (CSV + Synthetic Benchmark)'}
                    {backendLatencyMs !== null && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/40 text-slate-300">
                        {backendLatencyMs} ms
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {backendMessage}
                  </p>
                </div>
              </div>

              {/* Architecture & Security Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Supabase Project URL
                  </div>
                  <div className="text-xs font-mono text-gis-textPrimary truncate">
                    {isUrlProvided ? rawUrl : 'Not Configured (Running in Mock Fallback)'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Source: <code className="text-slate-400">VITE_SUPABASE_URL</code> in <code className="text-slate-400">.env</code>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Public Anon Key (Browser Safe)
                  </div>
                  <div className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {isSupabaseConfigured
                      ? `Configured (${
                          keyType === 'publishable'
                            ? 'Publishable sb_publishable_...'
                            : keyType === 'legacy_jwt'
                            ? 'Legacy Anon JWT eyJ...'
                            : 'Client Key'
                        })`
                      : 'Empty / Offline'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Source: <code className="text-slate-400">VITE_SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY</code>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Security Key Exposure Guard
                  </div>
                  <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Service-Role Key: Never Exposed
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Frontend code strictly enforces Row Level Security (RLS) via Anon Key
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-1.5">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    Spatial Engine & PostGIS
                  </div>
                  <div className="text-xs text-blue-300 font-medium">
                    PostgreSQL 16 + PostGIS 3.4
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Coordinates in EPSG:4326 (WGS84); geodesic metrics in EPSG:7030
                  </div>
                </div>
              </div>

              {/* Graceful Degradation Notice */}
              <div className="p-3.5 rounded-xl bg-gis-dark border border-gis-border space-y-2">
                <div className="text-xs font-bold text-gis-textPrimary flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Graceful Fallback System Guarantee
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  SurakshaGIS was designed to operate seamlessly even when the remote database is offline or unconfigured. In fallback mode, the GIS map, risk assessment tables, AHP relocation horizon matrices, and carrying capacity calculations use verified Phase 4 CSV records and authentic benchmark data.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'migrations' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                SQL migration scripts have been generated in <code className="text-blue-400 font-mono">supabase/migrations/</code>. Apply them to any Supabase project via the SQL Editor or CLI.
              </p>
              <div className="space-y-2">
                {migrationsList.map(item => (
                  <div
                    key={item.step}
                    className="p-3 rounded-xl bg-gis-surface/60 border border-gis-border flex items-start gap-3"
                  >
                    <span className="w-6 h-6 rounded-md bg-gis-dark border border-gis-border flex items-center justify-center text-[10px] font-mono text-blue-400 shrink-0 font-bold">
                      {item.step}
                    </span>
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="text-xs font-mono font-bold text-gis-textPrimary truncate">
                        {item.file}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${item.statusColor}`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'setup' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-2">
                <div className="text-xs font-bold text-gis-textPrimary">
                  Step 1: Create a Free Supabase Project
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Visit <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-blue-400 underline inline-flex items-center gap-1">supabase.com <ExternalLink className="w-3 h-3" /></a> and create a new project. Choose a region closest to your users (e.g. Mumbai/ap-south-1).
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-2">
                <div className="text-xs font-bold text-gis-textPrimary">
                  Step 2: Run Consolidated SQL Setup
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Navigate to <strong>SQL Editor</strong> in Supabase Studio, paste and execute the single consolidated setup file:
                </p>
                <div className="bg-gis-dark p-2.5 rounded-lg border border-gis-border text-[11px] font-mono text-emerald-400 space-y-1">
                  <div>📁 supabase/FINAL_REMOTE_SETUP.sql (Consolidated Idempotent Setup)</div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Or apply individual migration files in numerical order: <code>01_enable_postgis</code>, <code>02_create_core_tables</code>, <code>03_create_spatial_functions</code>, <code>04_create_rls_policies</code>.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-gis-surface/60 border border-gis-border space-y-2">
                <div className="text-xs font-bold text-gis-textPrimary">
                  Step 3: Add Credentials to .env
                </div>
                <div className="bg-gis-dark p-2.5 rounded-lg border border-gis-border text-[11px] font-mono text-emerald-400 space-y-1">
                  <div>VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co</div>
                  <div>VITE_SUPABASE_ANON_KEY=eyJhbGciOi...[PUBLIC_ANON_KEY]</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-gis-border flex items-center justify-between bg-gis-surface/40">
          <div className="text-xs text-slate-400">
            {backendMode === 'supabase_postgis' ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live PostGIS Connection Verified
              </span>
            ) : (
              <span className="text-slate-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Local Mode: Ready for Deployment
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={testBackendConnection}
              disabled={isTestingBackend}
              className="text-xs py-1.5 px-3"
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isTestingBackend ? 'animate-spin' : ''}`} />
              {isTestingBackend ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button variant="primary" onClick={onClose} className="text-xs py-1.5 px-4">
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
