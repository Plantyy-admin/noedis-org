import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--start-maximized']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    storageState: undefined
  });
  
  const page = await context.newPage();
  
  console.log('🌐 Opening https://noedis.org...');
  await page.goto('https://noedis.org', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  // Wait a moment for redirects
  await page.waitForTimeout(2000);
  
  const url = page.url();
  console.log('📍 URL:', url);
  
  if (url.includes('auth') || url.includes('login') || url.includes('signin')) {
    console.log('🔑 Login page detected, filling credentials...');
    
    // Try to find email/username field
    const emailField = await page.$('input[type="email"], input[name="email"], input[autocomplete="email"], input[placeholder*="mail" i]');
    if (emailField) {
      await emailField.fill('lukas.plant1010@gmail.com');
      await page.waitForTimeout(500);
      
      const passField = await page.$('input[type="password"]');
      if (passField) {
        await passField.fill('REDACTED');
        await page.waitForTimeout(500);
      }
      
      // Click submit
      const submitBtn = await page.$('button[type="submit"], button:has-text("Continue"), button:has-text("Sign in")');
      if (submitBtn) {
        await submitBtn.click();
        console.log('✅ Logged in!');
        await page.waitForTimeout(3000);
      }
    }
  }
  
  console.log('📍 Final URL:', page.url());
  await page.screenshot({ path: '/tmp/noedis-final.png' });
  console.log('📸 Screenshot saved');
  console.log('✅ Browser stays open — use it!');
  
  // Keep browser open
  await new Promise(() => {});
})();