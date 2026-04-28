/**
 * E2E — Project Lifecycle: Initiation → Closure
 *
 * Validates that a project can be created, all phase tabs and sub-tabs
 * are accessible, and the closure workflow (gate creation, approval
 * request, and approval decision) succeeds end-to-end.
 *
 * Uses the same auth/CSRF pattern as demand.spec.ts to avoid the CSRF
 * issues that block raw curl-based smoke scripts.
 */
import { test, expect, type Page } from '@playwright/test';

import { loginViaUi } from './helpers/auth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectCreateResponse {
  success: boolean;
  data: { id: string; projectName: string; currentPhase?: string };
}

interface GateCreateResponse {
  success: boolean;
  data: { id: string; gateName: string; status: string };
}

interface ApprovalCreateResponse {
  success: boolean;
  data: { id: string; title: string; status: string };
}

interface ApprovalDecideResponse {
  success: boolean;
  data: { id: string; status: string };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getMutationHeaders(page: Page): Promise<Record<string, string>> {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:5000';
  const origin = new URL(baseUrl).origin;
  const cookies = await page.context().cookies(origin);
  let csrfToken = cookies.find((c) => c.name === 'XSRF-TOKEN')?.value;

  if (!csrfToken) {
    const res = await page.request.get('/api/auth/csrf-token', {
      headers: { Origin: origin, Referer: `${origin}/` },
    });
    const body = (await res.json()) as { csrfToken?: string | null };
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    csrfToken = body.csrfToken || undefined;
  }

  if (!csrfToken) {
    throw new Error('Missing XSRF-TOKEN for mutation request.');
  }

  return {
    Origin: origin,
    Referer: `${origin}/`,
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken,
  };
}

// ---------------------------------------------------------------------------
// Shared state — project created once for the whole describe block
// ---------------------------------------------------------------------------

let projectId = '';

test.describe('Project lifecycle — initiation to closure', () => {
  test.describe.configure({ mode: 'serial' });

  test('create project via API', async ({ page }) => {
    await loginViaUi(page, '/portfolio-gateway');

    const headers = await getMutationHeaders(page);
    const res = await page.request.post('/api/portfolio/projects', {
      headers,
      data: {
        directCreate: true,
        projectName: `E2E Lifecycle ${Date.now()}`,
        projectDescription: 'Automated lifecycle smoke test project',
        workspacePath: 'standard',
      },
    });
    const body = (await res.json()) as ProjectCreateResponse;
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.data?.id).toBeTruthy();
    projectId = body.data.id;
  });

  test('workspace loads and all phase tab triggers exist', async ({ page }) => {
    expect(projectId, 'project creation must succeed first').toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await expect(page).toHaveURL(new RegExp(`/project/${projectId}`));

    // Back-to-portfolio button anchors the workspace header
    await expect(page.locator('[data-testid="button-back-portfolio"]')).toBeVisible();

    // All standard phase tab triggers are present in the DOM (sr-only but accessible)
    for (const phase of ['initiation', 'planning', 'execution', 'monitoring', 'closure']) {
      await expect(
        page.locator(`[data-testid="tab-trigger-${phase}"]`),
        `phase trigger "${phase}" missing`,
      ).toBeAttached();
    }
  });

  test('monitoring phase: all sub-tabs render', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    // Switch to monitoring
    await page.locator('[data-testid="tab-trigger-monitoring"]').click();
    await expect(page.locator('[data-testid="button-monitoring-subtab-overview"]')).toBeVisible();

    for (const subTab of ['overview', 'risks', 'compliance', 'governance', 'executive']) {
      await page.locator(`[data-testid="button-monitoring-subtab-${subTab}"]`).click();
      // Workspace header must still be present — proves no crash
      await expect(page.locator('[data-testid="button-back-portfolio"]')).toBeVisible();
    }
  });

  test('monitoring governance sub-tab shows gate governance heading', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await page.locator('[data-testid="tab-trigger-monitoring"]').click();
    await page.locator('[data-testid="button-monitoring-subtab-governance"]').click();

    await expect(page.getByText(/Gate Governance/i).first()).toBeVisible();
  });

  test('closure phase: all sub-tabs render without errors', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await page.locator('[data-testid="tab-trigger-closure"]').click();
    await expect(page.locator('[data-testid="button-closure-subtab-summary"]')).toBeVisible();

    for (const subTab of ['summary', 'deliverables', 'signoff', 'lessons', 'governance']) {
      await page.locator(`[data-testid="button-closure-subtab-${subTab}"]`).click();
      await expect(
        page.locator('[data-testid="button-back-portfolio"]'),
        `workspace crashed on closure sub-tab "${subTab}"`,
      ).toBeVisible();
    }
  });

  test('closure summary sub-tab: closure package status card is present', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await page.locator('[data-testid="tab-trigger-closure"]').click();
    await page.locator('[data-testid="button-closure-subtab-summary"]').click();

    await expect(page.getByText('Closure Package Status')).toBeVisible();
  });

  test('closure governance sub-tab: readiness section is present', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await page.locator('[data-testid="tab-trigger-closure"]').click();
    await page.locator('[data-testid="button-closure-subtab-governance"]').click();

    await expect(page.getByText(/Closure Readiness/i).first()).toBeVisible();
  });

  test('closure gate creation via API succeeds', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    const headers = await getMutationHeaders(page);
    const res = await page.request.post(`/api/portfolio/projects/${projectId}/gates`, {
      headers,
      data: {
        gateName: 'E2E Closure Gate',
        gateType: 'closure',
        gateOrder: 500,
        description: 'E2E lifecycle test gate',
      },
    });
    const body = (await res.json()) as GateCreateResponse;
    expect(res.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.data?.id).toBeTruthy();
    expect(body.data.status).toBeTruthy();
  });

  test('closure approval request and approve decision via API succeeds', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    const headers = await getMutationHeaders(page);

    // 1. Create a pending approval
    const createRes = await page.request.post(`/api/portfolio/projects/${projectId}/approvals`, {
      headers,
      data: {
        approvalType: 'document',
        title: 'E2E Project Closure Sign-off',
        description: 'E2E lifecycle test — project closure approval',
        priority: 'high',
        status: 'pending',
      },
    });
    const createBody = (await createRes.json()) as ApprovalCreateResponse;
    expect(createRes.ok(), JSON.stringify(createBody)).toBeTruthy();

    const approvalId = createBody.data?.id;
    expect(approvalId).toBeTruthy();

    // 2. Approve it
    const decideRes = await page.request.post(`/api/portfolio/approvals/${approvalId}/decide`, {
      headers,
      data: { decision: 'approved', comments: 'E2E lifecycle smoke — approved.' },
    });
    const decideBody = (await decideRes.json()) as ApprovalDecideResponse;
    expect(decideRes.ok(), JSON.stringify(decideBody)).toBeTruthy();
    expect(decideBody.data?.status).toBe('approved');
  });

  test('closure signoff sub-tab: shows approval list section', async ({ page }) => {
    expect(projectId).toBeTruthy();
    await loginViaUi(page, `/project/${projectId}`);

    await page.locator('[data-testid="tab-trigger-closure"]').click();
    await page.locator('[data-testid="button-closure-subtab-signoff"]').click();

    // The signoff sub-tab renders either an approval list or the "request sign-off" prompt
    await expect(
      page.getByText(/Sign-off|Approval/i).first(),
    ).toBeVisible();
  });
});
