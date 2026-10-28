import React from 'react';

interface LoadingSpinnerProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  label = 'Loading GIS spatial layers...',
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="relative">
        <div
          className={`${sizeMap[size]} rounded-full border-gis-border border-t-gis-accent animate-spin`}
        />
        <div className="absolute inset-0 rounded-full blur-sm bg-gis-accent/20 animate-pulse" />
      </div>
      {label && <p className="mt-3 text-xs sm:text-sm text-slate-400 font-medium tracking-wide">{label}</p>}
    </div>
  );
};
