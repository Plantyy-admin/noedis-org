/* ══════════════════════════════════════════════════════════════
   STRUCTURE panel — Org + jednotky společnosti
   ══════════════════════════════════════════════════════════════ */

import { esc, statusClass, setText, designation } from './util.js';

/* Expansion state survives live re-renders. */
const expanded = new Set();
let expandMode = 'default'; // 'default' | 'all' | 'none'
let searchQuery = '';

export function setStructureSearch(q) {
  searchQuery = String(q || '').trim().toLowerCase();
}
export function getStructureSearch() {
  return searchQuery;
}
export function setExpandMode(mode) {
  expandMode = mode;
}
export function toggleNode(key, fallbackOpen) {
  if (expanded.has(key)) expanded.delete(key);
  else expanded.add(key);
  // Remember an explicit choice against the current default.
  explicit.set(key, expanded.has(key));
  return expanded.has(key);
}
const explicit = new Map();

function isOpen(key, defaultOpen) {
  if (explicit.has(key)) return explicit.get(key);
  if (expandMode === 'all') return true;
  if (expandMode === 'none') return false;
  return defaultOpen;
}

/* ── search matching ─────────────────────────────────────────── */

function matches(...fields) {
  if (!searchQuery) return false;
  return fields.some((f) => String(f || '').toLowerCase().includes(searchQuery));
}

/* ── header counters ─────────────────────────────────────────── */

export function renderStructureChrome(model) {
  setText('struct-source', `· MASTER ${model.blueprintVersion}`);
  const c = model.counts;
  const meta = document.getElementById('struct-meta');
  if (!meta) return;
  meta.innerHTML = [
    ['Departmenty', c.departments],
    ['Divize', c.divisions],
    ['Týmy', c.teams],
    ['Agenti', c.agents],
    ['Obsazené týmy', `${c.staffedTeams}/${c.teams}`],
    ['Volná místa', c.vacancies],
  ]
    .map(([label, value]) => `<span>${esc(label)} <strong>${esc(value)}</strong></span>`)
    .join('');
}

/* ── ORG — vedení společnosti ────────────────────────────────── */

export function renderOrg(model) {
  const host = document.getElementById('org-tree');
  if (!host) return;

  const exec = model.executive;
  const noe = exec.find((e) => e.key === 'noe');
  const rest = exec.filter((e) => e.key !== 'noe');
  const boards = model.departments.map((d) => ({
    name: d.board,
    dept: d.name,
    color: d.color,
    icon: d.icon,
    agent: d.boardAgent,
  }));

  const card = (title, sub, status, cls, color) => `
    <div class="org-card ${cls}"${color ? ` style="--c:${esc(color)}"` : ''}>
      <span class="org-dot ${statusClass(status)}"></span>
      <div class="org-card-body">
        <div class="org-card-title">${esc(title)}</div>
        ${sub ? `<div class="org-card-sub">${esc(sub)}</div>` : ''}
      </div>
    </div>`;

  host.innerHTML = `
    <div class="org-flow">
      <div class="org-level">
        ${card('FOUNDER / HUMAN BOARD', 'jediné místo, kam vstupuje lidské zadání', 'idle', 'founder')}
      </div>

      <div class="org-connector"><span class="org-vline"></span></div>

      <div class="org-level">
        ${noe
          ? card(`${noe.name} — ${noe.interface || 'NOE COMMAND'}`, noe.title || noe.role, noe.status, 'exec-primary')
          : card('NOE — NOE COMMAND', 'agent chybí v Paperclipu', 'error', 'exec-primary missing')}
      </div>

      <div class="org-connector"><span class="org-vline"></span></div>

      <div class="org-level org-level-row">
        ${rest
          .map((e) =>
            card(
              `${e.name} — ${e.interface || ''}`.trim(),
              e.title || e.role,
              e.status,
              'exec',
            ),
          )
          .join('')}
      </div>

      <div class="org-connector"><span class="org-vline"></span><span class="org-hline"></span></div>

      <div class="org-boards-label">DEPARTMENT BOARDS · 9</div>
      <div class="org-boards">
        ${boards
          .map((b) => `
            <div class="org-board${b.agent ? '' : ' missing'}" style="--c:${esc(b.color)}">
              <div class="org-board-top">
                <span class="org-dot ${statusClass(b.agent?.status)}"></span>
                <span class="org-board-name">${esc(b.dept)}</span>
              </div>
              <div class="org-board-agent">${esc(b.agent?.name || b.name)}</div>
            </div>`)
          .join('')}
      </div>
    </div>

    ${model.unassigned.length ? `
      <div class="org-unassigned">
        <div class="org-unassigned-head">
          ⚠ ${model.unassigned.length} agent(ů) mimo blueprint — nejsou přiřazeni k žádné jednotce
        </div>
        <div class="org-unassigned-list">
          ${model.unassigned
            .map((a) => `<span class="chip"><span class="org-dot ${statusClass(a.status)}"></span>${esc(a.name)}</span>`)
            .join('')}
        </div>
      </div>` : ''}
  `;
}

/* ── JEDNOTKY SPOLEČNOSTI ────────────────────────────────────── */

export function renderUnits(model) {
  const host = document.getElementById('units-tree');
  if (!host) return;

  const deptBlocks = model.departments.map((dept) => renderDepartment(dept)).join('');

  const unmatchedSection = model.unassigned.length
    ? `
      <div class="unit-dept unassigned">
        <div class="unit-dept-head static">
          <span class="unit-dept-icon" style="--c:#ff3355">⚠</span>
          <span class="unit-dept-name">NEPŘIŘAZENO</span>
          <span class="unit-dept-purpose">Agenti, které blueprint nezná</span>
          <span class="unit-dept-badge">${model.unassigned.length} agentů</span>
        </div>
        <div class="unit-dept-body open">
          <div class="unit-team">
            <div class="unit-team-body open">
              ${model.unassigned
                .map(
                  (a) => `<div class="unit-agent">
                    <span class="org-dot ${statusClass(a.status)}"></span>
                    <span class="unit-agent-name">${esc(a.name)}</span>
                    <span class="unit-agent-role">${esc(designation(a))}</span>
                  </div>`,
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>`
    : '';

  host.innerHTML = deptBlocks + unmatchedSection;
  wireUnitToggles(host);
}

function renderDepartment(dept) {
  const key = `dept:${dept.key}`;
  const open = isOpen(key, true);
  const hit = matches(dept.name, dept.purpose, dept.board) || searchQuery === '';
  const childHit = dept.divisions.some(
    (v) =>
      matches(v.name, dept.name) ||
      v.teams.some((t) => matches(t.name) || t.members.some((m) => matches(m.name, designation(m)))),
  );
  if (!hit && !childHit) return '';

  const teamCount = dept.divisions.reduce((n, v) => n + v.teams.length, 0);
  const staffed = dept.divisions.reduce((n, v) => n + v.teams.filter((t) => t.members.length).length, 0);

  return `
    <div class="unit-dept" data-key="${esc(key)}" style="--c:${esc(dept.color)}">
      <button class="unit-dept-head" data-toggle="${esc(key)}" aria-expanded="${open}">
        <span class="unit-caret${open ? ' open' : ''}">▶</span>
        <span class="unit-dept-icon">${esc(dept.icon || '▣')}</span>
        <span class="unit-dept-name">${esc(dept.name)}</span>
        <span class="unit-dept-purpose">${esc(dept.purpose || '')}</span>
        <span class="unit-dept-badge">${dept.divisions.length} divize · ${teamCount} týmů · ${staffed} obsazeno</span>
        <span class="unit-dept-board">
          <span class="org-dot ${statusClass(dept.boardAgent?.status)}"></span>
          ${esc(dept.boardAgent?.name || dept.board)}
        </span>
      </button>
      <div class="unit-dept-body${open ? ' open' : ''}">
        ${dept.divisions.map((div) => renderDivision(dept, div)).join('')}
      </div>
    </div>`;
}

function renderDivision(dept, div) {
  const key = `div:${dept.key}/${div.name}`;
  const divHit = matches(div.name, dept.name);
  const teamHit = div.teams.some((t) => matches(t.name) || t.members.some((m) => matches(m.name, designation(m))));
  const open = isOpen(key, divHit || (searchQuery !== '' && teamHit));

  return `
    <div class="unit-div" data-key="${esc(key)}">
      <button class="unit-div-head" data-toggle="${esc(key)}" aria-expanded="${open}">
        <span class="unit-caret${open ? ' open' : ''}">▶</span>
        <span class="unit-div-name">${esc(div.name)}</span>
        <span class="unit-div-badge">${div.teams.length} týmů · ${div.agentCount} agentů${
          div.vacancyCount ? ` · ${div.vacancyCount} volných` : ''
        }</span>
      </button>
      <div class="unit-div-body${open ? ' open' : ''}">
        ${div.teams.map((team) => renderTeam(dept, div, team)).join('')}
      </div>
    </div>`;
}

function renderTeam(dept, div, team) {
  const key = `team:${dept.key}/${div.name}/${team.name}`;
  const teamHit = matches(team.name, div.name, dept.name);
  const memberHit = team.members.some((m) => matches(m.name, designation(m)));
  const open = isOpen(key, teamHit || (searchQuery !== '' && memberHit));

  const memberRows = team.members
    .filter((m) => !searchQuery || matches(m.name, designation(m)) || teamHit)
    .map(
      (m) => `
        <div class="unit-agent">
          <span class="org-dot ${statusClass(m.status)}"></span>
          <span class="unit-agent-name">${esc(m.name)}</span>
          <span class="unit-agent-model">${esc(m.adapterConfig?.model || '')}</span>
          <span class="unit-agent-role">${esc(designation(m))}</span>
        </div>`,
    )
    .join('');

  const vacancyRows = team.vacancies
    .filter((v) => !searchQuery || matches(v, team.name))
    .map(
      (v) => `
        <div class="unit-vacancy">
          <span class="vac-dot">◇</span>
          <span class="unit-agent-name">${esc(v)}</span>
          <span class="vac-tag">lazy — neinstantováno</span>
        </div>`,
    )
    .join('');

  if (!memberRows && !vacancyRows) return '';

  return `
    <div class="unit-team" data-key="${esc(key)}">
      <button class="unit-team-head" data-toggle="${esc(key)}" aria-expanded="${open}">
        <span class="unit-caret${open ? ' open' : ''}">▶</span>
        <span class="unit-team-name">${esc(team.name)}</span>
        <span class="unit-team-badge">${team.members.length} agentů${
          team.vacancies.length ? ` · ${team.vacancies.length} volných` : ''
        }</span>
      </button>
      <div class="unit-team-body${open ? ' open' : ''}">
        ${memberRows}${vacancyRows}
      </div>
    </div>`;
}

function wireUnitToggles(host) {
  host.querySelectorAll('button[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      const isOpenNow = toggleNode(key);
      btn.setAttribute('aria-expanded', String(isOpenNow));
      btn.querySelector('.unit-caret')?.classList.toggle('open', isOpenNow);
      // The collapsible body is always the button's immediate next sibling.
      const body = btn.nextElementSibling;
      if (body) body.classList.toggle('open', isOpenNow);
    });
  });
}

/** Apply current search by re-rendering through the caller. */
export function applyStructureSearch(model) {
  renderStructureChrome(model);
  renderOrg(model);
  renderUnits(model);
}
