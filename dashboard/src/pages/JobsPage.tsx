import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { DataTable, type Column } from '../components/DataTable';
import { clsx } from 'clsx';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '../components/Button';

interface Job {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  params: Record<string, any>;
  result: Record<string, any>;
  progress: number;
  total: number;
  message: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  error: string;
}

interface JobsResponse {
  jobs: Job[];
  total: number;
  error?: string;
}

type StatusFilterValue = 'all' | 'running' | 'completed' | 'failed' | 'queued';

const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'queued', label: 'Queued' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

const STATUS_BADGE: Record<string, string> = {
  queued: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-400',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');

  const fetchJobs = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    const params = new URLSearchParams({ limit: '50' });
    if (statusFilter !== 'all') {
      params.set('status', statusFilter);
    }
    const res = await api.get<JobsResponse>(`/api/jobs?${params}`);
    if (res.ok && res.data && !res.data.error) {
      setJobs(res.data.jobs);
    }
    if (showLoading) setLoading(false);
  }, [statusFilter]);

  // Initial fetch and refetch on filter change
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh every 3 seconds if there are running/queued jobs
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === 'running' || j.status === 'queued');
    if (!hasActive) return;
    const interval = setInterval(() => {
      fetchJobs(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs, fetchJobs]);

  const columns: Column<Job>[] = [
    {
      key: 'id',
      label: 'Job ID',
      sortable: true,
      filterable: true,
      filterType: 'text',
      render: (val) => <span className="font-mono text-xs">{val}</span>,
      width: '140px',
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      render: (val) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground">
          {val === 'retry_sync' ? 'Retry Sync' : val === 'agent_fix' ? 'Agent Fix' : val}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      filterOptions: [
        { value: 'queued', label: 'Queued' },
        { value: 'running', label: 'Running' },
        { value: 'completed', label: 'Completed' },
        { value: 'failed', label: 'Failed' },
      ],
      render: (val: string) => (
        <span className={clsx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', STATUS_BADGE[val])}>
          {val === 'running' && <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />}
          {val}
        </span>
      ),
    },
    {
      key: 'progress',
      label: 'Progress',
      sortable: false,
      render: (_val, row) => {
        if (row.status === 'queued') return <span className="text-xs text-muted-foreground">Pending</span>;
        if (row.total === 0) return <span className="text-xs text-muted-foreground">—</span>;
        const pct = Math.round((row.progress / row.total) * 100);
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-[100px]">
              <div
                className={clsx(
                  'h-full rounded-full transition-all',
                  row.status === 'completed' ? 'bg-emerald-500' :
                  row.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{row.progress}/{row.total}</span>
          </div>
        );
      },
      width: '180px',
    },
    {
      key: 'created_by',
      label: 'Created By',
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      render: (val) => <span className="text-xs">{val || 'system'}</span>,
    },
    {
      key: 'created_at',
      label: 'Created At',
      sortable: true,
      render: (val) => <span className="text-xs text-muted-foreground">{val ? formatTime(val) : '—'}</span>,
    },
    {
      key: 'started_at',
      label: 'Duration',
      sortable: false,
      render: (_val, row) => (
        <span className="text-xs text-muted-foreground">
          {formatDuration(row.started_at, row.completed_at)}
          {row.status === 'running' && <Loader2 className="inline h-3 w-3 animate-spin ml-1" />}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Background Jobs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor and track background operations (retry-sync, agent-fix)
          </p>
        </div>
        <Button variant="outline" onClick={() => fetchJobs()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={clsx(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              statusFilter === f.value
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Running jobs alert */}
      {jobs.some((j) => j.status === 'running') && (
        <div className="flex items-center gap-2 p-3 rounded-md text-sm bg-blue-500/10 text-blue-600 border border-blue-500/20">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-medium">Jobs are currently running...</span>
          <span className="text-xs text-blue-500 ml-auto">Auto-refreshing every 3s</span>
        </div>
      )}

      {/* Jobs table */}
      <DataTable<Job>
        columns={columns}
        data={jobs}
        loading={loading}
        rowKey={(row) => row.id}
        expandable
        renderExpanded={(row) => (
          <div className="space-y-3 text-sm">
            {row.message && (
              <div>
                <span className="font-medium text-muted-foreground">Message:</span>{' '}
                <span>{row.message}</span>
              </div>
            )}
            {row.error && (
              <div>
                <span className="font-medium text-red-500">Error:</span>{' '}
                <span className="text-red-600 dark:text-red-400">{row.error}</span>
              </div>
            )}
            {Object.keys(row.params).length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground block mb-1">Parameters:</span>
                <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 overflow-auto max-h-40">
                  {JSON.stringify(row.params, null, 2)}
                </pre>
              </div>
            )}
            {Object.keys(row.result).length > 0 && (
              <div>
                <span className="font-medium text-muted-foreground block mb-1">Result:</span>
                <pre className="text-xs text-muted-foreground bg-muted rounded-md p-3 overflow-auto max-h-40">
                  {JSON.stringify(row.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
        emptyMessage="No background jobs found."
      />
    </div>
  );
}
