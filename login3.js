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
  
  console.log('1️⃣ Getting session token via Paperclip API...');
  
  // Login via API directly on port 3100
  const loginRes = await page.request().post('https://noedis.org/api/auth/sign-in/email', {
    data: { email: 'lukas.plant1010@gmail.com', password: 'REDACTED' }
  });
  
  const loginData = await loginRes.json();
  console.log('API Response:', JSON.stringify(loginData).substring(0, 200));
  
  if (loginData.token) {
    console.log('2️⃣ Setting session cookie...');
    
    // Set the session cookie
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
    
    // Also try other possible cookie names
    await context.addCookies([
      {
        name: 'paperclip.session-token',
        value: loginData.token,
        domain: 'noedis.org',
        path: '/',
        httpOnly: false,
        secure: true,
        sameSite: 'Lax'
      }
    ]);
    
    console.log('3️⃣ Navigating to dashboard...');
    await page.goto('https://noedis.org/NOE/dashboard', { 
      waitUntil: 'networkidle', 
      timeout: 15000 
    });
    
    console.log('📍 Dashboard URL:', page.url());
    await page.screenshot({ path: '/tmp/noedis-final.png' });
    
    if (page.url().includes('/dashboard') || page.url().includes('/NOE/')) {
      console.log('✅ SUCCESS - Logged in!');
    } else {
      console.log('⚠️ Still on auth page, trying alternate approach...');
      // Try navigating to root
      await page.goto('https://noedis.org/', { waitUntil: 'networkidle' });
      console.log('📍 Root URL:', page.url());
      await page.screenshot({ path: '/tmp/noedis-root.png' });
    }
  } else {
    console.log('❌ Login failed:', JSON.stringify(loginData));
  }
  
  console.log('\n✅ Browser open — use it!');
  await new Promise(() => {});
})();