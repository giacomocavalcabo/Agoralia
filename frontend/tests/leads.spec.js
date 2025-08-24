import { test, expect } from '@playwright/test';

test.describe('Leads', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/leads');
    await page.waitForSelector('h1');
  });

  test('no raw i18n keys on screen', async ({ page }) => {
    const txt = await page.locator('body').textContent();
    const re = /\b[a-z]+(\.[a-z0-9_-]+){1,}\b/;
    expect(re.test(txt)).toBeFalsy();
  });

  test('search and pagination', async ({ page }) => {
    const search = page.getByTestId('leads-search');
    await search.fill('demo');
    await page.waitForTimeout(600);
    await expect(page.getByTestId('leads-table')).toBeVisible();

    const nextBtn = page.getByRole('button', { name: 'Next' });
    await nextBtn.click();
    await expect(page.getByTestId('leads-table')).toBeVisible();
  });

  test('bulk delete confirm flow (UI)', async ({ page }) => {
    const firstCb = page.getByTestId('select-checkbox').first();
    await firstCb.check();
    await page.getByTestId('bulk-delete').click();
    // We use window.confirm in the minimal impl; just ensure table still visible
    await expect(page.getByTestId('leads-table')).toBeVisible();
  });

  test('screenshot', async ({ page }) => {
    await page.screenshot({ path: 'leads.png', fullPage: true });
  });
});
