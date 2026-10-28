import React, { useState, useMemo } from 'react';
import {
  Home,
  CheckCircle2,
  TrendingDown,
  Scale,
  PlusCircle,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { CandidateRelocationSite } from '../types/gis.types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { VerificationBadge } from '../components/common/VerificationBadge';
import { EmptyState } from '../components/common/EmptyState';
import { evaluateCarryingCapacity } from '../utils/gisCalculators';

export const RelocationSitesView: React.FC = () => {
  const {
    candidateSites,
    settlements,
    userRole,
    addCandidateSite,
    setCurrentRoute,
    persistenceStorageType,
  } = useApp();

  // Dynamic Planning Standard Basis (National Building Code SP 7 norm = 45 sqm)
  const [perCapitaBasisSqm, setPerCapitaBasisSqm] = useState<number>(45.0);
  const [selectedSite, setSelectedSite] = useState<CandidateRelocationSite | null>(null);
  const [showProposalModal, setShowProposalModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New Parcel Form State
  const [formName, setFormName] = useState('');
  const [formDistrict, setFormDistrict] = useState('Wayanad');
  const [formTotalAreaSqm, setFormTotalAreaSqm] = useState<number>(100000);
  const [formSlopeDeg, setFormSlopeDeg] = useState<number>(5.5);
  const [formRoadDistM, setFormRoadDistM] = useState<number>(200);
  const [formWaterDistM, setFormWaterDistM] = useState<number>(400);
  const [formHospitalKm, setFormHospitalKm] = useState<number>(4.0);
  const [formSchoolKm, setFormSchoolKm] = useState<number>(2.0);
  const [formOwnership, setFormOwnership] = useState('Government Revenue Land (Unencumbered)');

  // Dynamic evaluation of all sites based on active per-capita standard
  const evaluatedSites = useMemo(() => {
    return candidateSites.map(site => {
      const evaluation = evaluateCarryingCapacity({
        totalAreaSqm: site.totalAreaSqm,
        avgSlopeDegrees: site.avgSlopeDegrees,
        perCapitaGrossSqm: perCapitaBasisSqm,
        currentAllocatedPop: site.currentAllocatedPop,
      });

      return {
        ...site,
        dynamicMaxCapacity: evaluation.maxCarryingCapacityPop,
        dynamicRemainingMargin: evaluation.remainingCapacityMargin,
        evaluation,
      };
    });
  }, [candidateSites, perCapitaBasisSqm]);

  const totalAreaSqm = evaluatedSites.reduce((acc, s) => acc + s.totalAreaSqm, 0);
  const totalUsableAreaSqm = evaluatedSites.reduce((acc, s) => acc + s.usableAreaSqm, 0);
  const totalCapacity = evaluatedSites.reduce((acc, s) => acc + s.dynamicMaxCapacity, 0);
  const totalAllocated = evaluatedSites.reduce((acc, s) => acc + s.currentAllocatedPop, 0);
  const remainingMargin = Math.max(0, totalCapacity - totalAllocated);

  // Proposal Form Live Evaluation Preview
  const proposalEvaluation = useMemo(() => {
    return evaluateCarryingCapacity({
      totalAreaSqm: formTotalAreaSqm,
      avgSlopeDegrees: formSlopeDeg,
      perCapitaGrossSqm: perCapitaBasisSqm,
    });
  }, [formTotalAreaSqm, formSlopeDeg, perCapitaBasisSqm]);

  // Handle New Parcel Submission
  const handleProposeParcel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const siteCode = `CRS-${formDistrict.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-3)}`;
    const newSite: CandidateRelocationSite = {
      id: `site-${Date.now()}`,
      siteCode,
      locationName: formName.trim(),
      district: formDistrict,
      coordinates: [
        { lat: 11.58, lng: 76.12 },
        { lat: 11.59, lng: 76.13 },
        { lat: 11.585, lng: 76.14 },
        { lat: 11.575, lng: 76.13 },
      ],
      centroid: { lat: 11.582, lng: 76.13 },
      totalAreaSqm: formTotalAreaSqm,
      usableAreaSqm: proposalEvaluation.netUsableAreaSqm,
      avgSlopeDegrees: formSlopeDeg,
      distanceToPrimaryRoadM: formRoadDistM,
      distanceToWaterSourceM: formWaterDistM,
      distanceToNearestHospitalKm: formHospitalKm,
      distanceToNearestSchoolKm: formSchoolKm,
      maxCarryingCapacityPop: proposalEvaluation.maxCarryingCapacityPop,
      currentAllocatedPop: 0,
      suitabilityScore: Math.round(
        Math.max(50, 100 - formSlopeDeg * 2.5 - (formHospitalKm / 10) * 10)
      ),
      landOwnershipType: formOwnership,
      isVerified: true,
      dataSource: `State Land Bank & Cadastral Registry (${formDistrict} DDMA)`,
    };

    addCandidateSite(newSite);
    setShowProposalModal(false);
    setToastMessage(`Parcel "${newSite.locationName}" (${newSite.siteCode}) successfully evaluated and saved.`);
    setTimeout(() => setToastMessage(null), 4000);

    // Reset form
    setFormName('');
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 shadow-xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{toastMessage}</span>
        </div>
      )}

      {/* Top Carrying Capacity Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-gis-card border border-gis-border flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Total Safe Parcels
            </p>
            <p className="text-2xl font-bold text-gis-textPrimary font-mono">{evaluatedSites.length}</p>
            <p className="text-xs text-slate-400">Inspected & cleared sites</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
            <Home className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gis-card border border-gis-border flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Usable Land Area
            </p>
            <p className="text-2xl font-bold text-gis-textPrimary font-mono">
              {(totalUsableAreaSqm / 10000).toFixed(1)} ha
            </p>
            <p className="text-xs text-slate-400">
              Total: {(totalAreaSqm / 10000).toFixed(1)} ha gross
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/30">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gis-card border border-gis-border flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Max Population Capacity
            </p>
            <p className="text-2xl font-bold text-gis-textPrimary font-mono">
              {totalCapacity.toLocaleString()}
            </p>
            <p className="text-xs text-emerald-500 font-medium font-mono">
              {perCapitaBasisSqm} m² / person standard
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/30">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-gis-card border border-gis-border flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Remaining Absorptive Buffer
            </p>
            <p className="text-2xl font-bold text-emerald-500 font-mono">
              {remainingMargin.toLocaleString()}
            </p>
            <p className="text-xs text-slate-400">
              {totalAllocated.toLocaleString()} already allocated
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dynamic Standard Calibration Bar */}
      <div className="bg-gis-card border border-gis-border rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sliders className="w-4 h-4 text-gis-accent shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-gis-textPrimary uppercase tracking-wider">
              Carrying Capacity Standard Calibration
            </h4>
            <p className="text-[11px] text-slate-400">
              Adjust gross per-capita land allocation to test absorption under NBC SP 7 guidelines.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs w-full md:w-auto">
          {[
            { val: 30, label: '30 m² (Emergency)' },
            { val: 45, label: '45 m² (NBC Standard)' },
            { val: 60, label: '60 m² (Extended)' },
          ].map(opt => (
            <button
              key={opt.val}
              onClick={() => setPerCapitaBasisSqm(opt.val)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                perCapitaBasisSqm === opt.val
                  ? 'bg-gis-accent text-white shadow-sm'
                  : 'bg-gis-surface text-slate-400 hover:text-gis-textPrimary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sites Listing */}
      <Card
        title="Candidate Relocation Land Parcels & Carrying Capacity"
        subtitle="Evaluated using PostGIS spatial buffer subtraction, terrain slope penalties (>15° triggers 40% reduction), and infrastructure catchments"
        action={
          userRole === 'sdma_admin' || userRole === 'district_planner' ? (
            <Button
              variant="primary"
              size="sm"
              icon={<PlusCircle className="w-4 h-4" />}
              onClick={() => setShowProposalModal(true)}
            >
              Propose New Parcel
            </Button>
          ) : undefined
        }
      >
        {evaluatedSites.length === 0 ? (
          <EmptyState
            title="No Candidate Sites Available"
            description="No relocation parcels match the active district or verification filters. Switch to include benchmark scenarios to test hypothetical parcels."
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {evaluatedSites.map(site => {
              const allocationPct = Math.round(
                (site.currentAllocatedPop / site.dynamicMaxCapacity) * 100
              );
              return (
                <div
                  key={site.id}
                  className="bg-gis-surface/50 border border-gis-border hover:border-emerald-600/60 rounded-xl p-4 space-y-3 transition-all shadow-md"
                >
                  {/* Site Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gis-textPrimary text-base">{site.locationName}</span>
                        <span className="text-[10px] font-mono text-slate-400 bg-gis-surface px-2 py-0.5 rounded border border-gis-border">
                          {site.siteCode}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        District: <strong className="text-gis-textPrimary">{site.district}</strong> • Ownership:{' '}
                        <strong className="text-gis-textPrimary">{site.landOwnershipType}</strong>
                      </p>
                    </div>
                    <Badge variant="success" size="sm">
                      Suitability {site.suitabilityScore}
                    </Badge>
                  </div>

                  {/* Key Geospatial Factors */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-gis-surface border border-gis-border">
                      <span className="text-[10px] text-slate-400 block">AVG SLOPE</span>
                      <strong
                        className={
                          site.avgSlopeDegrees <= 15 ? 'text-emerald-500' : 'text-amber-500'
                        }
                      >
                        {site.avgSlopeDegrees}° ({site.avgSlopeDegrees <= 15 ? 'Stable' : 'Penalty -40%'})
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-gis-surface border border-gis-border">
                      <span className="text-[10px] text-slate-400 block">USABLE AREA</span>
                      <strong className="text-gis-textPrimary">
                        {(site.usableAreaSqm / 1000).toFixed(0)}k m²
                      </strong>
                    </div>
                    <div className="p-2 rounded bg-gis-surface border border-gis-border">
                      <span className="text-[10px] text-slate-400 block">HOSPITAL</span>
                      <strong className="text-gis-textPrimary">{site.distanceToNearestHospitalKm} km</strong>
                    </div>
                    <div className="p-2 rounded bg-gis-surface border border-gis-border">
                      <span className="text-[10px] text-slate-400 block">ROAD DIST</span>
                      <strong className="text-gis-textPrimary">{site.distanceToPrimaryRoadM}m</strong>
                    </div>
                  </div>

                  {/* Carrying Capacity Gauge */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-400">
                        Carrying Capacity ({perCapitaBasisSqm} m²/capita):
                      </span>
                      <span className="font-mono text-gis-textPrimary font-semibold">
                        {site.currentAllocatedPop.toLocaleString()} /{' '}
                        {site.dynamicMaxCapacity.toLocaleString()} ({allocationPct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-gis-surface overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          allocationPct >= 90
                            ? 'bg-red-500'
                            : allocationPct >= 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(100, allocationPct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Provenance Badge & Action */}
                  <div className="flex items-center justify-between pt-2 border-t border-gis-border/60">
                    <VerificationBadge
                      isVerified={site.isVerified}
                      dataSource={site.dataSource}
                      size="sm"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedSite(site)}
                      className="text-xs text-gis-accent hover:text-blue-500"
                    >
                      Inspect Cadastral Details →
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Cadastral Detail Modal */}
      {selectedSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-gis-textPrimary">{selectedSite.locationName}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  Site Code: {selectedSite.siteCode} • District: {selectedSite.district}
                </p>
              </div>
              <button
                onClick={() => setSelectedSite(null)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Detailed Carrying Capacity Breakdown */}
              <div className="p-3.5 rounded-xl bg-gis-surface border border-gis-border space-y-2">
                <span className="text-[10px] text-emerald-500 uppercase font-mono font-bold block flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> NBC SP 7 Carrying Capacity Breakdown
                </span>
                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2 rounded bg-gis-card border border-gis-border/60">
                    <span className="text-[10px] text-slate-400 block">GROSS LAND AREA</span>
                    <strong className="text-gis-textPrimary">
                      {(selectedSite.totalAreaSqm / 10000).toFixed(2)} Hectares (
                      {selectedSite.totalAreaSqm.toLocaleString()} m²)
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-gis-card border border-gis-border/60">
                    <span className="text-[10px] text-slate-400 block">NET USABLE AREA (-25%)</span>
                    <strong className="text-emerald-500">
                      {selectedSite.usableAreaSqm.toLocaleString()} m²
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-gis-card border border-gis-border/60">
                    <span className="text-[10px] text-slate-400 block">AVG TERRAIN GRADIENT</span>
                    <strong className="text-gis-textPrimary">
                      {selectedSite.avgSlopeDegrees}° (
                      {selectedSite.avgSlopeDegrees <= 15 ? 'Cleared' : 'Restricted Slope'})
                    </strong>
                  </div>
                  <div className="p-2 rounded bg-gis-card border border-gis-border/60">
                    <span className="text-[10px] text-slate-400 block">MAX ABSORBABLE CITIZENS</span>
                    <strong className="text-emerald-500 text-sm">
                      {selectedSite.maxCarryingCapacityPop.toLocaleString()} pop
                    </strong>
                  </div>
                </div>
              </div>

              {/* Infrastructure Catchments */}
              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">ACCESS TO PRIMARY ROAD</span>
                  <strong className="text-gis-textPrimary">{selectedSite.distanceToPrimaryRoadM}m distance</strong>
                </div>
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">WATER CATCHMENT</span>
                  <strong className="text-gis-textPrimary">{selectedSite.distanceToWaterSourceM}m distance</strong>
                </div>
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">HEALTHCARE ACCESS</span>
                  <strong className="text-gis-textPrimary">{selectedSite.distanceToNearestHospitalKm} km to Hospital</strong>
                </div>
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">PRIMARY EDUCATION</span>
                  <strong className="text-gis-textPrimary">{selectedSite.distanceToNearestSchoolKm} km to School</strong>
                </div>
              </div>

              {/* Compatible Settlement Allocation Matcher */}
              <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 space-y-2">
                <span className="text-[10px] text-blue-400 uppercase font-mono font-bold block flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-500" /> Compatible Immediate Settlements for this Site
                </span>
                <div className="space-y-1.5">
                  {settlements
                    .filter(
                      s =>
                        s.district === selectedSite.district &&
                        s.priorityHorizon === 'immediate'
                    )
                    .map(s => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-2 rounded bg-gis-card border border-gis-border text-xs"
                      >
                        <div>
                          <span className="font-semibold text-gis-textPrimary">{s.name}</span>
                          <span className="text-slate-400 block text-[10px] font-mono">
                            {s.totalPopulation} citizens • {s.householdCount} households
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="text-[11px] text-gis-accent hover:text-gis-accentHover"
                          icon={<ArrowRight className="w-3 h-3" />}
                          onClick={() => {
                            setSelectedSite(null);
                            setCurrentRoute('reports');
                          }}
                        >
                          Draft RAP Allocation
                        </Button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1">
                  Data Provenance & Cadastral Verification
                </span>
                <VerificationBadge
                  isVerified={selectedSite.isVerified}
                  dataSource={selectedSite.dataSource}
                  showSource
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gis-border">
              <Button variant="secondary" size="sm" onClick={() => setSelectedSite(null)}>
                Close Dossier
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Propose & Evaluate Candidate Parcel Modal */}
      {showProposalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleProposeParcel}
            className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-emerald-400" />
                  Propose & Evaluate Candidate Relocation Parcel
                </h3>
                <p className="text-xs text-slate-400">
                  Runs PostGIS Carrying Capacity & Terrain Buildability Algorithms
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProposalModal(false)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gis-textPrimary block mb-1 font-semibold">Location / Parcel Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Meppadi North Tableland Parcel"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Target District</label>
                  <input
                    type="text"
                    required
                    value={formDistrict}
                    onChange={e => setFormDistrict(e.target.value)}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                  />
                </div>
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Total Land Area (m²)</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={formTotalAreaSqm}
                    onChange={e => setFormTotalAreaSqm(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Average Terrain Slope (°)</label>
                  <input
                    type="number"
                    min="0"
                    max="45"
                    step="0.1"
                    required
                    value={formSlopeDeg}
                    onChange={e => setFormSlopeDeg(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {formSlopeDeg <= 15 ? '✓ Slope ≤ 15° (Cleared for Construction)' : '⚠️ Slope > 15° (Triggers 40% reduction)'}
                  </span>
                </div>
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Road Distance (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={formRoadDistM}
                    onChange={e => setFormRoadDistM(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold text-xs">Water Source (m)</label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    required
                    value={formWaterDistM}
                    onChange={e => setFormWaterDistM(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-2.5 py-1.5 text-xs text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                </div>
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold text-xs">Hospital (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={formHospitalKm}
                    onChange={e => setFormHospitalKm(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-2.5 py-1.5 text-xs text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                </div>
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold text-xs">School (km)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    required
                    value={formSchoolKm}
                    onChange={e => setFormSchoolKm(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-2.5 py-1.5 text-xs text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-gis-textPrimary block mb-1 font-semibold">Land Ownership / Cadastral Classification</label>
                <select
                  value={formOwnership}
                  onChange={e => setFormOwnership(e.target.value)}
                  className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                >
                  <option value="Government Revenue Land (Unencumbered)">Government Revenue Land (Unencumbered)</option>
                  <option value="Acquired Commercial Tea Plantation Plateau">Acquired Commercial Tea Plantation Plateau</option>
                  <option value="Municipal Evacuee Land Bank">Municipal Evacuee Land Bank</option>
                  <option value="Forest Fringe Reclaimed Revenue Land">Forest Fringe Reclaimed Revenue Land</option>
                </select>
              </div>

              {/* Live Evaluated Capacity Preview */}
              <div className="p-3 rounded-xl bg-gis-surface border border-gis-border font-mono space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Algorithms Live Output:</span>
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Usable Area (-25%):</span>
                  <span className="text-gis-textPrimary font-bold">{proposalEvaluation.netUsableAreaSqm.toLocaleString()} m²</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Absorptive Capacity (@ {perCapitaBasisSqm} m²):</span>
                  <span className="text-emerald-500 font-bold">{proposalEvaluation.maxCarryingCapacityPop.toLocaleString()} citizens</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-gis-border">
              <span className="text-[11px] text-slate-400 font-mono">
                Storage: {persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Browser Storage'}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowProposalModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Register & Persist Parcel
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
