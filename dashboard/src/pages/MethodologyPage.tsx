import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Info, Database, Calculator } from 'lucide-react';

const TILE_DEFINITIONS = [
  {
    name: 'Total Employees',
    dataKey: 'total_employees',
    source: 'PA0000 (Personnel Actions)',
    logic: 'COUNT of unique employees where Status (STAT2) = 3 (Active)',
    notes: 'Only active employees are included. Terminated or withdrawn employees are excluded.',
  },
  {
    name: 'Synced',
    dataKey: 'synced_count',
    source: 'PA0000 + BUT000 (Business Partners) + /SHCM/D_BP_SYNC',
    logic: 'Total Employees - Failed - Pending = Employees with a matching Business Partner record and no errors in the sync log',
    notes: 'Derived count. An employee is "synced" if they have a BP and no open sync error.',
  },
  {
    name: 'Failed',
    dataKey: 'failed_count',
    source: '/SHCM/D_BP_SYNC (Sync Error Log)',
    logic: 'COUNT of UNIQUE employees (by PERNR) that have at least one error record in the sync log',
    notes: 'An employee with multiple errors is counted once here. On the Records page, each error is a separate row.',
  },
  {
    name: 'Pending',
    dataKey: 'pending_count',
    source: 'PA0000 + BUT000',
    logic: 'Employees with NO matching Business Partner AND no sync error = not yet processed',
    notes: 'These employees have not been synced at all. Typically 0 after initial sync run.',
  },
  {
    name: 'Error Rate',
    dataKey: 'error_rate',
    source: 'Derived',
    logic: '(failed_count / total_employees) * 100, displayed as percentage',
    notes: 'Represents the proportion of the active workforce with sync failures.',
  },
  {
    name: 'Business Partners',
    dataKey: 'bp_count',
    source: 'BUT000 (Business Partner Master)',
    logic: 'COUNT of all Business Partner records',
    notes: 'Includes duplicates. May be higher than employee count due to duplicate BPs or vendor BPs.',
  },
  {
    name: 'Employee Vendors',
    dataKey: 'vendor_count',
    source: 'LFB1 (Vendor Line Items)',
    logic: 'COUNT of vendor records linked to a PERNR (employee-vendor relationships)',
    notes: 'These employees also have a vendor master record and need BUPA sync for both roles.',
  },
  {
    name: 'Open Errors',
    dataKey: 'open_errors',
    source: '/SHCM/D_BP_SYNC',
    logic: 'COUNT of error records where STATUS = "open" (not yet resolved)',
    notes: 'Initially equals Failed count. Decreases as errors are resolved. Differs from Failed because Failed counts unique employees while this counts error records.',
    redundancyNote: 'Shows same value as "Failed" until errors are resolved. Enable only when you start fixing errors.',
  },
  {
    name: 'Resolved Errors',
    dataKey: 'resolved_errors',
    source: '/SHCM/D_BP_SYNC',
    logic: 'COUNT of error records where STATUS != "open" (fixed/resolved)',
    notes: 'Increases as the agent or consultant fixes sync errors.',
  },
  {
    name: 'Last Sync Time',
    dataKey: 'last_sync_time',
    source: 'Sync execution history',
    logic: 'Timestamp of the most recent BUPA sync workflow execution',
    notes: 'Displayed as a formatted date/time, not a number.',
  },
];

export function MethodologyPage() {
  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Methodology" subtitle="How the BUPA sync process works" />
        <p className="text-sm text-muted-foreground mt-1">
          How dashboard tile counts are calculated. Enable/disable tiles in Settings &rarr; Customization.
        </p>
      </div>

      <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-medium">Dashboard vs Records Page</p>
          <p className="text-xs">Dashboard shows <strong>unique employee counts</strong>. The Records page shows <strong>one row per error</strong> (an employee with 2 errors = 2 rows). This means Records total can exceed Dashboard total.</p>
        </div>
      </div>

      <div className="space-y-4">
        {TILE_DEFINITIONS.map((tile) => (
          <div key={tile.dataKey} className="rounded-lg border border-border p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                {tile.name}
              </h3>
              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{tile.dataKey}</code>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="font-medium text-muted-foreground block mb-1">Data Source</span>
                <div className="flex items-start gap-1.5">
                  <Database className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span>{tile.source}</span>
                </div>
              </div>
              <div>
                <span className="font-medium text-muted-foreground block mb-1">Calculation Logic</span>
                <span>{tile.logic}</span>
              </div>
              <div>
                <span className="font-medium text-muted-foreground block mb-1">Notes</span>
                <span className="text-muted-foreground">{tile.notes}</span>
              </div>
            </div>

            {tile.redundancyNote && (
              <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 px-3 py-2 text-xs text-yellow-700 dark:text-yellow-300">
                {tile.redundancyNote}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
