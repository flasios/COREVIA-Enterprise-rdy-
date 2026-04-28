import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:5001/login');
await page.waitForTimeout(800);
await page.fill('input[name=identifier]', 'superadmin');
await page.fill('input[name=password]', 'Kr2!hohekoVSS4dDjWGC');
await page.click('button[type=submit]');
await page.waitForTimeout(3000);

await page.goto('http://127.0.0.1:5001/pmo-office');
await page.waitForTimeout(2000);

// Click Open AI Tasks
await page.locator('text=Open AI Tasks').click();
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/pmo-ai-1-landing.png' });

// Click New Conversation
const newConvBtn = page.locator('button:has-text("New Conversation"), button:has-text("Start Conversation")').first();
if (await newConvBtn.isVisible()) {
  await newConvBtn.click();
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: '/tmp/pmo-ai-2-new-conv.png' });

// Log all visible inputs/textareas
const inputs = await page.locator('input:visible, textarea:visible').all();
console.log('Visible inputs/textareas:', inputs.length);
for (const inp of inputs) {
  const tag = await inp.evaluate(el => el.tagName);
  const ph = await inp.getAttribute('placeholder');
  const type = await inp.getAttribute('type');
  console.log({ tag, type, placeholder: ph });
}

// Try typing
const chatInput = page.locator('input[placeholder*="Ask"], textarea[placeholder*="Ask"], input[placeholder*="Type"], textarea[placeholder*="Type"], input[placeholder*="message"], textarea[placeholder*="message"]').first();
if (await chatInput.isVisible().catch(() => false)) {
  await chatInput.fill('What projects are critical?');
  await page.screenshot({ path: '/tmp/pmo-ai-3-typed.png' });
  await chatInput.press('Enter');
  await page.waitForTimeout(10000);
  await page.screenshot({ path: '/tmp/pmo-ai-4-response.png' });
  console.log('Response received');
} else {
  console.log('Chat input NOT FOUND');
  // Dump all clickable elements
  const btns = await page.locator('button:visible').all();
  for (const b of btns) {
    const t = await b.textContent();
    if (t?.trim()) console.log('Button:', t.trim().substring(0, 50));
  }
}

await browser.close();
