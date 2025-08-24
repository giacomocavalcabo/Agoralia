import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Assignments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge/assignments')
  })

  test('assigns KB with confirm dialog', async ({ page }) => {
    const assignSelect = page.locator('[data-testid="assign-select"]').first()
    await assignSelect.selectOption('kb-1')
    
    await expect(page.locator('[data-testid="assign-confirm"]')).toBeVisible()
  })

  test('shows success toast on assignment', async ({ page }) => {
    const assignSelect = page.locator('[data-testid="assign-select"]').first()
    await assignSelect.selectOption('kb-1')
    
    const confirmButton = page.locator('[data-testid="confirm-button"]')
    await confirmButton.click()
    
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible()
  })

  test('takes screenshot', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    await page.screenshot({ path: 'kb-assignments.png', fullPage: true })
  })
})
