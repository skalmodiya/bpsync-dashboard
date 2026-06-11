import { clsx } from 'clsx';

type StatusType = 'success' | 'error' | 'warning' | 'info' | 'running' | 'offline' | 'healthy' | 'degraded';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  pulse?: boolean;
}

const statusStyles: Record<StatusType, string> = {
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  healthy: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  offline: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  running: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

const dotStyles: Record<StatusType, string> = {
  success: 'bg-emerald-500',
  healthy: 'bg-emerald-500',
  error: 'bg-red-500',
  offline: 'bg-red-500',
  warning: 'bg-yellow-500',
  degraded: 'bg-yellow-500',
  info: 'bg-blue-500',
  running: 'bg-blue-500',
};

export function StatusBadge({ status, label, pulse }: StatusBadgeProps) {
  const displayLabel = label || status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status]
      )}
    >
      <span
        className={clsx('h-1.5 w-1.5 rounded-full', dotStyles[status], pulse && 'animate-pulse')}
      />
      {displayLabel}
    </span>
  );
}
