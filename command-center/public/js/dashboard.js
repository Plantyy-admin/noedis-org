/* ── DASHBOARD panel ───────────────────────────────────────── */

import { setText, statusClass, esc, fmtDate, designation } from './util.js';

export function renderDashboard(model, dashboard, company) {
  if (dashboard) {
    const a = dashboard.agents || {};
    const t = dashboard.tasks || {};
    const c = dashboard.costs || {};
    const b = dashboard.budgets || {};

    setText('m-agents-active', a.active ?? model.agents.length);
    setText('m-agents-running', a.running ?? 0);
    setText('m-agents-paused', a.paused ?? 0);
    setText('m-agents-error', a.error ?? 0);

    setText('m-tasks-open', t.open ?? 0);
    setText('m-tasks-progress', t.inProgress ?? 0);
    setText('m-tasks-blocked', t.blocked ?? 0);
    setText('m-tasks-done', t.done ?? 0);

    setText('m-cost-spend', `$${((c.monthSpendCents || 0) / 100).toFixed(2)}`);
    setText('m-cost-budget', `$${((c.monthBudgetCents || 0) / 100).toFixed(2)}`);
    setText('m-cost-util', `${c.monthUtilizationPercent ?? 0}%`);

    setText('m-pending-approvals', dashboard.pendingApprovals ?? 0);
    setText('m-pending-incidents', b.activeIncidents ?? 0);
  }

  if (company) {
    setText('dash-company-id', company.id ? `${company.id.slice(0, 8)}…` : '—');
    setText('dash-company-status', company.status || '—');
    setText('dash-company-prefix', company.issuePrefix || '—');
    setText('dash-company-created', fmtDate(company.createdAt));
  }

  renderRuntime(model);
  renderRoster(model);
}

function renderRuntime(model) {
  const rt = model.runtime || {};
  const adapters = Object.keys(model.adapterCounts || {});
  setText('rt-adapter', adapters.length ? adapters.join(', ') : '—');
  setText('rt-provider', rt.provider || '—');
  setText('rt-model', rt.model || '—');
  setText('rt-credential', rt.credential || '—');

  const driftEl = document.getElementById('rt-drift');
  if (driftEl) {
    driftEl.textContent = model.drift.length === 0
      ? `OK — všech ${model.agents.length} agentů na pi_local`
      : `${model.drift.length} agentů mimo invariant`;
    driftEl.classList.toggle('warn', model.drift.length > 0);
    if (model.drift.length) {
      driftEl.title = model.drift
        .map((d) => `${d.name}: ${d.adapterType} / ${d.provider}`)
        .join('\n');
    } else {
      driftEl.title = '';
    }
  }
}

function renderRoster(model) {
  const tbody = document.getElementById('agent-tbody');
  if (!tbody) return;

  if (!model.agents.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-td">Žádní agenti — Paperclip nevrátil data</td></tr>';
    return;
  }

  const rows = [...model.agents].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'cs'),
  );

  tbody.innerHTML = rows
    .map(
      (a) => `
      <tr>
        <td class="roster-name">${esc(a.name || '—')}</td>
        <td><span class="status-pill ${statusClass(a.status)}">${esc(a.status || 'idle')}</span></td>
        <td class="roster-role">${esc(designation(a) || '—')}</td>
        <td class="roster-unit">${esc(a.metadata?.path || '—')}</td>
        <td><code>${esc(a.adapterType || '—')}</code></td>
        <td><code>${esc(a.adapterConfig?.model || '—')}</code></td>
      </tr>`,
    )
    .join('');
}
