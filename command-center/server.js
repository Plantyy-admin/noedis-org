/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — server
   ──────────────────────────────────────────────────────────────
   Serves the cockpit UI and is the only component that talks to
   Paperclip. The board API key stays server-side; the browser only
   ever sees /noedis/api/*.

   Routes
     GET  /noedis/health              liveness + Paperclip uplink state
     GET  /noedis/api/blueprint       canonical MASTER v0.3.0 org blueprint
     GET  /noedis/api/overview        single bundle for first paint
     GET  /noedis/api/company         Paperclip company record
     GET  /noedis/api/agents          live agents
     GET  /noedis/api/org             live org chart (reports_to tree)
     GET  /noedis/api/dashboard       Paperclip dashboard metrics
     GET  /noedis/api/issues          work items
     GET  /noedis/api/activity        activity feed
     GET  /noedis/api/inbox           board inbox (issues + approvals)
     POST /noedis/api/work            work intake -> issue assigned to an agent
     POST /noedis/api/wake            request an agent heartbeat
     WS   /noedis/ws                  live push (poll-derived deltas)
   ══════════════════════════════════════════════════════════════ */

import express from 'express';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { config, readBlueprint, log } from './lib/config.js';
import { PaperclipClient, PaperclipError } from './lib/paperclip.js';

const paperclip = new PaperclipClient({
  baseUrl: config.paperclip.baseUrl,
  apiKey: config.paperclip.apiKey,
  companyId: config.paperclip.companyId,
  timeoutMs: config.paperclip.timeoutMs,
});

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '1mb' }));

/* ─── helpers ────────────────────────────────────────────────── */

function sendError(res, err, fallbackStatus = 502) {
  const status = err instanceof PaperclipError ? err.status || fallbackStatus : 500;
  res.status(status).json({
    error: err?.message || 'Unexpected error',
    path: err?.path || null,
    paperclip: paperclip.status(),
  });
}

/** Wrap an async route so failures become structured JSON, never a hang. */
const route = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    log('route error:', err?.message || err);
    sendError(res, err);
  }
};

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/* ─── status ─────────────────────────────────────────────────── */

app.get('/noedis/health', route(async (_req, res) => {
  let paperclipHealth = null;
  let paperclipError = null;
  try {
    paperclipHealth = await paperclip.health();
  } catch (err) {
    paperclipError = err.message;
  }
  res.json({
    status: 'ok',
    service: 'noedis-command-center',
    version: '0.4.0',
    blueprintVersion: readBlueprintSafe()?.version ?? null,
    paperclip: {
      ...paperclip.status(),
      health: paperclipHealth,
      error: paperclipError,
    },
    paperclipUiUrl: config.paperclipUiUrl,
    wsClients: wsClients.size,
    uptimeSec: Math.round(process.uptime()),
    now: new Date().toISOString(),
  });
}));

function readBlueprintSafe() {
  try {
    return readBlueprint();
  } catch (err) {
    log('blueprint read failed:', err.message);
    return null;
  }
}

app.get('/noedis/api/blueprint', route(async (_req, res) => {
  const blueprint = readBlueprintSafe();
  if (!blueprint) {
    return res.status(500).json({ error: 'org-blueprint.json missing or invalid' });
  }
  res.json(blueprint);
}));

/* ─── Paperclip passthroughs ─────────────────────────────────── */

app.get('/noedis/api/company', route(async (_req, res) => {
  res.json(await paperclip.company_());
}));

app.get('/noedis/api/agents', route(async (_req, res) => {
  res.json(await paperclip.agents());
}));

app.get('/noedis/api/org', route(async (_req, res) => {
  res.json(await paperclip.org());
}));

app.get('/noedis/api/dashboard', route(async (_req, res) => {
  res.json(await paperclip.dashboard());
}));

app.get('/noedis/api/issues', route(async (req, res) => {
  res.json(await paperclip.issues({
    limit: req.query.limit || 50,
    status: req.query.status,
    assigneeAgentId: req.query.assigneeAgentId,
  }));
}));

app.get('/noedis/api/activity', route(async (req, res) => {
  res.json(await paperclip.activity(req.query.limit || 25));
}));

app.get('/noedis/api/projects', route(async (_req, res) => {
  res.json(await paperclip.projects());
}));

app.get('/noedis/api/goals', route(async (_req, res) => {
  res.json(await paperclip.goals());
}));

app.get('/noedis/api/runs', route(async (req, res) => {
  res.json(await paperclip.heartbeatRuns(req.query.limit || 25));
}));

app.get('/noedis/api/inbox', route(async (_req, res) => {
  res.json(await paperclip.inbox());
}));

/* ─── combined overview (single call, resilient per-section) ─── */

app.get('/noedis/api/overview', route(async (_req, res) => {
  const sections = {
    blueprint: () => Promise.resolve(readBlueprintSafe()),
    company: () => paperclip.company_(),
    agents: () => paperclip.agents(),
    org: () => paperclip.org(),
    dashboard: () => paperclip.dashboard(),
    issues: () => paperclip.issues({ limit: 50 }),
    activity: () => paperclip.activity(20),
  };

  const out = {};
  const errors = {};
  await Promise.all(
    Object.entries(sections).map(async ([key, fn]) => {
      try {
        out[key] = await fn();
      } catch (err) {
        out[key] = null;
        errors[key] = err?.message || String(err);
      }
    }),
  );

  res.json({
    ...out,
    errors,
    paperclip: paperclip.status(),
    generatedAt: new Date().toISOString(),
  });
}));

/* ─── work intake ────────────────────────────────────────────── */

app.post('/noedis/api/work', route(async (req, res) => {
  const { title, description, assigneeAgentId, priority, wake } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const issue = await paperclip.createWork({
    title: String(title).trim(),
    description: description ? String(description) : undefined,
    assigneeAgentId,
    priority: priority || 'medium',
  });

  let wakeResult = null;
  let wakeError = null;
  if (wake && assigneeAgentId) {
    try {
      wakeResult = await paperclip.wake(assigneeAgentId);
    } catch (err) {
      wakeError = err.message;
    }
  }

  res.status(201).json({ issue, wake: wakeResult, wakeError });
}));

app.post('/noedis/api/wake', route(async (req, res) => {
  const { agentId } = req.body || {};
  if (!agentId) return res.status(400).json({ error: 'agentId is required' });
  res.json(await paperclip.wake(agentId));
}));

/* ─── live push ──────────────────────────────────────────────── */

const wss = new WebSocketServer({ noServer: true });
const wsClients = new Set();

function broadcast(type, data) {
  const msg = JSON.stringify({ type, data, at: new Date().toISOString() });
  for (const ws of wsClients) {
    if (ws.readyState === 1) {
      try {
        ws.send(msg);
      } catch {
        /* drop dead socket */
      }
    }
  }
}

let lastSignature = null;

async function pollAndBroadcast() {
  try {
    const [agents, dashboard] = await Promise.all([
      paperclip.agents(),
      paperclip.dashboard(),
    ]);
    const signature = JSON.stringify({
      a: (agents || []).map((x) => [x.id, x.status, x.errorReason]),
      d: dashboard,
    });
    if (signature !== lastSignature) {
      lastSignature = signature;
      broadcast('snapshot', { agents, dashboard, paperclip: paperclip.status() });
    }
  } catch (err) {
    const state = paperclip.status();
    const signature = `err:${state.lastError}`;
    if (signature !== lastSignature) {
      lastSignature = signature;
      broadcast('uplink', { paperclip: state });
    }
  }
}

/* ─── static UI ──────────────────────────────────────────────── */

app.use(express.static(config.publicDir, { extensions: ['html'] }));

app.get('/noedis/config', (_req, res) => {
  res.json({
    companyId: config.paperclip.companyId,
    paperclipUiUrl: config.paperclipUiUrl,
    pollIntervalMs: config.pollIntervalMs,
  });
});

/* SPA fallback — never swallow API or asset paths. */
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/noedis/') || req.path.startsWith('/api/')) return next();
  res.sendFile(`${config.publicDir}/index.html`);
});

app.use((req, res) => {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
});

/* ─── websocket upgrade ──────────────────────────────────────── */

server.on('upgrade', (request, socket, head) => {
  let pathname = '/';
  try {
    pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname === '/noedis/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wsClients.add(ws);
      ws.send(JSON.stringify({
        type: 'connected',
        data: { companyId: config.paperclip.companyId, paperclip: paperclip.status() },
        at: new Date().toISOString(),
      }));
      pollAndBroadcast();
      ws.on('close', () => wsClients.delete(ws));
      ws.on('error', () => wsClients.delete(ws));
    });
    return;
  }

  socket.destroy();
});

/* ─── boot ───────────────────────────────────────────────────── */

server.listen(config.port, config.host, () => {
  const bp = readBlueprintSafe();
  const deptCount = bp?.departments?.length ?? 0;
  const divisionCount = (bp?.departments || []).reduce((n, d) => n + (d.divisions?.length || 0), 0);
  const teamCount = (bp?.departments || []).reduce(
    (n, d) => n + (d.divisions || []).reduce((m, v) => m + (v.teams?.length || 0), 0),
    0,
  );

  log(`Command Center v0.4.0 listening on http://${config.host}:${config.port}`);
  log(`Paperclip   : ${config.paperclip.baseUrl}`);
  log(`Company     : ${config.paperclip.companyId}`);
  log(`API key     : ${config.paperclip.apiKey ? 'configured' : 'MISSING (set PAPERCLIP_API_KEY)'}`);
  log(`Paperclip UI: ${config.paperclipUiUrl}`);
  log(`Blueprint   : ${deptCount} departments / ${divisionCount} divisions / ${teamCount} teams`);
});

if (!paperclip.configured) {
  log('WARNING: Paperclip client is not fully configured — API routes will return 502.');
}

setInterval(pollAndBroadcast, config.pollIntervalMs);
pollAndBroadcast();

process.on('SIGTERM', () => {
  log('SIGTERM — shutting down');
  server.close(() => process.exit(0));
});
