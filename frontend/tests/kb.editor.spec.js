import { test, expect } from '@playwright/test'

test.describe('Knowledge Base Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/knowledge/company/new')
  })

  test('saves on Ctrl/Cmd+S', async ({ page }) => {
    const titleInput = page.locator('[data-testid="kb-title"]')
    await titleInput.fill('Test KB')
    
    // Trigger Ctrl+S
    await page.keyboard.press('Control+S')
    
    await expect(page.locator('[data-testid="save-toast"]')).toBeVisible()
  })

  test('shows unsaved changes guard', async ({ page }) => {
    const titleInput = page.locator('[data-testid="kb-title"]')
    await titleInput.fill('Test KB')
    
    // Try to navigate away
    await page.click('[data-testid="back-button"]')
    
    await expect(page.locator('[data-testid="unsaved-guard"]')).toBeVisible()
  })

  test('takes screenshot', async ({ page }) => {
    await page.waitForSelector('h1', { timeout: 10000 })
    await page.screenshot({ path: 'kb-editor.png', fullPage: true })
  })
})
