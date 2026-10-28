import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  Clock,
  Calendar,
  AlertCircle,
  Scale,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Filter,
  Save,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { HazardType } from '../types/gis.types';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { VerificationBadge } from '../components/common/VerificationBadge';
import { evaluateAhpConsistency, computeSettlementAhpScore } from '../utils/gisCalculators';

export const PriorityPlanningView: React.FC = () => {
  const {
    settlements,
    setCurrentRoute,
    ahpWeights,
    setAhpWeights,
    addAuditLog,
    districts,
  } = useApp();

  // Local AHP Weight Sliders (default synced to AppContext)
  const [hazardWeight, setHazardWeight] = useState<number>(ahpWeights.hazard);
  const [demographicWeight, setDemographicWeight] = useState<number>(ahpWeights.demographic);
  const [historyWeight, setHistoryWeight] = useState<number>(ahpWeights.history);

  // Pairwise Saaty ratios
  const [hazardVsDemo, setHazardVsDemo] = useState<number>(1.2);
  const [hazardVsHist, setHazardVsHist] = useState<number>(1.6);
  const [demoVsHist, setDemoVsHist] = useState<number>(1.4);

  // Filter state
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>('all');
  const [selectedHazardFilter, setSelectedHazardFilter] = useState<HazardType | 'all'>('all');
  const [showMatrixModal, setShowMatrixModal] = useState<boolean>(false);
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null);

  const totalWeight = hazardWeight + demographicWeight + historyWeight;

  // Saaty Consistency Evaluation
  const consistencyReport = useMemo(() => {
    return evaluateAhpConsistency(hazardVsDemo, hazardVsHist, demoVsHist);
  }, [hazardVsDemo, hazardVsHist, demoVsHist]);

  // Reset to calibrated standard weights
  const handleResetWeights = () => {
    setHazardWeight(40);
    setDemographicWeight(35);
    setHistoryWeight(25);
    setHazardVsDemo(1.2);
    setHazardVsHist(1.6);
    setDemoVsHist(1.4);
    setAhpWeights({ hazard: 40, demographic: 35, history: 25 });
    addAuditLog(
      'AHP_WEIGHTS_RESET',
      'AHP Multi-Criteria Weights Reset to Default Calibrated Standard',
      'Hazard: 40%, Demographics: 35%, Disaster History: 25% (CR = 0.042)'
    );
    setAppliedFeedback('AHP weights reset to default calibrated standard (40% / 35% / 25%).');
    setTimeout(() => setAppliedFeedback(null), 3500);
  };

  // Apply Pairwise Matrix computed weights to sliders
  const handleApplyMatrixWeights = () => {
    setHazardWeight(consistencyReport.weights.hazard);
    setDemographicWeight(consistencyReport.weights.demographic);
    setHistoryWeight(consistencyReport.weights.history);
    setAhpWeights({
      hazard: consistencyReport.weights.hazard,
      demographic: consistencyReport.weights.demographic,
      history: consistencyReport.weights.history,
    });
    addAuditLog(
      'AHP_MATRIX_APPLIED',
      `Saaty Pairwise AHP Matrix Applied (CR: ${consistencyReport.consistencyRatio})`,
      `Computed Eigenvector Weights: Hazard=${consistencyReport.weights.hazard}%, Demographics=${consistencyReport.weights.demographic}%, History=${consistencyReport.weights.history}%`
    );
    setShowMatrixModal(false);
    setAppliedFeedback(
      `Pairwise AHP weights (${consistencyReport.weights.hazard}% / ${consistencyReport.weights.demographic}% / ${consistencyReport.weights.history}%) applied system-wide.`
    );
    setTimeout(() => setAppliedFeedback(null), 4000);
  };

  // Save / Propagate slider weights to system context
  const handleApplyWeightsSystemWide = () => {
    setAhpWeights({
      hazard: hazardWeight,
      demographic: demographicWeight,
      history: historyWeight,
    });
    addAuditLog(
      'AHP_SCENARIO_UPDATED',
      'System-Wide AHP Relocation Priorities Recalculated',
      `Weights: Hazard=${hazardWeight}%, Demographics=${demographicWeight}%, History=${historyWeight}%`
    );
    setAppliedFeedback(
      `Scenario applied! Relocation horizons and calculated risk scores updated across all maps and tables.`
    );
    setTimeout(() => setAppliedFeedback(null), 4000);
  };

  // Dynamically evaluated settlements based on active sliders
  const evaluatedSettlements = useMemo(() => {
    return settlements
      .filter(s => {
        if (selectedDistrictFilter !== 'all' && s.district !== selectedDistrictFilter) return false;
        if (selectedHazardFilter !== 'all' && s.primaryHazardExposure !== selectedHazardFilter) return false;
        return true;
      })
      .map(s => {
        const { score, horizon, subScores } = computeSettlementAhpScore(
          s,
          hazardWeight,
          demographicWeight,
          historyWeight
        );
        return {
          ...s,
          dynamicScore: score,
          dynamicHorizon: horizon,
          subScores,
        };
      })
      .sort((a, b) => b.dynamicScore - a.dynamicScore);
  }, [settlements, hazardWeight, demographicWeight, historyWeight, selectedDistrictFilter, selectedHazardFilter]);

  // Grouped by Horizon
  const immediateGroup = evaluatedSettlements.filter(s => s.dynamicHorizon === 'immediate');
  const shortTermGroup = evaluatedSettlements.filter(s => s.dynamicHorizon === 'short_term');
  const mediumTermGroup = evaluatedSettlements.filter(s => s.dynamicHorizon === 'medium_term');

  // Household & Budget Estimations (Assuming ~15 Lakhs INR per displaced family unit)
  const immediateHouseholds = immediateGroup.reduce((acc, s) => acc + s.householdCount, 0);
  const immediateBudgetCr = (immediateHouseholds * 1500000) / 10000000;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {appliedFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-950/90 border border-emerald-700 text-emerald-200 text-xs flex items-center gap-2.5 shadow-xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{appliedFeedback}</span>
        </div>
      )}

      {/* Top AHP Weight Simulator Card */}
      <Card
        title="Multi-Criteria AHP Prioritization Engine"
        subtitle="Analytical Hierarchy Process (AHP) calibration synthesizing hazard intensity, demographic vulnerability, and disaster history"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowMatrixModal(true)}
              icon={<Scale className="w-3.5 h-3.5 text-gis-accent" />}
            >
              Pairwise Matrix
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetWeights}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset Defaults
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleApplyWeightsSystemWide}
              icon={<Save className="w-3.5 h-3.5" />}
            >
              Apply System-Wide
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Hazard Severity Slider */}
            <div className="space-y-2 p-3.5 rounded-xl bg-gis-surface/50 border border-gis-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gis-textPrimary">1. Hazard Intensity (Slope / Flood)</span>
                <span className="font-mono text-red-500 font-bold text-sm">{hazardWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={hazardWeight}
                onChange={e => setHazardWeight(Number(e.target.value))}
                className="w-full accent-red-500 bg-gis-surface h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                Weight assigned to physical slope instability, flood depth, and return periods.
              </p>
            </div>

            {/* Demographic Vulnerability Slider */}
            <div className="space-y-2 p-3.5 rounded-xl bg-gis-surface/50 border border-gis-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gis-textPrimary">2. Demographic Vulnerability</span>
                <span className="font-mono text-blue-500 font-bold text-sm">{demographicWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={demographicWeight}
                onChange={e => setDemographicWeight(Number(e.target.value))}
                className="w-full accent-blue-500 bg-gis-surface h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                Weight for kuccha housing percentage and dependent elderly/children ratios.
              </p>
            </div>

            {/* Historical Disaster Frequency Slider */}
            <div className="space-y-2 p-3.5 rounded-xl bg-gis-surface/50 border border-gis-border">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gis-textPrimary">3. Historical Displacement</span>
                <span className="font-mono text-amber-500 font-bold text-sm">{historyWeight}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="80"
                value={historyWeight}
                onChange={e => setHistoryWeight(Number(e.target.value))}
                className="w-full accent-amber-500 bg-gis-surface h-2 rounded-lg cursor-pointer"
              />
              <p className="text-[10px] text-slate-400">
                Weight for recurring flood inundations and past slope displacement events.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-gis-border text-xs gap-2">
            <span className="text-slate-400">
              Total Weight Sum:{' '}
              <strong className={`font-mono ${totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                {totalWeight}% {totalWeight === 100 ? '(Calibrated)' : '(Auto-normalized)'}
              </strong>
            </span>
            <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
              <span>Formula: <code>Composite = (W_h × H) + (W_v × V) + (W_hist × Hist)</code></span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter and Scoping Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-gis-card border border-gis-border rounded-xl p-3 text-xs">
        <div className="flex items-center gap-2 text-gis-textPrimary">
          <Filter className="w-3.5 h-3.5 text-gis-accent" />
          <span className="font-semibold">Horizon Queue Scope:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedDistrictFilter}
            onChange={e => setSelectedDistrictFilter(e.target.value)}
            className="bg-gis-surface border border-gis-border rounded-lg px-2.5 py-1 text-gis-textPrimary text-xs focus:outline-none focus:border-gis-accent font-mono"
          >
            <option value="all">All Districts ({settlements.length})</option>
            {districts.filter(d => d !== 'all').map(d => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={selectedHazardFilter}
            onChange={e => setSelectedHazardFilter(e.target.value as any)}
            className="bg-gis-surface border border-gis-border rounded-lg px-2.5 py-1 text-gis-textPrimary text-xs focus:outline-none focus:border-gis-accent font-mono"
          >
            <option value="all">All Hazard Types</option>
            <option value="landslide">Landslides</option>
            <option value="riverine_flood">Riverine Floods</option>
            <option value="cloudburst_flash_flood">Cloudburst Ravines</option>
            <option value="coastal_erosion">Coastal Erosion</option>
          </select>
        </div>
      </div>

      {/* Relocation Horizon Buckets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bucket 1: Immediate Horizon */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 dark:border-red-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-600 dark:bg-red-900/60 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">
                  Immediate Horizon (0-6M)
                </h4>
                <p className="text-[10px] text-red-600/80 dark:text-red-300/80">Score ≥ 80 • Imminent Catastrophic Hazard</p>
              </div>
            </div>
            <Badge variant="danger" size="sm" pulse>
              {immediateGroup.length} Settlements
            </Badge>
          </div>

          {/* Immediate Horizon Summary Banner */}
          <div className="p-3 rounded-lg bg-gis-surface/60 border border-gis-border text-xs space-y-1 font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Displaced Households:</span>
              <strong className="text-gis-textPrimary">{immediateHouseholds.toLocaleString()}</strong>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Estimated Budget:</span>
              <strong className="text-emerald-500">₹{immediateBudgetCr.toFixed(2)} Cr</strong>
            </div>
          </div>

          <div className="space-y-2.5">
            {immediateGroup.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-gis-card border border-red-900/60 hover:border-red-600 transition-all space-y-2 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gis-textPrimary text-sm">{item.name}</span>
                  <Badge variant="danger" size="sm">
                    Score {item.dynamicScore}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>Pop: {item.totalPopulation.toLocaleString()}</span>
                  <span>Kuccha: {item.kucchaHousesPct}%</span>
                  <span>{item.district}</span>
                </div>
                <div className="pt-2 border-t border-gis-border/60 flex items-center justify-between">
                  <VerificationBadge isVerified={item.isVerified} dataSource={item.dataSource} size="sm" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentRoute('reports')}
                    className="text-[11px] text-red-500 hover:text-red-400 flex items-center gap-1"
                  >
                    Draft Action Plan <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bucket 2: Short-Term Horizon */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-500/30 dark:border-amber-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:bg-amber-900/60 dark:text-amber-400">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Short-Term Horizon (6-24M)
                </h4>
                <p className="text-[10px] text-amber-600/80 dark:text-amber-300/80">Score 60-79 • High Structural Vulnerability</p>
              </div>
            </div>
            <Badge variant="warning" size="sm">
              {shortTermGroup.length} Settlements
            </Badge>
          </div>

          <div className="space-y-2.5">
            {shortTermGroup.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-gis-card border border-gis-border hover:border-amber-600/60 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gis-textPrimary text-sm">{item.name}</span>
                  <Badge variant="warning" size="sm">
                    Score {item.dynamicScore}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>Pop: {item.totalPopulation.toLocaleString()}</span>
                  <span>Kuccha: {item.kucchaHousesPct}%</span>
                  <span>{item.district}</span>
                </div>
                <div className="pt-2 border-t border-gis-border/60 flex items-center justify-between">
                  <VerificationBadge isVerified={item.isVerified} dataSource={item.dataSource} size="sm" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCurrentRoute('reports')}
                    className="text-[11px] text-amber-500 hover:text-amber-400 flex items-center gap-1"
                  >
                    Action Plan <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bucket 3: Medium-Term Horizon */}
        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-blue-500/10 dark:bg-blue-950/40 border border-blue-500/30 dark:border-blue-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:bg-blue-900/60 dark:text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                  Medium-Term Horizon (2-5Y)
                </h4>
                <p className="text-[10px] text-blue-600/80 dark:text-blue-300/80">Score &lt; 60 • Mitigation & Monitoring</p>
              </div>
            </div>
            <Badge variant="primary" size="sm">
              {mediumTermGroup.length} Settlements
            </Badge>
          </div>

          <div className="space-y-2.5">
            {mediumTermGroup.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-xl bg-gis-card border border-gis-border hover:border-blue-600/60 transition-all space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gis-textPrimary text-sm">{item.name}</span>
                  <Badge variant="primary" size="sm">
                    Score {item.dynamicScore}
                  </Badge>
                </div>
                <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
                  <span>Pop: {item.totalPopulation.toLocaleString()}</span>
                  <span>Kuccha: {item.kucchaHousesPct}%</span>
                  <span>{item.district}</span>
                </div>
                <div className="pt-2 border-t border-gis-border/60 flex items-center justify-between">
                  <VerificationBadge isVerified={item.isVerified} dataSource={item.dataSource} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pairwise Comparison Matrix Modal */}
      {showMatrixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-start justify-between border-b border-gis-border pb-3">
              <div>
                <h3 className="text-base font-bold text-gis-textPrimary flex items-center gap-2">
                  <Scale className="w-4 h-4 text-gis-accent" />
                  Saaty Pairwise AHP Comparison Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Strict mathematical consistency validation (Consistency Ratio CR &lt; 0.10)
                </p>
              </div>
              <button
                onClick={() => setShowMatrixModal(false)}
                className="text-slate-400 hover:text-gis-textPrimary"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="space-y-3 bg-gis-surface/60 border border-gis-border rounded-xl p-3.5">
                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Hazard Intensity vs Demographic Vulnerability:</span>
                    <strong className="text-gis-textPrimary">{hazardVsDemo.toFixed(1)} : 1</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={hazardVsDemo}
                    onChange={e => setHazardVsDemo(Number(e.target.value))}
                    className="w-full accent-gis-accent"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Hazard Intensity vs Historical Displacement:</span>
                    <strong className="text-gis-textPrimary">{hazardVsHist.toFixed(1)} : 1</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={hazardVsHist}
                    onChange={e => setHazardVsHist(Number(e.target.value))}
                    className="w-full accent-gis-accent"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Demographic Vulnerability vs Historical Displacement:</span>
                    <strong className="text-gis-textPrimary">{demoVsHist.toFixed(1)} : 1</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="3.0"
                    step="0.1"
                    value={demoVsHist}
                    onChange={e => setDemoVsHist(Number(e.target.value))}
                    className="w-full accent-gis-accent"
                  />
                </div>
              </div>

              {/* Mathematical Diagnostics */}
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">λ_MAX</span>
                  <strong className="text-gis-textPrimary">{consistencyReport.lambdaMax}</strong>
                </div>
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">INDEX (CI)</span>
                  <strong className="text-gis-textPrimary">{consistencyReport.consistencyIndex}</strong>
                </div>
                <div className="p-2.5 rounded bg-gis-surface border border-gis-border">
                  <span className="text-[10px] text-slate-400 block">RATIO (CR)</span>
                  <strong
                    className={
                      consistencyReport.isConsistent ? 'text-emerald-500' : 'text-red-500'
                    }
                  >
                    {consistencyReport.consistencyRatio}
                  </strong>
                </div>
              </div>

              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${consistencyReport.isConsistent
                  ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
                  : 'bg-red-950/60 border-red-800 text-red-200'
                  }`}
              >
                {consistencyReport.isConsistent ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>
                  {consistencyReport.isConsistent
                    ? `Scientifically Validated: Consistency Ratio ${consistencyReport.consistencyRatio} < 0.10 satisfies Saaty's theorem.`
                    : `High Consistency Ratio ${consistencyReport.consistencyRatio} >= 0.10: Judgments may contain internal contradictions.`}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-gis-border">
              <Button variant="secondary" size="sm" onClick={() => setShowMatrixModal(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyMatrixWeights}
                disabled={!consistencyReport.isConsistent}
              >
                Apply Eigenvector Weights
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
