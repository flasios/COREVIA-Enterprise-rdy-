import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:5001';

async function shot(page, name) {
  await page.screenshot({ path: `/tmp/corevia_${name}.png`, fullPage: false });
  console.log(`📸 ${name}  →  ${page.url()}`);
}

const b = await chromium.launch({ headless: true });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// ─── 1. LOGIN ──────────────────────────────────────────────────────────────
await page.goto(`${BASE}/login`);
await page.waitForSelector('input[type="password"]', { timeout: 8000 });
await page.locator('input[type="text"], input[name="username"]').first().fill('superadmin');
await page.locator('input[type="password"]').fill('CoreviaSmoke#2026');
await shot(page, '01_login');
await page.locator('input[type="password"]').press('Enter');
await page.waitForFunction(() => !window.location.href.includes('/login'), { timeout: 12000 });
await page.waitForTimeout(2500);
await shot(page, '02_home');
console.log('Home URL:', page.url());

// ─── 2. DEMAND MODULE ──────────────────────────────────────────────────────
await page.goto(`${BASE}/demand`);
await page.waitForTimeout(2000);
await shot(page, '03_demand_list');

// Find & click "New" / "Create" / "Submit Request" button
const newBtn = page.locator('button:has-text("New"), button:has-text("Submit Request"), button:has-text("Create Demand"), a:has-text("New Request")').first();
const hasnew = await newBtn.count();
console.log('New demand button count:', hasnew);
if (hasnew > 0) {
  await newBtn.click();
  await page.waitForTimeout(1200);
  await shot(page, '04_demand_form_open');

  const titleField = page.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="name" i]').first();
  if (await titleField.count() > 0) {
    await titleField.fill('AI-Powered Customer Analytics Platform');
  }
  const descField = page.locator('textarea[name="description"], textarea[placeholder*="description" i], textarea').first();
  if (await descField.count() > 0) {
    await descField.fill('Build a real-time AI analytics dashboard to improve customer retention by 25%.');
  }
  await shot(page, '05_demand_form_filled');

  // Submit
  const submitBtn = page.locator('button[type="submit"], button:has-text("Submit"), button:has-text("Create"), dialog button:has-text("Save")').last();
  await submitBtn.click();
  await page.waitForTimeout(2500);
  await shot(page, '06_demand_after_submit');
}

// ─── 3. OPEN DEMAND DETAIL ─────────────────────────────────────────────────
// Click the first demand row
const firstRow = page.locator('table tbody tr, [data-testid*="demand-row"], .demand-card').first();
if (await firstRow.count() > 0) {
  await firstRow.click();
  await page.waitForTimeout(1500);
  await shot(page, '07_demand_detail');
}

// ─── 4. PORTFOLIO / PROJECTS ───────────────────────────────────────────────
await page.goto(`${BASE}/portfolio`);
await page.waitForTimeout(2000);
await shot(page, '08_portfolio_list');

// Create new project
const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add Project"), a:has-text("New Project")').first();
if (await newProjectBtn.count() > 0) {
  await newProjectBtn.click();
  await page.waitForTimeout(1200);
  await shot(page, '09_project_form_open');

  const projTitle = page.locator('input[name="name"], input[name="title"], input[placeholder*="project" i], input[placeholder*="name" i]').first();
  if (await projTitle.count() > 0) {
    await projTitle.fill('AI Customer Analytics Platform — Q2 2026');
  }
  const projDesc = page.locator('textarea[name="description"], textarea[placeholder*="description" i], textarea').first();
  if (await projDesc.count() > 0) {
    await projDesc.fill('Enterprise AI analytics platform build-out, Phase 1.');
  }
  await shot(page, '10_project_form_filled');

  const submitProjBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save"), button:has-text("Submit")').last();
  await submitProjBtn.click();
  await page.waitForTimeout(2500);
  await shot(page, '11_project_created');
}

// ─── 5. OPEN PROJECT WORKSPACE ─────────────────────────────────────────────
// Click the first project card / row
const firstProject = page.locator('[data-testid*="project-card"], table tbody tr, .project-card, a[href*="/portfolio/projects/"]').first();
if (await firstProject.count() > 0) {
  await firstProject.click();
  await page.waitForTimeout(2000);
  await shot(page, '12_project_workspace');
  console.log('Workspace URL:', page.url());
}

// ─── 6. WALK THROUGH PHASE TABS ────────────────────────────────────────────
for (const phase of ['initiation', 'planning', 'execution', 'monitoring', 'closure']) {
  const tab = page.locator(`[data-testid="tab-trigger-${phase}"]`);
  if (await tab.count() > 0) {
    await tab.click();
    await page.waitForTimeout(1200);
    await shot(page, `13_phase_${phase}`);
  }
}

// ─── 7. CLOSURE — Create approval + submit gate ─────────────────────────────
// Already on closure tab — look for approval creation or gate submission UI
const closureApprovalBtn = page.locator('button:has-text("Request Approval"), button:has-text("Create Approval"), button:has-text("Submit for Approval")').first();
if (await closureApprovalBtn.count() > 0) {
  await closureApprovalBtn.click();
  await page.waitForTimeout(1200);
  await shot(page, '14_closure_approval_dialog');
  // Close dialog if needed
  const cancelBtn = page.locator('button:has-text("Cancel"), button[aria-label="Close"]').first();
  if (await cancelBtn.count() > 0) await cancelBtn.click();
}

// Look for gate section
const gateSection = page.locator('[data-testid*="gate"], section:has-text("Gate"), h2:has-text("Gate"), h3:has-text("Gate")').first();
if (await gateSection.count() > 0) {
  await gateSection.scrollIntoViewIfNeeded();
  await shot(page, '15_closure_gate_section');
}

// ─── 8. FINAL SUMMARY ──────────────────────────────────────────────────────
await shot(page, '16_final_state');
console.log('\n✅ All E2E screenshots captured');
await b.close();
