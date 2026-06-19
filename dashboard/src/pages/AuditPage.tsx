import { PageHeader } from '../components/PageHeader';
import { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { DataTable, type Column } from '../components/DataTable';
import { RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../lib/api';

interface AuditEvent {
  id: string;
  timestamp: string;
  action: string;
  category: string;
  user: string;
  user_id: string;
  user_name: string;
  user_email: string;
  details: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'settings', label: 'Settings' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'agent', label: 'Agent' },
  { id: 'system', label: 'System' },
];

const categoryColors: Record<string, string> = {
  settings: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  workflow: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  agent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  system: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (diffMs < 0) return 'just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

export function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [isPolling, setIsPolling] = useState(false);
  const [pollInterval, setPollInterval] = useState(5);
  const [lastRefresh, setLastRefresh] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const fetchEvents = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (activeCategory !== 'all') {
        params.set('category', activeCategory);
      }
      const res = await api.get<{ events: AuditEvent[]; total: number }>(`/api/audit?${params}`);
      if (!res.ok) {
        setError(`Failed to fetch audit events: ${res.error}`);
        return;
      }
      setEvents(res.data?.events || []);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [activeCategory]);

  // Initial fetch and refetch on category change
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-poll
  useEffect(() => {
    if (!isPolling) return;
    const interval = setInterval(() => {
      fetchEvents(false);
    }, pollInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents, isPolling, pollInterval]);

  const handleClear = async () => {
    try {
      const res = await api.delete('/api/audit');
      if (res.ok) {
        setEvents([]);
        setConfirmClear(false);
      } else {
        setError('Failed to clear audit log');
      }
    } catch {
      setError('Failed to clear audit log');
    }
  };

  const columns: Column<AuditEvent>[] = [
    {
      key: 'timestamp',
      label: 'Time',
      sortable: true,
      render: (val) => (
        <span className="text-muted-foreground whitespace-nowrap text-xs" title={new Date(val).toLocaleString()}>
          {relativeTime(val)}
        </span>
      ),
    },
    {
      key: 'user_name',
      label: 'User',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      render: (val, row) => (
        <span className="text-xs" title={row.user_email || row.user_id || ''}>
          {val || row.user || row.user_id || 'System'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      render: (val) => <span className="font-medium text-sm">{val}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      filterOptions: CATEGORIES.filter((c) => c.id !== 'all').map((c) => ({ value: c.id, label: c.label })),
      render: (val) => (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${categoryColors[val] || categoryColors.system}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Details',
      filterable: false,
      render: (val, row) => {
        if (!val || Object.keys(val).length === 0)
          return <span className="text-muted-foreground text-xs">—</span>;

        // Special summary for agent fix requests
        if (row.action === 'agent.fix_requested') {
          const hasResponse = !!val.agent_response;
          return (
            <span className="text-xs flex items-center gap-1.5">
              <span className="text-muted-foreground">
                {val.errors_found ?? 0} errors · {val.pernr_count ?? 0} employee(s)
              </span>
              {hasResponse && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">· response saved ↓</span>
              )}
            </span>
          );
        }

        const entries = Object.entries(val).filter(([k]) => k !== 'agent_response');
        const summary = entries
          .slice(0, 3)
          .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
          .join(', ');
        return <span className="text-muted-foreground text-xs max-w-xs truncate block">{summary}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle="Track all system actions and changes"
        action={
          <div className="flex items-center gap-2">
            <button onClick={() => fetchEvents()}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)}
                className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white bg-red-500/30 hover:bg-red-500/45 px-3 py-1.5 rounded-lg transition-colors">
                <Trash2 className="h-3.5 w-3.5" />
                Clear Log
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-white/70">Are you sure?</span>
                <button onClick={handleClear}
                  className="text-xs text-white bg-red-500/50 hover:bg-red-500/70 px-2.5 py-1.5 rounded-lg transition-colors font-medium">
                  Yes, Clear
                </button>
                <button onClick={() => setConfirmClear(false)}
                  className="text-xs text-white/70 hover:text-white bg-white/15 hover:bg-white/25 px-2.5 py-1.5 rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            )}
          </div>
        }
      />

      {/* Category Filters */}
      <div className="flex items-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Polling Controls */}
      <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 border border-border">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isPolling}
              onChange={(e) => setIsPolling(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-refresh
          </label>
          {isPolling && (
            <label className="flex items-center gap-1">
              every
              <select
                value={pollInterval}
                onChange={(e) => setPollInterval(Number(e.target.value))}
                className="bg-background border border-border rounded px-1 py-0.5 text-xs"
              >
                <option value={3}>3s</option>
                <option value={5}>5s</option>
                <option value={10}>10s</option>
                <option value={30}>30s</option>
              </select>
            </label>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPolling && <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
          {lastRefresh && <span>Last: {lastRefresh}</span>}
          <span>{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Events Table */}
      <Card title="Events" description={`Showing ${activeCategory === 'all' ? 'all' : activeCategory} events`}>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DataTable<AuditEvent>
          columns={columns}
          data={events}
          loading={loading}
          rowKey={(row) => row.id}
          expandable
          renderExpanded={(row) => {
            const isAgentFix = row.action === 'agent.fix_requested';
            const agentResponse = row.details?.agent_response as string | undefined;

            if (isAgentFix && agentResponse) {
              return (
                <div className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                  {/* Summary bar */}
                  <div className="flex items-center gap-4 px-4 py-2 bg-emerald-500/8 border-b border-border/50 text-xs">
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">🤖 Agent Fix Proposals</span>
                    {row.details?.pernr_count !== undefined && (
                      <span className="text-muted-foreground">
                        {row.details.errors_found as number} errors · {row.details.pernr_count as number} employee(s)
                      </span>
                    )}
                    {(row.details?.pernr_list as string[] | undefined)?.length ? (
                      <span className="text-muted-foreground">
                        PERNRs: {(row.details.pernr_list as string[]).join(', ')}
                      </span>
                    ) : null}
                    {(row.details?.categories as string[] | undefined)?.length ? (
                      <span className="text-muted-foreground">
                        Categories: {(row.details.categories as string[]).join(', ')}
                      </span>
                    ) : null}
                  </div>
                  {/* Agent response */}
                  <div className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Agent Response</p>
                    <pre className="text-xs text-foreground leading-relaxed whitespace-pre-wrap overflow-auto max-h-96 font-mono bg-background/60 rounded-md p-3 border border-border/40">
                      {agentResponse}
                    </pre>
                  </div>
                </div>
              );
            }

            // Default: raw JSON for all other events
            return (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium mb-2">Full Details</p>
                <pre className="text-xs text-muted-foreground overflow-auto max-h-40 whitespace-pre-wrap">
                  {JSON.stringify({ details: row.details, metadata: row.metadata }, null, 2)}
                </pre>
              </div>
            );
          }}
          emptyMessage="No audit events found."
        />
      </Card>
    </div>
  );
}
