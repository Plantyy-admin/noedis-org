/* ── tiny DOM + format helpers ─────────────────────────────── */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : String(v));
  }
  for (const child of [children].flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = value ?? '—';
}

export function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' });
}

export function ago(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Normalise a Paperclip agent status into one of our visual classes. */
export function statusClass(status) {
  const s = String(status || 'idle').toLowerCase();
  if (s === 'running' || s === 'active' || s === 'working' || s === 'in_progress') return 'running';
  if (s === 'paused') return 'paused';
  if (s === 'error' || s === 'failed' || s === 'terminated') return 'error';
  return 'idle';
}

export function debounce(fn, ms = 150) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Human-readable designation for an agent.
 *  Paperclip's `role` column is a fixed enum, so the meaningful labels are
 *  `title` and the org path we keep in `metadata`. */
export function designation(agent) {
  if (!agent) return '';
  return agent.title || agent.metadata?.path || agent.metadata?.team || agent.name || '';
}
