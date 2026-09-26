/* Capture one screenshot per view. Usage: node test/shots.mjs [baseUrl] */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || 'http://127.0.0.1:3200';
const OUT = path.join(__dirname, 'out');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3500);

for (const view of ['structure', 'gameplay', 'dashboard', 'inbox', 'chat', 'paperclip']) {
  await page.click(`.nav-tab[data-view="${view}"]`);
  await page.waitForTimeout(view === 'gameplay' ? 2500 : 1200);
  await page.screenshot({ path: path.join(OUT, `${view}.png`) });
  console.log(`  ${view}.png`);
}

await browser.close();
console.log(`screenshots -> ${OUT}`);
