import { test, expect } from '@playwright/test'

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard (assuming authentication is handled)
    await page.goto('/')
  })

  test('should not display raw i18n keys', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('h1', { timeout: 10000 })
    
    // Get all visible text
    const visibleText = await page.locator('body').textContent()
    
    // Check for i18n key patterns (e.g., dashboard.metrics.calls_today)
    const i18nKeyPattern = /\b[a-z]+(\.[a-z0-9_-]+){1,}\b/
    const hasRawKeys = i18nKeyPattern.test(visibleText)
    
    expect(hasRawKeys).toBe(false)
  })

  test('should format numbers per locale', async ({ page }) => {
    // Check if numbers are properly formatted
    const kpiCard = page.locator('[data-testid="kpi-card"]').first()
    const value = await kpiCard.locator('[data-testid="kpi-value"]').textContent()
    
    // Should be a number, not raw data
    expect(value).toMatch(/^\d+$/)
  })

  test('should take screenshot', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    await page.screenshot({ path: 'dashboard.png', fullPage: true })
  })
})
