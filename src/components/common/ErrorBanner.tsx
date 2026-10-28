import React from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  title = 'Geospatial Query Error',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border border-red-800/80 bg-red-950/40 p-4 text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-red-900/50 text-red-400 shrink-0 mt-0.5 sm:mt-0">
          <AlertOctagon className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-red-100">{title}</h4>
          <p className="text-xs text-red-300/90 mt-0.5 leading-relaxed">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="danger"
          size="sm"
          onClick={onRetry}
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          className="shrink-0"
        >
          Retry Query
        </Button>
      )}
    </div>
  );
};
