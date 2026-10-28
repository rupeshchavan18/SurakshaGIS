import React from 'react';
import { Layers, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Spatial Records Found',
  description = 'No entities match the active district, hazard type, or verification filters.',
  icon,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-gis-border bg-gis-darkest/50 ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-gis-surface border border-gis-border flex items-center justify-center text-slate-400 mb-3 shadow-inner">
        {icon || <Layers className="w-6 h-6 text-slate-400" />}
      </div>
      <h4 className="text-base font-semibold text-gis-textPrimary">{title}</h4>
      <p className="text-xs sm:text-sm text-gis-textSecondary max-w-md mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction} icon={<RefreshCw className="w-3.5 h-3.5" />}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
