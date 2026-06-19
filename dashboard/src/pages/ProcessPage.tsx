import { PageHeader } from '../components/PageHeader';
import { useState } from 'react';
import { Card } from '../components/Card';
import { ArrowRight, ArrowDown, CheckCircle, XCircle, Bot, Workflow, User, Database, Mail, ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';

const PROCESS_STEPS = [
  {
    id: 1,
    phase: 'Initial Sync',
    trigger: 'Consultant clicks "Trigger Sync" on Dashboard or n8n scheduled run',
    executor: 'n8n Workflow',
    steps: [
      'Select employee population (PA0000 active + LFB1 vendors)',
      'Execute BUPA sync program (/SHCM/RH_SYNC_BUPA_EMPL_SINGLE)',
      'Wait for sync job completion',
      'Extract error log (/SHCM/D_BP_SYNC + SLG1)',
      'Emit milestone M1 (Population) + M2 (Sync Executed)',
    ],
    output: 'List of sync errors grouped by category',
    color: 'blue',
  },
  {
    id: 2,
    phase: 'Error Analysis',
    trigger: 'Automatic (after Step 1) OR Consultant clicks "Ask Agent to Fix"',
    executor: 'n8n → AI Agent',
    steps: [
      'n8n sends error batch to AI Agent via A2A protocol',
      'Agent classifies errors (Missing Address, Duplicate BP, etc.)',
      'Agent cross-references PA and BP data for root cause',
      'Agent generates fix proposals with confidence scores',
      'Agent returns structured proposals to n8n',
    ],
    output: 'Fix proposals with: action, target table/field, proposed value, confidence',
    color: 'green',
  },
  {
    id: 3,
    phase: 'Consultant Review',
    trigger: 'Fix proposals available in Dashboard',
    executor: 'Human (Consultant)',
    steps: [
      'Review agent proposals on Records page',
      'Check confidence scores and explanations',
      'Approve fixes (individually or by category)',
      'Reject fixes that need manual intervention',
      'Optionally modify proposed values before approval',
    ],
    output: 'Approved fix list ready for application',
    color: 'orange',
  },
  {
    id: 4,
    phase: 'Apply Fixes',
    trigger: 'Consultant clicks "Apply & Retry" or approves in Task Center',
    executor: 'n8n Workflow',
    steps: [
      'n8n receives approved fixes via webhook',
      'Apply corrections to master data (PA infotypes, BP fields)',
      'Validate applied changes (pre-check before resync)',
      'Log each fix in audit trail with before/after values',
      'Emit milestone M4 (Fixes Applied)',
    ],
    output: 'Corrected master data ready for resync',
    color: 'purple',
  },
  {
    id: 5,
    phase: 'Resync & Report',
    trigger: 'Automatic (after Step 4)',
    executor: 'n8n Workflow',
    steps: [
      'Re-trigger BUPA sync for corrected employees only',
      'Wait for sync completion',
      'Verify: check if previously-failed records now sync successfully',
      'Generate reconciliation report (synced/still-failed/coverage %)',
      'Send email notification with full run summary',
      'Emit milestone M5 (Reconciliation Complete)',
    ],
    output: 'Reconciliation report + email notification',
    color: 'emerald',
  },
];

const ARCHITECTURE = [
  { component: 'Dashboard (React)', role: 'UI for monitoring, triggering, reviewing proposals, approving fixes', icon: User },
  { component: 'Backend API (FastAPI)', role: 'Settings, auth, audit, proxies requests to n8n/agent/S4', icon: Database },
  { component: 'n8n Workflow', role: 'Orchestrates ALL operations: sync, agent calls, fix application, resync, email', icon: Workflow },
  { component: 'AI Agent (Python)', role: 'Analyzes errors, proposes fixes. Called BY n8n, never directly by dashboard in production', icon: Bot },
  { component: 'SAP S/4HANA', role: 'Source of truth: employee data (PA), business partners (BP), sync logs', icon: Database },
  { component: 'Email (SMTP)', role: 'Sends notifications after each workflow run with detailed report', icon: Mail },
];

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10',
  green: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10',
  orange: 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10',
  purple: 'border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10',
  emerald: 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10',
};

const BADGE_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export function ProcessPage() {
  // First step expanded by default
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set([1]));

  const toggleStep = (id: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedSteps(new Set(PROCESS_STEPS.map((s) => s.id)));
  const collapseAll = () => setExpandedSteps(new Set());

  return (
    <div className="space-y-8">
      <div>
        <PageHeader title="Process Flow" subtitle="End-to-end BUPA sync process visualization" />
        <p className="text-sm text-muted-foreground mt-1">
          End-to-end BUPA Sync Automation process — how each component interacts
        </p>
      </div>

      {/* Visual Flow Diagram */}
      <Card title="Process Overview" description="Sequential flow from trigger to completion">
        <div className="flex flex-wrap items-center gap-2 py-4">
          {PROCESS_STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-2">
              <div className={`rounded-lg px-3 py-2 border text-center ${COLOR_MAP[step.color]}`}>
                <div className="text-xs font-bold text-muted-foreground">Step {step.id}</div>
                <div className="text-sm font-semibold">{step.phase}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{step.executor}</div>
              </div>
              {idx < PROCESS_STEPS.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Detailed Steps */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Detailed Process Steps</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors"
            >
              Collapse All
            </button>
          </div>
        </div>
        {PROCESS_STEPS.map((step) => {
          const isExpanded = expandedSteps.has(step.id);
          return (
            <div key={step.id} className={`rounded-lg border ${COLOR_MAP[step.color]} overflow-hidden`}>
              <button
                onClick={() => toggleStep(step.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${BADGE_MAP[step.color]}`}>
                    Step {step.id}
                  </span>
                  <h3 className="text-sm font-semibold">{step.phase}</h3>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded font-medium">{step.executor}</span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">Trigger</span>
                      <p className="text-xs">{step.trigger}</p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">Actions</span>
                      <ol className="text-xs space-y-1 list-decimal list-inside">
                        {step.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground block mb-1">Output</span>
                      <p className="text-xs">{step.output}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Architecture */}
      <Card title="System Architecture" description="Components and their responsibilities">
        <div className="space-y-3">
          {ARCHITECTURE.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.component} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                <Icon className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium">{item.component}</span>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Key Clarifications */}
      <Card title="Key Clarifications" description="Common questions about the process">
        <div className="space-y-4 text-sm">
          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <p className="font-medium mb-1">Q: Does "Ask Agent to Fix" trigger n8n?</p>
            <p className="text-muted-foreground text-xs">
              <strong>Production:</strong> Yes — the Dashboard sends selected errors to n8n via webhook. n8n then calls the Agent, collects proposals, and routes them back to the Dashboard for review.
              <br />
              <strong>Local dev (current):</strong> The Dashboard calls the Agent directly for faster iteration. The n8n step is bypassed for development convenience.
            </p>
          </div>

          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <p className="font-medium mb-1">Q: Does "Retry Sync" trigger n8n?</p>
            <p className="text-muted-foreground text-xs">
              <strong>Production:</strong> Yes — retry sends a list of PERNRs to n8n via webhook. n8n then runs the BUPA sync for just those employees and reports results.
              <br />
              <strong>Local dev (current):</strong> The Dashboard calls the mock S/4 retry endpoint directly. Once connected to real n8n, this will route through the workflow.
            </p>
          </div>

          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <p className="font-medium mb-1">Q: What's the difference between "Agent Fix" and "Resync"?</p>
            <p className="text-muted-foreground text-xs">
              <strong>Agent Fix</strong> = AI analyzes the error, identifies root cause, proposes a data correction (e.g., "add missing address to BP 1234").
              <br />
              <strong>Resync</strong> = Re-run the BUPA sync program for specific employees. This only works AFTER the underlying data issue is fixed.
              <br />
              <strong>Correct flow:</strong> Agent proposes fix → Consultant approves → Fix applied to master data → THEN resync succeeds.
            </p>
          </div>

          <div className="p-3 rounded-md bg-muted/50 border border-border">
            <p className="font-medium mb-1">Q: When does email notification fire?</p>
            <p className="text-muted-foreground text-xs">
              Emails are sent by n8n after: (1) Initial sync completes with the reconciliation report, (2) Agent proposes fixes (summary to consultant), (3) Resync completes with updated results. Check Mailpit at http://localhost:8025 locally.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
