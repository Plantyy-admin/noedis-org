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
    setupCanvas();
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
        initCanvas();
      }
      if (name === 'dashboard') {
        // Dashboard is already live-updated via polling + WebSocket
      }
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

  // ─── CANVAS RENDERER (GAMEPLAY) ────────────────────────────
  let canvas = null;
  let ctx = null;
  let animationId = null;
  let agentsOnMap = [];
  let mapTime = 0;

  function setupCanvas() {
    canvas = document.getElementById('station-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    window.addEventListener('resize', () => {
      if (document.getElementById('view-gameplay').classList.contains('active')) {
        resizeCanvas();
      }
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function resetCanvasTransform() {
    if (!ctx) return;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function initCanvas() {
    if (!canvas || !ctx) return;
    resizeCanvas();
    if (animationId) cancelAnimationFrame(animationId);
    mapTime = 0;
    renderLoop();
  }

  // ─── STARNET-INSPIRED PIXEL-ART STATION ────────────────────
  // Draws a top-down pixel station with rooms, corridors, and agent avatars
  function renderLoop() {
    if (!ctx || !canvas) return;
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;

    mapTime += 0.016; // ~60fps step

    // Clear
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, w, h);

    // Grid floor
    ctx.strokeStyle = '#12122a';
    ctx.lineWidth = 1;
    const gridSize = 48;
    for (let x = 0; x <= w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Draw station rooms
    const cx = w / 2;
    const cy = h / 2;

    // Main Hub (center) - NOE COMMAND
    drawRoom(ctx, cx - 40, cy - 40, 80, 80, '#ffb00018', '#ffb00044', 'NOE COMMAND');

    // Department rooms radiating out
    const rooms = [
      { x: cx - 160, y: cy - 40, w: 80, h: 80, label: 'USER', color: '#00ff8833', border: '#00ff8866' },
      { x: cx + 80, y: cy - 40, w: 80, h: 80, label: 'TECHNOLOGY', color: '#00ccff33', border: '#00ccff66' },
      { x: cx - 40, y: cy - 160, w: 80, h: 80, label: 'GAME & ECONOMY', color: '#bb66ff33', border: '#bb66ff66', font: '11px' },
      { x: cx - 40, y: cy + 80, w: 80, h: 80, label: 'CREATIVE', color: '#ff335533', border: '#ff335566' },
      { x: cx - 160, y: cy - 130, w: 60, h: 60, label: 'MARKETING', color: '#ffb00022', border: '#ffb00055', font: '11px' },
      { x: cx + 100, y: cy + 80, w: 60, h: 60, label: 'FINANCE', color: '#00ff8822', border: '#00ff8855' },
      { x: cx + 100, y: cy - 130, w: 60, h: 60, label: 'LEGAL', color: '#55557733', border: '#55557766' },
      { x: cx - 160, y: cy + 80, w: 60, h: 60, label: 'QA', color: '#00ccff22', border: '#00ccff55' },
    ];

    // Corridors (connecting lines)
    ctx.strokeStyle = '#1a1a3a';
    ctx.lineWidth = 8;
    ctx.setLineDash([8, 8]);
    for (const room of rooms) {
      const fromX = cx;
      const fromY = cy;
      const toX = room.x + room.w / 2;
      const toY = room.y + room.h / 2;
      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw pulsing data lines on corridors when agents are running
    if (agents.some(a => a.status === 'running' || a.status === 'active')) {
      ctx.strokeStyle = '#00ff8844';
      ctx.lineWidth = 2;
      const t = mapTime * 0.5;
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        const fromX = cx;
        const fromY = cy;
        const toX = room.x + room.w / 2;
        const toY = room.y + room.h / 2;
        const progress = ((t + i * 0.3) % rooms.length) / rooms.length;
        const px = fromX + (toX - fromX) * progress;
        const py = fromY + (toY - fromY) * progress;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw rooms
    for (const room of rooms) {
      drawRoom(ctx, room.x, room.y, room.w, room.h, room.color, room.border, room.label, room.font);
    }

    // Draw NOE REPORT satellite
    drawRoom(ctx, cx + 80, cy + 160, 60, 40, '#00ff8822', '#00ff8844', 'NOE REPORT', '10px');

    // Draw Workforce Architect terminal
    drawRoom(ctx, cx - 80, cy + 160, 60, 40, '#bb66ff22', '#bb66ff44', 'WF ARCHITECT', '10px');

    // Draw agent dots on the map
    const agentPositions = getAgentPositions(rooms, cx, cy);
    agentPositions.forEach((pos, i) => {
      const status = agents[i]?.status || 'idle';
      const color = status === 'running' ? '#00ff88' :
                     status === 'paused' ? '#ffb000' :
                     status === 'error' ? '#ff3355' : '#555577';
      const pulse = status === 'running' ? Math.sin(mapTime * 3 + i) * 2 + 4 : 3;

      // Glow
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, pulse * 4);
      gradient.addColorStop(0, color + '88');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pulse * 4, 0, Math.PI * 2);
      ctx.fill();

      // Dot
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, pulse, 0, Math.PI * 2);
      ctx.fill();

      // Label
      if (agents[i]) {
        ctx.fillStyle = '#c8c8d4';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(agents[i].name || agents[i].codename || '', pos.x, pos.y - 12);
      }
    });

    animationId = requestAnimationFrame(renderLoop);
  }

  function hexAlpha(hex, newAlpha) {
    // Replace the last 2 hex chars (alpha) with a new value
    return hex.slice(0, -2) + newAlpha;
  }

  function drawRoom(ctx, x, y, w, h, fillColor, strokeColor, label, fontSize) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Terminal scan line effect (dim alpha)
    ctx.fillStyle = hexAlpha(strokeColor, '08');
    ctx.fillRect(x + 4, y + 4, w - 8, 1);

    // Label (bright alpha)
    ctx.fillStyle = hexAlpha(strokeColor, 'cc');
    ctx.font = fontSize || '12px "VT323", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  function getAgentPositions(rooms, cx, cy) {
    // Position agents around the map based on their role
    const positions = [];
    const rolePositions = [
      { x: cx - 160, y: cy - 100, label: 'tech' },     // Technology
      { x: cx + 120, y: cy - 30, label: 'game' },      // Game
      { x: cx - 140, y: cy + 60, label: 'creative' },  // Creative
      { x: cx - 80, y: cy - 140, label: 'market' },     // Marketing
      { x: cx + 30, y: cy + 60, label: 'finance' },     // Finance
      { x: cx + 120, y: cy + 60, label: 'legal' },      // Legal
      { x: cx - 80, y: cy + 130, label: 'qa' },         // QA
      { x: cx + 20, y: cy - 110, label: 'user' },       // User
      { x: cx + 160, y: cy - 100, label: 'labs' },      // Labs
    ];

    agents.forEach((agent, i) => {
      const pos = rolePositions[i % rolePositions.length];
      positions.push({
        x: pos.x + (i > 0 ? (i % 3) * 15 - 15 : 0),
        y: pos.y + (Math.floor(i / 3) * 15),
      });
    });

    if (positions.length === 0) {
      positions.push({ x: cx, y: cy });
    }

    return positions;
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