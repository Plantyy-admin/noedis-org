import { chromium } from 'playwright';

(async () => {
  console.log('🔑 Getting session token from VPS Paperclip API...');
  
  // Login via the VPS directly (bypasses all DNS/SSL issues)
  const { execSync } = await import('child_process');
  const curlCmd = `curl -s 'http://127.0.0.1:3100/api/auth/sign-in/email' -H 'Content-Type: application/json' -H 'Origin: https://noedis.org' -d '{"email":"lukas.plant1010@gmail.com","password":"REDACTED"}'`;
  
  const result = execSync(`sshpass -p 'REDACTED' ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no -p 501 vpsadmin@76.13.154.124 "${curlCmd.replace(/"/g, '\\"')}"`, { timeout: 15000 });
  
  const loginData = JSON.parse(result.toString());
  
  if (!loginData.token) {
    console.log('❌ Login failed:', JSON.stringify(loginData));
    process.exit(1);
  }
  
  console.log('✅ Got session token');
  
  // Launch browser
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  // Set session cookie
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
  
  console.log('🌐 Navigating to dashboard...');
  await page.goto('https://noedis.org/', { 
    waitUntil: 'networkidle', 
    timeout: 20000 
  });
  
  console.log('📍 URL:', page.url());
  await page.screenshot({ path: '/tmp/noedis-final.png' });
  
  if (page.url().includes('/auth')) {
    console.log('⚠️ Still on auth page, trying root...');
    await page.goto('https://noedis.org/', { waitUntil: 'networkidle' });
    console.log('📍 URL after retry:', page.url());
  }
  
  console.log('✅ Browser stays open — Paperclip ready!');
  await new Promise(() => {});
})();