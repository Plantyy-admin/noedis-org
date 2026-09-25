import { chromium } from 'playwright';

const INVITE_URL = 'http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to invite URL...');
  await page.goto(INVITE_URL, { waitUntil: 'networkidle' });

  // Wait for the page to load - check what's rendered
  const content = await page.content();
  console.log('Page loaded, length:', content.length);
  
  // Try to find signup/claim form elements
  const buttons = await page.locator('button, a, [role="button"]').all();
  console.log('Buttons found:', buttons.length);
  for (const btn of buttons) {
    const text = await btn.textContent();
    console.log('  -', text?.trim().substring(0, 80));
  }

  // Check for input fields
  const inputs = await page.locator('input, textarea, select').all();
  console.log('Inputs found:', inputs.length);
  for (const inp of inputs) {
    const id = await inp.getAttribute('id');
    const name = await inp.getAttribute('name');
    const placeholder = await inp.getAttribute('placeholder');
    console.log('  -', { id, name, placeholder });
  }

  // Take screenshot for debugging
  await page.screenshot({ path: '/tmp/invite-page.png', fullPage: true });
  console.log('Screenshot saved to /tmp/invite-page.png');

  // Check localStorage and sessionStorage
  const ls = await page.evaluate(() => JSON.stringify({...localStorage}));
  console.log('localStorage:', ls?.substring(0, 500));

  await browser.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});