import { chromium } from 'playwright';

// The founder password is never stored in the repo.
const ADMIN_PASS = process.env.NOEDIS_ADMIN_PASS;
if (!ADMIN_PASS) throw new Error('set NOEDIS_ADMIN_PASS');

const INVITE_URL = 'http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for all API requests
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      console.log(`Response ${response.status()} ${response.url().split('/api/')[1]}`);
    }
  });

  console.log('Navigating to invite URL...');
  await page.goto(INVITE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Try clicking "I already have an account" first
  console.log('Clicking "I already have an account"...');
  await page.click('button:has-text("I already have an account")');
  await page.waitForTimeout(1000);

  // Check what inputs are now visible
  const inputs = await page.locator('input').all();
  console.log('Inputs after switch:', inputs.length);
  for (const inp of inputs) {
    const id = await inp.getAttribute('id');
    const name = await inp.getAttribute('name');
    const type = await inp.getAttribute('type');
    const ph = await inp.getAttribute('placeholder');
    console.log('  -', { id, name, type, ph });
  }

  // Fill sign-in form
  const emailInput = await page.locator('#invite-email');
  if (await emailInput.isVisible()) {
    await emailInput.fill('founder@noedis.org');
  }
  const passInput = await page.locator('#invite-password');
  if (await passInput.isVisible()) {
    await passInput.fill(ADMIN_PASS);
  }
  
  // Look for sign-in button
  const buttons = await page.locator('button').all();
  console.log('Buttons visible:');
  for (const btn of buttons) {
    if (await btn.isVisible()) {
      const text = await btn.textContent();
      console.log('  -', text.trim());
    }
  }

  // Click sign in button
  const signInBtn = page.locator('button:has-text("Sign in")');
  if (await signInBtn.isVisible()) {
    console.log('Clicking Sign in...');
    await signInBtn.click();
    await page.waitForTimeout(5000);
    
    const url = page.url();
    console.log('URL after sign in:', url);
    
    const bodyText = await page.locator('body').innerText();
    console.log('Body:', bodyText.substring(0, 500));
    
    const cookies = await context.cookies();
    console.log('Cookies:', cookies.map(c => c.name));
    
    const ls = await page.evaluate(() => JSON.stringify({...localStorage}));
    console.log('localStorage keys:', Object.keys(JSON.parse(ls)));
  }

  await page.screenshot({ path: '/tmp/after-signin.png', fullPage: true });
  console.log('Screenshot saved');

  await browser.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});