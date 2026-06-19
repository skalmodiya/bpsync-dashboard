import { PageHeader } from '../components/PageHeader';
import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useDashboardConfig } from '../hooks/useDashboardConfig';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { ConfigPanel } from '../components/ConfigPanel';
import { showToast } from '../components/Toast';
import { api } from '../lib/api';
import type { Settings, N8nWorkflow, LLMModel } from '../types';
import type { DashboardConfig } from '../hooks/useDashboardConfig';
import { CheckCircle, XCircle, Loader2, Cpu, Workflow, Server, Mail, Rocket, Palette, AlertTriangle, Info } from 'lucide-react';

type TestStatus = 'idle' | 'testing' | 'success' | 'error';

const TABS = [
  { id: 'customize', label: 'Customize', icon: Palette },
  { id: 'llm', label: 'LLM', icon: Cpu },
  { id: 'n8n', label: 'n8n', icon: Workflow },
  { id: 's4hana', label: 'S/4HANA', icon: Server },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'deployment', label: 'Deploy', icon: Rocket },
  { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
] as const;

type TabId = typeof TABS[number]['id'];

export function SettingsPage() {
  const { settings, setSettings, loading, saving, saveSettings, testConnection, sendTestEmail, fetchN8nWorkflows, fetchLlmModels, fetchAiCoreDeployments } = useSettings();
  const { config: dashConfig, loading: dashConfigLoading, saving: dashConfigSaving, updateConfig: updateDashConfig, resetConfig: resetDashConfig } = useDashboardConfig();
  const [testStatuses, setTestStatuses] = useState<Record<string, TestStatus>>({});
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabId>('customize');
  const [configPanelOpen, setConfigPanelOpen] = useState(false);

  const [n8nWorkflows, setN8nWorkflows] = useState<N8nWorkflow[]>([]);
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [aiCoreDeployments, setAiCoreDeployments] = useState<Array<{ id: string; name: string; model_name: string; deployment_url: string }>>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [loadingDeployments, setLoadingDeployments] = useState(false);
  const [aiCoreDestination, setAiCoreDestination] = useState('');

  const [resetTargets, setResetTargets] = useState<Set<string>>(new Set());
  const [resetPurpose, setResetPurpose] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<any>(null);

  const RESET_TARGETS = [
    { value: 'audit_log', label: 'Audit Log', description: 'Clear all audit events (reset events are always preserved)' },
    { value: 'agent_logs', label: 'Agent Invocation Logs', description: 'Delete all stored agent interaction logs' },
    { value: 'sync_history', label: 'Sync Execution History', description: 'Clear the sync run history' },
    { value: 'settings', label: 'Settings', description: 'Reset all settings to defaults' },
  ];

  const handleResetApp = async () => {
    setResetting(true);
    setResetResult(null);
    const res = await api.post<any>('/api/settings/reset-app', {
      confirmation: resetConfirmation,
      purpose: resetPurpose,
      targets: [...resetTargets],
    });
    if (res.ok && res.data && !res.data.error) {
      setResetResult(res.data.results);
      setResetTargets(new Set());
      setResetPurpose('');
      setResetConfirmation('');
      showToast('info', 'App reset completed. Check audit log for permanent record.');
    } else {
      showToast('error', res.data?.detail || res.data?.error || res.error || 'Reset failed');
    }
    setResetting(false);
  };

  useEffect(() => {
    if (activeTab === 'llm' && !loading) {
      if (settings.llm.provider === 'sap-ai-core') {
        handleLoadDeployments();
      } else {
        handleLoadModels();
      }
    }
  }, [activeTab, loading, settings.llm.provider]);

  useEffect(() => {
    if (activeTab === 'n8n' && !loading) {
      handleLoadWorkflows();
    }
  }, [activeTab, loading]);

  const handleSave = async () => {
    const success = await saveSettings(settings);
    if (success) {
      showToast('success', 'Settings saved successfully');
    } else {
      showToast('error', 'Failed to save settings');
    }
  };

  const handleTest = async (type: 'llm' | 'n8n' | 's4hana' | 'email') => {
    setTestStatuses((s) => ({ ...s, [type]: 'testing' }));
    setTestMessages((s) => ({ ...s, [type]: '' }));
    const res = await testConnection(type);
    if (res.ok && res.data) {
      const data = res.data as any;
      const isSuccess = data.success === true || data.status === 'connected' || data.status === 'ok';
      const isReachable = typeof data.status === 'string' && data.status.startsWith('reachable');
      if (isSuccess) {
        setTestStatuses((s) => ({ ...s, [type]: 'success' }));
        setTestMessages((s) => ({ ...s, [type]: data.message || data.status || 'Connected!' }));
      } else if (isReachable) {
        setTestStatuses((s) => ({ ...s, [type]: 'success' }));
        setTestMessages((s) => ({ ...s, [type]: `${data.status} (HTTP ${data.http_status})` }));
      } else {
        setTestStatuses((s) => ({ ...s, [type]: 'error' }));
        setTestMessages((s) => ({ ...s, [type]: data.message || data.error || data.detail || 'Connection failed' }));
      }
    } else {
      setTestStatuses((s) => ({ ...s, [type]: 'error' }));
      setTestMessages((s) => ({ ...s, [type]: res.error || 'Failed to connect' }));
    }
  };

  const handleLoadWorkflows = async () => {
    setLoadingWorkflows(true);
    const res = await fetchN8nWorkflows();
    if (res.ok && res.data) {
      const data = res.data as any;
      if (data.workflows) {
        setN8nWorkflows(data.workflows);
        setTestMessages((s) => ({ ...s, n8nWorkflows: '' }));
      } else if (data.error) {
        setTestMessages((s) => ({ ...s, n8nWorkflows: data.error }));
      }
    } else {
      setTestMessages((s) => ({ ...s, n8nWorkflows: res.error || 'Failed to load' }));
    }
    setLoadingWorkflows(false);
  };

  const handleLoadModels = async () => {
    setLoadingModels(true);
    const res = await fetchLlmModels();
    if (res.ok && res.data) {
      const data = res.data as any;
      if (data.models) {
        setLlmModels(data.models);
        setTestMessages((s) => ({ ...s, llmModels: '' }));
      } else if (data.error) {
        setTestMessages((s) => ({ ...s, llmModels: data.error }));
      }
    } else {
      setTestMessages((s) => ({ ...s, llmModels: res.error || 'Failed to load' }));
    }
    setLoadingModels(false);
  };

  const handleLoadDeployments = async () => {
    setLoadingDeployments(true);
    const res = await fetchAiCoreDeployments();
    if (res.ok && res.data) {
      const data = res.data as any;
      if (data.deployments) {
        setAiCoreDeployments(data.deployments);
        setAiCoreDestination(data.destination || '');
        setTestMessages((s) => ({ ...s, llmModels: '' }));
      } else {
        setTestMessages((s) => ({ ...s, llmModels: data.error || 'No deployments found' }));
      }
    } else {
      setTestMessages((s) => ({ ...s, llmModels: res.error || 'Failed to load deployments' }));
    }
    setLoadingDeployments(false);
  };

  const update = <K extends keyof Settings>(section: K, updates: Partial<Settings[K]>) => {
    setSettings((prev: Settings) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  };

  const TestIndicator = ({ type }: { type: string }) => {
    const status = testStatuses[type];
    const msg = testMessages[type];
    if (!status || status === 'idle') return null;
    return (
      <div className="flex items-center gap-2 mt-2 text-xs">
        {status === 'testing' && <Loader2 className="h-3 w-3 animate-spin text-blue-500" />}
        {status === 'success' && <CheckCircle className="h-3 w-3 text-emerald-500" />}
        {status === 'error' && <XCircle className="h-3 w-3 text-red-500" />}
        <span className={status === 'error' ? 'text-red-500' : status === 'success' ? 'text-emerald-500' : ''}>
          {msg || (status === 'testing' ? 'Testing...' : '')}
        </span>
      </div>
    );
  };

  return (
    <div className="w-full">
      <PageHeader title="Settings" subtitle="Configure connections and deployment options. All settings are persisted to the backend." />

      {/* Tab Navigation */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-6">

      {/* Customization */}
      {activeTab === 'customize' && (
        <div className="space-y-4">
          <Card title="Dashboard Customization" description="Configure dashboard cards, layout, and display preferences">
            <div className="space-y-4">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setConfigPanelOpen(true)}
                loading={dashConfigLoading}
              >
                Open Customization Panel
              </Button>
            </div>
          </Card>

          <Card title="Error Breakdown Limit" description="Maximum number of error categories shown on the dashboard">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1.5">Max Categories</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={dashConfig.errorBreakdownLimit || 5}
                  onChange={(e) => {
                    const newLimit = Math.max(1, parseInt(e.target.value) || 5);
                    updateDashConfig({ ...dashConfig, errorBreakdownLimit: newLimit });
                  }}
                  className="w-full max-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </Card>

          <ConfigPanel
            config={dashConfig}
            open={configPanelOpen}
            onClose={() => setConfigPanelOpen(false)}
            onSave={async (newConfig: DashboardConfig) => {
              await updateDashConfig(newConfig);
              setConfigPanelOpen(false);
            }}
            onReset={async () => {
              await resetDashConfig();
              setConfigPanelOpen(false);
            }}
            saving={dashConfigSaving}
          />

          <Card title="Theme" description="Application appearance">
            <div className="flex gap-3">
              {(['light', 'dark', 'system'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    if (mode === 'system') {
                      localStorage.removeItem('theme');
                      document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
                    } else if (mode === 'dark') {
                      localStorage.setItem('theme', 'dark');
                      document.documentElement.classList.add('dark');
                    } else {
                      localStorage.setItem('theme', 'light');
                      document.documentElement.classList.remove('dark');
                    }
                    setSettings((s) => ({ ...s }));
                  }}
                  className={`px-4 py-2 rounded-md border text-sm capitalize transition-colors ${
                    (mode === 'system' && !localStorage.getItem('theme')) ||
                    (mode === 'dark' && localStorage.getItem('theme') === 'dark') ||
                    (mode === 'light' && localStorage.getItem('theme') === 'light')
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </Card>

          <Card title="Header Gradient" description="Customize the gradient colors used in page headers across the app.">
            <div className="space-y-4">
              {/* Live preview */}
              {(() => {
                const g = dashConfig.headerGradient ?? { from: '#2d1bb5', via: '#6a1bbf', to: '#a020c0' };
                return (
                  <div
                    className="rounded-xl h-14 flex items-center px-5 transition-all duration-300"
                    style={{ background: `linear-gradient(to right, ${g.from}, ${g.via}, ${g.to})` }}
                  >
                    <span className="text-white font-bold text-base">Header Preview</span>
                  </div>
                );
              })()}

              {/* Color stops */}
              <div className="grid grid-cols-3 gap-4">
                {(['from', 'via', 'to'] as const).map((stop) => {
                  const defaults = { from: '#2d1bb5', via: '#6a1bbf', to: '#a020c0' };
                  const current = (dashConfig.headerGradient?.[stop]) ?? defaults[stop];
                  return (
                    <div key={stop} className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground capitalize">
                        {stop === 'from' ? 'Start color' : stop === 'via' ? 'Middle color' : 'End color'}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={current}
                          onChange={(e) => updateDashConfig({
                            ...dashConfig,
                            headerGradient: {
                              from: dashConfig.headerGradient?.from ?? defaults.from,
                              via:  dashConfig.headerGradient?.via  ?? defaults.via,
                              to:   dashConfig.headerGradient?.to   ?? defaults.to,
                              [stop]: e.target.value,
                            },
                          })}
                          className="h-9 w-10 rounded-md border border-border cursor-pointer p-0.5 bg-transparent"
                        />
                        <input
                          type="text"
                          value={current}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                              updateDashConfig({
                                ...dashConfig,
                                headerGradient: {
                                  from: dashConfig.headerGradient?.from ?? defaults.from,
                                  via:  dashConfig.headerGradient?.via  ?? defaults.via,
                                  to:   dashConfig.headerGradient?.to   ?? defaults.to,
                                  [stop]: val,
                                },
                              });
                            }
                          }}
                          className="flex-1 min-w-0 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Preset palettes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Presets</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'SAP Joule (default)', from: '#2d1bb5', via: '#6a1bbf', to: '#a020c0' },
                    { label: 'Ocean Blue',  from: '#0c4a6e', via: '#0369a1', to: '#0ea5e9' },
                    { label: 'Forest',     from: '#14532d', via: '#15803d', to: '#22c55e' },
                    { label: 'Sunset',     from: '#7c2d12', via: '#c2410c', to: '#f97316' },
                    { label: 'Rose',       from: '#881337', via: '#be123c', to: '#f43f5e' },
                    { label: 'Slate',      from: '#0f172a', via: '#1e293b', to: '#475569' },
                    { label: 'Teal',       from: '#134e4a', via: '#0f766e', to: '#14b8a6' },
                    { label: 'Amber',      from: '#78350f', via: '#b45309', to: '#f59e0b' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      title={preset.label}
                      onClick={() => updateDashConfig({ ...dashConfig, headerGradient: preset })}
                      className="group relative h-8 w-16 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 hover:shadow-md"
                      style={{
                        background: `linear-gradient(to right, ${preset.from}, ${preset.via}, ${preset.to})`,
                        borderColor: JSON.stringify(dashConfig.headerGradient) === JSON.stringify(preset) ||
                          (!dashConfig.headerGradient && preset.label.includes('default'))
                          ? 'white' : 'transparent',
                      }}
                    >
                      <span className="sr-only">{preset.label}</span>
                      <span className="absolute inset-0 flex items-end justify-center pb-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] text-white/90 font-medium bg-black/30 px-1 rounded">
                          {preset.label.split(' ')[0]}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset */}
              {dashConfig.headerGradient && (
                <button
                  onClick={() => updateDashConfig({ ...dashConfig, headerGradient: undefined })}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                >
                  Reset to default (SAP Joule)
                </button>
              )}
            </div>
          </Card>

          <Card title="Sidebar Logo" description="Upload a custom logo for the sidebar header. Replaces the default SAP logo.">
            <div className="space-y-3">
              {/* Preview + upload */}
              <div className="flex items-center gap-5">
                {/* Current logo preview */}
                <div className="flex h-14 w-36 items-center justify-center rounded-lg border border-border/60
                  bg-gradient-to-b from-[#2d1bb5] to-[#1a0f7a] flex-shrink-0">
                  {dashConfig.logoUrl ? (
                    <img src={dashConfig.logoUrl} alt="Logo preview" className="h-7 w-auto max-w-[80px] object-contain" />
                  ) : (
                    /* Default SAP logo preview */
                    <svg viewBox="0 0 60 30" className="h-7 w-auto" aria-label="SAP" fill="none">
                      <path d="M0 4 C0 1.8 1.8 0 4 0 L52 0 L60 8 L60 26 C60 28.2 58.2 30 56 30 L4 30 C1.8 30 0 28.2 0 26 Z" fill="#0070F2"/>
                      <text x="30" y="19" dominantBaseline="middle" textAnchor="middle"
                        fontFamily="Arial,Helvetica,sans-serif" fontWeight="bold" fontSize="13.5"
                        letterSpacing="1.5" fill="white">SAP</text>
                    </svg>
                  )}
                </div>

                {/* Upload controls */}
                <div className="flex-1 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer w-fit">
                    <input
                      type="file"
                      accept="image/png,image/svg+xml,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 100 * 1024) {
                          alert('Logo must be under 100KB');
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          updateDashConfig({ ...dashConfig, logoUrl: ev.target?.result as string });
                        };
                        reader.readAsDataURL(file);
                        e.target.value = '';
                      }}
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                      rounded-lg border border-border bg-background hover:bg-muted transition-colors cursor-pointer">
                      Upload Logo
                    </span>
                  </label>
                  {dashConfig.logoUrl && (
                    <button
                      onClick={() => updateDashConfig({ ...dashConfig, logoUrl: '' })}
                      className="text-xs text-muted-foreground hover:text-destructive underline transition-colors block"
                    >
                      Remove — restore default SAP logo
                    </button>
                  )}
                </div>
              </div>

              {/* Design guidelines */}
              <div className="rounded-lg bg-muted/40 border border-border/50 px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Logo guidelines for this space:</p>
                <ul className="space-y-0.5 ml-2">
                  <li>• <strong>Height:</strong> 28px displayed (upload at 56px for retina — 2×)</li>
                  <li>• <strong>Width:</strong> Max 80px displayed (sidebar header is 240px wide)</li>
                  <li>• <strong>Format:</strong> SVG (recommended), PNG, or WebP with transparent background</li>
                  <li>• <strong>File size:</strong> Max 100KB</li>
                  <li>• <strong>Background:</strong> Transparent — logo sits on the dark sidebar gradient</li>
                  <li>• <strong>Color:</strong> White or light-colored logo works best on the dark background</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Background Color" description="Customize the main background color of the app (light mode)">
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {/* Color picker */}
                <div className="relative">
                  <input
                    type="color"
                    value={dashConfig.bgColor || '#f5f5fa'}
                    onChange={(e) => updateDashConfig({ ...dashConfig, bgColor: e.target.value })}
                    className="h-10 w-20 rounded-lg border border-border cursor-pointer p-0.5 bg-transparent"
                    title="Pick background color"
                  />
                </div>
                {/* Current hex value */}
                <input
                  type="text"
                  value={dashConfig.bgColor || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                      updateDashConfig({ ...dashConfig, bgColor: val });
                    }
                  }}
                  placeholder="#f5f5fa"
                  className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {/* Preset swatches */}
                <div className="flex items-center gap-2 flex-wrap">
                  {[
                    { label: 'Default', color: '' },
                    { label: 'White', color: '#ffffff' },
                    { label: 'Warm', color: '#faf8f5' },
                    { label: 'Cool', color: '#f0f4ff' },
                    { label: 'Slate', color: '#f1f5f9' },
                    { label: 'Stone', color: '#f5f4f0' },
                    { label: 'Mint', color: '#f0faf4' },
                    { label: 'Rose', color: '#fff0f3' },
                  ].map(({ label, color }) => (
                    <button
                      key={label}
                      title={label}
                      onClick={() => updateDashConfig({ ...dashConfig, bgColor: color })}
                      className={`relative h-7 w-7 rounded-full border-2 transition-all hover:scale-110 ${
                        (dashConfig.bgColor || '') === color
                          ? 'border-primary shadow-md scale-110'
                          : 'border-border hover:border-primary/50'
                      }`}
                      style={{ backgroundColor: color || 'hsl(240 20% 98%)' }}
                    >
                      {(dashConfig.bgColor || '') === color && (
                        <span className="absolute inset-0 flex items-center justify-center text-primary text-[10px] font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
                {/* Reset button */}
                {dashConfig.bgColor && (
                  <button
                    onClick={() => updateDashConfig({ ...dashConfig, bgColor: '' })}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Changes apply instantly. The color is saved to your dashboard configuration.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* LLM Configuration */}
      {activeTab === 'llm' && (
        <Card title="LLM Configuration" description="Configure the language model provider">
          <div className="space-y-4">
            <Select
              label="Provider"
              value={settings.llm.provider}
              onChange={(e) => {
                const p = e.target.value as Settings['llm']['provider'];
                update('llm', { provider: p, model: '' });
                if (p === 'sap-ai-core') setLlmModels([]);
                else setAiCoreDeployments([]);
              }}
              options={[
                { value: 'sap-ai-core', label: 'SAP AI Core (BTP Destination)' },
                { value: 'local-proxy', label: 'Local Proxy (LiteLLM)' },
              ]}
            />

            {/* SAP AI Core via BTP Destination */}
            {settings.llm.provider === 'sap-ai-core' && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                  <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Credentials via BTP Destination</p>
                    <p className="mt-0.5">
                      AI Core credentials are resolved from the BTP destination named{' '}
                      <code className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded">
                        {aiCoreDestination || 'aicore'}
                      </code>.
                      To change the destination name, set the{' '}
                      <code className="bg-blue-100 dark:bg-blue-800/50 px-1 rounded">AICORE_DESTINATION_NAME</code>{' '}
                      environment variable on the backend app and redeploy.
                    </p>
                  </div>
                </div>

                <div>
                  {loadingDeployments ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Fetching deployments from SAP AI Core...
                    </div>
                  ) : (
                    <Select
                      label="Deployment (Model)"
                      value={settings.llm.model}
                      onChange={(e) => update('llm', { model: e.target.value })}
                      options={[
                        {
                          value: '',
                          label: aiCoreDeployments.length === 0
                            ? '-- No deployments found (check destination config) --'
                            : '-- Select a deployment --',
                        },
                        ...aiCoreDeployments.map((d) => ({
                          value: d.id,
                          label: d.model_name ? `${d.model_name} (${d.id})` : d.name || d.id,
                        })),
                      ]}
                    />
                  )}
                  {testMessages.llmModels && (
                    <p className="text-xs text-red-500 mt-1">{testMessages.llmModels}</p>
                  )}
                  <button
                    className="text-xs text-blue-500 hover:underline mt-1"
                    onClick={() => handleLoadDeployments()}
                  >
                    Reload deployments
                  </button>
                </div>
              </div>
            )}

            {/* Local Proxy */}
            {settings.llm.provider === 'local-proxy' && (
              <div className="space-y-4">
                <Input
                  label="Base URL"
                  value={settings.llm.baseUrl}
                  onChange={(e) => update('llm', { baseUrl: e.target.value })}
                  placeholder="http://localhost:6655/litellm/v1"
                />
                <Input
                  label="API Key"
                  type="password"
                  value={settings.llm.apiKey}
                  onChange={(e) => {
                    const newKey = e.target.value;
                    update('llm', { apiKey: newKey });
                    if (newKey && newKey.length > 3 && !newKey.startsWith('*')) {
                      clearTimeout((window as any).__llmModelTimer);
                      (window as any).__llmModelTimer = setTimeout(async () => {
                        setLoadingModels(true);
                        const updatedSettings = { ...settings, llm: { ...settings.llm, apiKey: newKey } };
                        const res = await fetchLlmModels(updatedSettings);
                        if (res.ok && res.data) {
                          const data = res.data as any;
                          if (data.models) setLlmModels(data.models);
                          else setTestMessages((s) => ({ ...s, llmModels: data.error || 'Failed' }));
                        }
                        setLoadingModels(false);
                      }, 800);
                    }
                  }}
                  placeholder="Enter API key to auto-load models..."
                />
                <div>
                  {loadingModels ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading models...
                    </div>
                  ) : (
                    <Select
                      label="Model"
                      value={settings.llm.model}
                      onChange={(e) => update('llm', { model: e.target.value })}
                      options={[
                        { value: '', label: llmModels.length === 0 ? '-- Enter API key to load models --' : '-- Select a model --' },
                        ...llmModels.map((m) => ({ value: m.id, label: m.name })),
                      ]}
                    />
                  )}
                  {testMessages.llmModels && (
                    <p className="text-xs text-red-500 mt-1">{testMessages.llmModels}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => handleTest('llm')} loading={testStatuses.llm === 'testing'}>
                Test Connection
              </Button>
              <TestIndicator type="llm" />
            </div>
          </div>
        </Card>
      )}

      {/* n8n Connection */}
      {activeTab === 'n8n' && (
        <Card title="n8n Connection" description="Configure the n8n workflow automation platform">
          <div className="space-y-4">
            <Input label="n8n URL" value={settings.n8n.url} onChange={(e) => update('n8n', { url: e.target.value })} placeholder="http://localhost:5678" />
            <Input
              label="API Key"
              type="password"
              value={settings.n8n.apiKey}
              onChange={(e) => {
                const newKey = e.target.value;
                update('n8n', { apiKey: newKey });
                if (newKey && newKey.length > 5 && !newKey.startsWith('*')) {
                  clearTimeout((window as any).__n8nWfTimer);
                  (window as any).__n8nWfTimer = setTimeout(async () => {
                    setLoadingWorkflows(true);
                    const updatedSettings = { ...settings, n8n: { ...settings.n8n, apiKey: newKey } };
                    const res = await fetchN8nWorkflows(updatedSettings);
                    if (res.ok && res.data) {
                      const data = res.data as any;
                      if (data.workflows) setN8nWorkflows(data.workflows);
                      else setTestMessages((s) => ({ ...s, n8nWorkflows: data.error || 'Failed' }));
                    }
                    setLoadingWorkflows(false);
                  }, 800);
                }
              }}
              placeholder="Enter API key to auto-load workflows..."
            />
            <div>
              {loadingWorkflows ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />Loading workflows...
                </div>
              ) : (
                <div className="space-y-3">
                  <Select label="Main Sync Workflow" value={settings.n8n.workflowId} onChange={(e) => update('n8n', { workflowId: e.target.value })}
                    options={[{ value: '', label: n8nWorkflows.length === 0 ? '-- Enter API key to load --' : '-- Select main sync workflow --' }, ...n8nWorkflows.map((w) => ({ value: w.id, label: `${w.name} (${w.id})${w.active ? '' : ' [inactive]'}` }))]} />
                  <Select label="Retry Sync Workflow" value={settings.n8n.retryWorkflowId} onChange={(e) => update('n8n', { retryWorkflowId: e.target.value })}
                    options={[{ value: '', label: n8nWorkflows.length === 0 ? '-- Enter API key to load --' : '-- Select retry workflow --' }, ...n8nWorkflows.map((w) => ({ value: w.id, label: `${w.name} (${w.id})${w.active ? '' : ' [inactive]'}` }))]} />
                  <Select label="Agent Fix Workflow" value={settings.n8n.agentFixWorkflowId} onChange={(e) => update('n8n', { agentFixWorkflowId: e.target.value })}
                    options={[{ value: '', label: n8nWorkflows.length === 0 ? '-- Enter API key to load --' : '-- Select agent fix workflow --' }, ...n8nWorkflows.map((w) => ({ value: w.id, label: `${w.name} (${w.id})${w.active ? '' : ' [inactive]'}` }))]} />
                  <div>
                    <label className="text-sm font-medium block mb-1.5">Monitor Workflows</label>
                    <div className="space-y-1 max-h-40 overflow-y-auto border border-border rounded-md p-2">
                      {n8nWorkflows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Enter API key to load workflows</p>
                      ) : (
                        n8nWorkflows.map((w) => (
                          <label key={w.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5">
                            <input type="checkbox" checked={settings.n8n.monitoredWorkflowIds.includes(w.id)}
                              onChange={(e) => {
                                const current = settings.n8n.monitoredWorkflowIds || [];
                                update('n8n', { monitoredWorkflowIds: e.target.checked ? [...current, w.id] : current.filter((id: string) => id !== w.id) });
                              }} className="h-3 w-3" />
                            {w.name} ({w.id}){w.active ? '' : ' [inactive]'}
                          </label>
                        ))
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Only selected workflows appear in the Workflows monitor.</p>
                  </div>
                </div>
              )}
              {testMessages.n8nWorkflows && <p className="text-xs text-red-500 mt-1">{testMessages.n8nWorkflows}</p>}
            </div>
            <Input label="Webhook Base URL (optional)" value={settings.n8n.webhookUrl || ''} onChange={(e) => update('n8n', { webhookUrl: e.target.value })} placeholder="e.g. https://your-tunnel.ngrok-free.app" />
            <p className="text-xs text-muted-foreground">If n8n is behind a tunnel, enter the public URL here. Leave empty to use the n8n URL above.</p>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => handleTest('n8n')} loading={testStatuses.n8n === 'testing'}>Test Connection</Button>
              <TestIndicator type="n8n" />
            </div>
          </div>
        </Card>
      )}

      {/* S/4HANA Source */}
      {activeTab === 's4hana' && (
        <div className="space-y-4">
          <Card title="S/4HANA Data Source" description="Choose between the Mock server or a real S/4HANA system via BTP destination">
            <div className="space-y-4">
              {/* Source toggle */}
              <div>
                <label className="text-sm font-medium block mb-2">Data Source</label>
                <div className="flex gap-3">
                  {(['mock', 'real'] as const).map((src) => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => update('s4Source', { source: src })}
                      className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                        settings.s4Source.source === src
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-muted'
                      }`}
                    >
                      {src === 'mock' ? 'Mock Server' : 'Real S/4HANA'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mock server config */}
              {settings.s4Source.source === 'mock' && (
                <div className="space-y-3">
                  <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    Using the mock S/4HANA server with simulated employee and BUPA data.
                  </div>
                  <Input label="Mock Server URL" value={settings.mockS4hana.serverUrl}
                    onChange={(e) => update('mockS4hana', { serverUrl: e.target.value })}
                    placeholder="http://localhost:8090" />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleTest('s4hana')} loading={testStatuses.s4hana === 'testing'}>
                      Test Connection
                    </Button>
                    <TestIndicator type="s4hana" />
                  </div>
                </div>
              )}

              {/* Real S/4HANA config */}
              {settings.s4Source.source === 'real' && (
                <div className="space-y-3">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium mb-1">Real S/4HANA via BTP Destination</p>
                    <p>Calls are routed through the BTP Connectivity service (Cloud Connector) using the named destination. Ensure the destination service is bound to the backend app.</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">BTP Destination Name</label>
                    <select
                      value={settings.s4Source.destinationName}
                      onChange={(e) => update('s4Source', { destinationName: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="S4_SIA_I577956">S4_SIA_I577956 (SIA HTTPS 443)</option>
                      <option value="SIA_I769350">SIA_I769350 (SIA HTTP 8001)</option>
                    </select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Both destinations use OnPremise proxy via Cloud Connector with BasicAuthentication (user I577956, client 500).
                    </p>
                  </div>
                  <Input
                    label="SAP Client"
                    value={settings.s4Source.sapClient}
                    onChange={(e) => update('s4Source', { sapClient: e.target.value })}
                    placeholder="500"
                  />
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleTest('s4hana')} loading={testStatuses.s4hana === 'testing'}>
                      Test Connection
                    </Button>
                    <TestIndicator type="s4hana" />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}


      {/* Email/SMTP */}
      {activeTab === 'email' && (
        <Card title="Email / SMTP (Optional)" description="Configure email notifications">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="SMTP Host" value={settings.email.smtpHost} onChange={(e) => update('email', { smtpHost: e.target.value })} placeholder="smtp.example.com" />
              <Input label="SMTP Port" type="number" value={settings.email.smtpPort || ''} onChange={(e) => update('email', { smtpPort: parseInt(e.target.value) || 587 })} placeholder="587" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Username" value={settings.email.username} onChange={(e) => update('email', { username: e.target.value })} placeholder="user@example.com" />
              <Input label="Password" type="password" value={settings.email.password} onChange={(e) => update('email', { password: e.target.value })} placeholder="••••••••" />
            </div>
            <Input label="From Email Address" value={settings.email.fromEmail} onChange={(e) => update('email', { fromEmail: e.target.value })} placeholder="bupa-sync@yourcompany.com" />
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Notification Recipients</label>
              <div className="min-h-[42px] w-full rounded-md border border-input bg-background px-2 py-1.5 flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-ring"
                onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}>
                {settings.email.notificationEmails.map((email, i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5">
                    {email}
                    <button type="button" className="hover:text-destructive ml-0.5"
                      onClick={() => update('email', { notificationEmails: settings.email.notificationEmails.filter((_, j) => j !== i) })}>×</button>
                  </span>
                ))}
                <input type="text" className="flex-1 min-w-[180px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5"
                  placeholder={settings.email.notificationEmails.length === 0 ? 'Enter email and press Enter...' : ''}
                  onKeyDown={(e) => {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if ((e.key === 'Enter' || e.key === ',') && val) {
                      e.preventDefault();
                      const emails = val.split(/[,\s]+/).map(v => v.trim()).filter(v => v.includes('@'));
                      if (emails.length) {
                        const existing = settings.email.notificationEmails;
                        update('email', { notificationEmails: [...existing, ...emails.filter(em => !existing.includes(em))] });
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                    if (e.key === 'Backspace' && !(e.target as HTMLInputElement).value && settings.email.notificationEmails.length) {
                      update('email', { notificationEmails: settings.email.notificationEmails.slice(0, -1) });
                    }
                  }}
                  onBlur={(e) => {
                    const val = e.target.value.trim();
                    if (val && val.includes('@')) {
                      const emails = val.split(/[,\s]+/).map(v => v.trim()).filter(v => v.includes('@'));
                      if (emails.length) {
                        update('email', { notificationEmails: [...settings.email.notificationEmails, ...emails.filter(em => !settings.email.notificationEmails.includes(em))] });
                        e.target.value = '';
                      }
                    }
                  }} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => handleTest('email')} loading={testStatuses.email === 'testing'}>Test Connection</Button>
              <Button variant="outline" size="sm"
                onClick={async () => {
                  setTestStatuses((s) => ({ ...s, emailSend: 'testing' }));
                  const res = await sendTestEmail();
                  if (res.ok && res.data) {
                    const data = res.data as any;
                    if (data.status === 'sent') {
                      setTestStatuses((s) => ({ ...s, emailSend: 'success' }));
                      setTestMessages((s) => ({ ...s, emailSend: data.message || 'Email sent!' }));
                    } else {
                      setTestStatuses((s) => ({ ...s, emailSend: 'error' }));
                      setTestMessages((s) => ({ ...s, emailSend: data.error || 'Failed' }));
                    }
                  } else {
                    setTestStatuses((s) => ({ ...s, emailSend: 'error' }));
                    setTestMessages((s) => ({ ...s, emailSend: res.error || 'Failed' }));
                  }
                }}
                loading={testStatuses.emailSend === 'testing'}
                disabled={settings.email.notificationEmails.length === 0}>
                Send Test Email
              </Button>
              <TestIndicator type="email" />
            </div>
          </div>
        </Card>
      )}

      {/* Deployment Mode */}
      {activeTab === 'deployment' && (
        <Card title="Deployment Mode" description="Select how this stack is deployed">
          <div className="space-y-4">
            <div className="flex gap-4">
              {(['local', 'docker', 'cf'] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="deployment-mode" value={mode} checked={settings.deployment.mode === mode}
                    onChange={() => update('deployment', { mode })} className="h-4 w-4 text-primary" />
                  <span className="text-sm capitalize">{mode === 'cf' ? 'Cloud Foundry (BTP)' : mode}</span>
                </label>
              ))}
            </div>
            <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {settings.deployment.mode === 'local' && <p>Running all services locally.</p>}
              {settings.deployment.mode === 'docker' && <p>Running via Docker Compose. Services communicate via Docker network.</p>}
              {settings.deployment.mode === 'cf' && <p>Deployed on SAP BTP Cloud Foundry. XSUAA handles authentication. AI Core credentials resolved via BTP destination.</p>}
            </div>
          </div>
        </Card>
      )}

      {/* Danger Zone */}
      {activeTab === 'danger' && (
        <div className="rounded-lg border-2 border-red-500/30 bg-red-500/5 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </h3>
          <p className="text-sm text-muted-foreground">These actions are destructive and cannot be undone. A permanent audit record will be created.</p>
          <p className="text-sm font-medium">Select items to reset:</p>
          <div className="space-y-2">
            {RESET_TARGETS.map((target) => (
              <label key={target.value} className="flex items-start gap-3 p-3 rounded-md border border-border hover:border-red-300 cursor-pointer">
                <input type="checkbox" checked={resetTargets.has(target.value)}
                  onChange={(e) => {
                    const next = new Set(resetTargets);
                    if (e.target.checked) next.add(target.value); else next.delete(target.value);
                    setResetTargets(next);
                  }} className="h-4 w-4 mt-0.5" />
                <div>
                  <span className="text-sm font-medium">{target.label}</span>
                  <p className="text-xs text-muted-foreground">{target.description}</p>
                </div>
              </label>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Reason for reset</label>
            <textarea value={resetPurpose} onChange={(e) => setResetPurpose(e.target.value)}
              placeholder="Explain why you are resetting the app (minimum 10 characters)..." rows={2}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">
              Type <code className="px-1 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 rounded text-xs">DELETE</code> to confirm
            </label>
            <input type="text" value={resetConfirmation} onChange={(e) => setResetConfirmation(e.target.value)} placeholder="DELETE"
              className="w-full max-w-xs rounded-md border border-red-300 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <button onClick={handleResetApp}
            disabled={resetConfirmation !== 'DELETE' || resetTargets.size === 0 || resetPurpose.length < 10 || resetting}
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Reset App
          </button>
          {resetResult && (
            <div className="rounded-md border border-border bg-muted/50 p-4">
              <p className="text-sm font-medium text-emerald-600 mb-2">Reset completed</p>
              <pre className="text-xs text-muted-foreground overflow-auto">{JSON.stringify(resetResult, null, 2)}</pre>
            </div>
          )}
        </div>
      )}

      </div>

      {/* Save */}
      {activeTab !== 'danger' && (
        <div className="flex justify-start pt-4 border-t border-border mt-6">
          <Button onClick={handleSave} loading={saving} size="lg">Save Settings</Button>
        </div>
      )}
    </div>
  );
}
