import { chromium } from 'playwright';

const INVITE_URL = 'http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen for API responses
  const apiResponses = [];
  page.on('response', response => {
    if (response.url().includes('/api/')) {
      apiResponses.push({ status: response.status(), url: response.url().split('/api/')[1] });
    }
  });

  console.log('Navigating to invite URL...');
  await page.goto(INVITE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click "I already have an account"
  await page.click('button:has-text("I already have an account")');
  await page.waitForTimeout(500);

  // Fill in credentials - our new founder user
  await page.fill('#invite-email', 'founder@noedis.org');
  await page.fill('#invite-password', 'NoedisPass2026!');
  
  // Click Sign in and continue
  await page.click('button:has-text("Sign in and continue")');
  await page.waitForTimeout(5000);

  // Get all cookies
  const cookies = await context.cookies();
  console.log('\nCookies after sign-in:');
  for (const c of cookies) {
    console.log(`  ${c.name}: ${c.value.substring(0, 80)} (domain: ${c.domain}, path: ${c.path})`);
  }

  // Check if we're still on invite page or redirected
  const url = page.url();
  console.log('\nCurrent URL:', url);

  // Take screenshot
  await page.screenshot({ path: '/tmp/after-signin-3.png', fullPage: true });
  console.log('Screenshot saved');

  // Get page body text
  const bodyText = await page.locator('body').innerText();
  console.log('\nPage body (first 500 chars):', bodyText.substring(0, 500));

  // Print API responses
  console.log('\nAPI responses during session:');
  for (const r of apiResponses) {
    console.log(`  ${r.status} ${r.url}`);
  }

  await browser.close();
  console.log('\nDone.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});