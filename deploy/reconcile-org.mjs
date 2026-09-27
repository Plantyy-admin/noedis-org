#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════
   NOEDIS — reconcile the live Paperclip org with the canonical
   blueprint (NOEDIS_COMPLETE_SUMMARY_v1.0.md §4.1 + §4.3).

   Idempotent: safe to run repeatedly. It
     1. creates the executive agents the blueprint requires and that
        do not yet exist (WorkforceArchitect),
     2. marks each department's head among the existing agents,
     3. places every known specialist into its division/team
        by writing role + reportsTo + metadata,
     4. aligns the executive roles (NOE / CODY / RENE),
     5. clears stale agent errors and reports runtime drift.

   Usage (on the VPS):
     node reconcile-org.mjs --blueprint ./org-blueprint.json \
       --api http://127.0.0.1:3100 --key <board-key> \
       --company <companyId> [--dry-run] [--prune] [--model <id>] \
       [--instructions-only]

   --instructions-only applies just the executive prompts (where the routing
   rules live) and exits. Instructions are not part of the drift check, so
   without it a corrected prompt never reaches an agent that already exists.

   --prune deletes agents that this reconciler previously managed
   (they carry metadata.blueprintVersion) but that the current blueprint no
   longer defines. Agents it never touched are never deleted.
   ══════════════════════════════════════════════════════════════ */

import fs from 'node:fs';

/* ── args ────────────────────────────────────────────────────── */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const BLUEPRINT_PATH = arg('blueprint', new URL('../command-center/config/org-blueprint.json', import.meta.url).pathname);
const API = String(arg('api', 'http://127.0.0.1:3100')).replace(/\/+$/, '');
const KEY = arg('key', process.env.PAPERCLIP_API_KEY || '');
const COMPANY = arg('company', process.env.NOEDIS_COMPANY_ID || '');
const DRY = Boolean(arg('dry-run', false));
const PRUNE = Boolean(arg('prune', false));

if (!KEY) { console.error('missing --key (board API key)'); process.exit(2); }
if (!COMPANY) { console.error('missing --company'); process.exit(2); }

const blueprint = JSON.parse(fs.readFileSync(BLUEPRINT_PATH, 'utf8'));

// Company model policy. One value, applied to every agent.
const MODEL = String(arg('model', process.env.NOEDIS_MODEL || '') || blueprint.runtime.model);

/* ── api ─────────────────────────────────────────────────────── */
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 500) }; } }
  if (!res.ok) {
    const msg = parsed?.error || parsed?.message || `HTTP ${res.status}`;
    throw new Error(`${method} ${path} -> ${msg}`);
  }
  return parsed;
}

/* ── plan ────────────────────────────────────────────────────── */

/** Flat list of every unit the blueprint defines, with its parent chain. */
function unitIndex() {
  const units = [];
  for (const dept of blueprint.departments) {
    for (const div of dept.divisions) {
      for (const team of div.teams) {
        units.push({ dept, div, team });
      }
    }
  }
  return units;
}

const UNITS = unitIndex();

/** Which unit does an existing agent belong to, by name? */
function unitForAgentName(name) {
  for (const u of UNITS) {
    if ((u.team.staffed || []).includes(name)) return u;
  }
  return null;
}

/* Executive routing. The blueprint says NOE "posoudí každý úkol a deleguje
   CODYmu" and CODY "rozděluje práci agentům v departmentech" — but a capable
   agent given only that simply does the work itself, and the chain never runs.
   These clauses are the missing mechanism, spelled out. */
const ROUTING = {
  noe:
    `Routing: you assess and route, you do not execute. Every task that needs real work must ` +
    `leave your hands as a child issue assigned to CODY (Right Hand), carrying a brief he can ` +
    `act on, and CODY must be woken. Do the work yourself only when the task is a question ` +
    `about your own routing — otherwise never close an execution task as done on your own ` +
    `authority; close it once CODY owns it, and say what you routed.\n\n`,
  cody:
    `Distribution: execution is yours. Break accepted work into department-sized child issues, ` +
    `assign each to the department head that owns it and wake them. Resolve dependencies ` +
    `between departments yourself; escalate to NOE only what a department cannot resolve, and ` +
    `hand RENE the finished result for the Founder.\n\n`,
};

const instructions = {
  executive: (e) =>
    `You are ${e.name} (${e.interface}). ${e.description}\n\n` +
    (ROUTING[e.key] || '') +
    `Reporting law: ${blueprint.reportingLaw.chain}\n` +
    `Runtime invariant: every NOEDIS agent runs pi_local through OpenRouter. ` +
    `Never reconfigure yourself or another agent onto codex_local, claude_local or opencode_local.\n` +
    `No plaintext credential may ever be written into instructions, repositories or markdown files.`,
  head: (dept) =>
    `You are the head of the ${dept.name} department at NOEDIS.\n\n` +
    `Purpose: ${dept.purpose}\n\n` +
    `You own this department's outcomes. You receive accepted work from CODY, break it into ` +
    `division and team work, verify evidence before accepting any result, and return one ` +
    `department-level result upward. Unresolvable problems escalate to CODY; only RENE ` +
    `communicates routine results to the Founder.\n\n` +
    `Divisions under you: ${dept.divisions.map((d) => d.name).join(', ')}.\n` +
    `If a division or team you need does not exist yet, request it from WorkforceArchitect ` +
    `rather than improvising an agent yourself.`,
  specialist: (u, name) =>
    `You are ${name}, a specialist in ${u.dept.name} / ${u.div.name} / ${u.team.name} at NOEDIS.\n\n` +
    `Department purpose: ${u.dept.purpose}\n\n` +
    `You do the hands-on work of your team and hand back evidence, not opinions. ` +
    `Report up through your department head (${u.dept.head}). Escalate blockers instead of guessing. ` +
    `Stay inside your specialism; cross-team needs go up the chain.`,
};

/* ── run ─────────────────────────────────────────────────────── */
const report = { created: [], updated: [], unchanged: [], pruned: [], errors: [], skipped: [], staleErrors: [] };

console.log(`\n▸ NOEDIS org reconcile ${DRY ? '(DRY RUN) ' : ''}`);
console.log(`  blueprint : ${blueprint.version} (${blueprint.departments.length} departments)`);
console.log(`  api       : ${API}`);
console.log(`  company   : ${COMPANY}\n`);

const existing = await call('GET', `/api/companies/${COMPANY}/agents`);
const byName = new Map((existing || []).map((a) => [a.name, a]));
const idByName = new Map();
for (const a of existing || []) idByName.set(a.name, a.id);

/* ── instructions-only pass ──────────────────────────────────────
   Instructions are deliberately NOT part of the drift check below: rewriting
   an agent's prompt is a behaviour change, not a reconciliation. But that also
   meant a corrected prompt never reached an agent that already existed. This
   flag applies the executive prompts (the routing rules live there) without
   touching provider, model or anything else. */
if (arg('instructions-only', false)) {
  const report = { updated: [], unchanged: [], errors: [] };
  console.log('\n▸ executive instructions only\n');
  for (const e of blueprint.executive) {
    const found = byName.get(e.name);
    if (!found) {
      report.errors.push(`${e.name}: not in the live org`);
      continue;
    }
    const want = instructions.executive(e);
    const have = found.adapterConfig?.instructions || '';
    if (have === want) {
      report.unchanged.push(e.name);
      continue;
    }
    if (DRY) {
      report.updated.push(`${e.name} (would update)`);
      continue;
    }
    try {
      await call('PATCH', `/api/agents/${found.id}`, {
        adapterConfig: { ...(found.adapterConfig || {}), instructions: want },
      });
      report.updated.push(e.name);
    } catch (err) {
      report.errors.push(`${e.name}: ${err.message}`);
    }
  }
  for (const [k, v] of Object.entries(report)) {
    if (v.length) console.log(`  ${k}: ${v.join(', ')}`);
  }
  console.log('');
  process.exit(report.errors.length ? 1 : 0);
}

const adapterConfigFor = (text) => ({
  adapterType: blueprint.runtime.adapterType,
  provider: blueprint.runtime.provider,
  model: MODEL,
  instructions: text,
});

const runtimeConfig = {
  heartbeat: {
    enabled: false,
    cooldownSec: 10,
    intervalSec: 300,
    wakeOnDemand: true,
    maxConcurrentRuns: 20,
    skipTimerWhenNoActionableWork: true,
  },
};

const iconFor = (key) => ({
  brain: 'brain', zap: 'zap', mail: 'mail', wrench: 'wrench',
  heart: 'heart', cpu: 'cpu', sparkles: 'sparkles', star: 'star',
  globe: 'globe', database: 'database', shield: 'shield', lightbulb: 'lightbulb',
}[key] || 'bot');

/* Paperclip validates agents.role against a fixed enum, so the org path goes
   into metadata (and title carries the human-readable designation). */
const ROLE_ENUMS = blueprint.roleEnums || { byAgentName: {}, departmentHeadByDept: {}, default: 'general' };
function roleEnumFor(name, fallback) {
  return ROLE_ENUMS.byAgentName?.[name] || fallback || ROLE_ENUMS.default || 'general';
}

/* Postgres stores metadata as jsonb, which does NOT preserve key order.
   Compare canonically so re-runs are genuinely idempotent. */
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

async function ensureAgent({ name, role, title, reportsTo, icon, instructions: text, metadata, permissions }) {
  const found = byName.get(name);
  if (!found) {
    if (DRY) {
      report.created.push(`${name} (would create)`);
      return { id: null, name, created: true };
    }
    const created = await call('POST', `/api/companies/${COMPANY}/agents`, {
      name,
      role,
      title,
      reportsTo: reportsTo || null,
      icon: icon || 'bot',
      adapterType: blueprint.runtime.adapterType,
      adapterConfig: adapterConfigFor(text),
      runtimeConfig,
      metadata,
    });
    report.created.push(name);
    byName.set(name, created);
    idByName.set(name, created.id);
    if (permissions) {
      await call('PATCH', `/api/agents/${created.id}/permissions`, permissions).catch((e) =>
        report.errors.push(`permissions for ${name}: ${e.message}`));
    }
    return { id: created.id, name, created: true };
  }

  // Exists — align role/title/reportsTo/metadata and keep the runtime invariant.
  const patch = {
    role,
    title,
    reportsTo: reportsTo || null,
    adapterType: blueprint.runtime.adapterType,
    adapterConfig: adapterConfigFor(text),
    runtimeConfig,
    metadata,
  };
  const same =
    found.role === role &&
    found.title === title &&
    (found.reportsTo || null) === (reportsTo || null) &&
    canonical(found.metadata || null) === canonical(metadata || null) &&
    found.adapterType === blueprint.runtime.adapterType &&
    found.adapterConfig?.provider === blueprint.runtime.provider &&
    found.adapterConfig?.model === MODEL;

  if (same) {
    report.unchanged.push(name);
    return { id: found.id, name, created: false };
  }

  if (process.env.NOEDIS_DEBUG) {
    const why = [];
    if (found.role !== role) why.push(`role: ${JSON.stringify(found.role)} != ${JSON.stringify(role)}`);
    if (found.title !== title) why.push(`title: ${JSON.stringify(found.title)} != ${JSON.stringify(title)}`);
    if ((found.reportsTo || null) !== (reportsTo || null)) why.push(`reportsTo: ${found.reportsTo} != ${reportsTo}`);
    if (canonical(found.metadata || null) !== canonical(metadata || null)) {
      why.push(`metadata:\n      have ${canonical(found.metadata || null)}\n      want ${canonical(metadata || null)}`);
    }
    if (found.adapterType !== blueprint.runtime.adapterType) why.push(`adapterType: ${found.adapterType}`);
    if (found.adapterConfig?.provider !== blueprint.runtime.provider) why.push(`provider: ${found.adapterConfig?.provider}`);
    if (found.adapterConfig?.model !== MODEL) why.push(`model: ${found.adapterConfig?.model}`);
    console.log(`   ~ ${name}: ${why.join(' | ') || 'unknown'}`);
  }

  if (DRY) {
    report.updated.push(`${name} (would update)`);
    return { id: found.id, name, created: false };
  }

  try {
    await call('PATCH', `/api/agents/${found.id}`, patch);
    report.updated.push(name);
  } catch (err) {
    // Older rows carry free-text roles the API now rejects as an enum; retry
    // with the same payload but surface the failure rather than hiding it.
    report.errors.push(`${name}: ${err.message}`);
  }
  return { id: found.id, name, created: false };
}

/* 1 ── executive ------------------------------------------------- */
console.log('── executive');
const execIds = {};
for (const e of blueprint.executive) {
  const reportsTo = e.reportsTo ? execIds[e.reportsTo] : null;
  try {
    const r = await ensureAgent({
      name: e.name,
      role: roleEnumFor(e.name, 'pm'),
      title: `${e.name} — ${e.interface || e.title}`,
      reportsTo,
      icon: iconFor(e.icon),
      instructions: instructions.executive(e),
      metadata: {
        level: 'executive',
        interface: e.interface,
        path: e.interface || e.name,
        blueprintVersion: blueprint.version,
      },
      permissions: e.key === 'workforce'
        // canAssignTasks is required by the permissions endpoint.
        ? { canCreateAgents: true, canAssignTasks: true, canCreateSkills: true }
        : undefined,
    });
    execIds[e.key] = r.id;
  } catch (err) {
    report.errors.push(`${e.name}: ${err.message}`);
  }
}

/* 2 ── department heads ------------------------------------------ */
/* The summary puts a department head among the existing 24 agents rather than
   creating a separate board agent, so this section only records the mapping. */
console.log('── department heads');
const headIdByDept = new Map();
for (const dept of blueprint.departments) {
  const head = byName.get(dept.head);
  if (!head) {
    report.errors.push(`department head ${dept.head} (${dept.name}) not found`);
    continue;
  }
  try {
    const r = await ensureAgent({
      name: dept.head,
      role: roleEnumFor(dept.head, ROLE_ENUMS.departmentHeadByDept?.[dept.key] || 'general'),
      title: dept.headTitle,
      // A department head reports to CODY, never to itself.
      reportsTo: execIds.cody || execIds.noe || null,
      icon: head.icon || 'bot',
      instructions: instructions.head(dept),
      metadata: {
        level: 'head',
        isDepartmentHead: true,
        dept: dept.key,
        deptName: dept.name,
        path: `${dept.name} / Vedoucí oddělení`,
        blueprintVersion: blueprint.version,
      },
    });
    headIdByDept.set(dept.key, r.id);
    console.log(`   ${dept.name.padEnd(10)} head: ${dept.head}`);
  } catch (err) {
    report.errors.push(`head ${dept.head}: ${err.message}`);
  }
}

/* 3 ── specialists ---------------------------------------------- */
console.log('── specialists');
for (const agent of existing || []) {
  if (blueprint.executive.some((e) => e.name === agent.name)) continue;
  if (blueprint.departments.some((d) => d.head === agent.name)) continue;

  const u = unitForAgentName(agent.name);
  if (!u) {
    report.skipped.push(`${agent.name} (not in blueprint)`);
    continue;
  }

  try {
    await ensureAgent({
      name: agent.name,
      role: roleEnumFor(agent.name, 'general'),
      title: agent.name,
      // A department head cannot report to itself — it reports to CODY.
      reportsTo: u.dept.head === agent.name
        ? (execIds.cody || execIds.noe || null)
        : (headIdByDept.get(u.dept.key) || execIds.cody || null),
      icon: agent.icon || 'bot',
      instructions: instructions.specialist(u, agent.name),
      metadata: {
        level: 'specialist',
        dept: u.dept.key,
        deptName: u.dept.name,
        division: u.div.name,
        team: u.team.name,
        path: `${u.dept.name} / ${u.div.name} / ${u.team.name}`,
        blueprintVersion: blueprint.version,
      },
    });
  } catch (err) {
    report.errors.push(`${agent.name}: ${err.message}`);
  }
}

/* 4 ── prune agents the blueprint no longer defines -------------- */
/* Only agents this reconciler previously managed are eligible: they carry
   metadata.blueprintVersion. Everything else is left strictly alone. */
if (PRUNE) {
  console.log('── prune');
  const managedNames = new Set([
    ...blueprint.executive.map((e) => e.name),
    ...blueprint.departments.map((d) => d.head),
    ...blueprint.departments.flatMap((d) =>
      d.divisions.flatMap((v) => v.teams.flatMap((t) => t.staffed || []))),
  ]);

  const live = await call('GET', `/api/companies/${COMPANY}/agents`);
  for (const a of live || []) {
    const managed = a?.metadata && typeof a.metadata === 'object' && a.metadata.blueprintVersion;
    if (!managed) continue;
    if (managedNames.has(a.name)) continue;
    if (DRY) {
      report.pruned.push(`${a.name} (would delete)`);
      continue;
    }
    try {
      await call('DELETE', `/api/agents/${a.id}`);
      report.pruned.push(a.name);
      byName.delete(a.name);
    } catch (err) {
      report.errors.push(`prune ${a.name}: ${err.message}`);
    }
  }
}

/* 4 ── clear stale errors --------------------------------------- */
/* Paperclip's clear-error route only accepts agents whose status is already
   "error". A stale message on an idle agent (e.g. NOE's pre-Pi-install
   "Command not found in PATH: pi") can only be cleared by writing the column. */
if (!DRY) {
  console.log('── clear stale errors');
  const fresh = await call('GET', `/api/companies/${COMPANY}/agents`);
  const stale = (fresh || []).filter((a) => a.errorReason);
  for (const a of stale) {
    try {
      await call('POST', `/api/agents/${a.id}/clear-error`, {});
      report.updated.push(`${a.name} (error cleared)`);
    } catch (err) {
      report.staleErrors.push({ name: a.name, id: a.id, reason: a.errorReason, why: err.message });
    }
  }
}

/* ── report ──────────────────────────────────────────────────── */
console.log('\n════════ RECONCILE REPORT ════════');
const line = (k, arr) => console.log(`${k.padEnd(12)} ${arr.length}${arr.length ? `\n             ${arr.join('\n             ')}` : ''}`);
line('created', report.created);
line('updated', report.updated);
line('unchanged', report.unchanged);
line('skipped', report.skipped);
line('pruned', report.pruned);
line('errors', report.errors);
if (report.staleErrors.length) {
  console.log('stale errors ' + report.staleErrors.length);
  for (const s of report.staleErrors) {
    console.log(`             ${s.name} (${s.id}): ${s.reason}`);
    console.log(`               -> API refused: ${s.why}`);
    console.log(`               -> clear with: docker exec noedis-pg psql -U paperclip -d paperclip -c "UPDATE agents SET error_reason = NULL WHERE id = '${s.id}';"`);
  }
}

if (!DRY) {
  const after = await call('GET', `/api/companies/${COMPANY}/agents`);
  const org = await call('GET', `/api/companies/${COMPANY}/org`);
  console.log(`\ntotal agents : ${after.length}`);
  console.log(`org roots    : ${org.length} (${org.map((r) => r.name).join(', ')})`);

  const drift = after.filter((a) => a.adapterType !== blueprint.runtime.adapterType
    || a.adapterConfig?.provider !== blueprint.runtime.provider);
  console.log(`runtime drift: ${drift.length}`);
  for (const d of drift) console.log(`   ! ${d.name}: ${d.adapterType} / ${d.adapterConfig?.provider}`);
}

console.log('');
process.exit(report.errors.length ? 1 : 0);
