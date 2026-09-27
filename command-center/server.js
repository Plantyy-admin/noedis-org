/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — server
   ──────────────────────────────────────────────────────────────
   Serves the cockpit UI and is the only component that talks to
   Paperclip. The board API key stays server-side; the browser only
   ever sees /noedis/api/*.

   Routes
     GET  /noedis/login               sign-in screen (open)
     POST /noedis/login               credential check -> session cookie
     GET  /noedis/logout              end the session, back to the sign-in screen
     POST /noedis/logout              same, as called by the header button
     GET  /noedis/health              liveness + Paperclip uplink state (open)
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
import { createAuth } from './lib/auth.js';
import { renderLoginPage } from './lib/login-page.js';

const paperclip = new PaperclipClient({
  baseUrl: config.paperclip.baseUrl,
  apiKey: config.paperclip.apiKey,
  companyId: config.paperclip.companyId,
  timeoutMs: config.paperclip.timeoutMs,
});

const auth = createAuth(config.auth);

const app = express();
const server = http.createServer(app);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));

/* ─── the gate ───────────────────────────────────────────────
   Installed before every route so no panel, asset or socket can be
   read without a session. Disabled entirely when no password is set. */
app.use(auth.middleware);

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || 'local';

app.get('/noedis/login', (req, res) => {
  if (auth.isAuthed(req)) return res.redirect(302, auth.safeNext(req.query.next || '/'));
  const locked = auth.throttled(clientIp(req));
  res
    .status(locked ? 429 : 200)
    .type('html')
    .send(renderLoginPage({ next: auth.safeNext(req.query.next || '/'), locked }));
});

app.post('/noedis/login', (req, res) => {
  const ip = clientIp(req);
  const next = auth.safeNext(req.body?.next || req.query.next || '/');
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');

  const locked = auth.throttled(ip);
  if (locked) {
    return res
      .status(429)
      .type('html')
      .send(renderLoginPage({ next, user: username, locked }));
  }

  if (!auth.checkCredentials(username, password)) {
    auth.noteFailure(ip);
    log(`AUTH: failed sign-in for "${username}" from ${ip}`);
    return res
      .status(401)
      .type('html')
      .send(renderLoginPage({ next, user: username, error: 'Nesprávné jméno nebo heslo.' }));
  }

  auth.resetFailures(ip);
  auth.issue(req, res);
  log(`AUTH: ${username} signed in from ${ip}`);
  res.redirect(303, next);
});

const logout = (req, res) => {
  auth.clear(req, res);
  if (String(req.headers.accept || '').includes('application/json')) {
    return res.json({ ok: true, login: '/noedis/login' });
  }
  res.redirect(303, '/noedis/login');
};
app.get('/noedis/logout', logout);
app.post('/noedis/logout', logout);

/* ─── helpers ────────────────────────────────────────────────── */

function sendError(res, err, fallbackStatus = 502) {
  let status = err instanceof PaperclipError ? err.status || fallbackStatus : 500;
  // 401 belongs to the cockpit's own gate (`X-Noedis-Auth`), so an upstream
  // rejection must never reuse it — the UI would read it as "signed out".
  if (status === 401 || status === 403) status = 502;
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
    version: '0.5.0',
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
    if (!auth.isAuthed(request)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
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

  log(`Command Center v0.5.0 listening on http://${config.host}:${config.port}`);
  log(`Paperclip   : ${config.paperclip.baseUrl}`);
  log(`Company     : ${config.paperclip.companyId}`);
  log(`API key     : ${config.paperclip.apiKey ? 'configured' : 'MISSING (set PAPERCLIP_API_KEY)'}`);
  log(`Paperclip UI: ${config.paperclipUiUrl}`);
  log(`Blueprint   : ${deptCount} departments / ${divisionCount} divisions / ${teamCount} teams`);
  log(
    `Auth        : ${auth.enabled ? `ON (user "${config.auth.user}")` : 'OFF — the cockpit is public'}`,
  );
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
