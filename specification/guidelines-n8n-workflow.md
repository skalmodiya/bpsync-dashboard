# n8n Workflow Guidelines

> Type-specific constraints for n8n Workflow assets.

## Workflow Structure

- Single `.n8n.json` file per workflow
- Use SAP MCP Client nodes for all SAP interactions (never HTTP Request)
- Use SAP AI Core nodes for any LLM operations (never OpenAI/Gemini)
- Use SAP Task Center nodes for human-in-the-loop approvals

## Node Conventions

- Descriptive node names (e.g., "Select Active Employees via RFC")
- Error handling on every SAP system call
- Sticky notes for complex logic sections
- Credential references by ID (never hardcoded)

## Design Principles

1. **Batch-aware** — All loops must handle 50,000+ records with pagination
2. **Checkpoint state** — Store progress in workflow static data or external store
3. **Timeout handling** — Background job polling must have max wait with graceful exit
4. **Error routing** — Failed items go to error branch, not crash the workflow
5. **Idempotent** — Safe to re-run from any point without duplicate side effects

## SAP Integration

- Use SAP MCP Client node for Business Partner operations
- Use RFC calls via Cloud Connector for on-premise PA table reads
- Use background job scheduling for sync report execution
- Poll job status with exponential backoff

## Testing

- Validate workflow JSON structure
- Test with sample payloads for each branch
- Verify error handling paths execute correctly
