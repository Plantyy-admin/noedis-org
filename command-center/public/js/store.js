/* ══════════════════════════════════════════════════════════════
   Model builder — merges the canonical MASTER blueprint with live
   Paperclip agents + org chart into one structure the UI renders.

   The blueprint is the source of truth for SHAPE (which departments,
   divisions and teams exist). Paperclip is the source of truth for
   REALITY (which agents exist, their status and runtime).

   An agent is placed by, in order of trust:
     1. agent.metadata.{dept,division,team}
     2. blueprint team `staffed` list (name match)
     3. live org chart reports_to chain
     4. otherwise it lands in `unassigned` so it is never hidden.
   ══════════════════════════════════════════════════════════════ */

export const RUNTIME = {
  adapterType: 'pi_local',
  provider: 'openrouter',
  model: 'openrouter/~deepseek/deepseek-flash-latest',
};

export function buildModel(blueprint, agents = [], orgTree = null) {
  const list = Array.isArray(agents) ? agents : [];
  const byName = new Map();
  const byId = new Map();
  for (const a of list) {
    if (a?.name) byName.set(a.name, a);
    if (a?.id) byId.set(a.id, a);
  }

  const claimed = new Set();

  /* ── executive layer ── */
  const executive = (blueprint?.executive || []).map((e) => {
    const agent = byName.get(e.name) || null;
    if (agent) claimed.add(agent.id);
    return { ...e, agent, status: agent?.status || 'idle' };
  });

  /* ── departments → divisions → teams ── */
  let divisionTotal = 0;
  let teamTotal = 0;
  let staffedTeamTotal = 0;

  const departments = (blueprint?.departments || []).map((dept) => {
    // The summary puts a department head among the existing agents rather than
    // creating a separate board agent.
    const headAgent = byName.get(dept.head) || null;
    if (headAgent) claimed.add(headAgent.id);

    let deptAgents = 0;

    const divisions = (dept.divisions || []).map((div) => {
      divisionTotal += 1;

      const teams = (div.teams || []).map((team) => {
        teamTotal += 1;

        const fromStaffed = (team.staffed || [])
          .map((n) => byName.get(n))
          .filter(Boolean);

        // Agents that declare this exact unit in their own metadata.
        // Only specialists are team members — board chairs and executives
        // carry a dept but must not appear inside every team of it.
        const fromMeta = list.filter((a) => {
          const m = a?.metadata;
          if (!m || typeof m !== 'object') return false;
          if (m.level && m.level !== 'specialist') return false;
          if (!m.dept || m.dept !== dept.key) return false;
          if (m.division && m.division !== div.name) return false;
          if (m.team && m.team !== team.name) return false;
          return true;
        });

        const seen = new Set();
        const members = [];
        for (const a of [...fromMeta, ...fromStaffed]) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          members.push(a);
          claimed.add(a.id);
        }

        const filled = new Set(members.map((m) => m.name));
        const vacancies = (team.specialists || []).filter((s) => !filled.has(s) && !byName.has(s));

        if (members.length > 0) staffedTeamTotal += 1;
        deptAgents += members.length;

        return { name: team.name, members, vacancies, specialists: team.specialists || [] };
      });

      const divisionAgents = teams.reduce((n, t) => n + t.members.length, 0);
      const divisionVacancies = teams.reduce((n, t) => n + t.vacancies.length, 0);

      return { name: div.name, teams, agentCount: divisionAgents, vacancyCount: divisionVacancies };
    });

    return {
      ...dept,
      headAgent,
      divisions,
      agentCount: deptAgents + (headAgent ? 1 : 0),
      vacancyCount: divisions.reduce((n, v) => n + v.vacancyCount, 0),
    };
  });

  /* ── anything live that the blueprint does not know about ── */
  const unassigned = list.filter((a) => a?.id && !claimed.has(a.id));

  /* ── runtime drift: the company-wide invariant ── */
  const drift = [];
  const adapterCounts = {};
  for (const a of list) {
    const adapter = a?.adapterType || '(none)';
    adapterCounts[adapter] = (adapterCounts[adapter] || 0) + 1;
    const model = a?.adapterConfig?.model;
    const provider = a?.adapterConfig?.provider;
    if (adapter !== RUNTIME.adapterType || (provider && provider !== RUNTIME.provider)) {
      drift.push({ name: a.name, adapterType: adapter, provider: provider || '(none)', model: model || '(none)' });
    }
  }

  const statusCounts = { running: 0, paused: 0, error: 0, idle: 0 };
  for (const a of list) {
    const s = String(a?.status || 'idle').toLowerCase();
    if (s === 'running' || s === 'active' || s === 'working') statusCounts.running += 1;
    else if (s === 'paused') statusCounts.paused += 1;
    else if (s === 'error' || s === 'failed') statusCounts.error += 1;
    else statusCounts.idle += 1;
  }

  return {
    blueprintVersion: blueprint?.version || '—',
    source: blueprint?.generatedFrom || '—',
    reportingLaw: blueprint?.reportingLaw || null,
    runtime: blueprint?.runtime || RUNTIME,
    executive,
    departments,
    unassigned,
    byId,
    byName,
    agents: list,
    orgTree,
    drift,
    adapterCounts,
    statusCounts,
    counts: {
      departments: departments.length,
      divisions: divisionTotal,
      teams: teamTotal,
      staffedTeams: staffedTeamTotal,
      agents: list.length,
      heads: departments.filter((d) => d.headAgent).length,
      vacancies: departments.reduce((n, d) => n + d.vacancyCount, 0)
        + executive.filter((e) => !e.agent).length,
    },
  };
}

/** Flatten the executive+department model into searchable rows. */
export function flattenForSearch(model) {
  const rows = [];
  for (const e of model.executive) {
    rows.push({ kind: 'exec', label: e.name, sub: e.interface || e.role || '', status: e.status });
  }
  for (const d of model.departments) {
    rows.push({ kind: 'dept', label: d.name, sub: d.purpose || '' });
    for (const v of d.divisions) {
      rows.push({ kind: 'division', label: v.name, sub: d.name });
      for (const t of v.teams) {
        rows.push({ kind: 'team', label: t.name, sub: `${d.name} / ${v.name}` });
        for (const m of t.members) {
          rows.push({ kind: 'agent', label: m.name, sub: `${d.name} / ${v.name} / ${t.name}`, status: m.status });
        }
      }
    }
  }
  return rows;
}
