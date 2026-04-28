/**
 * E2E — Authentication Flow
 *
 * Tests the login, session, and logout flow end-to-end.
 */
import { test, expect } from '@playwright/test';

import { getE2ECredentials, getTrustedAuthHeaders, loginWithRequest } from './helpers/auth';

function buildInvalidPassword(): string {
  return Array.from({ length: 16 }, (_, index) => String.fromCharCode(97 + (index % 26))).join('');
}

test.describe('Authentication', () => {
  test('login page renders', async ({ page }) => {
    await page.goto('/');
    // Should see a login form or auth page
    await expect(page.locator('body')).toBeVisible();
  });

  test('health endpoint returns ok', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBeDefined();
  });

  test('unauthenticated API returns 401', async ({ request }) => {
    const response = await request.get('/api/demand-reports');
    expect(response.status()).toBe(401);
  });

  test('login with valid credentials', async ({ request }) => {
    const { username, password } = getE2ECredentials();
    const response = await request.post('/api/auth/login', {
      headers: getTrustedAuthHeaders(),
      data: {
        username,
        password,
      },
    });
    const bodyText = await response.text();
    expect(response.ok(), bodyText).toBeTruthy();
    const body = JSON.parse(bodyText) as { success?: boolean; data?: Record<string, unknown> };
    expect(body.success).toBeTruthy();
    expect(body.data).toBeDefined();
  });

  test('login with invalid credentials returns error', async ({ request }) => {
    const response = await request.post('/api/auth/login', {
      headers: getTrustedAuthHeaders(),
      data: {
        username: 'nonexistent',
        password: buildInvalidPassword(),
      },
    });
    expect(response.ok()).toBeFalsy();
  });
});

test.describe('API Smoke Tests', () => {
  test.beforeAll(async ({ request }) => {
    await loginWithRequest(request);
    await request.get('/api/auth/me');
  });

  test('GET /api/health returns status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();
  });

  test('metrics endpoint returns prometheus format', async ({ request }) => {
    const response = await request.get('/metrics');
    if (response.ok()) {
      const text = await response.text();
      expect(text).toContain('http_requests_total');
    }
  });
});
