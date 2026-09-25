import { chromium } from 'playwright';

const INVITE_URL = 'http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for API responses
  page.on('response', response => {
    if (response.url().includes('/api/auth/sign-in') || response.url().includes('/api/auth/get-session')) {
      console.log(`Auth response: ${response.status()} ${response.url().split('/api/')[1]}`);
    }
  });

  console.log('Navigating to invite URL...');
  await page.goto(INVITE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click "I already have an account"
  await page.click('button:has-text("I already have an account")');
  await page.waitForTimeout(500);

  // Fill in credentials - Plantyy's email with new password
  await page.fill('#invite-email', 'lukas.plant1010@gmail.com');
  await page.fill('#invite-password', 'NoedisAdmin2026!');
  
  // Click Sign in and continue
  await page.click('button:has-text("Sign in and continue")');
  await page.waitForTimeout(3000);

  // Get all cookies
  const cookies = await context.cookies();
  console.log('\nCookies after sign-in:');
  for (const c of cookies) {
    console.log(`  ${c.name}: ${c.value.substring(0, 60)}... (domain: ${c.domain}, path: ${c.path})`);
  }

  // Check if we're still on invite page or redirected
  const url = page.url();
  console.log('\nCurrent URL:', url);

  // Take screenshot
  await page.screenshot({ path: '/tmp/after-signin-2.png', fullPage: true });
  console.log('Screenshot saved');

  // Get localStorage
  const ls = await page.evaluate(() => JSON.stringify({...localStorage}));
  console.log('localStorage:', ls);
  
  // Try to get page body text
  const bodyText = await page.locator('body').innerText();
  console.log('\nPage body (first 500 chars):', bodyText.substring(0, 500));

  await browser.close();
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});