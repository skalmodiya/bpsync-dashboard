import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DashboardCard } from '../components/DashboardCard';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import { api } from '../lib/api';
import {
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  X,
  Info,
} from 'lucide-react';
import { clsx } from 'clsx';

interface SyncStatusResponse {
  total_employees: number;
  synced_count: number;
  failed_count: number;
  pending_count: number;
  error_rate: string;
  errors_by_category: Record<string, number>;
  last_sync_time: string;
  sync_status: string;
  bp_count?: number;
  vendor_count?: number;
  open_errors?: number;
  resolved_errors?: number;
  methodology?: Record<string, string>;
  error?: string;
}

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  user_name?: string;
  details?: Record<string, unknown>;
}

const STATUS_ICONS: Record<string, typeof CheckCircle> = {
  success: CheckCircle,
  completed: CheckCircle,
  error: XCircle,
  failed: XCircle,
  warning: AlertTriangle,
  completed_with_errors: AlertTriangle,
  running: Clock,
  unknown: Activity,
};

const STATUS_COLORS: Record<string, string> = {
  success: 'text-emerald-500',
  completed: 'text-emerald-500',
  error: 'text-red-500',
  failed: 'text-red-500',
  warning: 'text-orange-500',
  completed_with_errors: 'text-orange-500',
  running: 'text-blue-500',
  unknown: 'text-muted-foreground',
};

export function DashboardPage() {
  const { config, loading: configLoading } = useDashboardConfig();
  const [syncData, setSyncData] = useState<SyncStatusResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllErrorsModal, setShowAllErrorsModal] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigate = useNavigate();

  const fetchSyncStatus = useCallback(async () => {
    setLoading(true);
    const res = await api.get<SyncStatusResponse>('/api/sync/status');
    if (res.ok && res.data && !res.data.error) {
      setSyncData(res.data);
    } else if (res.ok && res.data) {
      // Backend returned an error object — show fallback zeros
      setSyncData({
        total_employees: 0,
        synced_count: 0,
        failed_count: 0,
        pending_count: 0,
        error_rate: '0%',
        errors_by_category: {},
        last_sync_time: '',
        sync_status: 'unknown',
      });
    }
    setLoading(false);
  }, []);

  const fetchAudit = useCallback(async () => {
    const res = await api.get<{ events: AuditEvent[] }>('/api/audit?limit=5');
    if (res.ok && res.data?.events) {
      setAuditEvents(res.data.events);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSyncStatus();
    fetchAudit();
  }, [fetchSyncStatus, fetchAudit]);

  // Auto-refresh
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (config.autoRefresh && config.refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchSyncStatus();
        fetchAudit();
      }, config.refreshInterval * 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [config.autoRefresh, config.refreshInterval, fetchSyncStatus, fetchAudit]);

  const getCardValue = (dataKey: string): string | number => {
    if (!syncData) return 0;
    const val = (syncData as unknown as Record<string, unknown>)[dataKey];
    if (dataKey === 'last_sync_time' && typeof val === 'string' && val) {
      return new Date(val).toLocaleDateString();
    }
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return val;
    return 0;
  };

  const getCardNavigationStatus = (dataKey: string): string => {
    switch (dataKey) {
      case 'total_employees': return 'all';
      case 'synced_count': return 'synced';
      case 'failed_count': return 'failed';
      case 'pending_count': return 'pending';
      case 'open_errors': return 'failed';
      case 'resolved_errors': return 'all';
      default: return 'all';
    }
  };

  const visibleCards = config.cards
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const errorEntries = syncData?.errors_by_category
    ? Object.entries(syncData.errors_by_category).sort(([, a], [, b]) => b - a)
    : [];
  const errorBreakdownLimit = config.errorBreakdownLimit || 5;
  const visibleErrors = errorEntries.slice(0, errorBreakdownLimit);
  const hasMoreErrors = errorEntries.length > errorBreakdownLimit;
  const maxErrorCount = Math.max(...errorEntries.map(([, v]) => v), 1);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Business Partner sync progress and results
            {syncData?.last_sync_time && (
              <span className="ml-2">
                — Last sync: {new Date(syncData.last_sync_time).toLocaleString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Methodology info */}
          {syncData?.methodology && (
            <div className="relative group">
              <button className="text-muted-foreground hover:text-foreground p-1 rounded" title="How are these numbers calculated?">
                <Info className="h-4 w-4" />
              </button>
              <div className="absolute right-0 top-full mt-2 z-50 hidden group-hover:block w-80 rounded-md border border-border bg-card shadow-lg p-4">
                <h4 className="text-xs font-semibold mb-2">Count Methodology</h4>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {Object.entries(syncData.methodology).filter(([k]) => k !== 'note').map(([key, desc]) => (
                    <div key={key} className="flex gap-2">
                      <span className="font-medium text-foreground min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
                      <span>{desc as string}</span>
                    </div>
                  ))}
                  {syncData.methodology.note && (
                    <p className="mt-2 pt-2 border-t border-border text-[10px] italic">{syncData.methodology.note}</p>
                  )}
                </div>
                <button
                  onClick={() => navigate('/methodology')}
                  className="mt-3 text-xs text-primary hover:underline"
                >
                  View full methodology &rarr;
                </button>
              </div>
            </div>
          )}
          {config.autoRefresh && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Auto-refresh {config.refreshInterval}s
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchSyncStatus} loading={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div
        className={clsx(
          'grid gap-4',
          visibleCards.length <= 3
            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            : visibleCards.length === 4
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
        )}
      >
        {visibleCards.map((cardConfig) => (
          <DashboardCard
            key={cardConfig.id}
            config={cardConfig}
            value={getCardValue(cardConfig.dataKey)}
            numberFormat={config.numberFormat}
            onClick={() => navigate(`/records?status=${getCardNavigationStatus(cardConfig.dataKey)}`)}
          />
        ))}
      </div>

      {/* Error Breakdown + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Breakdown */}
        {config.errorBreakdownStyle !== 'hidden' && (
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4">
              <h3
                onClick={() => navigate('/records?status=failed')}
                className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors"
              >
                Error Breakdown
              </h3>
              <p className="text-xs text-muted-foreground">Errors by category</p>
            </div>
            {errorEntries.length > 0 ? (
              <>
                {config.errorBreakdownStyle === 'bar' ? (
                  <div className="space-y-3">
                    {visibleErrors.map(([category, count]) => (
                      <div
                        key={category}
                        onClick={() => navigate(`/records?status=failed&category=${category}`)}
                        className="space-y-1.5 cursor-pointer hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 transition-colors"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-xs">
                            {category.replace(/_/g, ' ')}
                          </span>
                          <span className="text-muted-foreground text-xs tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-500 transition-all duration-500"
                            style={{ width: `${(count / maxErrorCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {visibleErrors.map(([category, count]) => (
                      <div
                        key={category}
                        onClick={() => navigate(`/records?status=failed&category=${category}`)}
                        className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 rounded px-2 -mx-2 transition-colors"
                      >
                        <span className="text-sm">{category.replace(/_/g, ' ')}</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400 tabular-nums">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {hasMoreErrors && (
                  <button
                    onClick={() => setShowAllErrorsModal(true)}
                    className="mt-4 flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    View All Errors
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No errors recorded.
              </div>
            )}
          </div>
        )}

        {/* Recent Activity Timeline */}
        <div className={clsx("rounded-lg border border-border bg-card p-6", config.errorBreakdownStyle === 'hidden' ? 'lg:col-span-2' : '')}>
          <div className="mb-4">
            <h3
              onClick={() => navigate('/audit')}
              className="text-sm font-semibold cursor-pointer hover:text-primary transition-colors"
            >
              Recent Activity
            </h3>
            <p className="text-xs text-muted-foreground">Latest audit events</p>
          </div>
          {auditEvents.length > 0 ? (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {auditEvents.map((event) => {
                  const statusKey = event.category === 'settings'
                    ? 'success'
                    : event.action.includes('error')
                      ? 'error'
                      : event.action.includes('warning')
                        ? 'warning'
                        : 'success';
                  const IconComponent = STATUS_ICONS[statusKey] || Activity;
                  const colorCls = STATUS_COLORS[statusKey] || STATUS_COLORS.unknown;

                  return (
                    <div key={event.id} className="relative flex items-start gap-3 pl-1">
                      {/* Timeline dot */}
                      <div className={clsx('relative z-10 rounded-full bg-background p-0.5', colorCls)}>
                        <IconComponent className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {event.action.replace(/\./g, ' ').replace(/^./, (s) => s.toUpperCase())}
                          </p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {formatRelativeTime(event.timestamp)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.user_name || 'System'} — {event.category}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No recent activity. Trigger a sync to see events here.
            </div>
          )}
        </div>
      </div>

      {/* Sync Status Badge */}
      {syncData?.sync_status && syncData.sync_status !== 'unknown' && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className={clsx(
              'h-2 w-2 rounded-full',
              syncData.sync_status === 'completed'
                ? 'bg-emerald-500'
                : syncData.sync_status === 'completed_with_errors'
                  ? 'bg-orange-500'
                  : syncData.sync_status === 'running'
                    ? 'bg-blue-500 animate-pulse'
                    : 'bg-muted-foreground'
            )}
          />
          Status: {syncData.sync_status.replace(/_/g, ' ')}
        </div>
      )}

      {/* All Errors Modal */}
      {showAllErrorsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowAllErrorsModal(false)}>
          <div
            className="bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3
                  onClick={() => { setShowAllErrorsModal(false); navigate('/records?status=failed'); }}
                  className="text-base font-semibold cursor-pointer hover:text-primary transition-colors"
                >
                  All Error Categories
                </h3>
                <p className="text-xs text-muted-foreground">{errorEntries.length} categories, {errorEntries.reduce((sum, [, c]) => sum + c, 0)} total errors</p>
              </div>
              <button
                onClick={() => setShowAllErrorsModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-6">
              <div className="space-y-2">
                {errorEntries.map(([category, count]) => (
                  <div
                    key={category}
                    onClick={() => { setShowAllErrorsModal(false); navigate(`/records?status=failed&category=${category}`); }}
                    className="flex items-center justify-between py-2 px-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/50 rounded-md transition-colors"
                  >
                    <span className="text-sm font-medium">{category.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400 tabular-nums bg-red-500/10 px-2 py-0.5 rounded">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString();
}
