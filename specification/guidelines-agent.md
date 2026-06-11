# Agent Guidelines

> Type-specific constraints for AI Agent assets.

## Architecture

- Python-based agent using A2A (Agent-to-Agent) protocol
- OpenTelemetry instrumentation for all business steps
- Extension points via plugin architecture
- MCP tool integration for SAP system access

## Code Standards

- Python 3.11+
- Type hints on all functions
- Pydantic models for data validation
- Async/await for I/O operations
- Structured logging with correlation IDs

## Agent Design Principles

1. **Deterministic where possible** — Use rule-based logic for known error patterns; LLM only for ambiguous cases
2. **Transparent reasoning** — Every proposal must include explanation and confidence score
3. **Never act without approval** — Human-in-the-loop for all data modifications
4. **Idempotent operations** — Safe to retry any agent action
5. **Graceful degradation** — If MCP/RFC calls fail, queue for retry rather than crash

## Instrumentation

- Emit OpenTelemetry spans for each milestone (M1-M5)
- Track token usage per LLM invocation
- Log all tool calls with input/output
- Record approval decisions for learning loop

## MCP Tool Usage

- Always call `get_metadata_api_business_partner` before querying unknown entity structures
- Use `$select` to minimize payload size
- Handle pagination with `$top`/`$skip` for large result sets
- Respect rate limits on MCP server calls

## Testing

- Unit tests for error classification logic
- Integration tests for MCP tool interactions (mocked)
- End-to-end test with sample sync error log
