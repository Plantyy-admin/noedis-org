import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.NOEDIS_PORT || 3200;
const PAPERCLIP_TARGET = process.env.PAPERCLIP_URL || 'http://127.0.0.1:3100';
const COMPANY_ID = process.env.NOEDIS_COMPANY_ID || '66147035-5aa3-4612-b445-186ecd6e3169';

const app = express();
const server = http.createServer(app);

// ── NOEDIS API Proxy ──────────────────────────────────────────
// Proxies REST API calls to the Paperclip server
const apiProxy = createProxyMiddleware({
  target: PAPERCLIP_TARGET,
  changeOrigin: true,
  proxyTimeout: 30000,
  timeout: 30000,
});

app.use('/api', apiProxy);

// ── WebSocket proxy for live events ───────────────────────────
const wss = new WebSocketServer({ noServer: true });

// ── State tracking ────────────────────────────────────────────
let lastDashboard = null;
let wsClients = new Set();

function broadcastToClients(data) {
  const msg = JSON.stringify(data);
  for (const ws of wsClients) {
    try {
      if (ws.readyState === 1) ws.send(msg);
    } catch (_) { /* skip dead conns */ }
  }
}

// ── Poll dashboard every 2s ───────────────────────────────────
async function pollDashboard() {
  try {
    const res = await fetch(`${PAPERCLIP_TARGET}/api/companies/${COMPANY_ID}/dashboard`);
    const data = await res.json();
    if (JSON.stringify(data) !== JSON.stringify(lastDashboard)) {
      lastDashboard = data;
      broadcastToClients({ type: 'dashboard', data });
    }
  } catch (_) { /* Paperclip not reachable */ }
}

setInterval(pollDashboard, 2000);
pollDashboard();

// ── Static files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API route to get dashboard on demand ──────────────────────
app.get('/noedis/api/dashboard', async (req, res) => {
  try {
    const r = await fetch(`${PAPERCLIP_TARGET}/api/companies/${COMPANY_ID}/dashboard`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Paperclip unreachable' });
  }
});

// ── Agent list ────────────────────────────────────────────────
app.get('/noedis/api/agents', async (req, res) => {
  try {
    const r = await fetch(`${PAPERCLIP_TARGET}/api/companies/${COMPANY_ID}/agents`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Paperclip unreachable' });
  }
});

// ── Company info ──────────────────────────────────────────────
app.get('/noedis/api/company', async (req, res) => {
  try {
    const r = await fetch(`${PAPERCLIP_TARGET}/api/companies/${COMPANY_ID}`);
    const data = await r.json();
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: 'Paperclip unreachable' });
  }
});

// ── Health check ──────────────────────────────────────────────
app.get('/noedis/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '0.3.0',
    paperclipUrl: PAPERCLIP_TARGET,
    companyId: COMPANY_ID,
    wsClients: wsClients.size,
  });
});

// ── WebSocket upgrade ─────────────────────────────────────────
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  // NOEDIS WS for dashboard events
  if (url.pathname === '/noedis/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wsClients.add(ws);
      ws.send(JSON.stringify({ type: 'connected', companyId: COMPANY_ID }));
      ws.on('close', () => wsClients.delete(ws));
      ws.on('error', () => wsClients.delete(ws));
    });
    return;
  }

  // Proxy WS to Paperclip for event streams
  if (url.pathname === '/ws/paperclip') {
    // Forward to Paperclip's live events WS
    const paperclipUrl = new URL(PAPERCLIP_TARGET);
    const pcWsUrl = `ws://${paperclipUrl.host}/api/companies/${COMPANY_ID}/events/ws`;
    const pcReq = http.request({
      hostname: paperclipUrl.hostname,
      port: paperclipUrl.port,
      path: `/api/companies/${COMPANY_ID}/events/ws`,
      method: 'GET',
      headers: request.headers,
    });
    socket.destroy();
    return;
  }

  socket.destroy();
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/assets/')) return;
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ███ NOEDIS Command Center ███`);
  console.log(`  ─────────────────────────────`);
  console.log(`  View   │ URL`);
  console.log(`  ───────┼──────────────────────────`);
  console.log(`  LOCAL  │ http://127.0.0.1:${PORT}`);
  console.log(`  LOCAL  │ http://0.0.0.0:${PORT}`);
  console.log(`  ───────┼──────────────────────────`);
  console.log(`  Proxy  │ Paperclip → ${PAPERCLIP_TARGET}`);
  console.log(`  WS     │ /noedis/ws (${wsClients.size} clients)`);
  console.log(`  ─────────────────────────────\n`);
});