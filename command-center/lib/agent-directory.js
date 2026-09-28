/* ══════════════════════════════════════════════════════════════
   NOEDIS Command Center — the agent directory

   Everything the voice loop needs to know about who exists on the board:

     · a short-lived cache of the live Paperclip roster
     · the NOEDIS shape of it (who is leadership, who heads a department)
     · resolution of a target from either an explicit id (the picker in the
       VOICE panel) or a name spoken at the start of a sentence
       ("Cody, připrav nabídku" → CODY; nothing named → NOE)

   Reads are cached because the roster changes rarely and the voice loop
   asks for it on every turn.
   ══════════════════════════════════════════════════════════════ */

import { log } from './config.js';

const DEFAULT_TTL_MS = 30000;

/** "Vedoucí oddělení VÝVOJ" → "VÝVOJ" */
export function departmentOf(agent) {
  const m = /vedouc[íi]\s+odd[ěe]len[íi]\s+(.+)$/i.exec(String(agent?.title || ''));
  if (m) return m[1].trim().toUpperCase();
  return '';
}

/** Lowercase, no diacritics, no punctuation — the form both sides of a match
 *  are reduced to, so "Vývoji" and "vyvoj" are the same word. */
export function fold(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isDepartmentHead(agent, codyId) {
  if (/vedouc[íi]\s+odd[ěe]len[íi]/i.test(String(agent.title || ''))) return true;
  // The board's own shape: all seven heads report straight to CODY.
  return Boolean(codyId && agent.reportsTo === codyId);
}

function firstWord(name) {
  return fold(name).split(' ')[0] || '';
}

export class AgentDirectory {
  constructor({ paperclip, ttlMs = DEFAULT_TTL_MS }) {
    this.paperclip = paperclip;
    this.ttlMs = ttlMs;
    this._cache = null;
    this._at = 0;
    this._inflight = null;
  }

  /** The live roster, shaped for the cockpit. Cached for `ttlMs`. */
  async list({ force = false } = {}) {
    const fresh = this._cache && Date.now() - this._at < this.ttlMs;
    if (fresh && !force) return this._cache;
    if (this._inflight) return this._inflight;

    this._inflight = (async () => {
      try {
        const raw = await this.paperclip.agents();
        const list = Array.isArray(raw) ? raw : raw?.agents || raw?.data || [];
        const shaped = shapeRoster(list);
        this._cache = shaped;
        this._at = Date.now();
        return shaped;
      } catch (err) {
        log('agents: roster fetch failed:', err.message);
        // A stale roster beats no roster: the picker keeps working while the
        // board hiccups, and the caller can see it is stale.
        if (this._cache) return { ...this._cache, stale: true };
        throw err;
      } finally {
        this._inflight = null;
      }
    })();

    return this._inflight;
  }

  /**
   * Who should receive this utterance?
   *
   *   1. the agent picked in the VOICE panel, when it still exists
   *   2. a name/department spoken at the very start of the sentence
   *   3. NOE — the Senior Advisor the company routes through
   */
  async resolve({ targetAgentId, text } = {}) {
    const roster = await this.list();
    const { agents, noeAgentId } = roster;

    if (targetAgentId) {
      const picked = agents.find((a) => a.id === targetAgentId);
      if (picked) return { agent: picked, via: 'picker' };
    }

    const spoken = matchAddressee(text, agents);
    if (spoken) return { agent: spoken, via: 'spoken' };

    const noe =
      agents.find((a) => a.id === noeAgentId) ||
      agents.find((a) => fold(a.name) === 'noe') ||
      agents.find((a) => a.isLeadership) ||
      null;
    return { agent: noe, via: 'default' };
  }

  /** Every handle the orb can be told to light. */
  async handles() {
    const { agents } = await this.list();
    return agents.map((a) => ({ id: a.id, name: a.name, key: a.key, color: a.color }));
  }

  /**
   * Turn any handle into an agent: a Paperclip id, an exact name, a
   * department, or a short form ("frontend"). Returns null when nothing
   * matches, so callers can fall back to the turn's default target.
   */
  async byHandle(handle) {
    const raw = String(handle || '').trim();
    if (!raw) return null;
    const { agents } = await this.list();

    const byId = agents.find((a) => a.id === raw);
    if (byId) return byId;

    const folded = fold(raw);
    if (!folded) return null;

    const exact =
      agents.find((a) => fold(a.name) === folded) ||
      agents.find((a) => fold(a.department) === folded) ||
      agents.find((a) => fold(a.title) === folded);
    if (exact) return exact;

    return matchAddressee(raw, agents);
  }
}

/* ── shaping ──────────────────────────────────────────────── */

/** The orb colours, mirrored from the APEX skin so a chip in the cockpit and
 *  a circle around the orb are the same colour. */
const COLOR_LEAD = '#ffd23f';
const COLOR_CODY = '#4aa8ff';
const COLOR_RENE = '#63dda8';
const COLOR_DEPT = '#b07cff';
const COLOR_OTHER = '#8b9dba';

export function shapeRoster(list) {
  const byId = new Map(list.map((a) => [a.id, a]));
  const find = (re) =>
    list.find((a) => re.test(String(a.name || '')) || re.test(String(a.title || '')));

  const noe = find(/(^|\s)NOE(\s|$)/i);
  const cody = find(/(^|\s)CODY(\s|$)/i);
  const rene = find(/(^|\s)RENE(\s|$)/i);

  const agents = list.map((a) => {
    const dept = departmentOf(a);
    const head = isDepartmentHead(a, cody?.id);
    const leadership =
      a.id === noe?.id || a.id === cody?.id || a.id === rene?.id || /senior advisor|right hand|left hand/i.test(String(a.title || ''));
    let color = COLOR_OTHER;
    if (a.id === noe?.id) color = COLOR_LEAD;
    else if (a.id === cody?.id) color = COLOR_CODY;
    else if (a.id === rene?.id) color = COLOR_RENE;
    else if (head) color = COLOR_DEPT;

    return {
      id: String(a.id),
      name: String(a.name || 'agent'),
      title: String(a.title || ''),
      role: a.role ?? null,
      status: String(a.status || 'idle'),
      reportsTo: a.reportsTo ?? null,
      reportsToName: a.reportsTo ? String(byId.get(a.reportsTo)?.name || '') || null : null,
      department: dept || null,
      isDepartmentHead: head,
      isLeadership: leadership,
      color,
      /** Short key the orb's constellation uses for this agent. */
      key: orbKeyFor(a, noe, cody, rene),
    };
  });

  return {
    agents,
    companyId: null,
    noeAgentId: noe?.id ?? null,
    codyAgentId: cody?.id ?? null,
    reneAgentId: rene?.id ?? null,
    leadership: { noe: noe?.id ?? null, cody: cody?.id ?? null, rene: rene?.id ?? null },
    generatedAt: new Date().toISOString(),
    stale: false,
  };
}

/** The constellation has nine fixed slots: noe, cody, rene and dept0…dept6.
 *  Everything else is addressed by its Paperclip id. */
function orbKeyFor(agent, noe, cody, rene) {
  if (noe && agent.id === noe.id) return 'noe';
  if (cody && agent.id === cody.id) return 'cody';
  if (rene && agent.id === rene.id) return 'rene';
  return null;
}

/* ── spoken addressing ────────────────────────────────────── */

/**
 * How Whisper actually spells the names the founder says out loud.
 *
 * Checked against a real round trip (edge-tts → local Whisper): "Cody" came
 * back as "Kody". A speech recogniser normalises towards Czech orthography, so
 * the phonetic variants have to be listed — matching the board's spelling
 * exactly would drop the most important utterances, the ones that name a
 * person. Keys are looked up by the folded first word of the agent's name.
 */
const SPOKEN_ALIASES = {
  noe: ['noe', 'noje', 'noye'],
  cody: ['cody', 'kody', 'kodi', 'codi', 'codey'],
  rene: ['rene', 'renne', 'reneh'],
};

/**
 * Handles an agent answers to when addressed out loud. Order matters: the
 * full name is tried before the first word, and a department before an
 * abbreviation, so "frontend engineer" never loses to "frontend".
 */
export function handlesFor(agent) {
  const out = new Set();
  const name = fold(agent.name);
  if (name) out.add(name);
  const first = firstWord(agent.name);
  if (first && first.length >= 3) out.add(first);
  for (const alias of SPOKEN_ALIASES[first] || []) out.add(alias);
  const dept = fold(agent.department);
  if (dept && dept.length >= 3) out.add(dept);
  return [...out].filter(Boolean);
}

/**
 * Is somebody being addressed at the very start of the sentence?
 *
 * Only a leading handle counts, so "napiš marketingový plán" is a task with no
 * addressee while "marketing, napiš plán" is addressed to the Marketing Lead.
 *
 * Czech inflects, and a founder will say "vývoji" or "marketingu" rather than
 * the bare name, so a handle may carry up to two extra letters — but the word
 * must then end. That keeps "marketingový" (three letters past the handle) a
 * plain adjective rather than a vocative.
 */
export function matchAddressee(text, agents) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  // Only the first few words: an addressee is a vocative, and a vocative is at
  // the front. Commas and punctuation are folded to spaces, so a word boundary
  // is a space here.
  const head = fold(raw).split(' ').filter(Boolean).slice(0, 4).join(' ');
  if (!head) return null;

  let best = null;
  let bestLen = 0;

  for (const agent of agents || []) {
    for (const handle of handlesFor(agent)) {
      if (handle.length < 3 || handle.length <= bestLen) continue;
      if (!head.startsWith(handle)) continue;
      if (!endsAWord(head, handle.length)) continue;
      best = agent;
      bestLen = handle.length;
    }
  }

  return best;
}

/** True when the handle sits at the end of a word, allowing a Czech ending of
 *  at most two letters ("vývoj" → "vývoji", "marketing" → "marketingu"). */
function endsAWord(head, at) {
  for (let extra = 0; extra <= 2; extra++) {
    const rest = head.slice(at + extra);
    if (rest === '' || rest.startsWith(' ')) return true;
    const ch = head[at + extra];
    if (!ch || ch < 'a' || ch > 'z') return false;
  }
  return false;
}
