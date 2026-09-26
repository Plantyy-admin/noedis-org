import { chromium } from 'playwright';

(async () => {
  // First, login via API to get session token
  const loginRes = await fetch('https://noedis.org/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://noedis.org' },
    body: JSON.stringify({ email: 'lukas.plant1010@gmail.com', password: 'REDACTED' })
  });
  const loginData = await loginRes.json();
  
  if (!loginData.token) {
    console.log('❌ Login API failed:', JSON.stringify(loginData));
    process.exit(1);
  }
  
  console.log('✅ API login OK, token:', loginData.token.substring(0, 20) + '...');
  
  // Launch browser with pre-set cookie
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  // Set the session cookie BEFORE navigating
  await context.addCookies([
    {
      name: 'paperclip-default.session-token',
      value: loginData.token,
      domain: 'noedis.org',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    }
  ]);
  
  const page = await context.newPage();
  
  // Navigate to dashboard
  await page.goto('https://noedis.org/NOE/dashboard', { 
    waitUntil: 'networkidle',
    timeout: 20000 
  });
  
  console.log('📍 URL:', page.url());
  await page.screenshot({ path: '/tmp/noedis-loggedin.png' });
  
  const title = await page.title();
  console.log('📄 Title:', title);
  
  if (page.url().includes('/dashboard') || page.url().includes('/NOE/')) {
    console.log('✅ SUCCESS - fully logged in!');
  } else {
    console.log('⚠️ Not on dashboard. URL:', page.url());
    // Try root
    await page.goto('https://noedis.org/', { waitUntil: 'networkidle' });
    console.log('📍 Root URL:', page.url());
    await page.screenshot({ path: '/tmp/noedis-root.png' });
  }
  
  console.log('\n✅ Browser open — all 5 views ready!');
  await new Promise(() => {});
})();