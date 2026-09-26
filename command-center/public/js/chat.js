/* ══════════════════════════════════════════════════════════════
   CHAT panel — work intake.
   Paperclip models "talking to an agent" as creating an issue that is
   assigned to that agent and waking it. That is what this panel does.
   ══════════════════════════════════════════════════════════════ */

import { esc, statusClass, designation } from './util.js';
import { api } from './api.js';

let agents = [];
let selectedId = null;
let onToast = () => {};

export function initChat({ toast } = {}) {
  onToast = toast || onToast;

  const filter = document.getElementById('chat-filter');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');

  filter?.addEventListener('input', () => renderRoster());

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await submit();
  });

  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form?.requestSubmit();
    }
  });
}

export function setChatAgents(list) {
  agents = Array.isArray(list) ? list : [];
  // Keep the selection valid across live refreshes.
  if (selectedId && !agents.some((a) => a.id === selectedId)) selectedId = null;
  renderRoster();
  renderTarget();
}

function renderRoster() {
  const host = document.getElementById('chat-roster');
  if (!host) return;
  const q = (document.getElementById('chat-filter')?.value || '').trim().toLowerCase();

  const rows = agents
    .filter((a) => {
      if (!q) return true;
      return `${a.name || ''} ${designation(a)} ${a.metadata?.path || ''}`.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      // Executives first, then alphabetical.
      // Executives first (metadata.level), then alphabetical.
      const rank = (x) => (x.metadata?.level === 'executive' ? 0 : x.metadata?.level === 'board' ? 1 : 2);
      return rank(a) - rank(b) || String(a.name).localeCompare(String(b.name), 'cs');
    });

  if (!rows.length) {
    host.innerHTML = '<div class="empty-note">Žádný agent neodpovídá filtru.</div>';
    return;
  }

  host.innerHTML = rows
    .map(
      (a) => `
      <button class="roster-item${a.id === selectedId ? ' selected' : ''}" data-id="${esc(a.id)}">
        <span class="org-dot ${statusClass(a.status)}"></span>
        <span class="roster-item-body">
          <span class="roster-item-name">${esc(a.name)}</span>
          <span class="roster-item-role">${esc(designation(a))}</span>
        </span>
      </button>`,
    )
    .join('');

  host.querySelectorAll('.roster-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedId = btn.dataset.id;
      renderRoster();
      renderTarget();
    });
  });
}

function renderTarget() {
  const agent = agents.find((a) => a.id === selectedId) || null;
  const to = document.getElementById('chat-to');
  const toRole = document.getElementById('chat-to-role');
  const input = document.getElementById('chat-input');
  const send = document.getElementById('chat-send');
  const wake = document.getElementById('chat-wake');

  if (to) to.textContent = agent ? agent.name : '—';
  if (toRole) {
    toRole.textContent = agent
      ? [agent.metadata?.path || agent.metadata?.deptName, designation(agent)]
          .filter(Boolean)
          .join('  ·  ') || designation(agent)
      : 'Vyber agenta vlevo';
  }
  if (input) input.disabled = !agent;
  if (send) send.disabled = !agent;
  if (wake) wake.disabled = !agent;
}

async function submit() {
  const agent = agents.find((a) => a.id === selectedId);
  const input = document.getElementById('chat-input');
  const text = input?.value?.trim();
  if (!agent || !text) return;

  const wake = document.getElementById('chat-wake')?.checked ?? true;
  const priority = document.getElementById('chat-priority')?.value || 'medium';
  const send = document.getElementById('chat-send');
  if (send) send.disabled = true;

  const log = document.getElementById('chat-log');
  appendMessage(log, { who: 'FOUNDER', text, cls: 'me' });

  const [title, ...rest] = text.split('\n');
  try {
    const result = await api.createWork({
      title: title.slice(0, 200),
      description: text,
      assigneeAgentId: agent.id,
      priority,
      wake,
    });
    appendMessage(log, {
      who: 'SYSTÉM',
      text: `Úkol vytvořen: ${result.issue?.id || '?'} → ${agent.name}${
        wake ? (result.wakeError ? ` (probudit se nepodařilo: ${result.wakeError})` : ' · agent probuzen') : ''
      }`,
      cls: 'ok',
    });
    input.value = '';
    onToast(`Úkol zadán: ${agent.name}`, 'success');
  } catch (err) {
    appendMessage(log, { who: 'CHYBA', text: err.message, cls: 'err' });
    onToast(`Zadání selhalo: ${err.message}`, 'error');
  } finally {
    if (send) send.disabled = false;
  }
}

function appendMessage(log, { who, text, cls = '' }) {
  if (!log) return;
  log.querySelector('.chat-empty')?.remove();
  const node = document.createElement('div');
  node.className = `chat-msg ${cls}`;
  node.innerHTML = `
    <div class="chat-msg-who">${esc(who)}</div>
    <div class="chat-msg-text">${esc(text)}</div>`;
  log.append(node);
  log.scrollTop = log.scrollHeight;
}
