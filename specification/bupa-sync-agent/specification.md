# Specification: bupa-sync-agent

> **Guidelines**: Read [../guidelines.md](../guidelines.md) and [../guidelines-agent.md](../guidelines-agent.md) before executing ANY tasks below.

## Asset Type: AI Agent (Python, A2A protocol)

## MCP Server Integration

- **Server**: `sap.mcpbuilder:apiResource:business_partner_mcp_demo:v1`
- **Tool schemas**: See `./mcp-specs/` directory
  - `mcp-spec-business-partner-list.json` — List/filter Business Partners
  - `mcp-spec-business-partner-get.json` — Get single BP by ID with expansions
  - `mcp-spec-business-partner-address.json` — Get BP address details

---

## Project Setup

- [ ] Initialize Python project with `pyproject.toml` (Python 3.11+, dependencies: pydantic, opentelemetry-sdk, opentelemetry-api, httpx, python-a2a)
- [ ] Create project structure:
  ```
  assets/bupa-sync-agent/
    src/
      agent.py              # Main agent entry point
      models/               # Pydantic data models
      tools/                # MCP tool wrappers
      classifiers/          # Error classification logic
      resolvers/            # Fix proposal generation
      instrumentation/      # OpenTelemetry setup
    tests/
      test_classifiers.py
      test_resolvers.py
      test_agent.py
    config/
      error_patterns.yaml   # Known error-to-fix mappings
    README.md
  ```
- [ ] Configure OpenTelemetry with service name `bupa-sync-agent`

## Data Models

- [ ] Define `SyncError` model: employee_id (PERNR), error_class, error_message, error_source (SLG1/SHCM_D_BP_SYNC), timestamp, related_bp_id
- [ ] Define `FixProposal` model: error_id, proposed_action (enum: update_address, resolve_duplicate, fix_pernr_mapping, correct_bank_data, fix_identification, manual_review), target_table, target_field, current_value, proposed_value, explanation, confidence_score (0.0-1.0)
- [ ] Define `ApprovalDecision` model: proposal_id, decision (approved/rejected), reviewer, reason, timestamp
- [ ] Define `ReconciliationRecord` model: employee_id, bp_id, vendor_id, sync_status (synced/failed/pending/retrying), error_history, fix_history

## Error Classification

- [ ] Implement `ErrorClassifier` class with method `classify(error: SyncError) -> ErrorCategory`
- [ ] Define error categories based on known patterns:
  - `MISSING_ADDRESS` — BP has no valid address (required for BUPA sync)
  - `DUPLICATE_BP` — Multiple BPs found for same employee
  - `INVALID_PERNR` — PERNR format or mapping incorrect
  - `BANK_DATA_MISMATCH` — BUT0BK data inconsistent with PA0009
  - `IDENTIFICATION_MISSING` — BUT0ID has no valid identification doc
  - `CONFIG_MISMATCH` — BP category/grouping doesn't match CVI config
  - `UNKNOWN` — No pattern matched, requires manual research
- [ ] Load known patterns from `config/error_patterns.yaml`
- [ ] Implement pattern matching with regex and keyword extraction from SLG1 messages

## Fix Proposal Generation

- [ ] Implement `FixResolver` class with method `propose_fix(error: SyncError, context: dict) -> FixProposal`
- [ ] For `MISSING_ADDRESS`: Query BP via MCP tool `get_business_partner` with `$expand=to_BusinessPartnerAddress`, cross-reference with PA0006 data from RFC, propose address creation/update
- [ ] For `DUPLICATE_BP`: Query `list_business_partner` filtered by PersonNumber/name, identify duplicates, propose merge or deactivation
- [ ] For `INVALID_PERNR`: Cross-reference PA0001 PERNR with BP PersonNumber field, propose correction
- [ ] For `BANK_DATA_MISMATCH`: Compare BUT0BK (via BP expand to_BusinessPartnerBank) with PA0009 bank data, propose alignment
- [ ] For `IDENTIFICATION_MISSING`: Check BUT0ID via BP expand to_BuPaIdentification, propose adding from PA0185
- [ ] For `CONFIG_MISMATCH`: Check BusinessPartnerCategory/Grouping against expected CVI config values, propose correction
- [ ] For `UNKNOWN`: Generate LLM-based analysis of error message with SAP domain context, propose as low-confidence suggestion
- [ ] Implement confidence scoring: exact pattern match = 0.9+, partial match = 0.6-0.8, LLM-only = 0.3-0.5

## MCP Tool Integration

- [ ] Implement `BPToolClient` wrapper class for Business Partner MCP server
- [ ] Method `list_partners(filter: str, select: str, top: int)` wrapping `list_business_partner` tool
- [ ] Method `get_partner(bp_id: str, expand: str)` wrapping `get_business_partner` tool
- [ ] Method `get_address(bp_id: str, address_id: str)` wrapping `get_business_partner_address` tool
- [ ] Implement retry logic with exponential backoff for MCP tool calls
- [ ] Implement pagination helper for large result sets (50,000+ BPs)

## RFC Tool Integration (via n8n workflow calls)

- [ ] Define RFC call interface for PA table reads (PA0000, PA0001, PA0006, PA0009, PA0105, PA0185)
- [ ] Define RFC call interface for sync log read (`/SHCM/D_BP_SYNC`)
- [ ] Define RFC call interface for SLG1 application log read
- [ ] Define RFC call interface for data correction (PA infotype updates, BUT table updates)
- [ ] All RFC calls are routed through the n8n workflow — agent sends requests via A2A protocol

## Agent Core Logic

- [ ] Implement main agent loop: receive errors → classify → resolve → propose → await approval → report
- [ ] Implement batch processing: handle list of errors, group by category, process in parallel where safe
- [ ] Implement A2A protocol endpoints:
  - `POST /analyze-errors` — receives error batch, returns classified errors with proposals
  - `POST /approval-callback` — receives approval decisions, triggers fix application requests
  - `GET /status` — returns current processing status and progress
- [ ] Implement learning loop: store approved/rejected decisions, update pattern weights

## Business Step Instrumentation (OpenTelemetry)

- [ ] Instrument milestone M3 (Errors Classified): span on classification completion with error_count, category_breakdown attributes
- [ ] Instrument milestone M4 (Fixes Proposed): span on proposal generation with proposal_count, avg_confidence attributes
- [ ] Track per-error processing time as histogram metric
- [ ] Track LLM token usage per invocation as counter metric
- [ ] Track approval rate (approved/total) as gauge metric
- [ ] Emit structured logs for each milestone achievement/failure using format from PRD

## Extension Points

- [ ] Implement `ErrorPatternPlugin` interface: `match(error: SyncError) -> bool`, `resolve(error: SyncError, context: dict) -> FixProposal`
- [ ] Implement plugin loader that reads from `config/error_patterns.yaml` and `config/plugins/` directory
- [ ] Implement `DataSourceConnector` interface for adding new data sources beyond PA/BUPA tables
- [ ] Implement `NotificationChannel` interface (initial: email via SMTP; extensible to Teams/Slack)

## Tests

- [ ] Unit tests for `ErrorClassifier`: test each error category with sample SLG1 messages
- [ ] Unit tests for `FixResolver`: test each resolution strategy with mocked MCP/RFC responses
- [ ] Unit tests for confidence scoring logic
- [ ] Integration test for `BPToolClient` with mocked MCP server responses
- [ ] End-to-end test: feed sample error log → verify classified output → verify proposals generated
- [ ] Test plugin loading and custom pattern registration
