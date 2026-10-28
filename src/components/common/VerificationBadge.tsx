import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

interface VerificationBadgeProps {
  isVerified: boolean;
  dataSource: string;
  verifiedBy?: string;
  showSource?: boolean;
  size?: 'sm' | 'md';
}

export const VerificationBadge: React.FC<VerificationBadgeProps> = ({
  isVerified,
  dataSource,
  verifiedBy,
  showSource = false,
  size = 'md',
}) => {
  if (isVerified) {
    return (
      <div className="inline-flex items-center gap-1.5" title={`Verified by: ${verifiedBy || 'SDMA Authority'} (${dataSource})`}>
        <span
          className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700/60 ${
            size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
          }`}
        >
          <ShieldCheck className={size === 'sm' ? 'w-3 h-3 text-emerald-600 dark:text-emerald-400' : 'w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400'} />
          <span>VERIFIED DATA</span>
        </span>
        {showSource && (
          <span className="text-[11px] text-slate-400 font-mono truncate max-w-[180px]" title={dataSource}>
            {dataSource}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5" title={`Illustrative benchmark data — not live or verified. Source: ${dataSource}`}>
      <span
        className={`inline-flex items-center gap-1 font-semibold rounded-md border bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-700/70 ${
          size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'
        }`}
      >
        <AlertCircle className={size === 'sm' ? 'w-3 h-3 text-amber-600 dark:text-amber-400' : 'w-3.5 h-3.5 text-amber-600 dark:text-amber-400'} />
        <span>ILLUSTRATIVE DEMO (NOT LIVE)</span>
      </span>
      {showSource && (
        <span className="text-[11px] text-amber-700 dark:text-amber-400/80 font-mono truncate max-w-[200px]" title={dataSource}>
          {dataSource}
        </span>
      )}
    </div>
  );
};
