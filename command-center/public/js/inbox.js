/* ══════════════════════════════════════════════════════════════
   INBOX — §5.2 of the summary:

     "Reporty od RENE → NOE → Founder. Pouze DONE/DECISION/RISK/RELEASE"

   Every incoming item is classified into exactly one of those four
   categories. Anything else is deliberately not shown.
   ══════════════════════════════════════════════════════════════ */

import { esc, ago, statusClass } from './util.js';

const CATEGORIES = [
  { key: 'done', title: 'DONE', hint: 'Dokončená práce' },
  { key: 'decision', title: 'DECISION', hint: 'Čeká na rozhodnutí Foundera' },
  { key: 'risk', title: 'RISK', hint: 'Blokace, chyby, incidenty' },
  { key: 'release', title: 'RELEASE', hint: 'Nasazení a verze' },
];

const RELEASE_RE = /release|deploy|nasazen|verze|version|rollout|publish/i;

/** Sort one incoming item into a category, or null to drop it. */
function classify(item) {
  const status = String(item.status || '').toLowerCase();

  if (item.kind === 'approval') return 'decision';
  if (status === 'done') return 'done';
  if (status === 'blocked' || item.kind === 'agent-error') return 'risk';
  if (status === 'cancelled') return null;             // withdrawn — not a report
  if (status === 'backlog') return null;               // not yet work
  if (RELEASE_RE.test(`${item.title || ''} ${item.description || ''}`)) return 'release';
  if (status === 'in_review') return 'decision';
  return null;
}

export function renderInbox({ issues = [], approvals = [], agents = [], activity = [], errors = {} }) {
  const items = [
    ...issues.map((i) => ({ ...i, kind: 'issue' })),
    ...approvals.map((a) => ({ ...a, kind: 'approval', title: a.title || a.kind || a.type || 'Schválení' })),
    ...agents
      .filter((a) => String(a.status).toLowerCase() === 'error')
      .map((a) => ({
        kind: 'agent-error',
        id: `agent-${a.id}`,
        title: `${a.name} — chyba agenta`,
        description: a.errorReason || '',
        status: 'blocked',
        updatedAt: a.updatedAt,
      })),
  ];

  const buckets = { done: [], decision: [], risk: [], release: [] };
  for (const item of items) {
    const cat = classify(item);
    if (cat && buckets[cat]) buckets[cat].push(item);
  }

  for (const { key } of CATEGORIES) {
    renderCategory(key, buckets[key]);
  }
  renderActivity(activity, errors);
  return { counts: Object.fromEntries(CATEGORIES.map((c) => [c.key, buckets[c.key].length])) };
}

function renderCategory(key, list) {
  const host = document.getElementById(`inbox-${key}`);
  const count = document.getElementById(`inbox-${key}-count`);
  if (count) count.textContent = String(list.length);
  if (!host) return;

  if (!list.length) {
    host.innerHTML = '<div class="empty-note">Nic k reportování.</div>';
    return;
  }

  host.innerHTML = list
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
    .map(
      (i) => `
      <div class="inbox-item">
        <div class="inbox-item-top">
          <span class="status-pill ${statusClass(i.status)}">${esc(i.status || i.kind)}</span>
          <span class="inbox-item-title">${esc(i.title || '(bez názvu)')}</span>
          <span class="inbox-item-age">${esc(ago(i.updatedAt || i.createdAt))}</span>
        </div>
        ${i.description ? `<div class="inbox-item-desc">${esc(String(i.description).slice(0, 300))}</div>` : ''}
      </div>`,
    )
    .join('');
}

function renderActivity(activity, errors) {
  const host = document.getElementById('inbox-activity');
  if (!host) return;

  if (errors?.activity) {
    host.innerHTML = `<div class="empty-note error">Nepodařilo se načíst aktivitu: ${esc(errors.activity)}</div>`;
    return;
  }
  if (!activity.length) {
    host.innerHTML = '<div class="empty-note">Žádná aktivita.</div>';
    return;
  }

  host.innerHTML = activity
    .map(
      (e) => `
      <div class="act-row">
        <span class="act-age">${esc(ago(e.createdAt))}</span>
        <span class="act-action">${esc(e.action || '—')}</span>
        <span class="act-actor">${esc(e.actorType || '')}${e.agentId ? ` · agent ${esc(String(e.agentId).slice(0, 8))}…` : ''}</span>
        <span class="act-entity">${esc(e.entityType || '')}</span>
      </div>`,
    )
    .join('');
}
