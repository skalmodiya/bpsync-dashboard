import { useState, useCallback } from 'react';
import type { AgentHealth, AgentInfo, AgentInvocation } from '../types';
import { api } from '../lib/api';

// Direct agent URL — bypasses backend proxy to avoid CF inter-app network restrictions
const AGENT_URL = (window as any).__AGENT_URL__ || '';

async function agentFetch(path: string, options?: RequestInit) {
  try {
    const res = await fetch(`${AGENT_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    const data = await res.json();
    return { ok: res.ok, data, status: res.status };
  } catch (e) {
    return { ok: false, data: null, error: String(e) };
  }
}

export function useAgent() {
  const [health, setHealth] = useState<AgentHealth | null>(null);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [invocations, setInvocations] = useState<AgentInvocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = useCallback(async () => {
    setLoading(true);
    const res = await agentFetch('/health');
    if (res.ok && res.data) {
      setHealth({ status: res.data.status === 'healthy' ? 'healthy' : 'degraded', lastCheck: new Date().toISOString() });
    } else {
      setHealth({ status: 'offline', lastCheck: new Date().toISOString() });
    }
    setLoading(false);
  }, []);

  const fetchInfo = useCallback(async () => {
    const res = await agentFetch('/.well-known/agent.json');
    if (res.ok && res.data) {
      const raw = res.data;
      let capabilities: string[] = [];
      if (Array.isArray(raw.capabilities)) {
        capabilities = raw.capabilities;
      } else if (raw.capabilities && typeof raw.capabilities === 'object') {
        capabilities = Object.entries(raw.capabilities)
          .filter(([, v]) => v === true)
          .map(([k]) => k);
      }
      setInfo({
        name: raw.title || raw.name || 'Unknown',
        title: raw.title,
        description: raw.description || '',
        version: raw.version || '',
        capabilities,
        skills: raw.skills || [],
      });
    }
  }, []);

  const fetchInvocations = useCallback(async () => {
    // Invocation logs are stored on the backend — keep going through proxy
    const res = await api.get<AgentInvocation[]>('/api/agent/invocations');
    if (res.ok && res.data) {
      setInvocations(res.data);
    }
  }, []);

  const invokeAgent = useCallback(async (message: string) => {
    setError(null);
    const start = Date.now();
    // Call agent directly, but also log via backend
    const agentRes = await agentFetch('/invoke', {
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    });

    if (agentRes.ok && agentRes.data) {
      const result = agentRes.data.result || agentRes.data;
      const content = result.content || result.response || JSON.stringify(result);
      const duration = Date.now() - start;

      // Also log invocation via backend for history
      api.post('/api/agent/invoke', { message }).catch(() => {});

      const invocation: AgentInvocation = {
        id: `inv-${Date.now()}`,
        timestamp: new Date().toISOString(),
        message,
        response: content,
        duration,
        tokenUsage: agentRes.data.tokenUsage || { prompt: 0, completion: 0, total: 0 },
      };
      setInvocations((prev) => [invocation, ...prev.slice(0, 19)]);
      return content;
    } else {
      setError(agentRes.error || 'Failed to invoke agent');
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
