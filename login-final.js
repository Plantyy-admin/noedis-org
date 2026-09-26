import { chromium } from 'playwright';
import { readFileSync } from 'fs';

(async () => {
  // Read token from file (created by SSH)
  const token = readFileSync('/tmp/noedis-token.txt', 'utf8').trim();
  console.log('Token:', token.substring(0, 20) + '...');
  
  if (!token || token.length < 10) {
    console.log('❌ No valid token found. Run the SSH command first.');
    process.exit(1);
  }
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  await context.addCookies([
    {
      name: 'paperclip-default.session-token',
      value: token,
      domain: 'noedis.org',
      path: '/',
      httpOnly: false,
      secure: true,
      sameSite: 'Lax'
    }
  ]);
  
  const page = await context.newPage();
  await page.goto('https://noedis.org/', { waitUntil: 'networkidle', timeout: 20000 });
  
  console.log('📍 URL:', page.url());
  await page.screenshot({ path: '/tmp/noedis-final.png' });
  
  console.log('✅ Browser ready!');
  await new Promise(() => {});
})();