import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to invite and sign in
  await page.goto('http://127.0.0.1:3100/invite/pcp_bootstrap_ebf75869ae6961b6979d6814bc8bc3efc36b222fe4bd1fab', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Click "I already have an account"
  await page.click('button:has-text("I already have an account")');
  await page.waitForTimeout(500);

  // Fill sign-in form with the existing admin's credentials
  // We need to find what password was used. Let me try via the API
  // Actually, we don't know the password. Let me create a new admin user via DB
  
  // Let's check if we can directly submit to create a new account
  await page.click('button:has-text("Create account")');
  await page.waitForTimeout(500);
  
  await page.fill('#invite-name', 'Founder');
  await page.fill('#invite-email', 'founder@noedis.org');
  await page.fill('#invite-password', 'TestPass123!');
  
  // Wait for the submit and check network response
  const responsePromise = page.waitForResponse(r => r.url().includes('/api/auth/sign-up/email'), { timeout: 10000 }).catch(() => null);
  await page.click('button:has-text("Create account and continue")');
  const response = await responsePromise;
  
  if (response) {
    console.log('Signup response status:', response.status());
    const body = await response.text();
    console.log('Signup response body:', body.substring(0, 500));
  }
  
  await page.waitForTimeout(2000);
  
  // Get cookies after the attempt
  const cookies = await context.cookies();
  console.log('Cookies after signup attempt:');
  for (const c of cookies) {
    console.log(`  ${c.name}: ${c.value.substring(0, 40)}... (domain: ${c.domain})`);
  }
  
  // Get localStorage
  const ls = await page.evaluate(() => JSON.stringify({...localStorage}));
  console.log('localStorage:', ls);
  
  await page.screenshot({ path: '/tmp/after-signup-2.png', fullPage: true });
  console.log('Screenshot saved');
  
  await browser.close();
  console.log('Done.');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});