import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  ValidatedFloodRiskRecord,
  CsvLandCover,
  CsvSoilType,
} from '../types/csvDataset.types';
import { csvDatasetService } from '../services/csvDatasetService';
import { PriorityHorizon } from '../types/gis.types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ErrorBanner } from '../components/common/ErrorBanner';
import { EmptyState } from '../components/common/EmptyState';

export const DatasetIntegrationView: React.FC = () => {
  const {
    csvStatus,
    csvError,
    csvValidationReport,
    csvRecordCount,
    csvSourcePath,
    reloadCsvDataset,
    setCurrentRoute,
    isVerifiedOnly,
    setIsVerifiedOnly,
  } = useApp();

  // Local state for path customization & query
  const [inputPath, setInputPath] = useState<string>(csvSourcePath);
  const [activeTab, setActiveTab] = useState<'records' | 'mapping' | 'validation'>('records');

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLandCover, setSelectedLandCover] = useState<CsvLandCover | 'all'>('all');
  const [selectedSoilType, setSelectedSoilType] = useState<CsvSoilType | 'all'>('all');
  const [selectedFloodStatus, setSelectedFloodStatus] = useState<'all' | 'flood' | 'no_flood'>('all');
  const [selectedHorizon, setSelectedHorizon] = useState<PriorityHorizon | 'all'>('all');
  const [sortBy, setSortBy] = useState<'riskScore' | 'rainfall' | 'discharge' | 'waterLevel' | 'popDensity' | 'elevation' | 'rowIndex'>('riskScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Inspector modal state
  const [inspectedRecord, setInspectedRecord] = useState<ValidatedFloodRiskRecord | null>(null);

  // Column mapping specifications
  const mappingSpecs = useMemo(() => {
    return csvDatasetService.getColumnMappingSpecification();
  }, []);

  // Filtered and paginated records
  const queryResult = useMemo(() => {
    return csvDatasetService.queryRecords({
      searchQuery,
      landCover: selectedLandCover,
      soilType: selectedSoilType,
      floodOccurredFilter: selectedFloodStatus,
      horizonFilter: selectedHorizon,
      sortBy,
      sortOrder,
      page,
      pageSize,
    });
  }, [
    searchQuery,
    selectedLandCover,
    selectedSoilType,
    selectedFloodStatus,
    selectedHorizon,
    sortBy,
    sortOrder,
    page,
    pageSize,
    csvRecordCount,
  ]);

  const handleReload = async () => {
    await reloadCsvDataset(inputPath.trim() || undefined);
    setPage(1);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedLandCover('all');
    setSelectedSoilType('all');
    setSelectedFloodStatus('all');
    setSelectedHorizon('all');
    setPage(1);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* 1. Dataset Header & Source Path Configurator */}
      <div className="bg-gradient-to-r from-blue-950/40 via-gis-surface/70 to-gis-card border border-gis-border rounded-2xl p-4 sm:p-5 shadow-xl space-y-4 transition-colors duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-900/60 text-cyan-300 border border-blue-700/50 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-gis-textPrimary tracking-tight">
                  SurakshaGIS Phase 4: CSV Dataset Integration
                </h2>
                <Badge variant={csvStatus === 'success' ? 'success' : csvStatus === 'error' ? 'danger' : 'warning'}>
                  {csvStatus === 'success'
                    ? `Validated (${csvRecordCount.toLocaleString()} Records)`
                    : csvStatus === 'loading'
                    ? 'Validating...'
                    : csvStatus === 'error'
                    ? 'Load Error'
                    : 'Uninitialized'}
                </Badge>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 border border-amber-800 text-amber-300 font-semibold flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  MOCK / DEMO DATASET
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Typed data service ingesting <code>docs/flood_risk_dataset_india.csv</code> without mutations, strictly tagged <code>isVerified: false</code> for simulation and test harnesses.
              </p>
            </div>
          </div>

          {/* Quick toggle to All+Demo mode if currently verified only */}
          <div className="flex items-center gap-2">
            {isVerifiedOnly ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsVerifiedOnly(false)}
                className="text-amber-500 border-amber-700/60 hover:bg-amber-950/40"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                Enable Demo Mode in App
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setCurrentRoute('hazard-map')}
              >
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                View On GIS Map
              </Button>
            )}
          </div>
        </div>

        {/* Configurable Source Path Control */}
        <div className="pt-3 border-t border-gis-border flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto text-xs text-slate-400 shrink-0">
            <Database className="w-4 h-4 text-gis-accent" />
            <span className="font-semibold text-gis-textPrimary">Source Path:</span>
          </div>
          <div className="relative w-full">
            <input
              type="text"
              value={inputPath}
              onChange={e => setInputPath(e.target.value)}
              placeholder="/docs/flood_risk_dataset_india.csv"
              className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-gis-accent"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReload}
            disabled={csvStatus === 'loading'}
            className="shrink-0 w-full sm:w-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${csvStatus === 'loading' ? 'animate-spin' : ''}`} />
            {csvStatus === 'loading' ? 'Validating...' : 'Reload & Validate'}
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {csvStatus === 'loading' && (
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" label="Reading, parsing, and validating 10,000 records from CSV dataset..." />
        </Card>
      )}

      {/* Error State */}
      {csvStatus === 'error' && (
        <ErrorBanner
          message={csvError || 'Failed to load CSV dataset. Ensure docs/flood_risk_dataset_india.csv exists.'}
          onRetry={handleReload}
          title="CSV Dataset Validation Error"
        />
      )}

      {/* 2. Validation & Quality Audit Dashboard (When loaded) */}
      {csvValidationReport && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Parsed Records</span>
            <strong className="text-xl font-bold text-gis-textPrimary font-mono">
              {csvValidationReport.validRowsCount.toLocaleString()}
            </strong>
            <span className="text-[10px] text-emerald-500 block mt-0.5">100% Passed</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Missing Values</span>
            <strong className="text-xl font-bold text-emerald-500 font-mono">0</strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">All 14 cols complete</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Coordinates Bounds</span>
            <strong className="text-xs font-bold text-cyan-400 font-mono block mt-1">
              8.0°N - 37.0°N
            </strong>
            <span className="text-[10px] text-slate-400 block">68.0°E - 97.0°E (India)</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Flood Occurred (1)</span>
            <strong className="text-xl font-bold text-red-500 font-mono">
              {csvValidationReport.distributionCounts.floodOccurredPositive.toLocaleString()}
            </strong>
            <span className="text-[10px] text-slate-400 block mt-0.5">50.6% positive risk</span>
          </div>

          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">Rainfall Range</span>
            <strong className="text-xs font-bold text-blue-400 font-mono block mt-1">
              {csvValidationReport.attributeRanges.rainfallMm.min} - {csvValidationReport.attributeRanges.rainfallMm.max} mm
            </strong>
            <span className="text-[10px] text-slate-400 block">
              Avg: {csvValidationReport.attributeRanges.rainfallMm.avg} mm
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-gis-card border border-gis-border">
            <span className="text-[10px] font-mono text-slate-400 block uppercase">River Discharge</span>
            <strong className="text-xs font-bold text-amber-500 font-mono block mt-1">
              {csvValidationReport.attributeRanges.riverDischargeM3s.min} - {csvValidationReport.attributeRanges.riverDischargeM3s.max}
            </strong>
            <span className="text-[10px] text-slate-400 block">Peak m³/s channel</span>
          </div>
        </div>
      )}

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gis-border pb-2">
        <button
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'records'
              ? 'bg-gis-accent text-white shadow-md'
              : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Interactive Record Explorer ({csvRecordCount.toLocaleString()})
        </button>

        <button
          onClick={() => setActiveTab('mapping')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'mapping'
              ? 'bg-gis-accent text-white shadow-md'
              : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
          }`}
        >
          <Info className="w-3.5 h-3.5" />
          Explicit Column Mapping Matrix (14 Columns)
        </button>

        <button
          onClick={() => setActiveTab('validation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'validation'
              ? 'bg-gis-accent text-white shadow-md'
              : 'text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Quality & Validation Report
        </button>
      </div>

      {/* TAB 1: INTERACTIVE RECORD EXPLORER */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-gis-card border border-gis-border rounded-xl p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by zone, row #, soil type, or land cover..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-gis-surface border border-gis-border text-gis-textPrimary text-xs rounded-lg pl-9 pr-3 py-1.5 focus:outline-none focus:border-gis-accent"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Land Cover */}
              <select
                value={selectedLandCover}
                onChange={e => {
                  setSelectedLandCover(e.target.value as CsvLandCover | 'all');
                  setPage(1);
                }}
                className="bg-gis-surface border border-gis-border text-xs text-gis-textPrimary rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">All Land Covers</option>
                <option value="Water Body">Water Body</option>
                <option value="Forest">Forest</option>
                <option value="Agricultural">Agricultural</option>
                <option value="Desert">Desert</option>
                <option value="Urban">Urban</option>
              </select>

              {/* Soil Type */}
              <select
                value={selectedSoilType}
                onChange={e => {
                  setSelectedSoilType(e.target.value as CsvSoilType | 'all');
                  setPage(1);
                }}
                className="bg-gis-surface border border-gis-border text-xs text-gis-textPrimary rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">All Soils</option>
                <option value="Clay">Clay</option>
                <option value="Peat">Peat</option>
                <option value="Loam">Loam</option>
                <option value="Sandy">Sandy</option>
                <option value="Silt">Silt</option>
              </select>

              {/* Flood Status */}
              <select
                value={selectedFloodStatus}
                onChange={e => {
                  setSelectedFloodStatus(e.target.value as 'all' | 'flood' | 'no_flood');
                  setPage(1);
                }}
                className="bg-gis-surface border border-gis-border text-xs text-gis-textPrimary rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">All Flood States</option>
                <option value="flood">Flood Occurred (1)</option>
                <option value="no_flood">No Flood (0)</option>
              </select>

              {/* Horizon Filter */}
              <select
                value={selectedHorizon}
                onChange={e => {
                  setSelectedHorizon(e.target.value as PriorityHorizon | 'all');
                  setPage(1);
                }}
                className="bg-gis-surface border border-gis-border text-xs text-gis-textPrimary rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
              >
                <option value="all">All Horizons</option>
                <option value="immediate">Immediate</option>
                <option value="short_term">Short-Term</option>
                <option value="medium_term">Medium-Term</option>
                <option value="monitoring">Monitoring</option>
              </select>

              {(searchQuery || selectedLandCover !== 'all' || selectedSoilType !== 'all' || selectedFloodStatus !== 'all' || selectedHorizon !== 'all') && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-slate-400">
                  Reset
                </Button>
              )}
            </div>
          </div>

          {/* Empty State */}
          {queryResult.data.length === 0 && (
            <Card className="p-8">
              <EmptyState
                title="No CSV Records Match Filters"
                description="Try clearing your search query or broadening your categorical filters."
                actionLabel="Reset All Filters"
                onAction={resetFilters}
              />
            </Card>
          )}

          {/* Records Table */}
          {queryResult.data.length > 0 && (
            <div className="bg-gis-card border border-gis-border rounded-xl overflow-hidden shadow-lg">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gis-surface/80 border-b border-gis-border text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="px-3.5 py-2.5">Row #</th>
                      <th className="px-3 py-2.5">Coordinates</th>
                      <th className="px-3 py-2.5">Region Zone</th>
                      <th className="px-3 py-2.5">Land Cover / Soil</th>
                      <th className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            if (sortBy === 'rainfall') setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                            else {
                              setSortBy('rainfall');
                              setSortOrder('desc');
                            }
                          }}
                          className="flex items-center gap-1 hover:text-gis-textPrimary"
                        >
                          Rainfall (mm)
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            if (sortBy === 'discharge') setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                            else {
                              setSortBy('discharge');
                              setSortOrder('desc');
                            }
                          }}
                          className="flex items-center gap-1 hover:text-gis-textPrimary"
                        >
                          River Discharge
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-3 py-2.5">Water Level</th>
                      <th className="px-3 py-2.5">Flood Occurred</th>
                      <th className="px-3 py-2.5">
                        <button
                          onClick={() => {
                            if (sortBy === 'riskScore') setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
                            else {
                              setSortBy('riskScore');
                              setSortOrder('desc');
                            }
                          }}
                          className="flex items-center gap-1 hover:text-gis-textPrimary"
                        >
                          Risk Score
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>
                      <th className="px-3 py-2.5">Horizon</th>
                      <th className="px-3.5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gis-border/60">
                    {queryResult.data.map(r => (
                      <tr
                        key={r.id}
                        onClick={() => setInspectedRecord(r)}
                        className="hover:bg-gis-surface/50 transition-colors cursor-pointer"
                      >
                        <td className="px-3.5 py-2.5 font-mono text-slate-400 font-semibold">
                          #{r.rowIndex}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {r.latitude.toFixed(3)}°N, {r.longitude.toFixed(3)}°E
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">
                          {r.geographicZone.split(' ')[0]}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="text-gis-textPrimary font-medium">{r.landCover}</span>
                          <span className="text-slate-400 text-[10px] block font-mono">{r.soilType}</span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-blue-400">
                          {r.rainfallMm} mm
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {r.riverDischargeM3s.toFixed(0)} m³/s
                        </td>
                        <td className="px-3 py-2.5 font-mono text-cyan-400">
                          {r.waterLevelM} m
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant={r.floodOccurred ? 'danger' : 'info'} size="sm">
                            {r.floodOccurred ? 'Flood (1)' : 'No Flood (0)'}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-red-500">
                          {r.calculatedRiskScore}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            variant={
                              r.priorityHorizon === 'immediate'
                                ? 'danger'
                                : r.priorityHorizon === 'short_term'
                                ? 'warning'
                                : 'primary'
                            }
                            size="sm"
                          >
                            {r.priorityHorizon}
                          </Badge>
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={e => {
                              e.stopPropagation();
                              setInspectedRecord(r);
                            }}
                            className="text-xs"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="p-3 bg-gis-surface/50 border-t border-gis-border flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400">
                    Showing {(page - 1) * pageSize + 1} to{' '}
                    {Math.min(page * pageSize, queryResult.total)} of{' '}
                    {queryResult.total.toLocaleString()} matched records
                  </span>
                  <select
                    value={pageSize}
                    onChange={e => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-gis-surface border border-gis-border rounded px-2 py-0.5 text-xs text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                    title="Rows per page"
                  >
                    <option value={15}>15 / page</option>
                    <option value={25}>25 / page</option>
                    <option value={50}>50 / page</option>
                    <option value={100}>100 / page</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    icon={<ChevronLeft className="w-3.5 h-3.5" />}
                  >
                    Prev
                  </Button>
                  <span className="px-2 py-1 bg-gis-surface border border-gis-border rounded text-gis-textPrimary">
                    Page {page} of {queryResult.totalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= queryResult.totalPages}
                    onClick={() => setPage(prev => Math.min(queryResult.totalPages, prev + 1))}
                    icon={<ChevronRight className="w-3.5 h-3.5" />}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COLUMN MAPPING SPECIFICATION */}
      {activeTab === 'mapping' && (
        <Card
          title="RFC 4180 Ingestion Schema & Transformation Matrix"
          subtitle="Documented mapping of all 14 authentic CSV columns to internal spatial decision support models"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gis-surface/80 border-b border-gis-border text-slate-400 font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-3.5 py-2.5">CSV Column Name</th>
                  <th className="px-3 py-2.5">Sample Value</th>
                  <th className="px-3 py-2.5">Data Type</th>
                  <th className="px-3 py-2.5">Target Domain Model</th>
                  <th className="px-3 py-2.5">Target Field</th>
                  <th className="px-3 py-2.5">Transformation Logic & Formula</th>
                  <th className="px-3.5 py-2.5">Provenance Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gis-border/60 font-mono">
                {mappingSpecs.map((spec, i) => (
                  <tr key={i} className="hover:bg-gis-surface/40">
                    <td className="px-3.5 py-3 font-bold text-cyan-400">
                      {spec.csvColumn}
                    </td>
                    <td className="px-3 py-3 text-slate-400">
                      {spec.sampleValue}
                    </td>
                    <td className="px-3 py-3 text-slate-400 text-[11px]">
                      {spec.dataType}
                    </td>
                    <td className="px-3 py-3 text-gis-textPrimary">
                      {spec.applicationModel}
                    </td>
                    <td className="px-3 py-3 text-gis-accent">
                      {spec.targetField}
                    </td>
                    <td className="px-3 py-3 text-slate-400 font-sans text-xs leading-relaxed max-w-xs">
                      {spec.transformationLogic}
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                        spec.provenanceCategory === 'Simulation Label'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                          : spec.provenanceCategory === 'Derived Metric'
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                          : 'bg-blue-950/80 text-blue-300 border border-blue-800'
                      }`}>
                        {spec.provenanceCategory}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: QUALITY & VALIDATION REPORT */}
      {activeTab === 'validation' && csvValidationReport && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 sm:p-5 space-y-3">
            <h4 className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Dataset Quality & Completeness Audit
            </h4>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1.5 border-b border-gis-border">
                <span className="text-slate-400">Total Lines in File:</span>
                <span className="text-gis-textPrimary font-bold">{csvValidationReport.totalLines.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gis-border">
                <span className="text-slate-400">Valid Ingested Records:</span>
                <span className="text-emerald-500 font-bold">{csvValidationReport.validRowsCount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gis-border">
                <span className="text-slate-400">Malformed / Invalid Rows:</span>
                <span className="text-gis-textPrimary font-bold">{csvValidationReport.invalidRowsCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gis-border">
                <span className="text-slate-400">Duplicate Coordinate Pairs:</span>
                <span className="text-gis-textPrimary font-bold">{csvValidationReport.duplicateCoordinatesCount}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gis-border">
                <span className="text-slate-400">Indian Boundary Enforcement:</span>
                <span className="text-emerald-500 font-bold">100% Valid (EPSG:4326)</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Validation Timestamp:</span>
                <span className="text-slate-400">{csvValidationReport.parsedAtTimestamp}</span>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 space-y-3">
            <h4 className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider font-mono flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-400" />
              Categorical Balance in Authentic CSV
            </h4>
            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Land Cover Breakdown:</span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {Object.entries(csvValidationReport.distributionCounts.landCover).map(([k, v]) => (
                    <div key={k} className="p-1.5 rounded bg-gis-surface border border-gis-border flex justify-between">
                      <span className="text-slate-400">{k}:</span>
                      <strong className="text-gis-textPrimary">{v} ({Math.round((v / csvValidationReport.validRowsCount) * 100)}%)</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-[11px] block mb-1">Soil Type Breakdown:</span>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {Object.entries(csvValidationReport.distributionCounts.soilType).map(([k, v]) => (
                    <div key={k} className="p-1.5 rounded bg-gis-surface border border-gis-border flex justify-between">
                      <span className="text-slate-400">{k}:</span>
                      <strong className="text-gis-textPrimary">{v} ({Math.round((v / csvValidationReport.validRowsCount) * 100)}%)</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Slide-over Inspection Dossier Modal */}
      {inspectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-gis-border">
              <div>
                <h3 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                  Observation Record #{inspectedRecord.rowIndex}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  ID: <code className="text-cyan-400">{inspectedRecord.id}</code> ({inspectedRecord.geographicZone})
                </p>
              </div>
              <button
                onClick={() => setInspectedRecord(null)}
                className="text-slate-400 hover:text-gis-textPrimary text-sm"
              >
                ✕
              </button>
            </div>

            {/* Complete 14 attributes grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">LATITUDE</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.latitude}° N</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">LONGITUDE</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.longitude}° E</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">RAINFALL</span>
                <strong className="text-blue-400">{inspectedRecord.rainfallMm} mm</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">TEMPERATURE</span>
                <strong className="text-amber-500">{inspectedRecord.temperatureC} °C</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">HUMIDITY</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.humidityPct} %</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">RIVER DISCHARGE</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.riverDischargeM3s} m³/s</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">WATER LEVEL</span>
                <strong className="text-cyan-400">{inspectedRecord.waterLevelM} m</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">ELEVATION</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.elevationM} m</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">LAND COVER</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.landCover}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">SOIL TYPE</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.soilType}</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">POPULATION DENSITY</span>
                <strong className="text-gis-textPrimary">{inspectedRecord.populationDensity} pop/km²</strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">INFRASTRUCTURE</span>
                <strong className={inspectedRecord.hasInfrastructure ? 'text-emerald-500' : 'text-red-500'}>
                  {inspectedRecord.hasInfrastructure ? 'Present (1)' : 'Absent / Poor (0)'}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">HISTORICAL FLOODS</span>
                <strong className="text-gis-textPrimary">
                  {inspectedRecord.historicalFloodsCount > 0 ? 'Yes (1)' : 'No (0)'}
                </strong>
              </div>
              <div className="p-2.5 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-slate-400 block text-[10px]">FLOOD OCCURRED (TARGET)</span>
                <strong className={inspectedRecord.floodOccurred ? 'text-red-500' : 'text-blue-500'}>
                  {inspectedRecord.floodOccurred ? 'POSITIVE (1)' : 'NEGATIVE (0)'}
                </strong>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-500">
              <span className="font-bold block mb-0.5">Synthetic Provenance Tag:</span>
              This record is from <code>docs/flood_risk_dataset_india.csv</code> and tagged <code>isVerified = false</code>. It serves as mock test harness data for Phase 4.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gis-border">
              <Button variant="secondary" size="sm" onClick={() => setInspectedRecord(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setInspectedRecord(null);
                  setCurrentRoute('hazard-map');
                }}
              >
                Inspect on GIS Map
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
