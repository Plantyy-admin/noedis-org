/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — Application
   ══════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ─── CONFIG ─────────────────────────────────────────────────
  const COMPANY_ID = '66147035-5aa3-4612-b445-186ecd6e3169';
  const PAPERCLIP_URL = 'http://127.0.0.1:3100';
  const POLL_INTERVAL = 4000;  // ms
  // Central model policy — all Pi agents use OpenRouter with this default
  const DEFAULT_MODEL = 'openai/gpt-6-luna';
  const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

  // ─── STATE ──────────────────────────────────────────────────
  let dashboardData = null;
  let agents = [];
  let wsConnected = false;

  // ─── DOM REFS ───────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── INIT ───────────────────────────────────────────────────
  async function init() {
    await fetchCompany();
    await fetchDashboard();
    await fetchAgents();
    setupNavigation();
    connectWebSocket();
    setInterval(fetchDashboard, POLL_INTERVAL);
    setInterval(fetchAgents, POLL_INTERVAL * 2);
    showView('paperclip'); // Start with Paperclip view
  }

  // ─── NAVIGATION ─────────────────────────────────────────────
  function setupNavigation() {
    $$('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const viewName = tab.dataset.view;
        $$('.nav-tab').forEach(t => {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        showView(viewName);
      });
    });
  }

  function showView(name) {
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${name}`);
    if (target) {
      target.classList.add('active');
      if (name === 'gameplay') {
        initThreeGameplay();
      }
      if (name === 'dashboard') {
        // Dashboard is already live-updated via polling + WebSocket
      }
    }
  }

  // ─── THREE.JS AGENT SELECTOR ──────────────────────────────
  window.__selectThreeAgent = function(agentId) {
    const agent = agents.find(a => a.id === agentId || a.name === agentId || a.codename === agentId);
    if (agent && window.__threeOpenChat) {
      window.__threeOpenChat(agent);
    }
  }

  // ─── FETCH ──────────────────────────────────────────────────
  async function fetchData(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      console.warn(`[NOEDIS] fetch failed: ${url}`, e.message);
      return null;
    }
  }

  async function fetchCompany() {
    const data = await fetchData('/noedis/api/company');
    if (data) {
      document.getElementById('dash-company-id').textContent = data.id?.slice(0, 8) + '…' || '—';
      document.getElementById('dash-company-status').textContent = data.status || '—';
      document.getElementById('dash-company-prefix').textContent = data.issuePrefix || '—';
      document.getElementById('dash-company-created').textContent =
        data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '—';
    }
  }

  async function fetchDashboard() {
    const data = await fetchData('/noedis/api/dashboard');
    if (data) {
      dashboardData = data;
      updateStatusBar(data);
      updateDashboardMetrics(data);
    }
  }

  async function fetchAgents() {
    const data = await fetchData('/noedis/api/agents');
    if (data && Array.isArray(data)) {
      agents = data;
      updateAgentCount(data.length);
      renderCrew(data);
      renderAgentTable(data);
    }
  }

  // ─── WEBSOCKET ──────────────────────────────────────────────
  function connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${location.host}/noedis/ws`;
    try {
      const ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        wsConnected = true;
        updateUplink(true);
        toast('WebSocket connected', 'success');
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'dashboard' && msg.data) {
            dashboardData = msg.data;
            updateStatusBar(msg.data);
            updateDashboardMetrics(msg.data);
          }
          if (msg.type === 'connected') {
            console.log('[NOEDIS] WS connected:', msg.companyId);
          }
        } catch (_) { /* ignore parse errors */ }
      };
      ws.onclose = () => {
        wsConnected = false;
        updateUplink(false);
        setTimeout(connectWebSocket, 3000);
      };
      ws.onerror = () => {
        wsConnected = false;
        updateUplink(false);
      };
    } catch (e) {
      console.warn('[NOEDIS] WebSocket error:', e);
      updateUplink(false);
      setTimeout(connectWebSocket, 5000);
    }
  }

  // ─── UI UPDATES ─────────────────────────────────────────────
  function updateUplink(connected) {
    const dot = document.getElementById('nav-uplink');
    if (!dot) return;
    dot.className = 'status-dot ' + (connected ? 'green' : 'red');
    if (!connected) dot.classList.add('pulse');
    else dot.classList.remove('pulse');
  }

  function updateAgentCount(count) {
    const el = document.getElementById('nav-agent-count');
    if (el) el.textContent = `${count} agent${count !== 1 ? 's' : ''}`;
  }

  function updateStatusBar(data) {
    const agents = data.agents || {};
    const total = agents.active || 0;
    const running = agents.running || 0;
    const idle = total - running;
    const summary = document.getElementById('crew-summary');
    if (summary) {
      summary.textContent = `${running} WORKING / ${idle} IDLE`;
    }
  }

  function updateDashboardMetrics(data) {
    const a = data.agents || {};
    const t = data.tasks || {};
    const c = data.costs || {};
    const b = data.budgets || {};

    setText('m-agents-active', a.active ?? 0);
    setText('m-agents-running', a.running ?? 0);
    setText('m-agents-paused', a.paused ?? 0);
    setText('m-agents-error', a.error ?? 0);
    setText('m-tasks-open', t.open ?? 0);
    setText('m-tasks-progress', t.inProgress ?? 0);
    setText('m-tasks-blocked', t.blocked ?? 0);
    setText('m-tasks-done', t.done ?? 0);
    setText('m-pending-approvals', data.pendingApprovals ?? 0);
    setText('m-pending-incidents', b.activeIncidents ?? 0);

    const spend = c.monthSpendCents ? `$${(c.monthSpendCents / 100).toFixed(2)}` : '$0';
    const budget = c.monthBudgetCents ? `$${(c.monthBudgetCents / 100).toFixed(2)}` : '$0';
    const util = c.monthUtilizationPercent != null ? `${c.monthUtilizationPercent}%` : '0%';
    setText('m-cost-spend', spend);
    setText('m-cost-budget', budget);
    setText('m-cost-util', util);

    // Update station status too
    const statusEl = document.getElementById('station-status');
    if (statusEl) {
      const runs = a.running || 0;
      if (runs > 0) {
        statusEl.textContent = `● ${runs} ACTIVE RUN${runs !== 1 ? 'S' : ''}`;
        statusEl.style.color = 'var(--ph-green)';
      } else if (a.active > 0) {
        statusEl.textContent = '● STANDBY';
        statusEl.style.color = 'var(--ph-amber)';
      } else {
        statusEl.textContent = '● IDLE';
        statusEl.style.color = 'var(--ph-text-dim)';
      }
    }
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ─── CREW RENDER (GAMEPLAY) ────────────────────────────────
  function renderCrew(agentList) {
    const list = document.getElementById('crew-list');
    const empty = document.getElementById('crew-empty');
    if (!list) return;

    if (!agentList || agentList.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }

    if (empty) empty.style.display = 'none';

    list.innerHTML = agentList.map(agent => {
      const status = agent.status || 'idle';
      const name = agent.name || agent.codename || 'Unnamed';
      const role = agent.role || agent.specialty || 'Generalist';
      const avatar = agent.name ? agent.name[0].toUpperCase() : '?';
      return `
        <div class="agent-card ${status}" data-agent-id="${agent.id || ''}">
          <div class="agent-avatar">${avatar}</div>
          <div class="agent-info">
            <div class="agent-name">${escapeHtml(name)}</div>
            <div class="agent-role">${escapeHtml(role)}</div>
          </div>
          <span class="agent-badge ${status}">${status}</span>
        </div>
      `;
    }).join('');

    // Ensure card class matches badge status
    list.querySelectorAll('.agent-card').forEach(card => {
      const badge = card.querySelector('.agent-badge');
      if (badge) {
        const statusText = badge.textContent.trim();
        card.className = `agent-card ${statusText}`;
      }
    });
  }

  // ─── AGENT TABLE (DASHBOARD) ────────────────────────────────
  function renderAgentTable(agentList) {
    const tbody = document.getElementById('agent-tbody');
    if (!tbody) return;

    if (!agentList || agentList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-td">No agents — recruit via WorkforceArchitect in Paperclip</td></tr>';
      return;
    }

    tbody.innerHTML = agentList.map(agent => `
      <tr>
        <td>${escapeHtml(agent.name || agent.codename || '—')}</td>
        <td>${agent.status || 'idle'}</td>
        <td>${escapeHtml(agent.role || agent.specialty || '—')}</td>
        <td>${agent.adapterType || '—'}</td>
        <td>${agent.model || '—'}</td>
        <td>${agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : '—'}</td>
      </tr>
    `).join('');
  }

  // ─── THREE.JS GAMEPLAY ─────────────────────────────────────
  let threeGameplayInitialized = false;

  async function initThreeGameplay() {
    try {
      const THREE = await import('three');
      const { initThreeGameplay: startThree, destroyThreeGameplay } = await import('./three-gameplay.js');
      
      const container = document.getElementById('three-container');
      if (!container) return;
      
      // Clean previous
      if (window.__threeGameplayCleanup) {
        window.__threeGameplayCleanup();
      }
      
      startThree(container, agents);
      window.__threeGameplayCleanup = destroyThreeGameplay;
      threeGameplayInitialized = true;
      
      // Update crew rail for 3d
      updateCrewRail3d(agents);
    } catch (e) {
      console.warn('Three.js gameplay init failed:', e);
    }
  }

  function updateCrewRail3d(agentList) {
    const list = document.getElementById('crew-list-3d');
    const empty = document.getElementById('crew-empty-3d');
    const summary = document.getElementById('crew-summary-3d');
    if (!list) return;

    if (!agentList || agentList.length === 0) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      if (summary) summary.textContent = '0 WORKING / 0 IDLE';
      return;
    }

    if (empty) empty.style.display = 'none';

    const working = agentList.filter(a => {
      const s = (a.status || 'idle').toLowerCase();
      return s === 'working' || s === 'active' || s === 'running';
    }).length;
    const idle = agentList.length - working;
    if (summary) summary.textContent = `${working} WORKING / ${idle} IDLE`;

    list.innerHTML = agentList.map(a => {
      const status = (a.status || 'idle').toLowerCase();
      return `<div class="agent-card ${status}" onclick="window.__selectThreeAgent(\`${a.id || a.codename || ''}\`)">
        <div class="agent-avatar">◆</div>
        <div class="agent-info">
          <div class="agent-name">${escapeHtml(a.name || a.codename || 'Agent')}</div>
          <div class="agent-role">${escapeHtml(a.role || 'Specialist')}</div>
        </div>
        <span class="agent-badge ${status}">${status}</span>
      </div>`;
    }).join('');
  }

  // ─── TOAST ──────────────────────────────────────────────────
  function toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = `◆ ${message}`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  }

  // ─── UTILS ──────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ─── BOOT ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();