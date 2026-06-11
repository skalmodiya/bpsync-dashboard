# Specification Guidelines

> Read this file before executing ANY specification tasks.

## General Rules

1. **No direct API calls** — All SAP API interactions MUST go through MCP tools. Never use `requests`, `httpx`, `fetch`, or direct OData clients.
2. **One task at a time** — Mark each TODO item as complete before moving to the next.
3. **Test everything** — Every functional component must have corresponding tests.
4. **No secrets in code** — Use environment variables for all credentials and connection strings.
5. **Checkpoint/resume** — Long-running processes must support resumption from last successful step.

## Asset Structure

```
assets/
  <asset-name>/
    ... (implementation files)
```

## Implementation Order

1. Solution setup (solution.yaml, asset.yaml)
2. Per-asset implementation (in order listed in specification.md)
3. Cross-asset compatibility check (if multiple assets)

## Verification

- Run tests after each major implementation step
- Validate JSON/YAML files are well-formed
- Ensure all referenced files exist
