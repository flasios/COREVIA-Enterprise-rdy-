import { expect, test } from '@playwright/test';

import { loginViaUi } from './helpers/auth';

test.describe('Enterprise readiness routes', () => {
  test('PMO governance links to the dedicated demand intake dashboard', async ({ page }) => {
    await loginViaUi(page, '/pmo-office');

    await page.getByRole('button', { name: 'Governance' }).click();
    await expect(page.getByRole('heading', { name: 'Governance Command Center' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Demand Intake Governance/i })).toBeVisible();

    await page.getByRole('link', { name: /Demand Intake Governance/i }).click();

    await expect(page).toHaveURL(/\/demand-intake/);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Demand Intake');
  });

  test('intelligent workspace shell opens for an authenticated user', async ({ page }) => {
    await loginViaUi(page, '/intelligent-workspace');

    await expect(page).toHaveURL(/\/intelligent-workspace/);
    await expect(page.getByText('Governed Operations Console')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'AI work hub' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbox Copilot' })).toBeVisible();
  });
});