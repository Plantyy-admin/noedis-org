/* ══════════════════════════════════════════════════════════════
   STRUCTURE panel — Org + jednotky společnosti
   ══════════════════════════════════════════════════════════════ */

import { esc, statusClass, setText, designation } from './util.js';

/* Expansion state survives live re-renders. */
const expanded = new Set();
let expandMode = 'default'; // 'default' | 'all' | 'none'
let searchQuery = '';
/* CELÁ ORGANIZACE — draw the canvas as one centred chart (every department,
   division, team and agent) instead of the indented tree. */
let fullOrg = false;

export function setStructureSearch(q) {
  searchQuery = String(q || '').trim().toLowerCase();
}
export function getStructureSearch() {
  return searchQuery;
}
export function setExpandMode(mode) {
  expandMode = mode;
}
export function setFullOrg(on) {
  fullOrg = Boolean(on);
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
  // Name the document the structure actually comes from, not a version number.
  const src = String(model.source || '').replace(/^.*\//, '').replace(/\.md$/, '');
  setText('struct-source', src ? `· ${src}` : `· blueprint ${model.blueprintVersion}`);
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

      <div class="org-boards-label">DEPARTMENT HEADS · ${model.departments.length}</div>
      ${fullOrg
        ? renderOrgChart(model)
        : `<div class="org-tree">
        ${model.departments.map((dept) => renderOrgDepartment(dept)).join('')}
      </div>`}
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

/* ── ORG canvas: departments → divisions → teams → agents ────────
   The canvas shows the whole company as one connected tree so the
   structure is legible without switching to the detailed list below.
   Each level is a node; children hang off a rail under their parent. */

function countTeams(dept) {
  return dept.divisions.reduce((n, v) => n + v.teams.length, 0);
}
function countAgents(dept) {
  return dept.divisions.reduce(
    (n, v) => n + v.teams.reduce((m, t) => m + t.members.length, 0),
    0,
  );
}
function countVacancies(dept) {
  return dept.divisions.reduce(
    (n, v) => n + v.teams.reduce((m, t) => m + t.vacancies.length, 0),
    0,
  );
}

/* "3 divize · 6 týmů · 3 agenti" — Czech plural for the small counts here. */
function plural(n, one, few, many) {
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

function renderOrgDepartment(dept) {
  const teams = countTeams(dept);
  const agents = countAgents(dept);
  const vacancies = countVacancies(dept);
  const meta = [
    plural(dept.divisions.length, 'divize', 'divize', 'divizí'),
    plural(teams, 'tým', 'týmy', 'týmů'),
    plural(agents, 'agent', 'agenti', 'agentů'),
  ];
  if (vacancies) meta.push(plural(vacancies, 'volné místo', 'volná místa', 'volných míst'));

  return `
    <div class="org-branch" style="--c:${esc(dept.color)}">
      <div class="org-board org-node-dept${dept.headAgent ? '' : ' missing'}">
        <div class="org-board-top">
          <span class="org-dot ${statusClass(dept.headAgent?.status)}"></span>
          <span class="org-board-name">${esc(dept.name)}</span>
          <span class="org-node-meta">${esc(meta.join(' · '))}</span>
        </div>
        <div class="org-board-agent">${esc(dept.headAgent?.name || dept.head)}</div>
      </div>
      <div class="org-kids">
        ${dept.divisions.map((div) => renderOrgDivision(dept, div)).join('')}
      </div>
    </div>`;
}

function renderOrgDivision(dept, div) {
  const meta = [plural(div.teams.length, 'tým', 'týmy', 'týmů'), plural(div.agentCount, 'agent', 'agenti', 'agentů')];
  if (div.vacancyCount) meta.push(plural(div.vacancyCount, 'volné místo', 'volná místa', 'volných míst'));

  return `
    <div class="org-branch">
      <div class="org-node org-node-div">
        <span class="org-node-name">${esc(div.name)}</span>
        <span class="org-node-meta">${esc(meta.join(' · '))}</span>
      </div>
      <div class="org-kids">
        ${div.teams.map((team) => renderOrgTeam(team)).join('')}
      </div>
    </div>`;
}

function renderOrgTeam(team) {
  const members = team.members
    .map(
      (m) => `
        <div class="org-node org-node-agent">
          <span class="org-dot ${statusClass(m.status)}"></span>
          <span class="org-node-name">${esc(m.name)}</span>
          <span class="org-node-model">${esc(m.adapterConfig?.model || '')}</span>
          <span class="org-node-role">${esc(designation(m))}</span>
        </div>`,
    )
    .join('');

  const vacancies = team.vacancies
    .map(
      (v) => `
        <div class="org-node org-node-agent vacancy">
          <span class="vac-dot">◇</span>
          <span class="org-node-name">${esc(v)}</span>
          <span class="org-node-role">lazy — neinstantováno</span>
        </div>`,
    )
    .join('');

  const meta = [plural(team.members.length, 'agent', 'agenti', 'agentů')];
  if (team.vacancies.length) meta.push(plural(team.vacancies.length, 'volné místo', 'volná místa', 'volných míst'));

  return `
    <div class="org-branch">
      <div class="org-node org-node-team">
        <span class="org-node-name">${esc(team.name)}</span>
        <span class="org-node-meta">${esc(meta.join(' · '))}</span>
      </div>
      ${members || vacancies ? `<div class="org-kids">${members}${vacancies}</div>` : ''}
    </div>`;
}

/* ── CELÁ ORGANIZACE: one centred chart ────────────────────────
   Departments sit on top and every level hangs centred under its parent, drawn
   in the same connector language as the executive cards above. The whole
   company is wider than the panel on purpose, so the chart scrolls sideways. */

function ocCard({ name, sub, meta, status, color, cls = '', dot = false }) {
  return `
    <div class="oc-card ${cls}"${color ? ` style="--c:${esc(color)}"` : ''}>
      <span class="oc-card-head">
        ${dot ? `<span class="org-dot ${statusClass(status)}"></span>` : ''}
        <span class="oc-card-name">${esc(name)}</span>
      </span>
      ${sub ? `<span class="oc-card-sub">${esc(sub)}</span>` : ''}
      ${meta ? `<span class="oc-card-meta">${esc(meta)}</span>` : ''}
    </div>`;
}

function renderOrgChart(model) {
  const branches = model.departments
    .map((dept) => {
      const divisions = dept.divisions
        .map((div) => {
          const teams = div.teams
            .map((team) => {
              const leaves = [
                ...team.members.map((m) =>
                  ocCard({ name: m.name, sub: designation(m), status: m.status, cls: 'oc-agent', dot: true }),
                ),
                ...team.vacancies.map((v) => ocCard({ name: v, sub: 'lazy', cls: 'oc-agent oc-vacancy' })),
              ];
              const teamCard = ocCard({
                name: team.name,
                meta: plural(team.members.length, 'agent', 'agenti', 'agentů'),
                cls: 'oc-team',
              });
              return `<li>${teamCard}${
                leaves.length ? `<ul>${leaves.map((l) => `<li>${l}</li>`).join('')}</ul>` : ''
              }</li>`;
            })
            .join('');
          const divCard = ocCard({
            name: div.name,
            meta: plural(div.agentCount, 'agent', 'agenti', 'agentů'),
            cls: 'oc-div',
          });
          return `<li>${divCard}${teams ? `<ul>${teams}</ul>` : ''}</li>`;
        })
        .join('');
      const deptMeta = [
        plural(dept.divisions.length, 'divize', 'divize', 'divizí'),
        plural(countTeams(dept), 'tým', 'týmy', 'týmů'),
        plural(countAgents(dept), 'agent', 'agenti', 'agentů'),
      ].join(' · ');
      const deptCard = ocCard({
        name: dept.name,
        sub: dept.headAgent?.name || dept.head,
        meta: deptMeta,
        status: dept.headAgent?.status,
        color: dept.color,
        cls: 'oc-dept',
        dot: true,
      });
      return `<li>${deptCard}${divisions ? `<ul>${divisions}</ul>` : ''}</li>`;
    })
    .join('');

  return `
    <div class="org-chart-scroll">
      <ul class="org-chart">${branches}</ul>
    </div>
    <p class="org-chart-hint">
      Vodorovně posuňte pro zbytek organizace —
      ${model.counts.departments} oddělení · ${model.counts.divisions} divizí ·
      ${model.counts.teams} týmů · ${model.counts.agents} agentů
    </p>`;
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
  const hit = matches(dept.name, dept.purpose, dept.head) || searchQuery === '';
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
          <span class="org-dot ${statusClass(dept.headAgent?.status)}"></span>
          ${esc(dept.headAgent?.name || dept.head)}
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
