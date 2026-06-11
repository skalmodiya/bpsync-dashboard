import { useEffect, useRef, useState } from 'react';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Percent,
  Activity,
  Database,
  Server,
  Shield,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  FileText,
  Mail,
  Bell,
  Settings,
  RefreshCw,
  XCircle,
  Building,
  Truck,
  AlertCircle,
  CheckCheck,
  Calendar,
  type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardCardConfig } from '../hooks/useDashboardConfig';

// Map icon names to lucide components
export const ICON_MAP: Record<string, LucideIcon> = {
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Percent,
  Activity,
  Database,
  Server,
  Shield,
  Zap,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  FileText,
  Mail,
  Bell,
  Settings,
  RefreshCw,
  XCircle,
  Building,
  Truck,
  AlertCircle,
  CheckCheck,
  Calendar,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  green: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  red: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
  },
  orange: {
    bg: 'bg-orange-50 dark:bg-orange-950/30',
    text: 'text-orange-600 dark:text-orange-400',
    border: 'border-orange-200 dark:border-orange-800',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-950/30',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  primary: {
    bg: 'bg-slate-50 dark:bg-slate-950/30',
    text: 'text-slate-600 dark:text-slate-400',
    border: 'border-slate-200 dark:border-slate-800',
  },
};

const ICON_SIZES: Record<string, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

const ICON_CONTAINER_SIZES: Record<string, string> = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

interface DashboardCardProps {
  config: DashboardCardConfig;
  value: string | number;
  numberFormat: 'full' | 'compact';
  onClick?: () => void;
}

function AnimatedNumber({ value, format }: { value: string | number; format: 'full' | 'compact' }) {
  const [displayValue, setDisplayValue] = useState<string | number>(0);
  const prevRef = useRef<number>(0);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    // If value is a string (like "38%"), just display it
    if (typeof value === 'string') {
      setDisplayValue(value);
      return;
    }

    const start = prevRef.current;
    const end = value;
    const duration = 600;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);

      if (format === 'compact' && current >= 1000) {
        setDisplayValue(`${(current / 1000).toFixed(1)}k`);
      } else {
        setDisplayValue(current.toLocaleString());
      }

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [value, format]);

  return <>{displayValue}</>;
}

export function DashboardCard({ config, value, numberFormat, onClick }: DashboardCardProps) {
  const Icon = ICON_MAP[config.icon] || Users;
  const colors = COLOR_CLASSES[config.color] || COLOR_CLASSES.primary;
  const iconSizeCls = ICON_SIZES[config.iconSize] || ICON_SIZES.md;
  const containerSizeCls = ICON_CONTAINER_SIZES[config.iconSize] || ICON_CONTAINER_SIZES.md;

  const textAlignCls =
    config.textAlign === 'center'
      ? 'text-center'
      : config.textAlign === 'right'
        ? 'text-right'
        : 'text-left';

  const clickableClasses = onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : '';

  const iconElement = (
    <div
      className={clsx(
        'flex items-center justify-center rounded-lg',
        containerSizeCls,
        colors.bg,
        colors.text
      )}
    >
      <Icon className={iconSizeCls} />
    </div>
  );

  const valueElement = (
    <div className={textAlignCls}>
      <p className="text-2xl font-bold tracking-tight">
        <AnimatedNumber value={value} format={numberFormat} />
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{config.label}</p>
    </div>
  );

  if (config.iconPosition === 'top') {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'rounded-lg border bg-card text-card-foreground shadow-sm p-5 transition-all hover:shadow-md',
          colors.border,
          clickableClasses
        )}
      >
        <div className={clsx('flex flex-col gap-3', textAlignCls === 'text-center' ? 'items-center' : '')}>
          {iconElement}
          {valueElement}
        </div>
      </div>
    );
  }

  if (config.iconPosition === 'inline') {
    return (
      <div
        onClick={onClick}
        className={clsx(
          'rounded-lg border bg-card text-card-foreground shadow-sm p-5 transition-all hover:shadow-md',
          colors.border,
          clickableClasses
        )}
      >
        <div className={clsx('flex items-center gap-2', textAlignCls)}>
          <Icon className={clsx('h-5 w-5', colors.text)} />
          <span className="text-2xl font-bold tracking-tight">
            <AnimatedNumber value={value} format={numberFormat} />
          </span>
          <span className="text-xs text-muted-foreground ml-1">{config.label}</span>
        </div>
      </div>
    );
  }

  // Default: left position
  return (
    <div
      onClick={onClick}
      className={clsx(
        'rounded-lg border bg-card text-card-foreground shadow-sm p-5 transition-all hover:shadow-md',
        colors.border,
        clickableClasses
      )}
    >
      <div className="flex items-center gap-4">
        {iconElement}
        {valueElement}
      </div>
    </div>
  );
}
