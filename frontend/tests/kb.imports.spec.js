import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Imports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge/imports')
  })

  test('walks through import stepper', async ({ page }) => {
    const newImportButton = page.locator('[data-testid="new-import"]')
    await newImportButton.click()
    
    // Should show stepper
    await expect(page.locator('[data-testid="import-stepper"]')).toBeVisible()
    
    // Step 1: Upload
    await expect(page.locator('[data-testid="step-upload"]')).toBeVisible()
  })

  test('downloads error report on validation errors', async ({ page }) => {
    // Navigate to validation step with errors
    await page.goto('/knowledge/imports?step=validate&errors=true')
    
    const downloadButton = page.locator('[data-testid="download-report"]')
    await expect(downloadButton).toBeVisible()
  })

  test('takes screenshot', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    await page.screenshot({ path: 'kb-imports.png', fullPage: true })
  })
})
