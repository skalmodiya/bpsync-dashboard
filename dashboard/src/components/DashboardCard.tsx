import { useEffect, useRef, useState } from 'react';
import {
  Users, CheckCircle, AlertTriangle, Clock, Percent, Activity,
  Database, Server, Shield, Zap, TrendingUp, TrendingDown,
  BarChart3, PieChart, FileText, Mail, Bell, Settings,
  RefreshCw, XCircle, Building, Truck, AlertCircle, CheckCheck,
  Calendar, type LucideIcon,
} from 'lucide-react';
import { clsx } from 'clsx';
import type { DashboardCardConfig } from '../hooks/useDashboardConfig';

export const ICON_MAP: Record<string, LucideIcon> = {
  Users, CheckCircle, AlertTriangle, Clock, Percent, Activity,
  Database, Server, Shield, Zap, TrendingUp, TrendingDown,
  BarChart3, PieChart, FileText, Mail, Bell, Settings,
  RefreshCw, XCircle, Building, Truck, AlertCircle, CheckCheck, Calendar,
};

export const AVAILABLE_ICONS = Object.keys(ICON_MAP);

const COLOR_CLASSES: Record<string, {
  iconBg: string; iconText: string;
  gradientFrom: string; gradientTo: string;
  glow: string;
}> = {
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-900/20',
    iconText: 'text-blue-600 dark:text-blue-400',
    gradientFrom: 'from-blue-500', gradientTo: 'to-blue-400',
    glow: 'hover:shadow-blue-500/10',
  },
  green: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    gradientFrom: 'from-emerald-500', gradientTo: 'to-emerald-400',
    glow: 'hover:shadow-emerald-500/10',
  },
  red: {
    iconBg: 'bg-red-50 dark:bg-red-900/20',
    iconText: 'text-red-600 dark:text-red-400',
    gradientFrom: 'from-red-500', gradientTo: 'to-rose-400',
    glow: 'hover:shadow-red-500/10',
  },
  orange: {
    iconBg: 'bg-orange-50 dark:bg-orange-900/20',
    iconText: 'text-orange-600 dark:text-orange-400',
    gradientFrom: 'from-orange-500', gradientTo: 'to-amber-400',
    glow: 'hover:shadow-orange-500/10',
  },
  purple: {
    iconBg: 'bg-purple-50 dark:bg-purple-900/20',
    iconText: 'text-purple-600 dark:text-purple-400',
    gradientFrom: 'from-purple-500', gradientTo: 'to-violet-400',
    glow: 'hover:shadow-purple-500/10',
  },
  primary: {
    iconBg: 'bg-primary/8 dark:bg-primary/15',
    iconText: 'text-primary',
    gradientFrom: 'from-primary', gradientTo: 'to-primary/60',
    glow: 'hover:shadow-primary/10',
  },
};

const ICON_SIZES: Record<string, string> = {
  sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-6 w-6', xl: 'h-8 w-8',
};
const ICON_CONTAINER_SIZES: Record<string, string> = {
  sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12', xl: 'h-14 w-14',
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
    if (typeof value === 'string') { setDisplayValue(value); return; }
    const start = prevRef.current;
    const end = value;
    const duration = 700;
    const startTime = performance.now();
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * eased);
      if (format === 'compact' && current >= 1000) {
        setDisplayValue(`${(current / 1000).toFixed(1)}k`);
      } else {
        setDisplayValue(current.toLocaleString());
      }
      if (progress < 1) { animRef.current = requestAnimationFrame(animate); }
      else { prevRef.current = end; }
    };
    animRef.current = requestAnimationFrame(animate);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [value, format]);

  return <>{displayValue}</>;
}

export function DashboardCard({ config, value, numberFormat, onClick }: DashboardCardProps) {
  const Icon = ICON_MAP[config.icon] || Users;
  const colors = COLOR_CLASSES[config.color] || COLOR_CLASSES.primary;
  const iconSizeCls = ICON_SIZES[config.iconSize] || ICON_SIZES.md;
  const containerSizeCls = ICON_CONTAINER_SIZES[config.iconSize] || ICON_CONTAINER_SIZES.md;

  const textAlignCls =
    config.textAlign === 'center' ? 'text-center' :
    config.textAlign === 'right' ? 'text-right' : 'text-left';

  const baseCard = clsx(
    'relative rounded-xl bg-card/90 border border-border/50 backdrop-blur-sm overflow-hidden',
    'shadow-card transition-all duration-200',
    'hover:shadow-card-hover hover:-translate-y-0.5 hover:bg-card',
    colors.glow,
    onClick && 'cursor-pointer active:scale-[0.98] active:translate-y-0'
  );

  const accentBar = (
    <div className={clsx(
      'absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r',
      colors.gradientFrom, colors.gradientTo
    )} />
  );

  const iconElement = (
    <div className={clsx(
      'flex items-center justify-center rounded-xl flex-shrink-0',
      containerSizeCls, colors.iconBg, colors.iconText
    )}>
      <Icon className={iconSizeCls} />
    </div>
  );

  const valueElement = (
    <div className={textAlignCls}>
      <p className="text-3xl font-bold tracking-tight tabular-nums">
        <AnimatedNumber value={value} format={numberFormat} />
      </p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{config.label}</p>
    </div>
  );

  if (config.iconPosition === 'top') {
    return (
      <div onClick={onClick} className={baseCard}>
        {accentBar}
        <div className={clsx(
          'flex flex-col gap-3 p-5 pt-6',
          textAlignCls === 'text-center' ? 'items-center' : ''
        )}>
          {iconElement}
          {valueElement}
        </div>
      </div>
    );
  }

  if (config.iconPosition === 'inline') {
    return (
      <div onClick={onClick} className={baseCard}>
        {accentBar}
        <div className={clsx('flex items-center gap-2 p-5 pt-6', textAlignCls)}>
          <Icon className={clsx('h-5 w-5 flex-shrink-0', colors.iconText)} />
          <span className="text-2xl font-bold tracking-tight tabular-nums">
            <AnimatedNumber value={value} format={numberFormat} />
          </span>
          <span className="text-[11px] text-muted-foreground ml-1">{config.label}</span>
        </div>
      </div>
    );
  }

  // Default: left position (icon left, value right)
  return (
    <div onClick={onClick} className={baseCard}>
      {accentBar}
      <div className="flex items-center gap-4 p-5 pt-6">
        {iconElement}
        {valueElement}
      </div>
    </div>
  );
}
