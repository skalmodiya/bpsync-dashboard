import type { ReactNode } from 'react';
import { useDashboardConfig } from '../hooks/useDashboardConfig';

export const DEFAULT_HEADER_GRADIENT = {
  from: '#2d1bb5',
  via:  '#6a1bbf',
  to:   '#a020c0',
};

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  const { config } = useDashboardConfig();
  const g = config.headerGradient ?? DEFAULT_HEADER_GRADIENT;

  // Build inline gradient since Tailwind can't handle dynamic arbitrary values
  const gradientStyle = {
    background: `linear-gradient(to right, ${g.from}, ${g.via}, ${g.to})`,
    boxShadow: `0 4px 24px ${g.from}88`,
  };

  return (
    <div
      className="relative rounded-xl overflow-hidden mb-5 flex items-center justify-between px-5 py-4 min-h-[64px]"
      style={gradientStyle}
    >
      {/* Subtle radial glow at right */}
      <div className="absolute right-0 top-0 bottom-0 w-48
        bg-[radial-gradient(ellipse_at_right,rgba(200,80,255,0.35),transparent_70%)]
        pointer-events-none" />

      {/* Sparkle dots — decorative */}
      <div className="absolute right-16 top-2 h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse" />
      <div className="absolute right-24 bottom-2 h-1 w-1 rounded-full bg-white/40" />
      <div className="absolute right-10 bottom-3 h-2 w-2 rounded-full bg-white/25" />

      {/* Left: title + subtitle */}
      <div className="relative flex flex-col gap-0.5 min-w-0">
        <h1 className="text-white font-bold text-2xl leading-tight tracking-tight truncate">
          {title}
        </h1>
        {subtitle && (
          <p className="text-white/65 text-sm leading-snug">{subtitle}</p>
        )}
      </div>

      {/* Right: optional action slot + diamond icon */}
      <div className="relative flex items-center gap-3 flex-shrink-0 ml-4">
        {action}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" className="opacity-70">
          <path d="M14 2 L16 11 L26 14 L16 17 L14 26 L12 17 L2 14 L12 11 Z"
            fill="white" opacity="0.9" />
          <circle cx="22" cy="5" r="1.5" fill="white" opacity="0.7" />
          <circle cx="6" cy="22" r="1" fill="white" opacity="0.5" />
        </svg>
      </div>
    </div>
  );
}
