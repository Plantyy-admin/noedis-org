/* ── INBOX panel — NOE REPORT → FOUNDER ────────────────────── */

import { esc, ago, statusClass } from './util.js';

export function renderInbox({ issues = [], approvals = [], activity = [], errors = {} }) {
  renderIssues(issues);
  renderApprovals(approvals);
  renderActivity(activity, errors);
}

function renderIssues(issues) {
  const host = document.getElementById('inbox-issues');
  const count = document.getElementById('inbox-issue-count');
  if (count) count.textContent = String(issues.length);
  if (!host) return;

  if (!issues.length) {
    host.innerHTML = '<div class="empty-note">Žádné reporty ani úkoly.</div>';
    return;
  }

  host.innerHTML = issues
    .map(
      (i) => `
      <div class="inbox-item">
        <div class="inbox-item-top">
          <span class="status-pill ${statusClass(i.status)}">${esc(i.status || '—')}</span>
          <span class="inbox-item-title">${esc(i.title || '(bez názvu)')}</span>
          <span class="inbox-item-age">${esc(ago(i.updatedAt || i.createdAt))}</span>
        </div>
        <div class="inbox-item-meta">
          ${i.priority ? `<span class="tag">${esc(i.priority)}</span>` : ''}
          ${i.assigneeAgentId ? `<span class="tag">agent ${esc(String(i.assigneeAgentId).slice(0, 8))}…</span>` : '<span class="tag dim">nepřiřazeno</span>'}
        </div>
        ${i.description ? `<div class="inbox-item-desc">${esc(String(i.description).slice(0, 400))}</div>` : ''}
      </div>`,
    )
    .join('');
}

function renderApprovals(approvals) {
  const host = document.getElementById('inbox-approvals');
  const count = document.getElementById('inbox-approval-count');
  if (count) count.textContent = String(approvals.length);
  if (!host) return;

  if (!approvals.length) {
    host.innerHTML = '<div class="empty-note">Žádná čekající schválení.</div>';
    return;
  }

  host.innerHTML = approvals
    .map(
      (a) => `
      <div class="inbox-item">
        <div class="inbox-item-top">
          <span class="status-pill ${statusClass(a.status)}">${esc(a.status || 'pending')}</span>
          <span class="inbox-item-title">${esc(a.title || a.kind || a.type || 'Schválení')}</span>
          <span class="inbox-item-age">${esc(ago(a.createdAt))}</span>
        </div>
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
