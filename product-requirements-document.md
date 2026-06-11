# Product Requirements Document: Employee-to-Business Partner Sync Automation

**Date**: June 10, 2026
**Solution Category**: n8n Workflow, AI Agent
**Status**: Draft

---

## Product Purpose & Value Proposition

Post ECC-to-S/4HANA conversion, organizations must synchronize 50,000+ active employees and employee-vendors to Business Partner records. The current process takes weeks of manual effort: consultants inspect errors one-by-one in SLG1, research fixes individually, and re-run sync reports iteratively with no consolidated view or batch retry.

This solution enables consultants to trigger a single automated batch process that selects populations, executes sync, classifies errors intelligently, proposes contextual fixes for approval, and retries resolved records — reducing weeks of manual reconciliation to hours of monitored, assisted execution.

---

## Scope

### Goals (In Scope)

- Automated selection of active employee population (PA0000) and employee-vendor population (LFB1)
- Batch BUPA sync execution with progress monitoring
- Automated extraction and classification of sync errors from `/SHCM/D_BP_SYNC` and SLG1
- AI-powered error analysis with contextual fix proposals
- Human-in-the-loop approval workflow before fix application
- Batch retry of resolved records
- Final reconciliation report with complete sync coverage status

### Non-Goals (Out of Scope)

- CVI configuration or BP customizing setup (assumed complete before agent runs)
- Changes to the standard `/SHCM/RH_SYNC_BUPA_EMPL_SINGLE` report
- SuccessFactors Employee Central integration (scope is on-premise HCM only)
- Real-time continuous sync monitoring (this is a batch conversion tool)

---

## User Profiles & Personas

### SAP HCM Consultant
Primary user. Triggers the sync process, reviews proposed error fixes, approves or rejects them, and validates the final reconciliation report. Currently spends weeks manually cross-referencing PA and BUPA tables in Excel and researching SLG1 errors one-by-one. Needs deep PA/BUPA domain knowledge today; the agent should reduce this dependency.

### HR Administrator
Monitors sync status and handles escalated cases that require business-side decisions (e.g., duplicate employee records, organizational reassignments). Receives notifications on sync progress and errors requiring their input.

### SAP Basis Administrator
Manages Cloud Connector configuration, RFC destinations, and authorizations. Ensures the agent has appropriate system access. Not a daily user of the solution but critical for setup and maintenance.

### Logistics Team Member
Involved when employee-vendor records (LFB1) are affected by sync failures. Reviews vendor-specific error resolutions proposed by the agent.

---

## Requirements

### Must-Have (P0)

| ID | Requirement |
|----|-------------|
| R1 | As an HCM consultant, I want to trigger the sync process from a UI so that I can initiate batch BUPA sync without running SE38/SM37 manually. |
| R2 | As an HCM consultant, I want the system to automatically identify all active employees (PA0000 status 3) and employee-vendors (LFB1 PERNR) so that no records are missed. |
| R3 | As an HCM consultant, I want the system to execute BUPA sync in batch and monitor completion so that I don't need to watch background job logs. |
| R4 | As an HCM consultant, I want a consolidated error log with classified error types so that I can see all failures in one view instead of checking SLG1 per employee. |
| R5 | As an HCM consultant, I want the AI agent to analyze each error and propose a specific fix with explanation so that I can approve fixes without researching each error manually. |
| R6 | As an HCM consultant, I want to approve or reject proposed fixes before they are applied so that I maintain control over data changes. |
| R7 | As an HCM consultant, I want approved fixes to be applied automatically and errored records re-synced in batch so that I don't re-trigger manually per employee. |
| R8 | As an HCM consultant, I want a final reconciliation report showing synced, failed, and pending records so that I can confirm 100% coverage. |

### Should-Have (P1)

| ID | Requirement |
|----|-------------|
| R9 | As an HCM consultant, I want the agent to learn from prior fix approvals so that future proposals are more accurate. |
| R10 | As an HR admin, I want email notifications on sync progress and errors requiring my input so that I stay informed without monitoring the system. |
| R11 | As an HCM consultant, I want to see confidence scores on each fix proposal so that I can prioritize review of low-confidence items. |
| R12 | As a logistics team member, I want vendor-specific errors routed to me separately so that I only see relevant issues. |

---

## Solution Architecture Overview

| Component | Role |
|-----------|------|
| **n8n Workflow** | Orchestrates end-to-end process: trigger handling, population selection via RFC, sync job scheduling, error log polling, routing to AI agent, approval flow management, batch retry execution |
| **AI Agent** (Python, A2A protocol) | Error analysis and fix proposal generation: receives classified errors, cross-references PA/BUPA data, matches against known resolution patterns, generates contextual fix proposals with confidence scores |
| **SAP Cloud Connector** | Secure tunnel for RFC calls to on-premise S/4HANA system (PA infotype reads, sync log extraction, job scheduling, fix application) |
| **Business Partner MCP Server** | Query and update Business Partner records via `sap.mcpbuilder:apiResource:business_partner_mcp_demo:v1` |
| **SAP Task Center** | Human-in-the-loop approval workflow for proposed fixes |

### Connectivity

- On-premise S/4HANA accessed via SAP Cloud Connector with RFC function modules
- Business Partner API accessed via MCP server (OData)
- Agent communicates with n8n workflow via A2A protocol
- Notifications delivered via email (SMTP)

---

## Automation & Agent Behaviour

### AI Agent Responsibilities

1. **Error Classification** — Categorize sync errors by type: missing address, duplicate BP, invalid PERNR, configuration mismatch, bank data inconsistency, identification document issues
2. **Root Cause Analysis** — Cross-reference error with PA infotype data and BUPA table data to identify the specific data quality issue
3. **Fix Proposal Generation** — Generate a specific remediation action for each error, referencing the exact field/table to update, with natural language explanation
4. **Confidence Scoring** — Assign confidence score based on pattern match strength and data completeness
5. **Learning** — Track which proposals were approved/rejected to improve future recommendations

### Agent Decision Boundaries

- Agent NEVER applies fixes autonomously — always proposes and waits for approval
- Agent escalates to HR admin when error involves organizational or personnel action conflicts
- Agent routes vendor-related errors to logistics team
- Agent flags errors with no known pattern as "requires manual research"

---

## Milestones & Business Step Instrumentation

| ID | Milestone | Condition | Log on Achievement | Log on Miss/Skip |
|----|-----------|-----------|-------------------|------------------|
| M1 | Population Selected | All active employees and employee-vendors identified and batched | `[MILESTONE:M1] Population selection complete. Total records: {count}, Employees: {emp_count}, Vendors: {vendor_count}` | `[MILESTONE:M1:SKIPPED] Population selection failed: {error_reason}` |
| M2 | Sync Executed | BUPA sync report completed for entire population | `[MILESTONE:M2] BUPA sync execution complete. Job ID: {job_id}, Duration: {duration_min}m` | `[MILESTONE:M2:FAILED] Sync execution failed or timed out: {error_detail}` |
| M3 | Errors Classified | All sync errors extracted, parsed, and categorized | `[MILESTONE:M3] Error classification complete. Total errors: {error_count}, Categories: {category_breakdown}` | `[MILESTONE:M3:SKIPPED] No errors found - all records synced successfully` |
| M4 | Fixes Proposed | AI agent generated fix proposals for all classified errors | `[MILESTONE:M4] Fix proposals generated. Proposals: {proposal_count}, Avg confidence: {avg_confidence}%` | `[MILESTONE:M4:FAILED] Fix proposal generation failed for {failed_count} errors: {reason}` |
| M5 | Fixes Applied & Retried | Approved fixes applied and errored records re-synced | `[MILESTONE:M5] Reconciliation complete. Synced: {synced_count}, Remaining errors: {remaining_count}, Coverage: {coverage_pct}%` | `[MILESTONE:M5:PARTIAL] Retry incomplete. Applied: {applied_count}, Failed retry: {retry_failed_count}` |

---

## Agent Extensibility & Instrumentation

### Extension Points

The AI Agent must be designed with the following extension points for future capabilities:

1. **Error Pattern Plugins** — New error types and their resolution strategies can be added without modifying core agent logic
2. **Data Source Connectors** — Additional SAP tables or external systems can be connected as data sources for error analysis
3. **Notification Channels** — Beyond email, future channels (MS Teams, Slack, SAP Launchpad notifications) can be plugged in
4. **Approval Workflow Variants** — Different approval routing rules (by error severity, by organizational unit) can be configured

### Instrumentation Requirements

- All business steps (M1-M5) must emit structured OpenTelemetry spans with milestone attributes
- Each agent reasoning cycle must be traced with input context, proposed action, and confidence score
- Token usage must be tracked per invocation for cost monitoring
- Error classification accuracy must be measurable via approved/rejected ratio tracking
- End-to-end execution duration must be captured per batch run

---

## Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Scale** | Must handle 50,000+ employee records per batch run |
| **Performance** | Population selection and sync trigger within 30 minutes; error analysis within 2 hours for full batch |
| **Reliability** | Must resume from last checkpoint on failure (no full restart required) |
| **Security** | Least-privilege RFC authorizations; no storage of PA data outside SAP; audit trail for all fix applications |
| **Auditability** | Complete log of every proposed fix, approval decision, and applied change |

---

## Risks & Assumptions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| RFC connectivity instability at scale | Sync or fix application fails mid-batch | Implement checkpoint/resume pattern; retry with exponential backoff |
| Unknown error patterns in initial runs | Agent cannot propose fixes, requires manual research | Start with known patterns from presentation; build knowledge base iteratively |
| Authorization scope too narrow | Agent cannot read required tables or apply fixes | Define authorization requirements upfront; test with full scope in sandbox |
| Large batch performance strain on S/4 system | System slowdown during business hours | Schedule batch runs in off-peak windows; implement throttling |

### Assumptions

- CVI configuration is complete and validated before the agent is triggered
- SAP Cloud Connector is configured with appropriate RFC destinations
- The standard sync report `/SHCM/RH_SYNC_BUPA_EMPL_SINGLE` is functional and available
- Consultants have authorization to approve data changes in the target system

---

## Open Questions

1. What specific RFC function modules are available for reading `/SHCM/D_BP_SYNC` and applying fixes programmatically?
2. Are there existing custom Z-function modules for batch BUPA sync retry?
3. What is the expected approval SLA — how quickly must consultants respond before the process times out?
4. Should the reconciliation report be stored in SAP (e.g., as a document) or delivered only via email?
