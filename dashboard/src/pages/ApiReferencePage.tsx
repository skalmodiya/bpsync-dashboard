import { PageHeader } from '../components/PageHeader';
import { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Workflow } from 'lucide-react';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'SMTP';

interface Endpoint {
  method: Method;
  path: string;
  description: string;
  params?: string[];
  note?: string;
}

interface Section {
  title: string;
  subtitle?: string;
  endpoints: Endpoint[];
}

const METHOD_COLORS: Record<Method, string> = {
  GET:    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  POST:   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  PUT:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  PATCH:  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  SMTP:   'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

function EndpointRow({ e }: { e: Endpoint }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-border last:border-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold font-mono min-w-[44px] text-center ${METHOD_COLORS[e.method] || METHOD_COLORS.GET}`}>
          {e.method}
        </span>
        <code className="text-sm font-mono text-foreground">{e.path}</code>
      </div>
      <p className="text-xs text-muted-foreground">{e.description}</p>
      {e.params && e.params.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-0.5">
          {e.params.map(p => (
            <span key={p} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">{p}</span>
          ))}
        </div>
      )}
      {e.note && <p className="text-[10px] text-amber-600 dark:text-amber-400 italic">{e.note}</p>}
    </div>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────

const INBOUND: Section[] = [
  {
    title: 'Core',
    subtitle: 'Health & Auth',
    endpoints: [
      { method: 'GET',  path: '/health',  description: 'Backend health check' },
      { method: 'GET',  path: '/api/me',  description: 'Current user info from XSUAA JWT claims' },
    ],
  },
  {
    title: 'Settings',
    subtitle: '/api/settings',
    endpoints: [
      { method: 'GET',    path: '/api/settings',                         description: 'Get all settings (sensitive fields masked)' },
      { method: 'PUT',    path: '/api/settings',                         description: 'Save all settings', params: ['llm', 'n8n', 'smtp', 'mock_s4', 's4_source', 'agent'] },
      { method: 'PUT',    path: '/api/settings/secrets',                 description: 'Update API keys only (skip masking)', params: ['n8n_api_key', 'llm_api_key', 'smtp_password'] },
      { method: 'GET',    path: '/api/settings/dashboard',               description: 'Get dashboard customization config' },
      { method: 'PUT',    path: '/api/settings/dashboard',               description: 'Save dashboard customization config' },
      { method: 'GET',    path: '/api/settings/notification-emails',     description: 'Get notification email list (used by n8n)' },
      { method: 'POST',   path: '/api/settings/test-llm',                description: 'Test LLM or SAP AI Core connection' },
      { method: 'POST',   path: '/api/settings/test-n8n',                description: 'Test n8n API connectivity' },
      { method: 'POST',   path: '/api/settings/test-s4',                 description: 'Test S/4HANA connectivity (mock or real)' },
      { method: 'POST',   path: '/api/settings/test-agent',              description: 'Test BUPA Sync Agent health' },
      { method: 'POST',   path: '/api/settings/test-smtp',               description: 'Test SMTP server authentication' },
      { method: 'POST',   path: '/api/settings/send-test-email',         description: 'Send test email to configured recipients' },
      { method: 'POST',   path: '/api/settings/fetch-n8n-workflows',     description: 'Fetch workflow list from n8n for dropdowns' },
      { method: 'POST',   path: '/api/settings/fetch-llm-models',        description: 'Fetch model list from local LLM proxy' },
      { method: 'POST',   path: '/api/settings/fetch-aicore-deployments',description: 'Fetch running deployments from SAP AI Core via destination' },
      { method: 'POST',   path: '/api/settings/probe-s4',                description: 'Probe common S/4HANA paths to discover available services' },
      { method: 'POST',   path: '/api/settings/reset-app',               description: 'Reset selected app data', params: ['confirmation="DELETE"', 'purpose (≥10 chars)', 'targets[]'], note: 'Irreversible — creates permanent audit record' },
    ],
  },
  {
    title: 'Sync',
    subtitle: '/api/sync',
    endpoints: [
      { method: 'GET',  path: '/api/sync/status',           description: 'Dashboard overview: employee counts, error breakdown, last run' },
      { method: 'GET',  path: '/api/sync/records',          description: 'Paginated employee sync records', params: ['status', 'category', 'offset', 'limit'] },
      { method: 'GET',  path: '/api/sync/errors',           description: 'Current error log from S/4HANA' },
      { method: 'GET',  path: '/api/sync/error-categories', description: 'Distinct error categories from sync log' },
      { method: 'GET',  path: '/api/sync/history',          description: 'Sync execution history (last 100 runs)' },
      { method: 'POST', path: '/api/sync/trigger',          description: 'Trigger a full sync run' },
      { method: 'POST', path: '/api/sync/retry',            description: 'Retry failed records', params: ['pernr_list', 'mode', 'categories'] },
      { method: 'POST', path: '/api/sync/ask-agent-fix',    description: 'Send errors to AI agent for fix proposals' },
      { method: 'POST', path: '/api/sync/notify-completion',description: 'Called by n8n on workflow completion — sends email summary', params: ['run_id', 'total_employees', 'error_count', 'synced_count', 'report'] },
    ],
  },
  {
    title: 'n8n Proxy',
    subtitle: '/api/n8n',
    endpoints: [
      { method: 'GET',  path: '/api/n8n/workflows',                     description: 'List all n8n workflows' },
      { method: 'GET',  path: '/api/n8n/executions',                    description: 'Recent executions with workflow names', params: ['limit (default 20)'] },
      { method: 'GET',  path: '/api/n8n/executions/{execution_id}',     description: 'Execution details by ID' },
      { method: 'POST', path: '/api/n8n/workflows/{workflow_id}/activate', description: 'Activate a workflow' },
      { method: 'POST', path: '/api/n8n/trigger/bupa-sync',             description: 'Trigger BUPA sync via production or test webhook', note: 'Falls back to test webhook if production unavailable' },
    ],
  },
  {
    title: 'Agent Proxy',
    subtitle: '/api/agent',
    endpoints: [
      { method: 'GET',    path: '/api/agent/health',       description: 'Proxy to agent /health' },
      { method: 'GET',    path: '/api/agent/info',         description: 'Proxy to agent /.well-known/agent.json' },
      { method: 'GET',    path: '/api/agent/card',         description: 'Alias for /api/agent/info' },
      { method: 'POST',   path: '/api/agent/invoke',       description: 'Invoke agent — converts {message} to A2A format and logs', params: ['message'] },
      { method: 'GET',    path: '/api/agent/invocations',  description: 'Recent invocations from local logs', params: ['limit (default 20)'] },
      { method: 'DELETE', path: '/api/agent/invocations',  description: 'Clear all invocation logs' },
      { method: 'GET',    path: '/api/agent/logs',         description: 'Raw agent log files', params: ['limit (default 50)'] },
    ],
  },
  {
    title: 'Audit',
    subtitle: '/api/audit',
    endpoints: [
      { method: 'GET',    path: '/api/audit',            description: 'List audit events', params: ['limit (max 500)', 'category', 'action'] },
      { method: 'GET',    path: '/api/audit/categories', description: 'Available audit categories: settings, workflow, agent, system' },
      { method: 'DELETE', path: '/api/audit',            description: 'Clear audit log (preserves system.app_reset events)' },
    ],
  },
];

const OUTBOUND: Section[] = [
  {
    title: 'S/4HANA (Mock or Real via BTP Destination)',
    endpoints: [
      { method: 'GET',  path: '/sap/bc/ping',                                          description: 'Lightweight connectivity check (real S/4)' },
      { method: 'GET',  path: '/api/pa0000',                                            description: 'Employee master data — PA0000 infotype (PERNR, PLANS, STELL)' },
      { method: 'GET',  path: '/api/lfb1',                                              description: 'Employee–vendor links from LFB1' },
      { method: 'GET',  path: '/api/business_partners',                                 description: 'Business Partner records from BUT000' },
      { method: 'GET',  path: '/api/employees/{pernr}',                                 description: 'Employee detail by PERNR' },
      { method: 'GET',  path: '/api/sync/status',                                       description: 'Sync job status by job_id' },
      { method: 'GET',  path: '/api/bupa/sync/log',                                     description: 'BUPA sync error log from /SHCM/D_BP_SYNC' },
      { method: 'GET',  path: '/api/slg1/log',                                          description: 'SLG1 application log' },
      { method: 'GET',  path: '/api/sync/errors',                                       description: 'Sync error records' },
      { method: 'POST', path: '/api/sync/push',                                         description: 'Push employee list to sync (trigger SuccessFactors job)' },
      { method: 'POST', path: '/api/bupa/sync/execute',                                 description: 'Execute BUPA sync job with PERNR list' },
      { method: 'POST', path: '/api/bupa/sync/retry',                                   description: 'Retry sync for specific employees' },
      { method: 'GET',  path: '/sap/opu/odata/sap/API_BUSINESS_PARTNER/$metadata',      description: 'Standard BP OData availability check' },
      { method: 'GET',  path: '/sap/opu/odata/sap/HCM_PAOMCE_SRV/$metadata',           description: 'HCM OData service check' },
    ],
  },
  {
    title: 'n8n',
    subtitle: 'API + Webhooks',
    endpoints: [
      { method: 'GET',  path: '{n8n_url}/api/v1/workflows',                         description: 'List workflows', params: ['X-N8N-API-KEY header'] },
      { method: 'GET',  path: '{n8n_url}/api/v1/executions',                        description: 'List executions', params: ['X-N8N-API-KEY header', 'limit', 'workflowId'] },
      { method: 'GET',  path: '{n8n_url}/api/v1/executions/{id}',                   description: 'Execution details' },
      { method: 'POST', path: '{n8n_url}/api/v1/workflows/{id}/activate',           description: 'Activate workflow' },
      { method: 'POST', path: '{webhook_url}/webhook/bupa-sync',                    description: 'Trigger main sync (production)' },
      { method: 'POST', path: '{webhook_url}/webhook-test/bupa-sync',               description: 'Trigger main sync (test / editor open)' },
      { method: 'POST', path: '{webhook_url}/webhook/bupa-sync-retry',              description: 'Trigger retry workflow (production)' },
      { method: 'POST', path: '{webhook_url}/webhook-test/bupa-sync-retry',         description: 'Trigger retry workflow (test)' },
      { method: 'POST', path: '{webhook_url}/webhook/bupa-sync-agent-fix',          description: 'Trigger agent-fix workflow (production)' },
      { method: 'POST', path: '{webhook_url}/webhook-test/bupa-sync-agent-fix',     description: 'Trigger agent-fix workflow (test)' },
    ],
  },
  {
    title: 'BUPA Sync Agent',
    endpoints: [
      { method: 'GET',  path: '{agent_url}/health',                   description: 'Agent health check' },
      { method: 'GET',  path: '{agent_url}/.well-known/agent.json',   description: 'Agent card (A2A metadata)' },
      { method: 'POST', path: '{agent_url}/invoke',                   description: 'Invoke agent', params: ['messages: [{role, content}]'] },
    ],
  },
  {
    title: 'SAP AI Core',
    endpoints: [
      { method: 'POST', path: '{token_url}/oauth/token',               description: 'Get OAuth2 bearer token', params: ['client_credentials grant'] },
      { method: 'GET',  path: '{aicore_url}/v2/lm/deployments',        description: 'List running LLM deployments', params: ['AI-Resource-Group: default'] },
      { method: 'POST', path: '{deployment_url}/chat/completions',     description: 'LLM inference', params: ['?api-version=2023-05-15', 'AI-Resource-Group header'] },
    ],
  },
  {
    title: 'BTP Destination Service',
    endpoints: [
      { method: 'POST', path: '{dest_svc_url}/oauth/token',                                             description: 'Get destination service OAuth token', params: ['client_credentials'] },
      { method: 'GET',  path: '{dest_svc_uri}/destination-configuration/v1/destinations/{name}',        description: 'Resolve named destination (credentials + URL)' },
      { method: 'POST', path: '{connectivity_url}/oauth/token',                                         description: 'Get connectivity service token for OnPremise proxy' },
    ],
  },
  {
    title: 'LLM Proxy (Local)',
    endpoints: [
      { method: 'GET',  path: '{llm_base_url}/models',   description: 'List available models', params: ['Authorization: Bearer {api_key}'] },
    ],
  },
  {
    title: 'SMTP',
    endpoints: [
      { method: 'SMTP', path: '{smtp_host}:{smtp_port}', description: 'Send notification emails via smtplib (EHLO → STARTTLS → AUTH → SENDMAIL)' },
    ],
  },
];

const N8N_WORKFLOWS: Section[] = [
  {
    title: 'BUPA Sync — Local Services',
    subtitle: 'bupa-sync-local.n8n.json',
    endpoints: [
      { method: 'GET',  path: '{mock_s4}/api/pa0000',                          description: 'Read active employees (PA0000 infotype)' },
      { method: 'GET',  path: '{mock_s4}/api/lfb1',                            description: 'Read employee vendors (LFB1)' },
      { method: 'POST', path: '{mock_s4}/api/bupa/sync/execute',               description: 'Execute BUPA sync with PERNR list', params: ['pernr_list[]'] },
      { method: 'GET',  path: '{mock_s4}/api/bupa/sync/status/{job_id}',       description: 'Poll sync job status' },
      { method: 'GET',  path: '{mock_s4}/api/bupa/sync/log',                   description: 'Read sync error log from /SHCM/D_BP_SYNC' },
      { method: 'GET',  path: '{mock_s4}/api/slg1/log',                        description: 'Read SLG1 application log' },
      { method: 'POST', path: '{agent_url}/invoke',                            description: 'Send errors to AI agent for analysis', params: ['timeout: 120s'] },
    ],
  },
  {
    title: 'BUPA Sync — Retry',
    subtitle: 'bupa-sync-retry.n8n.json · Webhook: /webhook/bupa-sync-retry',
    endpoints: [
      { method: 'POST', path: '{mock_s4}/api/bupa/sync/retry', description: 'Retry sync for specific employees', params: ['pernr_list[]'] },
    ],
  },
  {
    title: 'BUPA Sync — Agent Fix',
    subtitle: 'bupa-sync-agent-fix.n8n.json · Webhook: /webhook/bupa-sync-agent-fix',
    endpoints: [
      { method: 'POST', path: '{agent_url}/invoke', description: 'Send failed records to AI agent for fix proposals', params: ['messages: [{role, content}]', 'timeout: 120s'] },
    ],
  },
  {
    title: 'BUPA Sync — Orchestration',
    subtitle: 'bupa-sync-orchestration.n8n.json · Uses MCP tools (not HTTP nodes)',
    endpoints: [
      { method: 'GET',  path: 'mcp://sap-hcm-server/read_pa0000_active_employees',  description: 'Read PA0000 active employees via MCP' },
      { method: 'GET',  path: 'mcp://sap-hcm-server/read_lfb1_vendor_employees',    description: 'Read LFB1 vendor links via MCP' },
      { method: 'POST', path: 'mcp://sap-hcm-server/schedule_bupa_sync_job',        description: 'Schedule BUPA sync job via MCP' },
      { method: 'GET',  path: 'mcp://sap-hcm-server/check_job_status',              description: 'Poll sync job status via MCP' },
      { method: 'GET',  path: 'mcp://sap-hcm-server/read_bp_sync_error_log',        description: 'Read /SHCM/D_BP_SYNC via MCP' },
      { method: 'GET',  path: 'mcp://sap-hcm-server/read_slg1_application_log',     description: 'Read SLG1 log via MCP' },
      { method: 'POST', path: 'mcp://sap-hcm-server/apply_fix_via_rfc',             description: 'Apply fix via RFC via MCP' },
      { method: 'POST', path: 'mcp://sap-hcm-server/retrigger_sync_for_records',    description: 'Re-trigger sync via MCP' },
    ],
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

const TOP_TABS = [
  {
    id: 'inbound',
    label: 'Inbound',
    sublabel: 'Backend API',
    icon: <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />,
    sections: INBOUND,
    note: <span>Base URL: <code className="bg-muted px-1 rounded font-mono">https://bpsync-backend.cfapps.us10.hana.ondemand.com</code></span>,
  },
  {
    id: 'outbound',
    label: 'Outbound',
    sublabel: 'External Services',
    icon: <ArrowUpRight className="h-3.5 w-3.5 text-blue-500" />,
    sections: OUTBOUND,
    note: null,
  },
  {
    id: 'n8n',
    label: 'n8n Workflows',
    sublabel: 'HTTP Nodes',
    icon: <Workflow className="h-3.5 w-3.5 text-purple-500" />,
    sections: N8N_WORKFLOWS,
    note: <span><code className="bg-muted px-1 rounded font-mono">{'{mock_s4}'}</code> = <code className="bg-muted px-1 rounded font-mono">https://mock-s4hana.cfapps.us10.hana.ondemand.com</code></span>,
  },
] as const;

export function ApiReferencePage() {
  const [topTab, setTopTab] = useState(0);
  const current = TOP_TABS[topTab];
  const totalEndpoints = current.sections.reduce((a, s) => a + s.endpoints.length, 0);

  return (
    <div className="space-y-4 w-full">
      {/* Page header */}
      <div>
        <PageHeader title="API Reference" subtitle="All service endpoints — inbound, outbound and n8n workflows" />
      </div>

      {/* Top-level tab bar */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex border-b border-border bg-muted/20 overflow-x-auto">
          {TOP_TABS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTopTab(i)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
                topTab === i
                  ? 'border-primary text-primary bg-background'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">— {t.sublabel}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                topTab === i ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              }`}>
                {t.sections.reduce((a, s) => a + s.endpoints.length, 0)}
              </span>
            </button>
          ))}
        </div>

        {/* Note for current top tab */}
        {current.note && (
          <div className="px-4 py-1.5 text-xs text-muted-foreground bg-muted/10 border-b border-border">
            {current.note}
          </div>
        )}

        {/* Inner section tabs */}
        <InnerTabPanel sections={current.sections} />
      </div>
    </div>
  );
}

function InnerTabPanel({ sections }: { sections: Section[] }) {
  const [active, setActive] = useState(0);
  const section = sections[Math.min(active, sections.length - 1)];

  return (
    <>
      {/* Section tab bar */}
      <div className="flex overflow-x-auto border-b border-border bg-background">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors flex-shrink-0 ${
              active === i
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
            }`}
          >
            {s.title}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
              active === i ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
            }`}>
              {s.endpoints.length}
            </span>
          </button>
        ))}
      </div>

      {/* Endpoint list */}
      <div className="px-4 pb-2">
        {section.subtitle && (
          <p className="text-[10px] text-muted-foreground pt-2 pb-1 font-mono">{section.subtitle}</p>
        )}
        {section.endpoints.map((e, i) => <EndpointRow key={i} e={e} />)}
      </div>
    </>
  );
}
