import { useState, useEffect, useCallback } from 'react';
import type { Settings } from '../types';
import { api } from '../lib/api';

const defaultSettings: Settings = {
  llm: {
    provider: 'local-proxy',
    baseUrl: 'http://localhost:6655/litellm/v1',
    model: 'anthropic--claude-4.6-sonnet',
    apiKey: '',
  },
  n8n: {
    url: 'http://localhost:5678',
    apiKey: '',
    workflowId: '',
    retryWorkflowId: '',
    agentFixWorkflowId: '',
    monitoredWorkflowIds: [],
    webhookUrl: '',
  },
  mockS4hana: {
    serverUrl: 'http://localhost:8090',
  },
  s4Source: {
    source: 'mock',
    destinationName: 'S4_SIA_I577956',
    sapClient: '500',
  },
  deployment: {
    mode: 'local',
  },
  email: {
    smtpHost: 'localhost',
    smtpPort: 1025,
    username: '',
    password: '',
    fromEmail: '',
    notificationEmails: [],
  },
};

function fromBackend(data: any): Settings {
  const deploymentMode = data?.deployment_mode || data?.deployment?.mode || 'local';
  const rawProvider = data?.llm?.provider || defaultSettings.llm.provider;
  const provider: Settings['llm']['provider'] =
    rawProvider === 'sap_ai_core' ? 'sap-ai-core' : 'local-proxy';

  return {
    llm: {
      provider,
      baseUrl: data?.llm?.base_url || data?.llm?.baseUrl || defaultSettings.llm.baseUrl,
      model: data?.llm?.model || defaultSettings.llm.model,
      apiKey: data?.llm?.api_key || data?.llm?.apiKey || '',
    },
    n8n: {
      url: data?.n8n?.url || defaultSettings.n8n.url,
      apiKey: data?.n8n?.api_key || data?.n8n?.apiKey || '',
      workflowId: data?.n8n?.workflow_id || data?.n8n?.workflowId || '',
      retryWorkflowId: data?.n8n?.retry_workflow_id || data?.n8n?.retryWorkflowId || '',
      agentFixWorkflowId: data?.n8n?.agent_fix_workflow_id || data?.n8n?.agentFixWorkflowId || '',
      monitoredWorkflowIds: data?.n8n?.monitored_workflow_ids || data?.n8n?.monitoredWorkflowIds || [],
      webhookUrl: data?.n8n?.webhook_url || data?.n8n?.webhookUrl || '',
    },
    mockS4hana: {
      serverUrl: data?.mock_s4?.url || data?.mockS4hana?.serverUrl || defaultSettings.mockS4hana.serverUrl,
    },
    s4Source: {
      source: data?.s4_source?.source || data?.s4Source?.source || 'mock',
      destinationName: data?.s4_source?.destination_name || data?.s4Source?.destinationName || 'S4_SIA_I577956',
      sapClient: data?.s4_source?.sap_client || data?.s4Source?.sapClient || '500',
    },
    deployment: { mode: deploymentMode },
    email: {
      smtpHost: data?.smtp?.host || data?.email?.smtpHost || '',
      smtpPort: data?.smtp?.port || data?.email?.smtpPort || 1025,
      username: data?.smtp?.username || data?.email?.username || '',
      password: data?.smtp?.password || data?.email?.password || '',
      fromEmail: data?.smtp?.from_email || data?.email?.fromEmail || '',
      notificationEmails: data?.smtp?.notification_emails || data?.email?.notificationEmails || [],
    },
  };
}

function toBackend(settings: Settings): any {
  const provider = settings.llm.provider === 'sap-ai-core' ? 'sap_ai_core' : 'local_proxy';
  return {
    deployment_mode: settings.deployment.mode,
    llm: {
      provider,
      base_url: settings.llm.baseUrl,
      model: settings.llm.model,
      api_key: settings.llm.apiKey,
    },
    n8n: {
      url: settings.n8n.url,
      api_key: settings.n8n.apiKey,
      workflow_id: settings.n8n.workflowId,
      retry_workflow_id: settings.n8n.retryWorkflowId,
      agent_fix_workflow_id: settings.n8n.agentFixWorkflowId,
      monitored_workflow_ids: settings.n8n.monitoredWorkflowIds,
      webhook_url: settings.n8n.webhookUrl,
    },
    mock_s4: { url: settings.mockS4hana.serverUrl },
    s4_source: {
      source: settings.s4Source.source,
      destination_name: settings.s4Source.destinationName,
      sap_client: settings.s4Source.sapClient,
    },
    smtp: {
      host: settings.email.smtpHost,
      port: settings.email.smtpPort,
      username: settings.email.username,
      password: settings.email.password,
      from_email: settings.email.fromEmail,
      notification_emails: settings.email.notificationEmails,
    },
    agent: { url: 'http://localhost:5000' },
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<any>('/api/settings');
    if (res.ok && res.data) {
      setSettings(fromBackend(res.data));
    } else if (res.error) {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  const saveSettings = useCallback(async (newSettings: Settings) => {
    setSaving(true);
    setError(null);

    const secrets: Record<string, string> = {};
    if (newSettings.n8n.apiKey && !newSettings.n8n.apiKey.startsWith('*'))
      secrets['n8n_api_key'] = newSettings.n8n.apiKey;
    if (newSettings.llm.apiKey && !newSettings.llm.apiKey.startsWith('*'))
      secrets['llm_api_key'] = newSettings.llm.apiKey;
    if (newSettings.email.password && !newSettings.email.password.startsWith('*'))
      secrets['smtp_password'] = newSettings.email.password;

    if (Object.keys(secrets).length > 0) {
      await api.put<any>('/api/settings/secrets', secrets);
    }

    const res = await api.put<any>('/api/settings', toBackend(newSettings));
    if (res.ok) {
      setSettings(newSettings);
    } else {
      setError(res.error || 'Failed to save settings');
    }
    setSaving(false);
    return res.ok;
  }, []);

  const testConnection = useCallback(
    async (type: 'llm' | 'n8n' | 's4hana' | 'email') => {
      const endpoint =
        type === 's4hana' ? 'test-s4' :
        type === 'llm' ? 'test-llm' :
        type === 'n8n' ? 'test-n8n' : 'test-smtp';
      return api.post<{ success: boolean; message: string }>(
        `/api/settings/${endpoint}`,
        toBackend(settings)
      );
    },
    [settings]
  );

  const sendTestEmail = useCallback(async () => {
    return api.post<{ status: string; message: string }>(
      '/api/settings/send-test-email',
      toBackend(settings)
    );
  }, [settings]);

  const fetchN8nWorkflows = useCallback(async (overrideSettings?: Settings) => {
    const s = overrideSettings || settings;
    return api.post<{ workflows?: Array<{ id: string; name: string; active: boolean }>; error?: string }>(
      '/api/settings/fetch-n8n-workflows',
      toBackend(s)
    );
  }, [settings]);

  const fetchLlmModels = useCallback(async (overrideSettings?: Settings) => {
    const s = overrideSettings || settings;
    return api.post<{ models?: Array<{ id: string; name: string }>; error?: string }>(
      '/api/settings/fetch-llm-models',
      toBackend(s)
    );
  }, [settings]);

  const fetchAiCoreDeployments = useCallback(async () => {
    return api.post<{
      deployments?: Array<{ id: string; name: string; model_name: string; status: string; deployment_url: string }>;
      destination?: string;
      error?: string;
    }>('/api/settings/fetch-aicore-deployments', {});
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    setSettings,
    loading,
    saving,
    error,
    saveSettings,
    testConnection,
    sendTestEmail,
    fetchN8nWorkflows,
    fetchLlmModels,
    fetchAiCoreDeployments,
    loadSettings,
  };
}
