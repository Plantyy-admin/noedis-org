import { chromium } from 'playwright';

const INVITE_URL = 'http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to invite URL...');
  await page.goto(INVITE_URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Fill in the signup form
  await page.fill('#invite-name', 'Founder');
  await page.fill('#invite-email', 'founder@noedis.org');
  await page.fill('#invite-password', 'NoedisAdmin2026!');
  
  console.log('Form filled, clicking Create account...');
  
  // Click the create account button
  await page.click('button:has-text("Create account")');
  
  // Wait for navigation or response
  await page.waitForTimeout(3000);
  
  // Check what happened
  const url = page.url();
  console.log('Current URL after submit:', url);
  
  const content = await page.content();
  console.log('Page content length:', content.length);
  
  // Check for success/error messages
  const bodyText = await page.locator('body').innerText();
  console.log('Body text:', bodyText.substring(0, 1000));
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/after-claim.png', fullPage: true });
  console.log('Screenshot saved to /tmp/after-claim.png');
  
  // Get cookies/tokens
  const cookies = await context.cookies();
  console.log('Cookies:', cookies.map(c => c.name + '=' + c.value.substring(0, 20) + '...'));
  
  // Check localStorage for auth token
  const ls = await page.evaluate(() => JSON.stringify({...localStorage}));
  console.log('localStorage:', ls);

  await browser.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});