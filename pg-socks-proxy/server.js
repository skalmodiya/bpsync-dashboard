'use strict';

const net = require('net');
const axios = require('axios');

// ── Configuration from VCAP_SERVICES / env ───────────────────────────────────

function getConnectivityCreds() {
  const vcap = JSON.parse(process.env.VCAP_SERVICES || '{}');
  const conn = (vcap.connectivity || [])[0];
  if (!conn) throw new Error('connectivity service not bound');
  return conn.credentials;
}

const CREDS = getConnectivityCreds();

const SOCKS5_HOST   = CREDS.onpremise_proxy_host;
const SOCKS5_PORT   = parseInt(CREDS.onpremise_socks5_proxy_port, 10);
const TOKEN_URL     = `${CREDS.token_service_url}/oauth/token`;
const CLIENT_ID     = CREDS.clientid;
const CLIENT_SECRET = CREDS.clientsecret;

const ONPREM_HOST = process.env.ONPREM_PG_VIRTUAL_HOST || 'onprem-postgres';
const ONPREM_PORT = parseInt(process.env.ONPREM_PG_VIRTUAL_PORT || '5432', 10);
const LISTEN_PORT = parseInt(process.env.PORT || '5433', 10);

// ── OAuth token fetcher ───────────────────────────────────────────────────────

let _token = null;
let _tokenExpiry = 0;

async function getToken() {
  if (_token && Date.now() < _tokenExpiry - 30000) return _token;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
  });
  const resp = await axios.post(TOKEN_URL, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  _token = resp.data.access_token;
  _tokenExpiry = Date.now() + resp.data.expires_in * 1000;
  return _token;
}

// ── SAP SOCKS5 handshake (custom auth method 0x80) ───────────────────────────
// SAP Cloud Connector SOCKS5 uses proprietary JWT auth (method 0x80).
// Sequence:
//   C→S: VER=5, NMETHODS=1, METHOD=0x80
//   S→C: VER=5, METHOD=0x80
//   C→S: 0x01, 0x00, <2-byte BE token length>, <token bytes>
//   S→C: 0x01, 0x00  (success)
//   Then standard SOCKS5 CONNECT request.

function socks5Connect(token, destHost, destPort) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(SOCKS5_PORT, SOCKS5_HOST, () => {
      sock.write(Buffer.from([0x05, 0x01, 0x80]));
    });

    let state = 'greeting';
    let buf = Buffer.alloc(0);

    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);

      if (state === 'greeting') {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x80) {
          return reject(new Error(`SOCKS5 greeting rejected: method=${buf[1]}`));
        }
        buf = buf.slice(2);
        state = 'auth';

        const tokenBuf = Buffer.from(token, 'utf8');
        const header = Buffer.alloc(4);
        header[0] = 0x01;
        header[1] = 0x00;
        header.writeUInt16BE(tokenBuf.length, 2);
        sock.write(Buffer.concat([header, tokenBuf]));
        return;
      }

      if (state === 'auth') {
        if (buf.length < 2) return;
        if (buf[0] !== 0x01 || buf[1] !== 0x00) {
          return reject(new Error(`SOCKS5 auth failed: ${buf[0]},${buf[1]}`));
        }
        buf = buf.slice(2);
        state = 'connect';

        const hostBuf = Buffer.from(destHost, 'utf8');
        const req = Buffer.alloc(7 + hostBuf.length);
        req[0] = 0x05; // VER
        req[1] = 0x01; // CMD CONNECT
        req[2] = 0x00; // RSV
        req[3] = 0x03; // ATYP domain
        req[4] = hostBuf.length;
        hostBuf.copy(req, 5);
        req.writeUInt16BE(destPort, 5 + hostBuf.length);
        sock.write(req);
        return;
      }

      if (state === 'connect') {
        if (buf.length < 10) return;
        if (buf[0] !== 0x05 || buf[1] !== 0x00) {
          return reject(new Error(`SOCKS5 CONNECT failed: REP=${buf[1]}`));
        }
        state = 'open';
        sock.removeAllListeners('data');
        const leftover = buf.slice(10);
        resolve({ socket: sock, leftover });
      }
    });

    sock.on('error', reject);
    sock.setTimeout(15000, () => reject(new Error('SOCKS5 handshake timeout')));
  });
}

// ── TCP proxy server ──────────────────────────────────────────────────────────

const server = net.createServer(async (clientSocket) => {
  clientSocket.pause();
  try {
    const token = await getToken();
    const { socket: proxySocket, leftover } = await socks5Connect(token, ONPREM_HOST, ONPREM_PORT);

    console.log(`[proxy] tunnel open → ${ONPREM_HOST}:${ONPREM_PORT}`);

    if (leftover && leftover.length > 0) clientSocket.push(leftover);

    proxySocket.on('error', (e) => { console.error(`[proxy] upstream: ${e.message}`); clientSocket.destroy(); });
    clientSocket.on('error', (e) => { console.error(`[proxy] client: ${e.message}`); proxySocket.destroy(); });
    clientSocket.on('close', () => proxySocket.destroy());
    proxySocket.on('close', () => clientSocket.destroy());

    clientSocket.pipe(proxySocket);
    proxySocket.pipe(clientSocket);
    clientSocket.resume();
  } catch (err) {
    console.error(`[proxy] failed: ${err.message}`);
    clientSocket.destroy();
  }
});

server.listen(LISTEN_PORT, '0.0.0.0', () => {
  console.log(`pg-socks-proxy listening on port ${LISTEN_PORT}`);
  console.log(`  SOCKS5 proxy : ${SOCKS5_HOST}:${SOCKS5_PORT}`);
  console.log(`  On-prem dest : ${ONPREM_HOST}:${ONPREM_PORT}`);
});

server.on('error', (err) => { console.error(`[server] ${err.message}`); process.exit(1); });
