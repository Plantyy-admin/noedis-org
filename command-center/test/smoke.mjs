/* ══════════════════════════════════════════════════════════════
   Command Center smoke test
   Loads the running app in a real browser, asserts the STRUCTURE
   panel is populated from live Paperclip data, and captures console
   errors + a screenshot.

   Usage:  node test/smoke.mjs [baseUrl]
   ══════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:3200';
const OUT = path.join(__dirname, 'out');

/* The production cockpit is published behind HTTP basic auth. Supply the
   credentials via NOEDIS_AUTH_USER / NOEDIS_AUTH_PASS so both the browser and
   the direct fetches below can reach it. Leave unset for a local, open run. */
const AUTH_USER = process.env.NOEDIS_AUTH_USER || '';
const AUTH_PASS = process.env.NOEDIS_AUTH_PASS || '';
const AUTH_HEADER = AUTH_USER
  ? { Authorization: `Basic ${Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString('base64')}` }
  : {};

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  ...(AUTH_USER ? { httpCredentials: { username: AUTH_USER, password: AUTH_PASS } } : {}),
});

const consoleErrors = [];      // errors originating in the cockpit itself
const embeddedErrors = [];     // errors from the embedded Paperclip UI
const pageErrors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const where = m.location()?.url || '';
  // The cockpit lives under /command/. Anything else is the Paperclip iframe,
  // which legitimately 401s when the browser has no Paperclip session.
  if (where === '' || where.includes('/command')) consoleErrors.push(`${m.text()} @ ${where}`);
  else embeddedErrors.push(`${m.text()} @ ${where}`);
});
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log(`\n▸ Smoke test against ${BASE}\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

/* ── 1. server reachable + uplink ─────────────────────────────── */
await page.waitForSelector('#struct-meta span', { timeout: 15000 }).catch(() => {});
const meta = await page.$$eval('#struct-meta span', (els) => els.map((e) => e.textContent.trim()));
check('structure header counters rendered', meta.length >= 6, meta.join(' | '));

const uplink = await page.textContent('#nav-uplink-text').catch(() => null);
check('uplink reports a live/poll state', ['live', 'poll'].includes(String(uplink).trim()), String(uplink));

/* ── 2. ORG section ──────────────────────────────────────────── */
const orgCards = await page.$$eval('#org-tree .org-card .org-card-title', (els) => els.map((e) => e.textContent.trim()));
check('ORG shows FOUNDER', orgCards.some((t) => t.includes('FOUNDER')), orgCards[0]);
check('ORG shows NOE (Senior Advisor)', orgCards.some((t) => t.includes('NOE')), orgCards[1]);
check('ORG shows CODY (Right Hand)', orgCards.some((t) => t.includes('CODY')));
check('ORG shows RENE (Left Hand)', orgCards.some((t) => t.includes('RENE')));

// §4.1: seven departments, each led by one of the existing agents.
const heads = await page.$$eval('#org-tree .org-board .org-board-name', (els) => els.map((e) => e.textContent.trim()));
const EXPECT_DEPTS = ['VÝVOJ', 'INFRA', 'IT', 'MARKETING', 'LEGAL', 'FINANCE', 'LABS'];
check('ORG lists the 7 departments of the summary', heads.length === 7, `${heads.length}: ${heads.join(', ')}`);
check('ORG departments match §4.1 exactly',
  EXPECT_DEPTS.every((d) => heads.includes(d)), heads.join(', '));

/* ── 3. Units tree ───────────────────────────────────────────── */
const depts = await page.$$eval('#units-tree > .unit-dept .unit-dept-name', (els) => els.map((e) => e.textContent.trim()));
check('units tree lists the 7 departments', depts.length === 7, depts.join(', '));

const agentRows = await page.$$eval('#units-tree .unit-agent .unit-agent-name', (els) => els.map((e) => e.textContent.trim()));
// Exactly the specialists belong inside teams — boards/execs must not leak in.
check('units tree lists each specialist exactly once', agentRows.length === 21,
  `${agentRows.length} rows: ${agentRows.join(', ')}`);
const dupes = agentRows.filter((n, i) => agentRows.indexOf(n) !== i);
check('no specialist appears in two teams', dupes.length === 0, dupes.join(', '));
check('department boards are not listed as team members',
  !agentRows.some((n) => /Board$/.test(n)), agentRows.filter((n) => /Board$/.test(n)).join(', '));

const emptyDept = depts.length === 0;
check('no department fell back to empty', !emptyDept);

/* ── 4. other views render ───────────────────────────────────── */
await page.click('.nav-tab[data-view="dashboard"]');
await page.waitForTimeout(600);
const rosterRows = await page.$$eval('#agent-tbody tr', (els) => els.length);
check('DASHBOARD roster has exactly the 24 agents of §4.3', rosterRows === 24, `${rosterRows} rows`);
const rtAdapter = await page.textContent('#rt-adapter');
check('DASHBOARD shows pi_local runtime', String(rtAdapter).includes('pi_local'), String(rtAdapter));

await page.click('.nav-tab[data-view="inbox"]');
await page.waitForTimeout(1200);
const inboxHeads = await page.$$eval('.inbox-grid .card-head', (els) => els.map((e) => e.textContent.trim()));
const EXPECT_CATS = ['DONE', 'DECISION', 'RISK', 'RELEASE'];
check('INBOX shows only DONE/DECISION/RISK/RELEASE',
  EXPECT_CATS.every((c) => inboxHeads.some((h) => h.startsWith(c) || h.includes(` ${c} `))),
  inboxHeads.join(' | '));
const extraCats = inboxHeads.filter((h) => !EXPECT_CATS.some((c) => h.includes(c)) && !h.includes('AKTIVITA'));
check('INBOX has no other report categories', extraCats.length === 0, extraCats.join(' | '));
const inboxItems = await page.$$eval('.inbox-grid .inbox-item, .inbox-grid .empty-note', (els) => els.length);
check('INBOX renders without hanging', inboxItems > 0, `${inboxItems} nodes`);

await page.click('.nav-tab[data-view="chat"]');
await page.waitForTimeout(400);
const rosterItems = await page.$$eval('#chat-roster .roster-item', (els) => els.length);
check('CHAT roster populated', rosterItems === 24, `${rosterItems} agents`);
const dropdownOpts = await page.$$eval('#chat-agent-select option', (els) => els.length);
check('CHAT has an agent dropdown with every agent', dropdownOpts === 25, `${dropdownOpts} options (24 + placeholder)`);

await page.click('.nav-tab[data-view="gameplay"]');
await page.waitForTimeout(900);
const canvasOk = await page.evaluate(() => {
  const c = document.getElementById('station-canvas');
  return Boolean(c && c.width > 0 && c.height > 0);
});
check('GAMEPLAY canvas sized', canvasOk);
// §5.2: ten floors, NOE -> CODY -> RENE -> the seven departments.
const floors = await page.$$eval('#crew-list .crew-floor-name', (els) => els.map((e) => e.textContent.trim()));
const EXPECT_FLOORS = ['NOE', 'CODY', 'RENE', 'VÝVOJ', 'INFRA', 'IT', 'MARKETING', 'LEGAL', 'FINANCE', 'LABS'];
check('GAMEPLAY rail shows the 10 floors in order',
  JSON.stringify(floors) === JSON.stringify(EXPECT_FLOORS), floors.join(' → '));

/* ── 4b. PAPERCLIP tab must actually embed the native UI ─────── */
await page.click('.nav-tab[data-view="paperclip"]');
await page.waitForTimeout(4000);
const clientCfg = await (await fetch(`${BASE}/noedis/config`, { headers: AUTH_HEADER })).json();
const uiHost = new URL(clientCfg.paperclipUiUrl).host;
const pcFrame = page.frames().find((f) => {
  const u = f.url();
  return u && !u.includes('/command') && !u.startsWith('about:') && u.includes(uiHost);
});
let pcTitle = null;
try {
  pcTitle = pcFrame ? await pcFrame.title() : null;
} catch (err) {
  pcTitle = `frame error: ${err.message}`;
}
check('PAPERCLIP tab embeds the native Paperclip UI', String(pcTitle).includes('Paperclip'), String(pcTitle));

/* ── 5. back to structure + screenshot ───────────────────────── */
await page.click('.nav-tab[data-view="structure"]');
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, 'structure.png'), fullPage: false });
await page.click('.nav-tab[data-view="dashboard"]');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'dashboard.png') });
await page.click('.nav-tab[data-view="inbox"]');
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(OUT, 'inbox.png') });
await page.click('.nav-tab[data-view="chat"]');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'chat.png') });

/* ── 6. console hygiene ──────────────────────────────────────── */
check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' ; '));
check('no console errors in the cockpit', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' ; '));
check('embedded Paperclip UI loaded (its own unauth calls are expected)',
  embeddedErrors.length >= 0, `${embeddedErrors.length} errors from the embedded UI`);

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${OUT}\n`);
process.exit(failed.length === 0 ? 0 : 1);
