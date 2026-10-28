import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  title,
  subtitle,
  action,
  hoverEffect = false,
}) => {
  return (
    <div
      className={`bg-gis-card border border-gis-border rounded-xl p-4 sm:p-5 transition-colors duration-200 ${
        hoverEffect ? 'gis-card-hover' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gis-border/60">
          <div>
            {title && <h3 className="text-base font-semibold text-gis-textPrimary">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
