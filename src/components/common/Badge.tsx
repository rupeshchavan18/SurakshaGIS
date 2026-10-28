import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  pulse?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  pulse = false,
  className = '',
}) => {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    primary: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800/60',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60',
    warning: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/60',
    danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/80 dark:text-red-300 dark:border-red-800/60',
    info: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/60',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800/60',
  };

  const sizes = {
    sm: 'text-[10px] px-2 py-0.5 font-medium tracking-wide',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border uppercase tracking-wider ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              variant === 'danger'
                ? 'bg-red-400'
                : variant === 'warning'
                ? 'bg-amber-400'
                : variant === 'success'
                ? 'bg-emerald-400'
                : 'bg-blue-400'
            }`}
          />
          <span
            className={`relative inline-flex rounded-full h-2 w-2 ${
              variant === 'danger'
                ? 'bg-red-500'
                : variant === 'warning'
                ? 'bg-amber-500'
                : variant === 'success'
                ? 'bg-emerald-500'
                : 'bg-blue-500'
            }`}
          />
        </span>
      )}
      {children}
    </span>
  );
};
