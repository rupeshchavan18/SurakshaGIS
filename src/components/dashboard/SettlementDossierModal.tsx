import React from 'react';
import {
  X,
  MapPin,
  Compass,
  SlidersHorizontal,
} from 'lucide-react';
import { VulnerableSettlement } from '../../types/gis.types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { VerificationBadge } from '../common/VerificationBadge';

interface SettlementDossierModalProps {
  settlement: VulnerableSettlement | null;
  onClose: () => void;
  onNavigateToMap: () => void;
  onNavigateToPlanning: () => void;
}

export const SettlementDossierModal: React.FC<SettlementDossierModalProps> = ({
  settlement,
  onClose,
  onNavigateToMap,
  onNavigateToPlanning,
}) => {
  if (!settlement) return null;

  const dependentCount = settlement.elderlyCount + settlement.childrenCount;
  const dependentRatio = Math.round((dependentCount / Math.max(1, settlement.totalPopulation)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gis-card border border-gis-border rounded-2xl max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gis-border pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gis-textPrimary">{settlement.name}</h3>
              <Badge
                variant={
                  settlement.priorityHorizon === 'immediate'
                    ? 'danger'
                    : settlement.priorityHorizon === 'short_term'
                    ? 'warning'
                    : 'primary'
                }
                size="sm"
                pulse={settlement.priorityHorizon === 'immediate'}
              >
                Risk {settlement.calculatedRiskScore}
              </Badge>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-gis-accent" />
              {settlement.district} • {settlement.subdistrict || 'Main Tehsil'} • Centroid: [{settlement.coordinates.lat.toFixed(4)}, {settlement.coordinates.lng.toFixed(4)}]
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-gis-textPrimary hover:bg-gis-surface transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Core Demographic & Vulnerability Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-gis-surface/60 border border-gis-border">
            <span className="text-[10px] text-slate-400 block uppercase">POPULATION</span>
            <strong className="text-gis-textPrimary text-sm">{settlement.totalPopulation.toLocaleString()}</strong>
            <span className="text-[10px] text-slate-400 block">{settlement.householdCount} families</span>
          </div>

          <div className="p-2.5 rounded-xl bg-gis-surface/60 border border-gis-border">
            <span className="text-[10px] text-slate-400 block uppercase">KUCCHA HOUSING</span>
            <strong className={`text-sm ${settlement.kucchaHousesPct >= 70 ? 'text-red-500' : 'text-gis-textPrimary'}`}>
              {settlement.kucchaHousesPct}%
            </strong>
            <span className="text-[10px] text-slate-400 block">mud / thatch</span>
          </div>

          <div className="p-2.5 rounded-xl bg-gis-surface/60 border border-gis-border">
            <span className="text-[10px] text-slate-400 block uppercase">DEPENDENT RATIO</span>
            <strong className="text-amber-500 text-sm">{dependentRatio}%</strong>
            <span className="text-[10px] text-slate-400 block">{dependentCount} kids/seniors</span>
          </div>

          <div className="p-2.5 rounded-xl bg-gis-surface/60 border border-gis-border">
            <span className="text-[10px] text-slate-400 block uppercase">DISASTERS</span>
            <strong className="text-gis-textPrimary text-sm">{settlement.historicalEventCount}</strong>
            <span className="text-[10px] text-slate-400 block">past events</span>
          </div>
        </div>

        {/* Hazard Risk Exposure Analysis */}
        <div className="p-3.5 rounded-xl bg-gis-darkest/80 border border-gis-border space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gis-textPrimary flex items-center gap-1.5 uppercase tracking-wide">
              Primary Hazard Exposure
            </span>
            <Badge variant="danger" size="sm">
              {settlement.primaryHazardExposure.replace(/_/g, ' ')}
            </Badge>
          </div>
          <p className="text-xs text-gis-textSecondary leading-relaxed">
            Habitation is located within active high-risk multi-hazard Red Zone perimeter. Geological slope instability and drainage saturation exceed critical safety thresholds for permanent human habitation.
          </p>
        </div>

        {/* Resettlement Action Recommendation */}
        <div className="p-3.5 rounded-xl bg-gis-surface/40 border border-gis-border space-y-1.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gis-textPrimary">SDMA Recommended Relocation Horizon:</span>
            <span className="font-mono font-bold text-red-500 uppercase tracking-wide">
              {settlement.priorityHorizon.replace(/_/g, ' ')} (0-6 Months)
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono flex items-center justify-between pt-1">
            <span>Mandated Gross Land Requisite (45 sqm/person):</span>
            <strong className="text-gis-textPrimary">
              {((settlement.totalPopulation * 45) / 1000).toFixed(1)}k m²
            </strong>
          </div>
        </div>

        {/* Data Provenance Badge */}
        <div className="pt-2 border-t border-gis-border flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">Source Provenance:</span>
          <VerificationBadge
            isVerified={settlement.isVerified}
            dataSource={settlement.dataSource}
            showSource
          />
        </div>

        {/* Footer Navigation CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                onClose();
                onNavigateToMap();
              }}
              icon={<Compass className="w-4 h-4 text-white" />}
              className="text-xs w-full sm:w-auto"
            >
              Locate on GIS Map
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                onNavigateToPlanning();
              }}
              icon={<SlidersHorizontal className="w-4 h-4 text-amber-400" />}
              className="text-xs w-full sm:w-auto"
            >
              AHP Horizon Planner
            </Button>
          </div>

          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs w-full sm:w-auto">
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
};
