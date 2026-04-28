import { expect, test } from '@playwright/test';

import { loginViaUi } from './helpers/auth';

test.describe('Authenticated Business Flows', () => {
  test('opens user management for an authenticated user', async ({ page }) => {
    await loginViaUi(page, '/admin/users');

    await expect(page.getByTestId('text-page-title')).toBeVisible();
    await expect(page.getByTestId('card-stats-total')).toBeVisible();
    await expect(page.getByTestId('input-search-users')).toBeVisible();
  });

  test('opens team management for an authenticated user', async ({ page }) => {
    await loginViaUi(page, '/admin/teams');

    await expect(page).toHaveURL(/\/admin\/teams/);
    await expect(page.getByRole('heading', { name: 'Team Management' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Team' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search teams...' })).toBeVisible();
  });

  test('opens the EA application registry after login', async ({ page }) => {
    await loginViaUi(page, '/ea-registry/applications');

    await expect(page).toHaveURL(/\/ea-registry\/applications/);
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Applications');
    await expect(
      page.getByRole('button', { name: /register (application|first application)/i }).first(),
    ).toBeVisible();
  });
});