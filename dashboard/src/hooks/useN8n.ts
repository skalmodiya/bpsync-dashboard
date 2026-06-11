import { useState, useCallback } from 'react';
import type { N8nExecution } from '../types';
import { api } from '../lib/api';

export function useN8n() {
  const [executions, setExecutions] = useState<N8nExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchExecutions = useCallback(async (limit = 20) => {
    setError(null);
    // Route through backend proxy which handles n8n auth
    const res = await api.get<any>(`/api/n8n/executions?limit=${limit}`);
    if (res.ok && res.data) {
      const execs = res.data.data || res.data.executions || res.data || [];
      setExecutions(Array.isArray(execs) ? execs : []);
    } else {
      setError(res.error || 'Failed to fetch executions');
    }
  }, []);

  const triggerSync = useCallback(async () => {
    setError(null);
    const res = await api.post<unknown>('/api/n8n/trigger/bupa-sync', {
      sync_scope: 'all_active',
      dry_run: false,
    });
    if (!res.ok) {
      setError(res.error || 'Failed to trigger sync');
    }
    return res.ok;
  }, []);

  return {
    executions,
    loading,
    error,
    fetchExecutions,
    triggerSync,
  };
}
