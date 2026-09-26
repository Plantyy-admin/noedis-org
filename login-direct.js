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
  
  // Go to site
  await page.goto('https://noedis.org/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  console.log('📍 Initial URL:', page.url());
  
  // Execute login via fetch and set cookie in one go
  const result = await page.evaluate(async () => {
    try {
      const res = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'lukas.plant1010@gmail.com', password: 'REDACTED' })
      });
      const data = await res.json();
      
      if (data.token) {
        // Set the cookie
        document.cookie = `paperclip-default.session-token=${data.token}; path=/; max-age=86400; secure; samesite=lax`;
        document.cookie = `paperclip.session-token=${data.token}; path=/; max-age=86400; secure; samesite=lax`;
        return { success: true, token: data.token };
      }
      return { success: false, error: data };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });
  
  console.log('Login result:', JSON.stringify(result));
  
  if (result.success) {
    console.log('✅ API login + cookie set!');
    
    // Reload to let server read the cookie
    await page.goto('https://noedis.org/', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('📍 After reload:', page.url());
    
    await page.screenshot({ path: '/tmp/noedis-final.png' });
  } else {
    console.log('❌ Login failed');
  }
  
  console.log('✅ Browser stays open');
  await new Promise(() => {});
})();