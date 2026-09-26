/* ══════════════════════════════════════════════════════════════
   GAMEPLAY panel — §5.2 of the summary.

   "Izometrická pixel-art stanice s 10 patry
    (NOE → CODY → RENE → VÝVOJ → INFRA → IT → MARKETING → LEGAL →
     FINANCE → LABS). Agent dots s glow efektem, starfield pozadí, 60fps."

   Ten floors, top to bottom. Each floor is an isometric slab; the agents
   that belong to it sit on the front edge with a status glow.
   ══════════════════════════════════════════════════════════════ */

import { statusClass, esc } from './util.js';

let canvas = null;
let ctx = null;
let raf = null;
let model = null;
let t = 0;
let stars = [];
let starsFor = { w: 0, h: 0 };

const GLOW = {
  running: '#00ff88',
  paused: '#ffb000',
  error: '#ff3355',
  idle: '#555577',
};

/* The ten floors, in the summary's order. */
const FLOOR_PLAN = [
  { key: 'noe', label: 'NOE', kind: 'exec', color: '#ffb000' },
  { key: 'cody', label: 'CODY', kind: 'exec', color: '#00ccff' },
  { key: 'rene', label: 'RENE', kind: 'exec', color: '#bb66ff' },
  { key: 'vyvoj', label: 'VÝVOJ', kind: 'dept' },
  { key: 'infra', label: 'INFRA', kind: 'dept' },
  { key: 'it', label: 'IT', kind: 'dept' },
  { key: 'marketing', label: 'MARKETING', kind: 'dept' },
  { key: 'legal', label: 'LEGAL', kind: 'dept' },
  { key: 'finance', label: 'FINANCE', kind: 'dept' },
  { key: 'labs', label: 'LABS', kind: 'dept' },
];

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
  starsFor = { w: 0, h: 0 };
}

/* ── starfield ───────────────────────────────────────────────── */

function ensureStars(w, h) {
  if (starsFor.w === w && starsFor.h === h && stars.length) return;
  const count = Math.round((w * h) / 5200);
  stars = Array.from({ length: count }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() < 0.85 ? 1 : 2,
    a: 0.18 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 1.4,
  }));
  starsFor = { w, h };
}

function drawStarfield(w, h) {
  ensureStars(w, h);
  for (const s of stars) {
    const twinkle = 0.65 + 0.35 * Math.sin(t * s.speed + s.phase);
    ctx.globalAlpha = s.a * twinkle;
    ctx.fillStyle = '#cdd6ff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

/* ── floors ──────────────────────────────────────────────────── */

function floorRoster(plan) {
  if (!model) return [];
  if (plan.kind === 'exec') {
    return model.executive
      .filter((e) => e.key === plan.key)
      .map((e) => ({ name: e.name, status: e.status, role: e.interface || '', level: 'executive' }));
  }
  const dept = model.departments.find((d) => d.key === plan.key);
  if (!dept) return [];
  const out = [];
  if (dept.headAgent) {
    out.push({
      name: dept.headAgent.name,
      status: dept.headAgent.status,
      role: dept.headTitle || 'Vedoucí oddělení',
      level: 'head',
    });
  }
  for (const div of dept.divisions) {
    for (const team of div.teams) {
      for (const m of team.members) {
        if (dept.headAgent && m.id === dept.headAgent.id) continue;
        out.push({ name: m.name, status: m.status, role: `${div.name} / ${team.name}`, level: 'specialist' });
      }
    }
  }
  return out;
}

function loop() {
  if (!ctx || !canvas) return;
  const w = canvas.width / (window.devicePixelRatio || 1);
  const h = canvas.height / (window.devicePixelRatio || 1);
  t += 1 / 60;

  ctx.fillStyle = '#07070f';
  ctx.fillRect(0, 0, w, h);
  drawStarfield(w, h);

  const floorCount = FLOOR_PLAN.length;
  const slabW = Math.min(w * 0.46, 520);
  // Depth is kept shallow on purpose: the front-to-back vertical extent must
  // stay under the floor height, otherwise upper slabs hide the agents below.
  const slabD = slabW * 0.26;
  const tw = slabW;
  const th = tw;
  const fh = Math.min((h * 0.82) / floorCount, 58);

  const originX = w / 2 - slabW * 0.20;
  const originY = h * 0.5 + (floorCount * fh) / 2 - fh * 2.4;

  const iso = (x, y, z) => ({
    X: originX + ((x - y) / slabW) * (tw / 2),
    Y: originY + ((x + y) / slabW) * (th / 4) - z * fh,
  });

  for (let i = 0; i < floorCount; i++) {
    const plan = FLOOR_PLAN[i];
    const dept = plan.kind === 'dept' ? model?.departments.find((d) => d.key === plan.key) : null;
    const color = plan.color || dept?.color || '#00ccff';
    drawSlab(iso, slabW, slabD, floorCount - 1 - i, color, plan, dept);
  }

  raf = requestAnimationFrame(loop);
}

function drawSlab(iso, W, D, z, color, plan, dept) {
  const a = iso(0, 0, z);
  const b = iso(W, 0, z);
  const c = iso(W, D, z);
  const d = iso(0, D, z);
  const drop = 12;

  ctx.fillStyle = shade(color, 0.17);
  ctx.beginPath();
  ctx.moveTo(a.X, a.Y); ctx.lineTo(d.X, d.Y); ctx.lineTo(d.X, d.Y + drop); ctx.lineTo(a.X, a.Y + drop);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = shade(color, 0.10);
  ctx.beginPath();
  ctx.moveTo(d.X, d.Y); ctx.lineTo(c.X, c.Y); ctx.lineTo(c.X, c.Y + drop); ctx.lineTo(d.X, d.Y + drop);
  ctx.closePath(); ctx.fill();

  ctx.fillStyle = shade(color, 0.32);
  ctx.beginPath();
  ctx.moveTo(a.X, a.Y); ctx.lineTo(b.X, b.Y); ctx.lineTo(c.X, c.Y); ctx.lineTo(d.X, d.Y);
  ctx.closePath(); ctx.fill();

  ctx.strokeStyle = withAlpha(color, 0.85);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = withAlpha(color, 0.95);
  ctx.font = '16px "VT323", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(plan.label, d.X - 14, d.Y + 4);

  if (dept) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillText(`${dept.divisions.length} divize · ${dept.agentCount} agentů`, d.X - 14, d.Y + 19);
  }

  const roster = floorRoster(plan);
  if (!roster.length) return;

  // Spread the dots across the visible top face, two staggered rows so a busy
  // department stays readable.
  const perRow = Math.min(roster.length, 6);
  const rows = Math.ceil(roster.length / perRow);
  roster.forEach((agent, i) => {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const inRow = Math.min(perRow, roster.length - row * perRow);
    const u = (col + 1) / (inRow + 1);
    const v = rows === 1 ? 0.55 : 0.34 + (row / Math.max(1, rows - 1)) * 0.42;
    const p = iso(u * W, v * D, z);
    drawAgentDot(p.X, p.Y, agent, i, color);
  });
}

function drawAgentDot(x, y, agent, i, floorColor) {
  const cls = statusClass(agent.status);
  const color = GLOW[cls] || GLOW.idle;
  const running = cls === 'running';
  const lead = agent.level === 'head' || agent.level === 'executive';
  const r = (lead ? 5 : 4) + (running ? Math.sin(t * 3.2 + i) * 1.4 : 0);

  // glow — the "agent dots s glow efektem" of §5.2
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 6);
  grad.addColorStop(0, withAlpha(color, running ? 0.6 : 0.35));
  grad.addColorStop(0.5, withAlpha(color, running ? 0.22 : 0.12));
  grad.addColorStop(1, withAlpha(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r * 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  if (lead) {
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.strokeStyle = withAlpha(floorColor, 0.95);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - r - 1.5, y - r - 1.5, r * 2 + 3, r * 2 + 3);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // dark core ring keeps the dot readable on a bright floor
  ctx.strokeStyle = 'rgba(6,6,14,0.85)';
  ctx.lineWidth = 1.4;
  if (lead) {
    ctx.strokeRect(x - r - 2.2, y - r - 2.2, r * 2 + 4.4, r * 2 + 4.4);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, r + 1.4, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function parse(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function shade(hex, amount) {
  const [r, g, b] = parse(hex);
  return `rgb(${Math.round(r * amount)},${Math.round(g * amount)},${Math.round(b * amount)})`;
}
function withAlpha(hex, alpha) {
  const [r, g, b] = parse(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── crew rail ───────────────────────────────────────────────── */

function renderCrew() {
  const host = document.getElementById('crew-list');
  const summary = document.getElementById('crew-summary');
  if (!host) return;

  const agents = model?.agents || [];
  const working = agents.filter((a) =>
    ['running', 'active', 'working'].includes(String(a.status).toLowerCase())).length;
  if (summary) summary.textContent = `${working} / ${agents.length}`;

  if (!agents.length) {
    host.innerHTML = '<div class="empty-note">Žádní agenti.</div>';
    return;
  }

  host.innerHTML = FLOOR_PLAN.map((plan) => {
    const roster = floorRoster(plan);
    if (!roster.length) return '';
    const dept = plan.kind === 'dept' ? model?.departments.find((d) => d.key === plan.key) : null;
    const color = plan.color || dept?.color || '#00ccff';
    return `
      <div class="crew-floor">
        <div class="crew-floor-head" style="--c:${esc(color)}">
          <span class="crew-floor-name">${esc(plan.label)}</span>
          <span class="crew-floor-count">${roster.length}</span>
        </div>
        ${roster.map((a) => `
          <div class="agent-card ${statusClass(a.status)}">
            <div class="agent-avatar">${esc((a.name || '?')[0].toUpperCase())}</div>
            <div class="agent-info">
              <div class="agent-name">${esc(a.name)}</div>
              <div class="agent-role">${esc(a.role || '')}</div>
            </div>
            <span class="agent-badge ${statusClass(a.status)}">${esc(a.status || 'idle')}</span>
          </div>`).join('')}
      </div>`;
  }).join('');
}

function updateStationStatus() {
  const el = document.getElementById('station-status');
  if (!el) return;
  const agents = model?.agents || [];
  const running = agents.filter((a) =>
    ['running', 'active', 'working'].includes(String(a.status).toLowerCase())).length;
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
