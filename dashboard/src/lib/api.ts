import type { ApiResponse } from '../types';
import { getXsuaaToken } from '../components/AuthGuard';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  private authHeaders(): Record<string, string> {
    const token = getXsuaaToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async get<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(), ...options?.headers },
        ...options,
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `${res.status}: ${text}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async post<T>(path: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(), ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `${res.status}: ${text}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async put<T>(path: string, body?: unknown, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(), ...options?.headers },
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `${res.status}: ${text}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async delete<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders(), ...options?.headers },
        ...options,
      });
      if (!res.ok) {
        const text = await res.text();
        return { ok: false, error: `${res.status}: ${text}` };
      }
      const data = await res.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}

export const api = new ApiClient((window as any).__BACKEND_URL__ || '');

export function n8nApi(apiKey: string) {
  return {
    async getExecutions(limit = 20): Promise<ApiResponse<{ data: unknown[] }>> {
      return api.get('/n8n/api/v1/executions?limit=' + limit, {
        headers: { 'X-N8N-API-KEY': apiKey },
      });
    },
    async triggerWebhook(webhookPath: string, payload?: unknown): Promise<ApiResponse<unknown>> {
      return api.post(`/n8n/webhook/${webhookPath}`, payload);
    },
  };
}
