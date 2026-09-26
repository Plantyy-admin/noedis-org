import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true
  });
  
  const page = await context.newPage();
  
  console.log('🔵 Navigating to https://noedis.org...');
  await page.goto('https://noedis.org', { waitUntil: 'networkidle', timeout: 30000 });
  
  console.log('📸 Current URL:', page.url());
  const title = await page.title();
  console.log('📄 Title:', title);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/noedis-login.png', fullPage: false });
  console.log('📸 Screenshot saved to /tmp/noedis-login.png');
  
  // If we see Paperclip login, fill credentials
  const emailInput = await page.$('input[type="email"], input[name="email"], input[placeholder*="email" i]');
  if (emailInput) {
    console.log('🔑 Found login form, filling credentials...');
    await emailInput.fill('lukas.plant1010@gmail.com');
    
    const passInput = await page.$('input[type="password"], input[name="password"]');
    if (passInput) {
      await passInput.fill('REDACTED');
      
      const submitBtn = await page.$('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In"), button:has-text("Continue")');
      if (submitBtn) {
        await submitBtn.click();
        console.log('✅ Clicked login button');
        await page.waitForTimeout(3000);
      }
    }
  }
  
  // Wait for dashboard to load
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/noedis-dashboard.png', fullPage: false });
  console.log('📸 Dashboard screenshot saved');
  
  console.log('🌐 Current URL:', page.url());
  
  // Keep browser open for user
  console.log('✅ Browser is open and logged in!');
})();