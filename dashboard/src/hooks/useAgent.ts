import { useState, useCallback } from 'react';
import type { AgentHealth, AgentInfo, AgentInvocation } from '../types';
import { api } from '../lib/api';

export function useAgent() {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [invocations, setInvocations] = useState<AgentInvocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    const res = await api.get<AgentHealth>('/api/agent/health');
    if (res.ok && res.data) {
      setHealth(res.data);
    } else {
      setHealth({
        status: 'offline',
        lastCheck: new Date().toISOString(),
      });
    }
    setLoading(false);
  }, []);

  const fetchInfo = useCallback(async () => {
    const res = await api.get<AgentInfo>('/api/agent/info');
    if (res.ok && res.data) {
      setInfo(res.data);
    }
  }, []);

  const fetchInvocations = useCallback(async () => {
    const res = await api.get<AgentInvocation[]>('/api/agent/invocations');
    if (res.ok && res.data) {
      setInvocations(res.data);
    }
  }, []);

  const invokeAgent = useCallback(async (message: string) => {
    setError(null);
    const res = await api.post<any>(
      '/api/agent/invoke',
      { message }
    );
    if (res.ok && res.data) {
      const responseText = res.data.response || res.data.content || res.data.role === 'assistant' ? (res.data.content || res.data.response || JSON.stringify(res.data)) : JSON.stringify(res.data);
      // Build invocation record from response
      const invocation: AgentInvocation = res.data.invocation || {
        id: `inv-${Date.now()}`,
        timestamp: new Date().toISOString(),
        message,
        response: typeof responseText === 'string' ? responseText : JSON.stringify(responseText),
        duration: res.data.duration || 0,
        tokenUsage: res.data.tokenUsage || { prompt: 0, completion: 0, total: 0 },
      };
      setInvocations((prev) => [invocation, ...prev.slice(0, 19)]);
      return typeof responseText === 'string' ? responseText : JSON.stringify(responseText);
    } else {
      setError(res.error || 'Failed to invoke agent');
      return null;
    }
  }, []);

  return {
    health,
    info,
    invocations,
    setInvocations,
    loading,
    error,
    checkHealth,
    fetchInfo,
    fetchInvocations,
    invokeAgent,
  };
}
