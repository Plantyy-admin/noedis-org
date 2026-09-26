/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — application bootstrap
   ══════════════════════════════════════════════════════════════ */

import { $, $$, esc, debounce, setText } from './util.js';
import { api, connectLive } from './api.js';
import { buildModel } from './store.js';
import {
  renderStructureChrome,
  renderOrg,
  renderUnits,
  setStructureSearch,
  setExpandMode,
} from './structure.js';
import { renderDashboard } from './dashboard.js';
import { renderInbox } from './inbox.js';
import { initChat, setChatAgents } from './chat.js';
import { initGameplay, setGameplayModel, startGameplay, stopGameplay } from './gameplay.js';

/* ── state ─────────────────────────────────────────────────── */

const state = {
  blueprint: null,
  company: null,
  agents: [],
  org: null,
  dashboard: null,
  issues: [],
  activity: [],
  inbox: { issues: [], approvals: [] },
  errors: {},
  model: null,
  activeView: 'structure',
  live: false,
};

/* ── boot ──────────────────────────────────────────────────── */

async function boot() {
  initNavigation();
  initGameplay();
  initChat({ toast });
  initStructureControls();
  connectLiveSocket();

  await loadClientConfig();
  await loadAll();
  // §5.3 auto-refresh: STRUCTURE 5s, DASHBOARD 4s, INBOX 6s.
  setInterval(refreshStructure, 5000);
  setInterval(refreshDashboard, 4000);
  setInterval(refreshInbox, 6000);

  showView('structure');

  if (!state.live) {
    toast('Live push odpojen — používám periodický refresh', 'warn');
  }
}

async function loadClientConfig() {
  try {
    const cfg = await api.clientConfig();
    const iframe = document.getElementById('paperclip-iframe');
    const open = document.getElementById('iframe-open');
    const note = document.getElementById('iframe-note');
    if (cfg?.paperclipUiUrl) {
      if (iframe) iframe.src = cfg.paperclipUiUrl;
      if (open) open.href = cfg.paperclipUiUrl;
      if (note) note.textContent = `Paperclip nativní UI — ${cfg.paperclipUiUrl}`;
    }
  } catch (err) {
    console.warn('[noedis] client config failed', err);
  }
}

async function loadAll() {
  try {
    const bundle = await api.overview();
    state.blueprint = bundle.blueprint;
    state.company = bundle.company;
    state.agents = bundle.agents || [];
    state.org = bundle.org;
    state.dashboard = bundle.dashboard;
    state.issues = bundle.issues || [];
    state.activity = bundle.activity || [];
    state.errors = bundle.errors || {};
    applyUplink(bundle.paperclip);
  } catch (err) {
    state.errors = { overview: err.message };
    applyUplink({ reachable: false, lastError: err.message });
    toast(`Načtení dat selhalo: ${err.message}`, 'error');
  }

  if (!state.blueprint) {
    try {
      state.blueprint = await api.blueprint();
    } catch (err) {
      state.errors.blueprint = err.message;
    }
  }

  rebuild();
  await refreshInbox();
}

function rebuild() {
  state.model = buildModel(state.blueprint, state.agents, state.org);
  renderStructureChrome(state.model);
  renderOrg(state.model);
  renderUnits(state.model);
  renderDashboard(state.model, state.dashboard, state.company);
  setChatAgents(state.agents);
  setGameplayModel(state.model);
  updateNavCounts();
}

/* ── periodic refresh ──────────────────────────────────────── */

async function refreshStructure() {
  try {
    const [agents, dashboard] = await Promise.all([api.agents(), api.dashboard()]);
    if (Array.isArray(agents)) state.agents = agents;
    state.dashboard = dashboard;
    applyUplink({ reachable: true });
    rebuild();
  } catch (err) {
    applyUplink({ reachable: false, lastError: err.message });
  }
}

async function refreshInbox() {
  try {
    const [inbox, activity] = await Promise.all([api.inbox(), api.activity(25)]);
    state.inbox = { issues: inbox.issues || [], approvals: inbox.approvals || [] };
    state.activity = activity || [];
    renderInbox({
      issues: state.inbox.issues,
      approvals: state.inbox.approvals,
      agents: state.agents,
      activity: state.activity,
      errors: { activity: inbox.issuesError },
    });
    updateInboxBadge();
  } catch (err) {
    state.errors.inbox = err.message;
    renderInbox({ issues: [], approvals: [], agents: [], activity: [], errors: { activity: err.message } });
  }
}

async function refreshDashboard() {
  try {
    state.dashboard = await api.dashboard();
    if (state.model) renderDashboard(state.model, state.dashboard, state.company);
  } catch (err) {
    /* keep the last good numbers */
  }
}

/* ── live socket ───────────────────────────────────────────── */

function connectLiveSocket() {
  connectLive({
    onStatus: ({ connected }) => {
      state.live = connected;
      if (connected) applyUplink({ reachable: true });
      else applyUplink({ reachable: false, lastError: 'WebSocket disconnected' });
    },
    onUplink: (data) => applyUplink(data?.paperclip || data),
    onSnapshot: (data) => {
      if (!data) return;
      if (Array.isArray(data.agents)) state.agents = data.agents;
      if (data.dashboard) state.dashboard = data.dashboard;
      rebuild();
    },
  });
}

function applyUplink(status) {
  const dot = document.getElementById('nav-uplink');
  const text = document.getElementById('nav-uplink-text');
  if (!dot) return;

  const ok = status?.reachable === true && state.live;
  const reachable = status?.reachable === true;

  dot.className = `status-dot ${ok ? 'green' : reachable ? 'yellow' : 'red'}`;
  if (text) {
    if (ok) text.textContent = 'live';
    else if (reachable) text.textContent = 'poll';
    else text.textContent = status?.lastError ? 'offline' : 'connecting…';
  }
  dot.title = status?.lastError || (ok ? 'Paperclip live' : 'Paperclip status unknown');
}

/* ── navigation ────────────────────────────────────────────── */

function initNavigation() {
  $$('.nav-tab').forEach((tab) => {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  });
}

function showView(name) {
  state.activeView = name;
  $$('.nav-tab').forEach((t) => {
    const on = t.dataset.view === name;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));

  if (name === 'gameplay') startGameplay();
  else stopGameplay();

  if (name === 'inbox') refreshInbox();
  if (name === 'dashboard') refreshStructure();
}

/* ── structure controls ────────────────────────────────────── */

function initStructureControls() {
  const search = document.getElementById('struct-search');
  search?.addEventListener(
    'input',
    debounce(() => {
      setStructureSearch(search.value);
      if (state.model) {
        renderOrg(state.model);
        renderUnits(state.model);
      }
    }, 150),
  );

  $$('[data-expand]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setExpandMode(btn.dataset.expand);
      if (state.model) {
        renderOrg(state.model);
        renderUnits(state.model);
      }
    });
  });

  document.getElementById('inbox-refresh')?.addEventListener('click', refreshInbox);
}

/* ── nav chrome ────────────────────────────────────────────── */

function updateNavCounts() {
  setText('nav-agent-count', `${state.agents.length} agentů`);
}

function updateInboxBadge() {
  const badge = document.getElementById('inbox-badge');
  if (!badge) return;
  const count = (state.issues || []).filter((i) => ['todo', 'in_progress', 'blocked'].includes(String(i.status))).length;
  badge.textContent = String(count);
  badge.hidden = count === 0;
}

/* ── toast ─────────────────────────────────────────────────── */

export function toast(message, type = 'info') {
  const host = document.getElementById('toast-container');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = `◆ ${message}`;
  host.append(node);
  setTimeout(() => {
    node.style.opacity = '0';
    node.style.transition = 'opacity .3s ease';
    setTimeout(() => node.remove(), 300);
  }, 3500);
}

/* ── go ────────────────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
