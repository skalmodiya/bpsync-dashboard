# BUPA Sync Agent

An AI agent that analyzes BUPA synchronization errors, classifies them by type, and proposes contextual fixes with confidence scores for consultant approval.

## Overview

This agent integrates with S/4HANA Business Partner (BUPA) synchronization processes to:

- Classify sync errors by category (missing address, duplicate BP, invalid PERNR, bank data mismatch, identification missing, config mismatch)
- Cross-reference employee and business partner data via MCP tools
- Propose contextual fixes with confidence scores
- Present proposals for consultant approval (never applies fixes autonomously)

## Architecture

- **Runtime**: Joule Studio Agent Runtime (A2A protocol)
- **Orchestration**: LangGraph (ReAct agent pattern)
- **LLM**: SAP AI Core via LiteLLM
- **Tools**: MCP-based S/4HANA Business Partner API access
- **Observability**: OpenTelemetry instrumentation

## Running Locally

```bash
pip install -r requirements.txt
python -m app.main
```

The agent serves on port 5000 with the agent card at `/.well-known/agent.json`.

## Testing

```bash
pip install -r requirements-test.txt
pytest
```

## Tags

bupa, sync, s4hana, agent, error-resolution
