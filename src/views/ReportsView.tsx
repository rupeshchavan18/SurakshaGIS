import React, { useState } from 'react';
import {
  FileCheck2,
  Download,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  History,
  PlusCircle,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RelocationActionPlan, PriorityHorizon } from '../types/gis.types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { VerificationBadge } from '../components/common/VerificationBadge';
import { EmptyState } from '../components/common/EmptyState';

export const ReportsView: React.FC = () => {
  const {
    actionPlans,
    userRole,
    settlements,
    candidateSites,
    addActionPlan,
    updateActionPlanStatus,
    auditLogs,
    persistenceStorageType,
  } = useApp();

  const [selectedPlan, setSelectedPlan] = useState<RelocationActionPlan | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Draft Plan Modal State
  const [showDraftModal, setShowDraftModal] = useState<boolean>(false);
  const [selectedSettlementId, setSelectedSettlementId] = useState<string>(
    settlements[0]?.id || ''
  );
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    candidateSites[0]?.id || ''
  );
  const [householdsCount, setHouseholdsCount] = useState<number>(150);
  const [costPerFamilyInr, setCostPerFamilyInr] = useState<number>(1500000); // 15 Lakhs default
  const [assignedHorizon, setAssignedHorizon] = useState<PriorityHorizon>('immediate');
  const [justificationSummary, setJustificationSummary] = useState<string>(
    'Critical slope instability and severe debris-flow risk in peak monsoon. Immediate resettlement required to protect vulnerable households.'
  );

  // Digital Approval Modal State
  const [planToApprove, setPlanToApprove] = useState<RelocationActionPlan | null>(null);
  const [confirmCheck, setConfirmCheck] = useState<boolean>(false);

  // Auto-sync households when settlement selection changes
  const handleSettlementChange = (id: string) => {
    setSelectedSettlementId(id);
    const s = settlements.find(item => item.id === id);
    if (s) {
      setHouseholdsCount(s.householdCount);
      setAssignedHorizon(s.priorityHorizon);
    }
  };

  // Submit Draft Plan
  const handleCreatePlan = (e: React.FormEvent) => {
    e.preventDefault();
    const settlement = settlements.find(s => s.id === selectedSettlementId);
    const site = candidateSites.find(s => s.id === selectedSiteId);

    if (!settlement || !site) return;

    const totalBudget = householdsCount * costPerFamilyInr;
    const planCode = `RAP-${settlement.district.slice(0, 3).toUpperCase()}-2026-${Date.now().toString().slice(-3)}`;

    const newPlan: RelocationActionPlan = {
      id: `plan-${Date.now()}`,
      planCode,
      settlementId: settlement.id,
      settlementName: settlement.name,
      targetSiteId: site.id,
      targetSiteName: site.locationName,
      assignedHorizon,
      householdsToRelocate: householdsCount,
      estimatedBudgetInr: totalBudget,
      justificationSummary,
      status: 'UNDER_REVIEW',
      isVerified: true,
      createdAt: new Date().toISOString(),
    };

    addActionPlan(newPlan);
    setShowDraftModal(false);
    setDownloadSuccess(`Plan ${planCode} successfully drafted and persisted (${persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Storage'}).`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Execute Digital Endorsement
  const handleConfirmApproval = () => {
    if (!planToApprove) return;

    updateActionPlanStatus(
      planToApprove.id,
      'SDMA_APPROVED',
      'SDMA Member Secretary (Digital Key #4829-SIG)'
    );

    setPlanToApprove(null);
    setConfirmCheck(false);
    setDownloadSuccess(`Plan ${planToApprove.planCode} officially endorsed and signed under the DM Act 2005.`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Download genuine GeoJSON package
  const handleExportGeoJSON = () => {
    const geoJsonData = {
      type: 'FeatureCollection',
      name: 'SurakshaGIS_Relocation_Package',
      metadata: {
        generatedAt: new Date().toISOString(),
        standard: 'SIH26191 / NDMA SDSS Specification',
        coordinateSystem: 'EPSG:4326 (WGS84)',
        totalSettlements: settlements.length,
        totalCandidateSites: candidateSites.length,
        totalActionPlans: actionPlans.length,
      },
      features: [
        ...settlements.map(s => ({
          type: 'Feature',
          properties: {
            entity: 'VulnerableSettlement',
            name: s.name,
            district: s.district,
            population: s.totalPopulation,
            householdCount: s.householdCount,
            kucchaHousesPct: s.kucchaHousesPct,
            riskScore: s.calculatedRiskScore,
            horizon: s.priorityHorizon,
            isVerified: s.isVerified,
            dataSource: s.dataSource,
          },
          geometry: {
            type: 'Point',
            coordinates: [s.coordinates.lng, s.coordinates.lat],
          },
        })),
        ...candidateSites.map(c => ({
          type: 'Feature',
          properties: {
            entity: 'CandidateRelocationSite',
            code: c.siteCode,
            name: c.locationName,
            capacity: c.maxCarryingCapacityPop,
            usableAreaSqm: c.usableAreaSqm,
            avgSlope: c.avgSlopeDegrees,
            ownership: c.landOwnershipType,
            isVerified: c.isVerified,
            dataSource: c.dataSource,
          },
          geometry: {
            type: 'Polygon',
            coordinates: [c.coordinates.map(pt => [pt.lng, pt.lat])],
          },
        })),
      ],
    };

    const blob = new Blob([JSON.stringify(geoJsonData, null, 2)], {
      type: 'application/geo+json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `surakshagis_spatial_dossier_${new Date().toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess('GeoJSON Spatial Package successfully generated and downloaded.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Download Structured CSV Relocation Ledger
  const handleExportCSV = () => {
    const headers = [
      'Plan Code',
      'Origin Settlement',
      'Target Relocation Parcel',
      'Displaced Households',
      'Estimated Budget (INR)',
      'Estimated Budget (Crores)',
      'Priority Horizon',
      'Administrative Status',
      'Endorsed By',
      'Created Timestamp',
    ];

    const rows = actionPlans.map(p => [
      `"${p.planCode}"`,
      `"${p.settlementName}"`,
      `"${p.targetSiteName}"`,
      p.householdsToRelocate,
      p.estimatedBudgetInr,
      (p.estimatedBudgetInr / 10000000).toFixed(2),
      `"${p.assignedHorizon}"`,
      `"${p.status}"`,
      `"${p.approvedBy || 'Pending SDMA Review'}"`,
      `"${p.createdAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `surakshagis_action_plans_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess('Relocation Action Plans Ledger exported to CSV successfully.');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // Print executive summary
  const handlePrintSummary = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Success Notification */}
      {downloadSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 shadow-xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{downloadSuccess}</span>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gis-card border border-gis-border rounded-xl p-4 shadow-md transition-colors duration-200">
        <div>
          <h2 className="text-lg font-bold text-gis-textPrimary flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-gis-accent" />
            Official Relocation Action Plans & Governance Ledger
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Binding disaster resettlement orders endorsed under the Disaster Management Act, 2005.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {userRole === 'sdma_admin' || userRole === 'district_planner' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowDraftModal(true)}
              icon={<PlusCircle className="w-3.5 h-3.5" />}
            >
              Draft New RAP
            </Button>
          ) : null}

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportGeoJSON}
            icon={<Download className="w-3.5 h-3.5 text-blue-400" />}
          >
            Export GeoJSON
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            icon={<FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />}
          >
            Export CSV
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrintSummary}
            icon={<FileText className="w-3.5 h-3.5 text-slate-400" />}
          >
            Print Dossier
          </Button>
        </div>
      </div>

      {/* Relocation Plans Table */}
      <Card
        title="Formal Relocation Action Plans (RAP)"
        subtitle="Mandated household counts, target site allocations, and rehabilitation budget disbursements"
      >
        {actionPlans.length === 0 ? (
          <EmptyState
            title="No Active Relocation Plans"
            description="No plans have been drafted for the current filter scope."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gis-surface/60 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-gis-border">
                <tr>
                  <th className="py-3 px-4">Plan Code</th>
                  <th className="py-3 px-3">Origin Settlement</th>
                  <th className="py-3 px-3">Target Relocation Parcel</th>
                  <th className="py-3 px-3">Households</th>
                  <th className="py-3 px-3">Estimated Budget</th>
                  <th className="py-3 px-3">Horizon</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Data Provenance</th>
                  <th className="py-3 px-4 text-right">Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gis-border/50 text-gis-textPrimary">
                {actionPlans.map(plan => {
                  const isApproved = plan.status === 'SDMA_APPROVED';
                  const isUnderReview = plan.status === 'UNDER_REVIEW';

                  return (
                    <tr
                      key={plan.id}
                      className="hover:bg-gis-surface/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedPlan(plan)}
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-gis-textPrimary">
                        {plan.planCode}
                      </td>
                      <td className="py-3 px-3 font-semibold text-gis-textPrimary">
                        {plan.settlementName}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        {plan.targetSiteName}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {plan.householdsToRelocate.toLocaleString()} families
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-500">
                        ₹{(plan.estimatedBudgetInr / 10000000).toFixed(2)} Cr
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            plan.assignedHorizon === 'immediate'
                              ? 'danger'
                              : plan.assignedHorizon === 'short_term'
                              ? 'warning'
                              : 'primary'
                          }
                          size="sm"
                        >
                          {plan.assignedHorizon}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${
                            isApproved
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : isUnderReview
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {isApproved ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-400" />
                          )}
                          {plan.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <VerificationBadge isVerified={plan.isVerified} dataSource="SDMA Plan Authority" size="sm" />
                      </td>
                      <td className="py-3 px-4 text-right">
                        {!isApproved && userRole === 'sdma_admin' ? (
                          <Button
                            variant="success"
                            size="sm"
                            className="text-xs"
                            onClick={e => {
                              e.stopPropagation();
                              setPlanToApprove(plan);
                            }}
                          >
                            Sign & Approve
                          </Button>
                        ) : isApproved ? (
                          <span className="text-[11px] font-mono text-emerald-500 flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> Endorsed
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">Review Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Administrative Audit Log Summary */}
      <Card
        title="Spatial Decision & Re-Zoning Audit Trail"
        subtitle="Cryptographically verified administrative actions and boundary revisions"
      >
        <div className="space-y-2 text-xs font-mono">
          {auditLogs.map(log => (
            <div
              key={log.id}
              className="p-3 rounded-lg bg-gis-surface/50 border border-gis-border flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 text-gis-accent shrink-0" />
                <div>
                  <span className="text-gis-textPrimary font-semibold">{log.title}</span>
                  <span className="text-slate-400 block text-[11px] font-sans">
                    {log.details} • Operator: <strong>{log.role}</strong>
                  </span>
                </div>
              </div>
              <span className="text-slate-400 text-[11px] shrink-0">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan Details Modal */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-gis-textPrimary">{selectedPlan.planCode}</h3>
                <p className="text-xs text-slate-400 font-mono">
                  {selectedPlan.settlementName} ➔ {selectedPlan.targetSiteName}
                </p>
              </div>
              <button
                onClick={() => setSelectedPlan(null)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-mono block">Executive Justification Summary</span>
                <p className="text-gis-textPrimary leading-relaxed">{selectedPlan.justificationSummary}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">DISPLACED FAMILIES</span>
                  <strong className="text-base text-gis-textPrimary">{selectedPlan.householdsToRelocate}</strong>
                </div>
                <div className="p-3 rounded-lg bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">TOTAL REHABILITATION BUDGET</span>
                  <strong className="text-base text-emerald-500">
                    ₹{(selectedPlan.estimatedBudgetInr / 10000000).toFixed(2)} Crores
                  </strong>
                </div>
              </div>

              {selectedPlan.approvedBy && (
                <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800 text-emerald-200">
                  <span className="text-[10px] uppercase font-mono block">Digital Authority Endorsement</span>
                  <strong className="text-gis-textPrimary">{selectedPlan.approvedBy}</strong>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3">
              <Button variant="secondary" size="sm" onClick={() => setSelectedPlan(null)}>
                Close Order
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Draft New Relocation Plan Modal */}
      {showDraftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreatePlan}
            className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                  <PlusCircle className="w-4 h-4 text-gis-accent" />
                  Draft Official Relocation Action Plan (RAP)
                </h3>
                <p className="text-xs text-slate-400">
                  Statutory resettlement directive under Section 34 of the Disaster Management Act, 2005
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDraftModal(false)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-gis-textPrimary block mb-1 font-semibold">Origin Vulnerable Settlement</label>
                <select
                  value={selectedSettlementId}
                  onChange={e => handleSettlementChange(e.target.value)}
                  className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono text-xs"
                >
                  {settlements.map(s => (
                    <option key={s.id} value={s.id} className="bg-gis-dark text-slate-200">
                      {s.name} ({s.district} • Pop: {s.totalPopulation} • Risk: {s.calculatedRiskScore} • {s.priorityHorizon.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-gis-textPrimary block mb-1 font-semibold">Target Safe Relocation Parcel</label>
                <select
                  value={selectedSiteId}
                  onChange={e => setSelectedSiteId(e.target.value)}
                  className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent font-mono text-xs"
                >
                  {candidateSites.map(c => (
                    <option key={c.id} value={c.id} className="bg-gis-dark text-slate-200">
                      {c.locationName} ({c.siteCode} • {c.district} • Capacity: {c.maxCarryingCapacityPop} pop)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Households to Resettle</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={householdsCount}
                    onChange={e => setHouseholdsCount(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                  />
                </div>
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Assigned Horizon</label>
                  <select
                    value={assignedHorizon}
                    onChange={e => setAssignedHorizon(e.target.value as any)}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                  >
                    <option value="immediate">Immediate (0-6 Months)</option>
                    <option value="short_term">Short-Term (6-24 Months)</option>
                    <option value="medium_term">Medium-Term (2-5 Years)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="text-gis-textPrimary block mb-1 font-semibold">Cost per Household (INR)</label>
                  <input
                    type="number"
                    min="500000"
                    step="100000"
                    required
                    value={costPerFamilyInr}
                    onChange={e => setCostPerFamilyInr(Number(e.target.value))}
                    className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent"
                  />
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex flex-col justify-center">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Budget Earmarked:</span>
                  <strong className="text-emerald-500 text-sm">
                    ₹{((householdsCount * costPerFamilyInr) / 10000000).toFixed(2)} Crores
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-gis-textPrimary block mb-1 font-semibold">Executive Justification Summary</label>
                <textarea
                  rows={2}
                  required
                  value={justificationSummary}
                  onChange={e => setJustificationSummary(e.target.value)}
                  className="w-full bg-gis-surface border border-gis-border rounded-lg px-3 py-2 text-gis-textPrimary focus:outline-none focus:border-gis-accent text-xs"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gis-border">
              <span className="text-[11px] text-slate-400 font-mono">
                Storage: {persistenceStorageType === 'remote_supabase' ? 'Supabase PostGIS' : 'Local Browser Storage'}
              </span>
              <div className="flex gap-2.5">
                <Button variant="secondary" size="sm" type="button" onClick={() => setShowDraftModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit">
                  Submit for SDMA Review
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Digital Approval Modal */}
      {planToApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-500" />
                  SDMA Digital Sign-Off & Statutory Endorsement
                </h3>
                <p className="text-xs text-slate-400">
                  Authorizing Plan Order: <strong>{planToApprove.planCode}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlanToApprove(null)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-gis-surface border border-gis-border space-y-1 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Origin Settlement:</span>
                  <strong className="text-gis-textPrimary">{planToApprove.settlementName}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Target Safe Parcel:</span>
                  <strong className="text-gis-textPrimary">{planToApprove.targetSiteName}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Total Families Displaced:</span>
                  <strong className="text-gis-textPrimary">{planToApprove.householdsToRelocate}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Appropriation Budget:</span>
                  <strong className="text-emerald-500">₹{(planToApprove.estimatedBudgetInr / 10000000).toFixed(2)} Cr</strong>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  By executing digital sign-off, this Relocation Action Plan becomes a legally enforceable order under Section 34 of the Disaster Management Act, 2005. Land bank requisition will be initiated with District Collectorate.
                </span>
              </div>

              <label className="flex items-center gap-2 text-xs text-gis-textPrimary cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmCheck}
                  onChange={e => setConfirmCheck(e.target.checked)}
                  className="rounded bg-gis-surface border-gis-border text-emerald-600 focus:ring-0"
                />
                <span>I confirm statutory verification and authorial clearance for this resettlement plan.</span>
              </label>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gis-border">
              <Button variant="secondary" size="sm" onClick={() => setPlanToApprove(null)}>
                Cancel
              </Button>
              <Button
                variant="success"
                size="sm"
                disabled={!confirmCheck}
                onClick={handleConfirmApproval}
              >
                Affix Digital Signature & Endorse
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
