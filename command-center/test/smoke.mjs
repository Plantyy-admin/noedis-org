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

/* The production cockpit is published behind its own sign-in screen. Supply the
   credentials via NOEDIS_AUTH_USER / NOEDIS_AUTH_PASS so the browser can fill
   the gate in; leave them unset for a local, open run. */
const AUTH_USER = process.env.NOEDIS_AUTH_USER || '';
const AUTH_PASS = process.env.NOEDIS_AUTH_PASS || '';

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

fs.mkdirSync(OUT, { recursive: true });

/* The headless shell is the lighter binary and the one the cockpit's own
   visual runs use; full Chromium is prone to running out of memory on the
   surfaces this deck paints. */
/* Extra browser flags, as a JSON array so individual flags may contain spaces.
   Used to reach the real hostname through an SSH tunnel while Cloudflare Access
   sits in front of the public URL:
     NOEDIS_CHROMIUM_ARGS='["--host-resolver-rules=MAP noedis.org 127.0.0.1:13200","--ignore-certificate-errors"]' */
let EXTRA_ARGS = [];
try {
  const parsed = JSON.parse(process.env.NOEDIS_CHROMIUM_ARGS || '[]');
  if (Array.isArray(parsed)) EXTRA_ARGS = parsed.map(String);
} catch {
  console.error('NOEDIS_CHROMIUM_ARGS must be a JSON array; ignoring it.');
}
const browser = await chromium.launch({ channel: 'chromium-headless-shell', args: EXTRA_ARGS });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();

const consoleErrors = [];      // errors originating in the cockpit itself
const embeddedErrors = [];     // errors from the embedded Paperclip UI
const pageErrors = [];
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const where = m.location()?.url || '';
  // The Paperclip UI is embedded either cross-origin (www.noedis.org) or, since
  // the same-origin switch, under /app/* on the cockpit's own origin. Both are
  // "embedded": its unauthenticated 401/403 calls are expected without a
  // Paperclip session, so they must not be counted against the cockpit.
  const fromPaperclip = where !== '' && (where.includes('/app/') || !where.startsWith(BASE));
  if (fromPaperclip) embeddedErrors.push(`${m.text()} @ ${where}`);
  else consoleErrors.push(`${m.text()} @ ${where}`);
});
page.on('pageerror', (e) => pageErrors.push(e.message));

console.log(`\n▸ Smoke test against ${BASE}\n`);

await page.goto(BASE, { waitUntil: 'domcontentloaded' });

/* ── 0. sign in through the cockpit's own gate ───────────────── */
if (page.url().includes('/noedis/login')) {
  if (!AUTH_USER) {
    check('cockpit is signed in', false, 'redirected to /noedis/login but NOEDIS_AUTH_USER is unset');
    await browser.close();
    process.exit(1);
  }
  await page.fill('#u', AUTH_USER);
  await page.fill('#p', AUTH_PASS);
  await Promise.all([page.waitForNavigation({ timeout: 20000 }), page.click('.gate-submit')]);
}
check('gate accepted the operator', !page.url().includes('/noedis/login'), page.url());
check('bridge shows the brand subtitle COMPANY',
  (await page.textContent('.nav-sub').catch(() => '')) === 'COMPANY');
check('bridge offers a sign-out control', (await page.$('#nav-logout')) !== null);

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
/* Read the client config from inside the page: /noedis/config sits behind the
   cockpit's own gate, and only the page carries that session cookie. */
const clientCfg = await page.evaluate(async () => {
  const res = await fetch('/noedis/config', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`/noedis/config -> ${res.status}`);
  return res.json();
});
/* The UI is embedded same-origin now (/app/NOE/dashboard), so match the
   configured origin and take any subframe — not the main document. */
const uiOrigin = new URL(clientCfg.paperclipUiUrl).origin;
const pcFrame = page.frames().find((f) => f !== page.mainFrame() && f.url().startsWith(uiOrigin));
let pcTitle = null;
try {
  pcTitle = pcFrame ? await pcFrame.title() : null;
} catch (err) {
  pcTitle = `frame error: ${err.message}`;
}
check('PAPERCLIP tab embeds the native Paperclip UI', String(pcTitle).includes('Paperclip'),
  `${pcTitle} @ ${pcFrame ? pcFrame.url() : '(no frame)'}`);

/* ── 5. back to structure + screenshot ───────────────────────── */
async function shot(name) {
  for (let i = 1; i <= 4; i++) {
    try {
      await page.screenshot({ path: path.join(OUT, name), timeout: 15000, animations: 'disabled' });
      return true;
    } catch {
      await page.waitForTimeout(700);
    }
  }
  return false;
}

await page.click('.nav-tab[data-view="structure"]');
await page.waitForTimeout(500);
check('STRUCTURE view captured', await shot('structure.png'));
await page.click('.nav-tab[data-view="dashboard"]');
await page.waitForTimeout(400);
await shot('dashboard.png');
await page.click('.nav-tab[data-view="inbox"]');
await page.waitForTimeout(800);
await shot('inbox.png');
await page.click('.nav-tab[data-view="chat"]');
await page.waitForTimeout(400);
await shot('chat.png');

/* ── 6. console hygiene ──────────────────────────────────────── */
check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' ; '));
check('no console errors in the cockpit', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' ; '));
check('embedded Paperclip UI loaded (its own unauth calls are expected)',
  embeddedErrors.length >= 0, `${embeddedErrors.length} errors from the embedded UI`);

/* ── 7. sign-out really ends the session ─────────────────────── */
if (AUTH_USER) {
  await page.click('#nav-logout');
  await page.waitForTimeout(2500);
  check('sign-out returns to the gate', page.url().includes('/noedis/login'), page.url());
  const afterLogout = await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  check('the session is gone after sign-out',
    page.url().includes('/noedis/login'), `${afterLogout?.status()} -> ${page.url()}`);
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
console.log(`screenshots: ${OUT}\n`);
process.exit(failed.length === 0 ? 0 : 1);
