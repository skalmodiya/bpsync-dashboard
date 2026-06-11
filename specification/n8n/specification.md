# Specification: n8n (BUPA Sync Orchestration Workflow)

> **Guidelines**: Read [../guidelines.md](../guidelines.md) and [../guidelines-n8n-workflow.md](../guidelines-n8n-workflow.md) before executing ANY tasks below.

## Asset Type: n8n Workflow

## Workflow Overview

Orchestrates the end-to-end BUPA sync process: trigger → population selection → sync execution → error extraction → AI agent analysis → approval routing → fix application → retry → reconciliation report.

---

## Project Setup

- [ ] Create workflow file: `assets/n8n/bupa-sync-orchestration.n8n.json`
- [ ] Define workflow metadata: name = "BUPA Sync Orchestration", tags = ["bupa", "sync", "s4hana", "conversion"]

## Trigger Node

- [ ] Add Manual Trigger node as primary entry point (consultant-initiated from UI)
- [ ] Add input parameters for trigger:
  - `sync_scope`: enum (all_active, vendors_only, specific_list)
  - `employee_list`: optional array of PERNRs (for specific_list scope)
  - `dry_run`: boolean (if true, only select population and report without executing sync)

## Step 1: Population Selection (Milestone M1)

- [ ] Add SAP MCP Client node "Read Active Employees (PA0000)" — RFC call to read PA0000 where STAT2 = 3 (active)
- [ ] Add SAP MCP Client node "Read Employee Vendors (LFB1)" — RFC call to read LFB1 for PERNR list
- [ ] Add Merge node to combine employee and vendor populations, deduplicate by PERNR
- [ ] Add Set node to create batch arrays (chunk into groups of 500 for parallel processing)
- [ ] Add IF node to check dry_run — if true, skip to reconciliation report
- [ ] Add Code node to emit milestone M1 log: `[MILESTONE:M1] Population selection complete. Total records: {count}`
- [ ] Add error branch: if RFC calls fail, emit `[MILESTONE:M1:SKIPPED]` and stop workflow with error notification

## Step 2: BUPA Sync Execution (Milestone M2)

- [ ] Add SAP MCP Client node "Schedule BUPA Sync Job" — RFC call to schedule background job for `/SHCM/RH_SYNC_BUPA_EMPL_SINGLE` with selected population
- [ ] Add Wait node with polling pattern: check job status every 60 seconds
- [ ] Add SAP MCP Client node "Check Job Status" — RFC call to read job status from SM37
- [ ] Add IF node: job complete → continue; job failed → error branch; job running → loop back to wait
- [ ] Add timeout logic: if job runs > 4 hours, emit warning and continue to error extraction
- [ ] Add Code node to emit milestone M2 log: `[MILESTONE:M2] BUPA sync execution complete. Job ID: {job_id}`
- [ ] Add error branch: emit `[MILESTONE:M2:FAILED]` and notify consultant of job failure

## Step 3: Error Log Extraction & Classification (Milestone M3)

- [ ] Add SAP MCP Client node "Read Sync Error Log" — RFC call to read `/SHCM/D_BP_SYNC` table for error entries
- [ ] Add SAP MCP Client node "Read SLG1 Application Log" — RFC call to read application log messages for BUPA sync object
- [ ] Add Code node "Merge and Deduplicate Errors" — combine error sources, create unified error list with: PERNR, error_class, error_message, timestamp
- [ ] Add IF node: if no errors → skip to M5 reconciliation; if errors → continue to AI agent
- [ ] Add Code node to emit milestone M3 log or skip message
- [ ] Add SAP AI Core node "Invoke BUPA Sync Agent" — call the AI agent's `/analyze-errors` endpoint via A2A protocol with the error batch
- [ ] Add Wait node for agent response (timeout: 2 hours for large batches)

## Step 4: Approval Workflow (Milestone M4)

- [ ] Add Code node to parse agent response — extract fix proposals with confidence scores
- [ ] Add Code node to emit milestone M4 log: `[MILESTONE:M4] Fix proposals generated. Proposals: {count}`
- [ ] Add Switch node to route by error severity:
  - High confidence (>0.8) + low risk → batch approval task
  - Medium confidence (0.5-0.8) → individual review tasks
  - Low confidence (<0.5) or unknown → escalation to senior consultant
  - Vendor-related errors → route to logistics team
- [ ] Add SAP Task Center node "Create Approval Task" — create task with:
  - Title: "BUPA Sync Fix Approval - Batch {batch_id}"
  - Description: summary of proposed fixes with confidence scores
  - Assignee: HCM consultant (from trigger context)
  - Priority: based on error count and confidence
- [ ] Add Switch node after approval response:
  - Approved → continue to fix application
  - Rejected → mark as manual review needed, send notification
  - Timeout (>24h) → escalate to HR admin
- [ ] Add email notification nodes for:
  - Approval task created (to consultant)
  - Escalation (to HR admin)
  - Vendor errors (to logistics team)

## Step 5: Fix Application & Retry (Milestone M5)

- [ ] Add Code node to filter approved fixes only
- [ ] Add Loop node to iterate through approved fixes in batches of 100
- [ ] Add SAP MCP Client node "Apply Fix via RFC" — RFC call to apply each approved data correction
- [ ] Add error handling: if fix application fails, log error and continue with remaining fixes
- [ ] Add SAP MCP Client node "Re-trigger BUPA Sync for Fixed Records" — RFC call to schedule sync for corrected employee batch only
- [ ] Add Wait node for retry sync completion (polling pattern, same as Step 2)
- [ ] Add SAP MCP Client node "Read Retry Results" — check which records now synced successfully
- [ ] Add Code node to emit milestone M5 log: `[MILESTONE:M5] Reconciliation complete. Synced: {count}, Remaining: {remaining}`

## Reconciliation Report

- [ ] Add Code node "Generate Reconciliation Report" — build structured report with:
  - Total employees in scope
  - Successfully synced (count + list)
  - Failed and fixed (count + list with fix details)
  - Still failing (count + list with error details)
  - Coverage percentage
  - Timeline (start, end, duration)
- [ ] Add email node "Send Reconciliation Report" — send to consultant and HR admin
- [ ] Add IF node: if coverage < 100%, include "remaining errors require manual intervention" section

## Error Handling & Resilience

- [ ] Add global error handler node — catches unhandled errors, sends alert email
- [ ] Implement checkpoint pattern: store workflow progress in static data after each major step
- [ ] Add retry logic on all SAP MCP Client nodes: 3 retries with exponential backoff (1s, 4s, 16s)
- [ ] Add timeout on all Wait nodes with graceful exit paths
- [ ] Add deduplication logic: if workflow re-runs, detect already-synced records and skip them

## Workflow Validation

- [ ] Validate workflow JSON structure passes n8n schema validation
- [ ] Verify all node connections are valid (no orphaned nodes)
- [ ] Verify all credential references are placeholder IDs (not hardcoded)
- [ ] Test happy path: population selected → sync runs → no errors → report sent
- [ ] Test error path: sync errors found → agent analyzes → approval → fixes applied → retry succeeds
- [ ] Test escalation path: low-confidence proposals → escalation → manual review → partial fix
