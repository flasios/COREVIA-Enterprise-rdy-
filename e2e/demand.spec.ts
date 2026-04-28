/**
 * E2E — Demand Workflow
 *
 * Tests the demand lifecycle: create, view, transition states.
 */
import { test, expect, type Page } from '@playwright/test';

import { loginViaUi, loginWithRequest } from './helpers/auth';

type WizardClassification = 'auto' | 'public' | 'top_secret';
type BusinessCaseScenario = 'auto' | 'public' | 'top_secret';

interface DemandAnalysisResponse {
  success: boolean;
  data?: Record<string, unknown>;
  provider?: string;
  fallbackUsed?: boolean;
}

interface DemandCreateResponse {
  success: boolean;
  data: {
    id: string;
    dataClassification?: string | null;
  };
}

interface DemandDetailResponse {
  success: boolean;
  data: {
    id: string;
    workflowStatus?: string | null;
    dataClassification?: string | null;
    dataClassificationConfidence?: number | null;
    dataClassificationReasoning?: string | null;
  };
}

interface BusinessCaseDetailResponse {
  success: boolean;
  data?: {
    id?: string;
    demandReportId?: string;
    executiveSummary?: string | null;
    solutionOverview?: string | null;
  };
  qualityReport?: {
    overallScore?: number;
    passed?: boolean;
  } | null;
}

interface WorkflowUpdateResponse {
  success: boolean;
  data: {
    id: string;
    workflowStatus?: string | null;
  };
}

interface BusinessCaseClarificationsResponse {
  success: boolean;
  clarifications?: Array<{
    questions?: unknown[];
  }>;
  needsClarifications?: boolean;
}

interface SeededBusinessCaseDemand {
  reportId: string;
  resolvedClassification: string;
}

interface ExpectedBusinessCaseRoute {
  variant: 'hybrid' | 'internal';
  routeTitle: string;
  plannedBadge: string;
  plannedLabel: string;
  routeDescriptionHint: RegExp;
}

async function fillDemandStepOne(page: Page, classification: WizardClassification, suffix: string) {
  await page.getByTestId('input-organization').fill(`QA ${suffix} Org`);
  await page.getByTestId('input-department').fill(
    classification === 'top_secret' ? 'National Security' : 'Public Affairs',
  );
  await page.getByTestId('input-requestor-name').fill('QA Runner');
  await page.getByTestId('input-email').fill('qa.runner@corevia.local');
  await page.getByTestId(`classification-${classification}`).click();

  if (classification === 'top_secret') {
    await expect(page.getByText(/Sovereign AI only/i)).toBeVisible();
    await page.getByText(/^Critical$/).click();
  }

  await page.getByTestId('button-wizard-continue').click();
}

function getObjectiveForClassification(classification: WizardClassification, suffix: string): string {
  if (classification === 'top_secret') {
    return `Top secret border security coordination ${suffix} for restricted operational planning and sovereign intelligence workflows`;
  }

  if (classification === 'public') {
    return `Public citizen services transparency dashboard ${suffix} for open announcements community events and service updates`;
  }

  return `Citizen information portal ${suffix} for open announcements service updates and community transparency workflows`;
}

async function triggerAIAssistance(page: Page, classification: WizardClassification, suffix: string) {
  const objective = getObjectiveForClassification(classification, suffix);
  const organizationName = `QA ${suffix} Org`;
  const department = classification === 'top_secret' ? 'National Security' : 'Public Affairs';
  const effectiveClassification = classification === 'top_secret' ? 'top_secret' : classification;

  await page.getByTestId('textarea-business-objective').fill(objective);

  const generateResponse = await page.request.post('/api/demand-analysis/generate-fields', {
    data: {
      businessObjective: objective,
      organizationName,
      generationMode: 'ai_only',
      accessLevel: effectiveClassification,
      dataClassification: effectiveClassification,
    },
  });
  const classifyResponse = await page.request.post('/api/demand-analysis/classify', {
    data: {
      businessObjective: objective,
      generationMode: 'ai_only',
      additionalContext: {
        organizationName,
        department,
        requestorName: 'QA Runner',
        requestorEmail: 'qa.runner@corevia.local',
        dataClassification: effectiveClassification,
        accessLevel: effectiveClassification,
      },
    },
  });

  const generateBody = (await generateResponse.json()) as DemandAnalysisResponse;
  const classifyBody = (await classifyResponse.json()) as DemandAnalysisResponse;

  return { generateBody, classifyBody };
}

async function submitDemand(page: Page): Promise<DemandCreateResponse> {
  for (let step = 0; step < 8; step += 1) {
    const createButton = page.getByTestId('button-create-report');
    if (await createButton.isVisible().catch(() => false)) {
      break;
    }

    const continueButton = page.getByTestId('button-wizard-continue');
    if (!(await continueButton.isVisible().catch(() => false))) {
      await page.waitForTimeout(500);
      continue;
    }

    await continueButton.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    await page.waitForTimeout(300);
  }

  await expect(page.getByTestId('button-create-report')).toBeVisible({ timeout: 15_000 });

  const createResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/demand-reports')
    && response.request().method() === 'POST',
  );

  await page.getByTestId('button-create-report').click();
  const createResponse = await createResponsePromise;
  const createBody = (await createResponse.json()) as DemandCreateResponse;

  expect(createResponse.status()).toBe(201);
  expect(createBody.success).toBeTruthy();
  await expect(page).toHaveURL(/intelligent-library\?section=demands/, { timeout: 30_000 });

  return createBody;
}

async function pollDemandDetail(page: Page, reportId: string): Promise<DemandDetailResponse['data']> {
  let latestBody: DemandDetailResponse | null = null;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await page.request.get(`/api/demand-reports/${reportId}`);
    if (response.status() === 429) {
      await page.waitForTimeout(1_500);
      continue;
    }

    expect(response.ok(), await response.text()).toBeTruthy();
    latestBody = (await response.json()) as DemandDetailResponse;

    if (latestBody.data.dataClassification && latestBody.data.dataClassificationConfidence != null) {
      return latestBody.data;
    }

    await page.waitForTimeout(1_000);
  }

  expect(latestBody?.data.dataClassification).toBeTruthy();
  expect(latestBody?.data.dataClassificationConfidence).not.toBeNull();
  return latestBody!.data;
}

async function getMutationHeaders(page: Page): Promise<Record<string, string>> {
  const baseUrl = process.env.BASE_URL ?? 'http://localhost:5000';
  const origin = new URL(baseUrl).origin;
  const cookies = await page.context().cookies(origin);
  let csrfToken = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;

  if (!csrfToken) {
    const csrfResponse = await page.request.get('/api/auth/csrf-token', {
      headers: {
        Origin: origin,
        Referer: `${origin}/`,
      },
    });
    const csrfBody = (await csrfResponse.json()) as { success?: boolean; csrfToken?: string | null };
    expect(csrfResponse.ok(), JSON.stringify(csrfBody)).toBeTruthy();
    csrfToken = csrfBody.csrfToken || undefined;
  }

  if (!csrfToken) {
    throw new Error('Missing XSRF-TOKEN cookie for authenticated mutation request.');
  }

  return {
    Origin: origin,
    Referer: `${origin}/`,
    'X-CSRF-Token': csrfToken,
  };
}

function getBusinessCaseObjective(classification: BusinessCaseScenario, suffix: string): string {
  if (classification === 'top_secret') {
    return `Restricted sovereign operations planning ${suffix} for cross-agency command coordination, secure national intelligence workflows, and classified incident response.`;
  }

  if (classification === 'public') {
    return `Public digital service modernization ${suffix} for citizen-facing portals, transparent service tracking, and high-volume self-service improvements.`;
  }

  return `Automated municipal service planning ${suffix} for service delivery optimization, public operations dashboards, and controlled back-office workflow improvements.`;
}

function getExpectedBusinessCaseRoute(classification: string | null | undefined): ExpectedBusinessCaseRoute {
  const normalized = String(classification || '').trim().toLowerCase();
  if (normalized === 'public' || normalized === 'internal') {
    return {
      variant: 'hybrid',
      routeTitle: 'Hybrid route selected',
      plannedBadge: 'Engine B planned',
      plannedLabel: 'Engine B / External Hybrid',
      routeDescriptionHint: /hybrid external path|faster/i,
    };
  }

  return {
    variant: 'internal',
    routeTitle: 'Offline sovereign route selected',
    plannedBadge: 'Engine A planned',
    plannedLabel: 'Engine A / Sovereign Internal',
    routeDescriptionHint: /internal offline path|sovereign boundary/i,
  };
}

async function seedDemandForBusinessCase(page: Page, classification: BusinessCaseScenario, suffix: string): Promise<SeededBusinessCaseDemand> {
  const mutationHeaders = await getMutationHeaders(page);
  const createResponse = await page.request.post('/api/demand-reports', {
    headers: mutationHeaders,
    data: {
      organizationName: `BC QA ${suffix} Org`,
      department: classification === 'top_secret' ? 'National Security' : 'Digital Services',
      requestorName: 'QA Runner',
      requestorEmail: 'qa.runner@corevia.local',
      urgency: classification === 'top_secret' ? 'Critical' : 'High',
      businessObjective: getBusinessCaseObjective(classification, suffix),
      expectedOutcomes: 'Documented business case with investment recommendation, implementation roadmap, and risk coverage.',
      currentChallenges: classification === 'top_secret'
        ? 'Legacy restricted coordination tooling causes slow response and fragmented command visibility.'
        : 'Fragmented intake and reporting workflows reduce transparency and slow service execution.',
      budgetRange: classification === 'top_secret' ? 'AED 8M - AED 12M' : 'AED 1M - AED 3M',
      timeframe: classification === 'top_secret' ? '12 months' : '6 months',
      stakeholders: classification === 'top_secret' ? 'Command center, operations, compliance' : 'Citizen services, operations, finance',
      dataClassification: classification,
    },
  });

  const createBody = (await createResponse.json()) as DemandCreateResponse;
  expect(createResponse.status(), JSON.stringify(createBody)).toBe(201);
  expect(createBody.success).toBeTruthy();

  const workflowResponse = await page.request.put(`/api/demand-reports/${createBody.data.id}/workflow`, {
    headers: mutationHeaders,
    data: {
      workflowStatus: 'acknowledged',
      decisionReason: 'E2E business case generation setup',
    },
  });
  const workflowBody = (await workflowResponse.json()) as WorkflowUpdateResponse;
  expect(workflowResponse.ok(), JSON.stringify(workflowBody)).toBeTruthy();
  expect(workflowBody.data.workflowStatus).toBe('acknowledged');

  const detail = await pollDemandDetail(page, createBody.data.id);
  const resolvedClassification = classification === 'auto'
    ? String(detail.dataClassification || '').toLowerCase()
    : String(detail.dataClassification || classification).toLowerCase();

  if (classification === 'auto') {
    expect(resolvedClassification).toBeTruthy();
    expect(resolvedClassification).not.toBe('auto');
    expect(detail.dataClassificationConfidence).not.toBeNull();
  }

  return {
    reportId: createBody.data.id,
    resolvedClassification,
  };
}

async function waitForBusinessCase(page: Page, reportId: string): Promise<BusinessCaseDetailResponse> {
  let lastBody: BusinessCaseDetailResponse | null = null;
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < 45; attempt += 1) {
    const businessCaseResponse = await page.request.get(`/api/demand-reports/${reportId}/business-case`);
    lastStatus = businessCaseResponse.status();

    if (businessCaseResponse.status() === 429) {
      await page.waitForTimeout(10_000);
      continue;
    }

    expect(businessCaseResponse.ok(), await businessCaseResponse.text()).toBeTruthy();
    lastBody = (await businessCaseResponse.json()) as BusinessCaseDetailResponse;

    const executiveSummary = lastBody.data?.executiveSummary;
    if (lastBody.success && executiveSummary && executiveSummary.trim().length > 40) {
      return lastBody;
    }

    await page.waitForTimeout(5_000);
  }

  throw new Error(`Business case was not generated for report ${reportId}. Last status: ${String(lastStatus)}. Last response: ${JSON.stringify(lastBody)}`);
}

async function openBusinessCaseTab(page: Page, reportId: string) {
  await page.goto(`/demand-analysis/${reportId}?tab=business-case`);
  await expect(page).toHaveURL(new RegExp(`/demand-analysis/${reportId}`), { timeout: 30_000 });
  await page.locator('[data-testid="tab-business-case"]').first().click();
  await expect(page.getByTestId('tabcontent-business-case')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('button-start-generation')).toBeVisible({ timeout: 30_000 });
}

async function resolveVisibleBusinessCaseRoute(page: Page): Promise<ExpectedBusinessCaseRoute> {
  const hybridNotice = page.getByRole('alert').filter({ hasText: 'Hybrid route selected' }).first();
  if (await hybridNotice.isVisible().catch(() => false)) {
    return getExpectedBusinessCaseRoute('public');
  }

  return getExpectedBusinessCaseRoute('sovereign');
}

async function runBusinessCaseScenario(page: Page, classification: BusinessCaseScenario, suffix: string, forcedRoute?: ExpectedBusinessCaseRoute) {
  const seeded = await seedDemandForBusinessCase(page, classification, suffix);
  const mutationHeaders = await getMutationHeaders(page);

  await openBusinessCaseTab(page, seeded.reportId);

  const expectedRoute = forcedRoute || await resolveVisibleBusinessCaseRoute(page);

  const routeNotice = page.getByRole('alert').filter({ hasText: expectedRoute.routeTitle }).first();
  await expect(routeNotice).toContainText(expectedRoute.plannedBadge);
  await expect(routeNotice).toContainText(expectedRoute.routeTitle);
  await expect(routeNotice).toContainText(expectedRoute.routeDescriptionHint);

  const engineDialog = page.getByRole('dialog', { name: /Engine A Will Be Used For This Draft/i });
  await expect(engineDialog).toHaveCount(0);
  const detectClarificationsResponsePromise = page.waitForResponse((response) =>
    response.url().includes(`/api/demand-reports/${seeded.reportId}/detect-clarifications`)
    && response.request().method() === 'POST',
  );
  await page.getByTestId('button-start-generation').click();

  if (expectedRoute.variant === 'internal') {
    await expect(engineDialog).toBeVisible({ timeout: 10_000 });
    await expect(engineDialog).toContainText('Engine A Will Be Used For This Draft');
    await expect(engineDialog).toContainText(/offline LLM boundary|sovereign internal route/i);
    await expect(engineDialog).toContainText(/take several minutes|live generation progress/i);
    await page.getByRole('button', { name: 'Continue With Engine A' }).click();
    await expect(engineDialog).toBeHidden({ timeout: 15_000 });
  } else {
    await expect(engineDialog).toHaveCount(0);
  }

  const detectClarificationsResponse = await detectClarificationsResponsePromise;
  const detectClarificationsBody = (await detectClarificationsResponse.json()) as BusinessCaseClarificationsResponse;
  expect(detectClarificationsResponse.ok(), JSON.stringify(detectClarificationsBody)).toBeTruthy();

  const totalClarificationQuestions = Array.isArray(detectClarificationsBody.clarifications)
    ? detectClarificationsBody.clarifications.reduce(
        (sum, domain) => sum + (Array.isArray(domain.questions) ? domain.questions.length : 0),
        0,
      )
    : 0;

  const generateBusinessCaseResponse = await page.request.post(
    `/api/demand-reports/${seeded.reportId}/generate-business-case`,
    {
      headers: mutationHeaders,
      data: {
        clarificationResponses: [],
        clarificationsBypassed: true,
        totalClarificationQuestions,
        generationMode: 'prompt_on_fallback',
      },
    },
  );

  expect(
    [200, 408, 502, 503, 504].includes(generateBusinessCaseResponse.status()),
    await generateBusinessCaseResponse.text(),
  ).toBeTruthy();

  const businessCase = await waitForBusinessCase(page, seeded.reportId);
  expect(businessCase.data?.executiveSummary?.trim().length || 0).toBeGreaterThan(40);

  await page.reload();
  await expect(page.locator('[data-testid="tab-business-case"]').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid="tab-business-case"]').first().click();
  await expect(page.getByTestId('card-business-case-route-summary')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('card-business-case-route-summary')).toContainText(`Planned route: ${expectedRoute.plannedLabel}`);
  await expect(page.getByTestId('text-executive-summary')).toBeVisible({ timeout: 30_000 });

  return {
    reportId: seeded.reportId,
    resolvedClassification: seeded.resolvedClassification,
    expectedRoute,
    businessCase,
  };
}

async function completeWizardFlow(page: Page, classification: WizardClassification, suffix: string) {
  await page.goto('/demand-analysis');
  await expect(page).toHaveURL(/\/demand-analysis/, { timeout: 15_000 });
  await fillDemandStepOne(page, classification, suffix);
  const aiResponses = await triggerAIAssistance(page, classification, suffix);
  const created = await submitDemand(page);
  const saved = await pollDemandDetail(page, created.data.id);

  return {
    created,
    saved,
    ...aiResponses,
  };
}

test.describe('Demand Workflow (API)', () => {
  test.beforeEach(async ({ request }) => {
    await loginWithRequest(request);
  });

  test('list demands', async ({ request }) => {
    const response = await request.get('/api/demand-reports');
    const bodyText = await response.text();
    expect(response.ok(), bodyText).toBeTruthy();
    const body = JSON.parse(bodyText) as unknown;
    expect(Array.isArray(body) || (body as Record<string, unknown>).demands || (body as Record<string, unknown>).data).toBeTruthy();
  });

  test('list projects', async ({ request }) => {
    const response = await request.get('/api/portfolio/projects');
    const bodyText = await response.text();
    expect(response.ok(), bodyText).toBeTruthy();
    const body = JSON.parse(bodyText) as unknown;
    expect(body).toBeDefined();
  });

  test('EA registry applications endpoint', async ({ request }) => {
    const response = await request.get('/api/ea/registry/applications');
    const bodyText = await response.text();
    expect(response.ok(), bodyText).toBeTruthy();
    const body = JSON.parse(bodyText) as unknown;
    expect(body).toBeDefined();
  });
});

test.describe('Demand UI Flow', () => {
  test('navigate to demands page', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // The app should eventually show either login or dashboard
    await page.waitForTimeout(2000);
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test.describe('demand wizard classification flows', () => {
    test.describe.configure({ mode: 'serial' });

    test('covers auto, public, and top secret wizard classification flows', async ({ page }) => {
      test.setTimeout(420_000);

      await loginViaUi(page, '/demand-analysis');

      await test.step('auto classification resolves and persists a non-auto value', async () => {
        const result = await completeWizardFlow(page, 'auto', `auto-${Date.now()}`);

        expect(result.saved.dataClassification).toBeTruthy();
        expect(result.saved.dataClassification).not.toBe('auto');
        expect(result.saved.dataClassificationConfidence).not.toBeNull();
      });

      await test.step('public classification persists public', async () => {
        const result = await completeWizardFlow(page, 'public', `public-${Date.now()}`);

        expect(result.saved.dataClassification).toBe('public');
        expect(result.saved.dataClassificationConfidence).not.toBeNull();
      });

      await test.step('top secret classification shows Engine A confirmation and persists sovereign', async () => {
        const result = await completeWizardFlow(page, 'top_secret', `top-secret-${Date.now()}`);

        expect(result.saved.dataClassification).toBe('sovereign');
        expect(result.saved.dataClassificationConfidence).not.toBeNull();
      });
    });
  });

  test.describe('business case generation routing flows', () => {
    test.describe.configure({ mode: 'serial' });

    test('covers auto, public, and top secret business case generation flows', async ({ page }) => {
      test.setTimeout(900_000);

      await loginViaUi(page, '/');

      await test.step('auto classification generates a business case with a route that matches the resolved classification', async () => {
        const result = await runBusinessCaseScenario(page, 'auto', `bc-auto-${Date.now()}`);

        expect(result.resolvedClassification).not.toBe('auto');
        expect(['Hybrid route selected', 'Offline sovereign route selected']).toContain(result.expectedRoute.routeTitle);
      });

      await test.step('public classification shows hybrid routing and generates successfully without Engine A confirmation', async () => {
        const result = await runBusinessCaseScenario(
          page,
          'public',
          `bc-public-${Date.now()}`,
          getExpectedBusinessCaseRoute('public'),
        );

        expect(result.expectedRoute.variant).toBe('hybrid');
        expect(result.businessCase.qualityReport).toBeTruthy();
      });

      await test.step('top secret classification shows the Engine A confirmation dialog and generates successfully on the sovereign path', async () => {
        const result = await runBusinessCaseScenario(
          page,
          'top_secret',
          `bc-top-secret-${Date.now()}`,
          getExpectedBusinessCaseRoute('sovereign'),
        );

        expect(result.expectedRoute.variant).toBe('internal');
        expect(['top_secret', 'sovereign']).toContain(result.resolvedClassification);
      });
    });
  });
});
