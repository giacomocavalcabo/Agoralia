import { test, expect } from '@playwright/test'

test.describe('Import Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication for testing
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'test-token')
      window.localStorage.setItem('user_role', 'admin')
    })
    
    await page.goto('/import')
  })

  test('should display complete wizard with all steps', async ({ page }) => {
    // Check that all 6 steps are visible in progress bar
    const steps = page.locator('[data-testid="progress-step"]')
    await expect(steps).toHaveCount(6)
    
    // Verify step labels
    await expect(page.getByText('Raw data')).toBeVisible()
    await expect(page.getByText('Field mapping')).toBeVisible()
    await expect(page.getByText('Select rows')).toBeVisible()
    await expect(page.getByText('Agoralia attributes')).toBeVisible()
    await expect(page.getByText('Legal review')).toBeVisible()
    await expect(page.getByText('Confirm & import')).toBeVisible()
  })

  test('should handle CSV upload and parsing', async ({ page }) => {
    // Create a test CSV file
    const csvContent = 'name,phone,email\nJohn Doe,+1234567890,john@example.com\nJane Smith,+0987654321,jane@example.com'
    
    // Mock file upload
    await page.setInputFiles('input[type="file"]', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csvContent)
    })
    
    // Wait for parsing to complete
    await expect(page.getByText('2 rows detected')).toBeVisible()
    
    // Check that mapping step is accessible
    await page.click('button:has-text("Continue")')
    await expect(page.getByText('Map fields')).toBeVisible()
  })

  test('should handle field mapping correctly', async ({ page }) => {
    // Navigate to mapping step (assuming CSV is already uploaded)
    await page.goto('/import?step=mapping')
    
    // Check that required fields are highlighted
    await expect(page.getByText('Required')).toBeVisible()
    
    // Verify phone and name are marked as required
    const requiredFields = page.locator('.required-field')
    await expect(requiredFields).toHaveCount(2)
    
    // Check auto-mapping works
    await page.click('button:has-text("Auto-map")')
    await expect(page.getByText('Auto-detected')).toBeVisible()
  })

  test('should allow row selection in subset step', async ({ page }) => {
    await page.goto('/import?step=subset')
    
    // Check that all rows are selected by default
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes).toHaveCount(3) // 2 data rows + select all
    
    // Verify select all functionality
    await page.click('button:has-text("Select all")')
    const selectedCount = page.locator('text=2 selected')
    await expect(selectedCount).toBeVisible()
    
    // Test individual row selection
    const firstRowCheckbox = page.locator('input[type="checkbox"]').nth(1)
    await firstRowCheckbox.uncheck()
    await expect(page.locator('text=1 selected')).toBeVisible()
  })

  test('should handle bulk attribute setting', async ({ page }) => {
    await page.goto('/import?step=attributes')
    
    // Select some rows first
    const checkboxes = page.locator('input[type="checkbox"]').nth(1)
    await checkboxes.check()
    
    // Test bulk setting contact class
    await page.selectOption('select:has-text("Select field")', 'contact_class')
    await page.selectOption('select:has-text("Select value")', 'b2b')
    await page.click('button:has-text("Set")')
    
    // Verify the change was applied
    await expect(page.locator('select[value="b2b"]')).toBeVisible()
  })

  test('should show compliance classification in legal review', async ({ page }) => {
    await page.goto('/import?step=review')
    
    // Check legend is visible
    await expect(page.getByText('🟢 Allowed • 🟡 Conditional • 🔴 Blocked')).toBeVisible()
    
    // Verify statistics are displayed
    await expect(page.locator('text=Allowed')).toBeVisible()
    await expect(page.locator('text=Conditional')).toBeVisible()
    await expect(page.locator('text=Blocked')).toBeVisible()
    
    // Check that category chips are colored correctly
    const allowedChip = page.locator('.bg-green-100')
    const conditionalChip = page.locator('.bg-amber-100')
    const blockedChip = page.locator('.bg-red-100')
    
    await expect(allowedChip).toBeVisible()
    await expect(conditionalChip).toBeVisible()
    // blockedChip might not be visible if no blocked contacts
  })

  test('should prevent proceeding with blocked contacts', async ({ page }) => {
    await page.goto('/import?step=review')
    
    // If there are blocked contacts, the next button should be disabled
    const nextButton = page.locator('button:has-text("Continue")')
    
    // Check if blocked contacts exist
    const blockedCount = page.locator('.bg-red-50 .text-2xl')
    const blockedText = await blockedCount.textContent()
    
    if (parseInt(blockedText) > 0) {
      await expect(nextButton).toBeDisabled()
      await expect(page.getByText('Cannot proceed - blocked contacts')).toBeVisible()
    } else {
      await expect(nextButton).toBeEnabled()
    }
  })

  test('should handle i18n switching correctly', async ({ page }) => {
    // Switch to Italian
    await page.click('[data-testid="language-switcher"]')
    await page.click('text=Italiano')
    
    // Verify Italian translations
    await expect(page.getByText('Importa')).toBeVisible()
    await expect(page.getByText('Dati grezzi')).toBeVisible()
    await expect(page.getByText('Mappatura campi')).toBeVisible()
    
    // Switch back to English
    await page.click('[data-testid="language-switcher"]')
    await page.click('text=English')
    
    // Verify English translations
    await expect(page.getByText('Import')).toBeVisible()
    await expect(page.getByText('Raw data')).toBeVisible()
    await expect(page.getByText('Field mapping')).toBeVisible()
  })

  test('should support deep linking to specific steps', async ({ page }) => {
    // Test deep link to mapping step
    await page.goto('/import?step=mapping')
    await expect(page.getByText('Map fields')).toBeVisible()
    
    // Test deep link to subset step
    await page.goto('/import?step=subset')
    await expect(page.getByText('Select rows to import')).toBeVisible()
    
    // Test deep link to attributes step
    await page.goto('/import?step=attributes')
    await expect(page.getByText('Agoralia attributes')).toBeVisible()
  })

  test('should handle CSV parsing errors gracefully', async ({ page }) => {
    // Create invalid CSV content
    const invalidCsv = 'invalid,csv,content\nno,proper,structure'
    
    // Mock file upload with invalid content
    await page.setInputFiles('input[type="file"]', {
      name: 'invalid.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(invalidCsv)
    })
    
    // Check that error is displayed
    await expect(page.getByText(/error|invalid/i)).toBeVisible()
  })

  test('should show proper validation messages', async ({ page }) => {
    await page.goto('/import?step=mapping')
    
    // Try to proceed without required fields
    await page.click('button:has-text("Continue")')
    
    // Check validation message
    await expect(page.getByText(/required|missing/i)).toBeVisible()
  })
})
