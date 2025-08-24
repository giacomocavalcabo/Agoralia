import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge')
  })

  test('should not display raw i18n keys', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    
    const visibleText = await page.locator('body').textContent()
    const i18nKeyPattern = /\b[a-z]+(\.[a-z0-9_-]+){1,}\b/
    const hasRawKeys = i18nKeyPattern.test(visibleText)
    
    expect(hasRawKeys).toBe(false)
  })

  test('search filters update table', async ({ page }) => {
    const searchInput = page.locator('[data-testid="kb-search"]')
    await searchInput.fill('test')
    
    // Should show filtered results or empty state
    await expect(page.locator('[data-testid="kb-table"]')).toBeVisible()
  })

  test('bulk delete shows confirm dialog', async ({ page }) => {
    const firstRow = page.locator('[data-testid="kb-row"]').first()
    await firstRow.locator('[data-testid="select-checkbox"]').check()
    
    const deleteButton = page.locator('[data-testid="bulk-delete"]')
    await deleteButton.click()
    
    await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()
  })

  test('takes screenshot', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    await page.screenshot({ path: 'kb-overview.png', fullPage: true })
  })
})
