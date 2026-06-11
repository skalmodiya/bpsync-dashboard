# Specification

> **Guidelines**: Read [guidelines.md](./guidelines.md) before executing ANY tasks below.

Check off items as completed.

## Solution Setup

- [ ] Create asset directories: `mkdir -p assets/bupa-sync-agent/ assets/n8n/`
- [ ] Invoke `setup-solution` skill to create `solution.yaml` and `asset.yaml` files for every asset
- [ ] Validate all `asset.yaml` and `solution.yaml` files exist and are well-formed

## Asset Implementation

- [ ] Execute specification/bupa-sync-agent/specification.md (all items)
- [ ] Execute specification/n8n/specification.md (all items)
- [ ] Cross-implementation compatibility check: verify A2A protocol interface between n8n workflow and agent aligns (request/response schemas, endpoint URLs, auth mechanism, timeout handling)
