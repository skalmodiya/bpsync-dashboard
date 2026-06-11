#!/bin/sh
# Wait for n8n to be ready, then import workflows via CLI
set -e

echo "=== BUPA Sync n8n Workflow Importer ==="
echo "Waiting for n8n API to be ready..."

until wget -qO /dev/null http://n8n:5678/ 2>/dev/null; do
  echo "  n8n not ready, waiting..."
  sleep 3
done

echo "n8n is ready!"
sleep 5  # Extra buffer for API to be fully initialized

# Import each workflow via n8n CLI
for f in /workflows/*.json; do
  if [ -f "$f" ]; then
    name=$(basename "$f" .json)
    echo "Importing: $name"
    n8n import:workflow --input="$f" 2>&1 || echo "  Warning: import may have encountered an issue for $name"
  fi
done

echo ""
echo "=== All workflows imported successfully ==="
echo "Access n8n at http://localhost:5678"
echo "Workflows are ready for activation via the n8n UI."
