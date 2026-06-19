'use strict';

const https = require('https');
const http = require('http');
const tls = require('tls');

// ── Config ────────────────────────────────────────────────────────────────────
const N8N_ASSET_URL   = process.env.N8N_ASSET_URL    || 'https://bpsync-n8n.cfapps.us10.hana.ondemand.com/assets/index-CDodBmSz.js';
const CF_API          = process.env.CF_API_URL        || 'https://api.cf.us10.hana.ondemand.com';
const UAA_URL         = process.env.UAA_URL           || 'https://uaa.cf.us10.hana.ondemand.com';
const CF_USER         = process.env.CF_USER           || '';
const CF_PASSWORD     = process.env.CF_PASSWORD       || '';
const N8N_APP_GUID    = process.env.N8N_APP_GUID      || '817d2181-9e7f-4c16-8b2e-f5177c46f081';
const CHECK_MS        = parseInt(process.env.CHECK_INTERVAL_MS    || '180000');
const FAIL_THRESHOLD  = parseInt(process.env.FAIL_THRESHOLD       || '3');
const COOLDOWN_MS     = parseInt(process.env.RESTART_COOLDOWN_MS  || '180000');

// Neon free tier pauses after 5 min idle — ping it every 3 min to prevent that
const NEON_HOST       = process.env.DB_POSTGRESDB_HOST || 'ep-steep-truth-atkvnd1q.c-9.us-east-1.aws.neon.tech';
const NEON_PORT       = parseInt(process.env.DB_POSTGRESDB_PORT   || '5432');
const NEON_KEEPALIVE_MS = parseInt(process.env.NEON_KEEPALIVE_MS  || '180000');

// ── State ─────────────────────────────────────────────────────────────────────
let fails         = 0;
let lastRestart   = 0;
let totalRestarts = 0;
let cfToken       = null;
let cfTokenExpiry = 0;

const log = (level, msg, data = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...data }));

// ── HTTP helpers ──────────────────────────────────────────────────────────────
function httpRequest({ url, method = 'GET', headers = {}, body = null, timeoutMs = 10000 }) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method,
      headers,
      timeout: timeoutMs,
    };
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(opts, (res) => {
      let b = '';
      res.on('data', d => (b += d));
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'timeout' }); });
    if (body) req.write(body);
    req.end();
  });
}

// ── CF token via password grant (cf / public client) ─────────────────────────
async function refreshToken() {
  if (!CF_USER || !CF_PASSWORD) return null;
  if (cfToken && Date.now() < cfTokenExpiry - 30000) return cfToken;

  const body = [
    'grant_type=password',
    `username=${encodeURIComponent(CF_USER)}`,
    `password=${encodeURIComponent(CF_PASSWORD)}`,
    'client_id=cf',
    'client_secret=',
  ].join('&');

  const resp = await httpRequest({
    url: `${UAA_URL}/oauth/token`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  });

  if (resp.status !== 200) {
    log('ERROR', 'Token refresh failed', { status: resp.status });
    return null;
  }
  const data = JSON.parse(resp.body);
  cfToken = data.access_token;
  cfTokenExpiry = Date.now() + data.expires_in * 1000;
  log('INFO', 'CF token refreshed', { expires_in: data.expires_in });
  return cfToken;
}

// ── Restart n8n via CF v3 API ─────────────────────────────────────────────────
async function restartN8n() {
  const now = Date.now();
  if (now - lastRestart < COOLDOWN_MS) {
    log('INFO', 'Cooldown active', { remaining_s: Math.round((COOLDOWN_MS - (now - lastRestart)) / 1000) });
    return;
  }

  const token = await refreshToken();
  if (!token) {
    log('WARN', 'No CF token — skipping restart (set CF_USER + CF_PASSWORD env vars)');
    return;
  }

  log('WARN', `Triggering CF restart for n8n`, { app_guid: N8N_APP_GUID, restart_num: totalRestarts + 1 });

  const resp = await httpRequest({
    url: `${CF_API}/v3/apps/${N8N_APP_GUID}/actions/restart`,
    method: 'POST',
    headers: {
      'Authorization': `bearer ${token}`,
      'Content-Type': 'application/json',
      'Content-Length': '0',
    },
    body: '',
    timeoutMs: 30000,
  });

  if (resp.status === 200 || resp.status === 202) {
    totalRestarts++;
    lastRestart = now;
    fails = 0;
    log('INFO', 'Restart triggered successfully', { total_restarts: totalRestarts });
  } else {
    log('ERROR', 'Restart API call failed', { status: resp.status, body: resp.body?.slice(0, 300) });
    cfToken = null; // force token refresh next time
  }
}

// ── Neon keep-alive: open a TLS connection to port 5432 to wake the instance ──
// Neon free tier suspends after 5 min of no TCP activity; this prevents that.
function neonKeepalive() {
  return new Promise((resolve) => {
    const sock = tls.connect({ host: NEON_HOST, port: NEON_PORT, rejectUnauthorized: false }, () => {
      log('INFO', 'Neon keepalive: connection established');
      sock.destroy();
      resolve(true);
    });
    sock.setTimeout(10000);
    sock.on('timeout', () => { sock.destroy(); log('WARN', 'Neon keepalive: timeout'); resolve(false); });
    sock.on('error', (e) => { log('WARN', 'Neon keepalive: error', { err: e.message }); resolve(false); });
  });
}

// ── Health probe ──────────────────────────────────────────────────────────────
async function probe(url, timeoutMs = 8000) {
  const resp = await httpRequest({ url, method: 'GET', timeoutMs });
  return resp.status;
}

async function check() {
  const status = await probe(N8N_ASSET_URL);

  if (status === 200) {
    if (fails > 0) log('INFO', 'n8n recovered', { was_failing: fails, url: N8N_ASSET_URL });
    else log('INFO', 'n8n healthy', { status, url: N8N_ASSET_URL });
    fails = 0;
    return;
  }

  fails++;
  log('WARN', 'n8n probe failed — non-200 response', { status, fails, threshold: FAIL_THRESHOLD, url: N8N_ASSET_URL });

  if (fails >= FAIL_THRESHOLD) {
    log('WARN', `Threshold reached (${fails}/${FAIL_THRESHOLD}), triggering CF restart`);
    await restartN8n();
  }
}

// ── Status endpoint (CF needs HTTP to keep app alive) ─────────────────────────
const PORT = parseInt(process.env.PORT || '3000');
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    watchdog: 'running',
    n8n_asset_url: N8N_ASSET_URL,
    consecutive_fails: fails,
    total_restarts: totalRestarts,
    last_restart: lastRestart ? new Date(lastRestart).toISOString() : null,
    cf_auth_configured: !!(CF_USER && CF_PASSWORD),
    uptime_s: Math.round(process.uptime()),
  }, null, 2));
}).listen(PORT, () => log('INFO', `Watchdog listening on :${PORT}`));

// ── Start ─────────────────────────────────────────────────────────────────────
log('INFO', 'Watchdog starting', {
  n8n_asset_url: N8N_ASSET_URL,
  app_guid: N8N_APP_GUID,
  check_ms: CHECK_MS,
  fail_threshold: FAIL_THRESHOLD,
  cooldown_ms: COOLDOWN_MS,
  neon_host: NEON_HOST,
  neon_keepalive_ms: NEON_KEEPALIVE_MS,
  cf_auth: !!(CF_USER && CF_PASSWORD) ? 'configured' : 'NOT SET',
});

// Pre-warm token
if (CF_USER && CF_PASSWORD) refreshToken().catch(() => {});

// Neon keep-alive: fire immediately then every NEON_KEEPALIVE_MS
neonKeepalive();
setInterval(neonKeepalive, NEON_KEEPALIVE_MS);

// First check after 60s startup grace, then every CHECK_MS
setTimeout(() => {
  check();
  setInterval(check, CHECK_MS);
}, 60000);
