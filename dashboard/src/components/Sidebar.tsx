import { NavLink } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard, Settings, Workflow, Bot, ClipboardList,
  List, User, ChevronUp, BookOpen, GitBranch, Code2, Sparkles,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useCopilotContext } from './copilot/CopilotContext';
import { useDashboardConfig } from '../hooks/useDashboardConfig';

// Official SAP logo SVG (the distinctive angled-cut shape)
function SapLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-label="SAP" fill="none">
      {/* Blue body with diagonal top-right cut */}
      <path d="M0 4 C0 1.8 1.8 0 4 0 L52 0 L60 8 L60 26 C60 28.2 58.2 30 56 30 L4 30 C1.8 30 0 28.2 0 26 Z"
        fill="#0070F2"/>
      <text x="30" y="19" dominantBaseline="middle" textAnchor="middle"
        fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="13.5"
        letterSpacing="1.5" fill="white">SAP</text>
    </svg>
  );
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/records', label: 'Records', icon: List },
  { to: '/workflows', label: 'Workflows', icon: Workflow },
  { to: '/agent', label: 'Agent', icon: Bot },
  { to: '/audit', label: 'Audit Log', icon: ClipboardList },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
  { to: '/process', label: 'Process Flow', icon: GitBranch },
  { to: '/api-reference', label: 'API Reference', icon: Code2 },
];

export function Sidebar() {
  const { user } = useCurrentUser();
  const copilot = useCopilotContext();
  const { config: dashConfig } = useDashboardConfig();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <aside className="flex h-screen w-60 flex-col relative overflow-hidden
      bg-gradient-to-b from-[hsl(230,70%,20%)] to-[hsl(240,65%,14%)]
      dark:from-[hsl(224,71%,5%)] dark:to-[hsl(230,60%,8%)]
      shadow-[4px_0_24px_rgba(0,0,0,0.18)]">

      {/* Subtle inner glow at top */}
      <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      {/* Bottom ambient glow */}
      <div className="absolute -bottom-16 -left-8 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

      {/* Logo header */}
      <div className="relative flex h-14 items-center gap-2.5 px-4 border-b border-white/10">
        {/* Logo: custom upload or default SAP */}
        {dashConfig.logoUrl ? (
          <img
            src={dashConfig.logoUrl}
            alt="Logo"
            className="h-7 w-auto max-w-[80px] object-contain flex-shrink-0"
          />
        ) : (
          <SapLogo className="h-7 w-auto flex-shrink-0" />
        )}
        <span className="text-sm font-semibold text-white tracking-wide">BPSYNC</span>
        <span className="text-[10px] text-white/40 font-medium mt-0.5">Dashboard</span>
      </div>

      {/* Navigation */}
      <nav className="relative flex-1 space-y-0.5 p-3 overflow-y-auto">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-white/18 text-white shadow-sm shadow-black/10 translate-x-0.5'
                  : 'text-white/60 hover:bg-white/10 hover:text-white/90 hover:translate-x-0.5'
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={clsx(
                  'h-4 w-4 flex-shrink-0 transition-colors duration-200',
                  isActive ? 'text-white' : 'text-white/50'
                )} />
                {label}
                {isActive && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* AI Copilot trigger */}
      <div className="relative px-3 pb-2">
        <button
          onClick={copilot.toggle}
          className={clsx(
            'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
            copilot.isOpen
              ? 'bg-white/18 text-white shadow-sm'
              : 'text-white/60 hover:bg-white/10 hover:text-white/90'
          )}
        >
          <Sparkles className={clsx('h-4 w-4 flex-shrink-0', copilot.isOpen ? 'text-white' : 'text-white/50')} />
          AI Copilot
          {copilot.unreadCount > 0 && (
            <span className="ml-auto h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
              {copilot.unreadCount > 9 ? '9+' : copilot.unreadCount}
            </span>
          )}
          {copilot.isOpen && !copilot.unreadCount && (
            <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          )}
        </button>
      </div>

      {/* User section */}
      <div className="relative border-t border-white/10 p-3" ref={menuRef}>
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs
            hover:bg-white/10 transition-all duration-200 group"
        >
          <div className="h-7 w-7 rounded-full
            bg-gradient-to-br from-white/25 to-white/10
            ring-1 ring-white/20
            flex items-center justify-center flex-shrink-0">
            <User className="h-3.5 w-3.5 text-white/80" />
          </div>
          <div className="truncate text-left flex-1 min-w-0">
            <span className="font-medium block truncate text-white/90 text-[11px]">{user.name}</span>
            {user.email && (
              <span className="text-white/40 block truncate text-[9px]">{user.email}</span>
            )}
          </div>
          <ChevronUp
            className={clsx(
              'h-3 w-3 text-white/40 transition-transform duration-200 flex-shrink-0',
              showUserMenu ? '' : 'rotate-180'
            )}
          />
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full left-3 right-3 mb-1 rounded-xl
            bg-white/95 dark:bg-[hsl(224,60%,8%)]
            border border-white/20 dark:border-white/10
            shadow-xl shadow-black/20
            backdrop-blur-sm
            py-1 z-50 animate-scale-in">
            <NavLink
              to="/profile"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs
                text-foreground hover:bg-primary/10 hover:text-primary
                transition-colors rounded-lg mx-1"
            >
              <User className="h-3.5 w-3.5" />
              My Profile
            </NavLink>
            <NavLink
              to="/settings"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs
                text-foreground hover:bg-primary/10 hover:text-primary
                transition-colors rounded-lg mx-1"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
