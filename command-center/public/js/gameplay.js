/* ══════════════════════════════════════════════════════════════
   GAMEPLAY panel — isometric-ish station map driven by the real org.
   Rooms are the nine departments; dots are live agents.
   ══════════════════════════════════════════════════════════════ */

import { statusClass, esc, designation } from './util.js';

let canvas = null;
let ctx = null;
let raf = null;
let model = null;
let t = 0;

const COLORS = {
  running: '#00ff88',
  paused: '#ffb000',
  error: '#ff3355',
  idle: '#555577',
};

export function initGameplay() {
  canvas = document.getElementById('station-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  window.addEventListener('resize', () => {
    if (document.getElementById('view-gameplay')?.classList.contains('active')) resize();
  });
}

export function setGameplayModel(nextModel) {
  model = nextModel;
  renderCrew();
  updateStationStatus();
}

export function startGameplay() {
  if (!canvas || !ctx) return;
  resize();
  if (raf) cancelAnimationFrame(raf);
  t = 0;
  loop();
}

export function stopGameplay() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
}

function resize() {
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, rect.width * dpr);
  canvas.height = Math.max(1, rect.height * dpr);
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** Grid of department rooms laid out around a central command hub. */
function layout(w, h) {
  const depts = model?.departments || [];
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.max(150, Math.min(w, h) * 0.34);
  const hub = { x: cx - 70, y: cy - 34, w: 140, h: 68, label: 'NOE COMMAND', color: '#ffb000' };

  const rooms = depts.map((d, i) => {
    const angle = (i / Math.max(1, depts.length)) * Math.PI * 2 - Math.PI / 2;
    const rw = 150;
    const rh = 66;
    return {
      x: cx + Math.cos(angle) * radius - rw / 2,
      y: cy + Math.sin(angle) * radius - rh / 2,
      w: rw,
      h: rh,
      label: d.name,
      color: d.color || '#00ccff',
      dept: d,
      angle,
    };
  });

  return { hub, rooms, cx, cy };
}

function loop() {
  if (!ctx || !canvas) return;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  t += 0.016;

  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, w, h);

  // grid
  ctx.strokeStyle = '#12122a';
  ctx.lineWidth = 1;
  const g = 48;
  for (let x = 0; x <= w; x += g) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }
  for (let y = 0; y <= h; y += g) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const { hub, rooms, cx, cy } = layout(w, h);

  // corridors
  ctx.setLineDash([6, 8]);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#1a1a3a';
  for (const room of rooms) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(room.x + room.w / 2, room.y + room.h / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // traffic pulses when anything is running
  const running = (model?.agents || []).some((a) => ['running', 'active', 'working'].includes(String(a.status).toLowerCase()));
  if (running) {
    ctx.fillStyle = '#00ff8899';
    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const p = ((t * 0.35 + i * 0.11) % 1);
      const px = cx + (room.x + room.w / 2 - cx) * p;
      const py = cy + (room.y + room.h / 2 - cy) * p;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRoom(hub.x, hub.y, hub.w, hub.h, '#ffb000', hub.label, 0, null);

  for (const room of rooms) {
    const statuses = collectStatuses(room.dept);
    drawRoom(room.x, room.y, room.w, room.h, room.color, room.label, statuses.length, statuses);
  }

  raf = requestAnimationFrame(loop);
}

function collectStatuses(dept) {
  const out = [];
  for (const v of dept.divisions) {
    for (const tm of v.teams) {
      for (const m of tm.members) out.push(statusClass(m.status));
    }
  }
  return out;
}

function drawRoom(x, y, w, h, color, label, dotCount, statuses) {
  ctx.fillStyle = `${color}14`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = `${color}66`;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = `${color}09`;
  ctx.fillRect(x + 4, y + 4, w - 8, 1);

  ctx.fillStyle = `${color}dd`;
  ctx.font = '13px "VT323", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 - 6);

  if (dotCount > 0) {
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#777799';
    ctx.fillText(`${dotCount} agentů`, x + w / 2, y + h / 2 + 12);
  }

  // status dots along the bottom edge
  const list = statuses || [];
  const gap = 9;
  const startX = x + w / 2 - ((list.length - 1) * gap) / 2;
  list.forEach((s, i) => {
    const px = startX + i * gap;
    const py = y + h - 7;
    const c = COLORS[s] || COLORS.idle;
    const pulse = s === 'running' ? Math.sin(t * 3 + i) * 1.5 + 3 : 2.2;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(px, py, pulse, 0, Math.PI * 2);
    ctx.fill();
  });
}

function renderCrew() {
  const host = document.getElementById('crew-list');
  const summary = document.getElementById('crew-summary');
  if (!host) return;

  const agents = model?.agents || [];
  const working = agents.filter((a) => ['running', 'active', 'working'].includes(String(a.status).toLowerCase())).length;
  if (summary) summary.textContent = `${working} / ${agents.length}`;

  if (!agents.length) {
    host.innerHTML = '<div class="empty-note">Žádní agenti.</div>';
    return;
  }

  host.innerHTML = agents
    .map(
      (a) => `
      <div class="agent-card ${statusClass(a.status)}">
        <div class="agent-avatar">${esc((a.name || '?')[0].toUpperCase())}</div>
        <div class="agent-info">
          <div class="agent-name">${esc(a.name)}</div>
          <div class="agent-role">${esc(designation(a))}</div>
        </div>
        <span class="agent-badge ${statusClass(a.status)}">${esc(a.status || 'idle')}</span>
      </div>`,
    )
    .join('');
}

function updateStationStatus() {
  const el = document.getElementById('station-status');
  if (!el) return;
  const agents = model?.agents || [];
  const running = agents.filter((a) => ['running', 'active', 'working'].includes(String(a.status).toLowerCase())).length;
  const errored = agents.filter((a) => String(a.status).toLowerCase() === 'error').length;
  if (errored) {
    el.textContent = `● ${errored} ERROR`;
    el.style.color = 'var(--ph-red)';
  } else if (running) {
    el.textContent = `● ${running} ACTIVE`;
    el.style.color = 'var(--ph-green)';
  } else {
    el.textContent = '● STANDBY';
    el.style.color = 'var(--ph-amber)';
  }
}
