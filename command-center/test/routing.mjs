/* ══════════════════════════════════════════════════════════════
   Routing tests — the part of the voice loop that must not be a guess.

   The hand-off used to depend on the model choosing to call a skill; the
   cockpit now decides *who* from the sentence and the picker, and the model
   only decides *what*. These assertions cover the deciding.

     node test/routing.mjs
   ══════════════════════════════════════════════════════════════ */

import assert from 'node:assert/strict';
import { matchAddressee, shapeRoster, fold, departmentOf } from '../lib/agent-directory.js';
import { extractJson, buildRoutingPrompt } from '../lib/hermes.js';

/* A miniature of the real board: same ids, same tree, fewer agents. */
const RAW = [
  { id: 'noe', name: 'NOE', title: 'NOE — Senior Advisor', role: 'ceo', status: 'idle', reportsTo: null },
  { id: 'cody', name: 'CODY', title: 'CODY — Right Hand', role: 'cto', status: 'idle', reportsTo: 'noe' },
  { id: 'rene', name: 'RENE', title: 'RENE — Left Hand', role: 'pm', status: 'idle', reportsTo: 'noe' },
  { id: 'fe', name: 'Frontend Engineer', title: 'Vedoucí oddělení VÝVOJ', status: 'idle', reportsTo: 'cody' },
  { id: 'ops', name: 'DevOps Engineer', title: 'Vedoucí oddělení INFRA', status: 'running', reportsTo: 'cody' },
  { id: 'mkt', name: 'Marketing Lead', title: 'Vedoucí oddělení MARKETING', status: 'idle', reportsTo: 'cody' },
  { id: 'fin', name: 'Business Analyst', title: 'Vedoucí oddělení FINANCE', status: 'idle', reportsTo: 'cody' },
  { id: 'be', name: 'Backend Engineer', title: 'Backend Engineer', status: 'idle', reportsTo: 'fe' },
];

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

console.log('\n▸ shapeRoster');

const roster = shapeRoster(RAW);

check('finds NOE, CODY and RENE by name', () => {
  assert.equal(roster.noeAgentId, 'noe');
  assert.equal(roster.codyAgentId, 'cody');
  assert.equal(roster.reneAgentId, 'rene');
});

check('marks exactly the agents reporting to CODY as department heads', () => {
  const heads = roster.agents.filter((a) => a.isDepartmentHead).map((a) => a.id).sort();
  assert.deepEqual(heads, ['fe', 'fin', 'mkt', 'ops']);
});

check('never marks a leadership agent as a department head', () => {
  for (const id of ['noe', 'cody', 'rene']) {
    const a = roster.agents.find((x) => x.id === id);
    assert.equal(a.isDepartmentHead, false, `${id} must not be a department head`);
    assert.equal(a.isLeadership, true, `${id} must be leadership`);
  }
});

check('gives each tier its orb colour', () => {
  const color = (id) => roster.agents.find((a) => a.id === id).color;
  assert.equal(color('noe'), '#ffd23f');
  assert.equal(color('cody'), '#4aa8ff');
  assert.equal(color('rene'), '#63dda8');
  assert.equal(color('fe'), '#b07cff');
  assert.equal(color('be'), '#8b9dba');
});

check('resolves the boss name from reportsTo', () => {
  assert.equal(roster.agents.find((a) => a.id === 'be').reportsToName, 'Frontend Engineer');
});

check('reads the department out of the Czech title', () => {
  assert.equal(departmentOf({ title: 'Vedoucí oddělení VÝVOJ' }), 'VÝVOJ');
  assert.equal(departmentOf({ title: 'Backend Engineer' }), '');
});

console.log('\n▸ matchAddressee — spoken targeting');

check('a leading name wins', () => {
  assert.equal(matchAddressee('Cody, připrav cenovou nabídku', roster.agents)?.id, 'cody');
  assert.equal(matchAddressee('NOE pošli to dál', roster.agents)?.id, 'noe');
});

check('a department works too', () => {
  assert.equal(matchAddressee('vývoji, oprav ten build', roster.agents)?.id, 'fe');
  assert.equal(matchAddressee('marketing, naplánuj kampaň', roster.agents)?.id, 'mkt');
});

check('diacritics and case do not matter', () => {
  assert.equal(matchAddressee('VÝVOJI, oprav build', roster.agents)?.id, 'fe');
  assert.equal(matchAddressee('cody, hele', roster.agents)?.id, 'cody');
});

check('a name in the middle is NOT an addressee', () => {
  assert.equal(matchAddressee('napiš to jako cody včera', roster.agents), null);
});

check('a longer word starting with a handle is not a match', () => {
  // "marketingový" must not be read as addressing "marketing"
  assert.equal(matchAddressee('marketingový plán pro příští týden', roster.agents), null);
});

check('a plain task with nobody named matches nobody', () => {
  assert.equal(matchAddressee('postav landing page pro produkt X', roster.agents), null);
  assert.equal(matchAddressee('jak se máš?', roster.agents), null);
});

check('the longest handle wins', () => {
  // "frontend engineer" must beat the department "vývoj" and the short "frontend"
  assert.equal(matchAddressee('Frontend Engineer, přidej endpoint', roster.agents)?.id, 'fe');
});

check('survives how Whisper actually spells the names', () => {
  // Verified against a real edge-tts → Whisper round trip: "Cody" came back
  // as "Kody". Matching only the board's spelling would drop these.
  assert.equal(matchAddressee('Kody, připrav prosím krátký seznam kroků', roster.agents)?.id, 'cody');
  assert.equal(matchAddressee('Kodi, hele', roster.agents)?.id, 'cody');
  assert.equal(matchAddressee('Noje, pošli to dál', roster.agents)?.id, 'noe');
});

check('fold strips diacritics and punctuation', () => {
  assert.equal(fold('VÝVOJI,'), 'vyvoji');
  assert.equal(fold('  Příliš  žluťoučký '), 'prilis zlutoucky');
});

console.log('\n▸ extractJson — the model answer');

check('reads a clean object', () => {
  assert.deepEqual(extractJson('{"say":"ahoj","task":null}'), { say: 'ahoj', task: null });
});

check('survives markdown fences and chatter', () => {
  const out = extractJson('Jistě!\n```json\n{"say":"hotovo","task":{"title":"T"}}\n```\nSnad to jde.');
  assert.equal(out.say, 'hotovo');
  assert.equal(out.task.title, 'T');
});

check('is not fooled by braces inside a string', () => {
  const out = extractJson('{"say":"použij { a }","task":null}');
  assert.equal(out.say, 'použij { a }');
});

check('returns null for prose', () => {
  assert.equal(extractJson('Předal jsem to NOE.'), null);
});

console.log('\n▸ buildRoutingPrompt');

check('lists every agent with its id', () => {
  const p = buildRoutingPrompt({ text: 'cokoliv', agents: roster.agents, target: roster.agents[0] });
  assert.match(p, /- cody \| CODY/);
  assert.match(p, /- fe \| Frontend Engineer/);
});

check('states the chosen target', () => {
  const target = roster.agents.find((a) => a.id === 'cody');
  const p = buildRoutingPrompt({ text: 'x', agents: roster.agents, target });
  assert.match(p, /VYBRANÝ CÍL: CODY \(cody\)/);
});

check('forbids tool calls, because the cockpit creates the issue', () => {
  const p = buildRoutingPrompt({ text: 'x', agents: roster.agents, target: null });
  assert.match(p, /Nevolej žádné nástroje/);
});

check('embeds the founder words', () => {
  const p = buildRoutingPrompt({ text: 'postav web', agents: [], target: null });
  assert.match(p, /postav web/);
});

console.log(`\n${failed === 0 ? '✓' : '✗'} ${passed} passed, ${failed} failed\n`);
process.exit(failed === 0 ? 0 : 1);
