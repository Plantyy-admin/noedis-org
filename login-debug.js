import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  // Step 1: Go to login page
  await page.goto('https://noedis.org/auth', { waitUntil: 'networkidle', timeout: 15000 });
  console.log('1. Auth page loaded:', page.url());
  
  // Step 2: Try the API login and capture ALL response headers/cookies
  const [response] = await Promise.all([
    page.waitForResponse(resp => resp.url().includes('/api/auth/') && resp.status() === 200, { timeout: 10000 }).catch(() => null),
    page.evaluate(async () => {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lukas.plant1010@gmail.com', password: 'REDACTED' })
      });
      return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body: await res.json() };
    })
  ]);
  
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'lukas.plant1010@gmail.com', password: 'REDACTED' })
    });
    const body = await res.json();
    return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
  });
  
  console.log('2. API Response:');
  console.log('   Status:', result.status);
  console.log('   Body:', JSON.stringify(result.body, null, 2));
  console.log('   Headers:', JSON.stringify(result.headers, null, 2));
  
  if (result.body.token) {
    console.log('\n3. Got token, checking cookies...');
    const cookies = await context.cookies();
    console.log('   Current cookies:', JSON.stringify(cookies, null, 2));
    
    // Try to reload
    await page.goto('https://noedis.org/', { waitUntil: 'networkidle' });
    console.log('4. After reload:', page.url());
  }
  
  await page.screenshot({ path: '/tmp/noedis-debug.png' });
  console.log('\n✅ Browser stays open');
  await new Promise(() => {});
})();