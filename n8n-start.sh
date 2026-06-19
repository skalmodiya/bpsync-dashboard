#!/bin/sh
# Extracts PostgreSQL credentials from VCAP_SERVICES and sets n8n DB env vars.
# Required because n8n doesn't read VCAP_SERVICES natively.

if [ -n "$VCAP_SERVICES" ]; then
  PG_URI=$(echo "$VCAP_SERVICES" | \
    python3 -c "
import sys, json
svc = json.load(sys.stdin)
pg = (svc.get('postgresql-db') or svc.get('postgresql') or [None])[0]
if pg:
    c = pg['credentials']
    # SAP postgresql-db exposes a 'uri' or individual fields
    uri = c.get('uri') or c.get('url') or ''
    if uri:
        print(uri)
    else:
        print('host={} port={} dbname={} user={} password={}'.format(
            c.get('hostname',''), c.get('port','5432'),
            c.get('dbname',''), c.get('username',''), c.get('password','')))
")

  if echo "$PG_URI" | grep -q "postgresql://\|postgres://"; then
    # Parse URI: postgresql://user:pass@host:port/dbname
    export DB_POSTGRESDB_HOST=$(echo "$PG_URI" | python3 -c "import sys; from urllib.parse import urlparse; u=urlparse(sys.stdin.read().strip()); print(u.hostname)")
    export DB_POSTGRESDB_PORT=$(echo "$PG_URI" | python3 -c "import sys; from urllib.parse import urlparse; u=urlparse(sys.stdin.read().strip()); print(u.port or 5432)")
    export DB_POSTGRESDB_DATABASE=$(echo "$PG_URI" | python3 -c "import sys; from urllib.parse import urlparse; u=urlparse(sys.stdin.read().strip()); print(u.path.lstrip('/'))")
    export DB_POSTGRESDB_USER=$(echo "$PG_URI" | python3 -c "import sys; from urllib.parse import urlparse; u=urlparse(sys.stdin.read().strip()); print(u.username)")
    export DB_POSTGRESDB_PASSWORD=$(echo "$PG_URI" | python3 -c "import sys; from urllib.parse import urlparse; u=urlparse(sys.stdin.read().strip()); print(u.password)")
    export DB_POSTGRESDB_SSL_ENABLED=true
    export DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false
    echo "[start] PostgreSQL configured from VCAP_SERVICES URI"
  fi
fi

export N8N_PORT=$PORT
echo "[start] Starting n8n on port $N8N_PORT"
exec n8n start
